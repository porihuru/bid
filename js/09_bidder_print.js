/* 
[JST 2026-01-31 00:10]  09_bidder_print.js v20260131-01
入札フォーム（入札者）- PDF出力（帳票デザイン版 / 最小依存）

反映要件:
  - 1番上: 「入札書」タイトル + 入札番号 + 作成年月日（状態は出さない）
  - 次: 宛先（左寄せ） to1/to2/to3（最終行に「御中」）
  - 次: 入札者（右寄せ）プロフィール（メール/住所/会社名/代表者名/担当者名/連絡先）
  - 入札概要: 左寄せ・1行表示（長い場合は同一行で折り返し）
  - 納入条件: 左寄せ・1行表示（長い場合は同一行で折り返し）
  - 明細: 見本列あり、合計金額なし、署名押印欄なし
制約:
  - bidder側は最小修正: このファイル(09)だけで完結（他JSに強依存しない）
  - 可能なら BidderState.state.bidHeader / BidderState.state.items を参照して PDFへ反映
  - 取れない場合は DOM から拾い、落ちずに動く
*/
(function(){
  "use strict";

  var FILE = "09_bidder_print.js";
  var VER  = "v20260131-01";
  var TS   = new Date().toISOString();

  function L(tag, msg){
    try{
      if(window.BidderLog && window.BidderLog.write) return window.BidderLog.write(tag, msg);
      if(window.BOOTLOG && window.BOOTLOG.write) return window.BOOTLOG.write(tag, msg);
      try{ console.log("[" + tag + "] " + msg); }catch(e){}
    }catch(ex){}
  }

  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });
  L("ver", TS + " " + FILE + " " + VER);

  // =========================================================
  // [PRN-01] util
  // =========================================================
  function $(id){
    try{ return document.getElementById(id); }catch(e){ return null; }
  }
  function trim(s){ return (s==null) ? "" : (""+s).replace(/^\s+|\s+$/g,""); }

  function getText(id){
    var el = $(id);
    if(!el) return "";
    try{ return trim(el.textContent || ""); }catch(e){ return ""; }
  }
  function getVal(id){
    var el = $(id);
    if(!el) return "";
    try{ return trim(el.value || ""); }catch(e){ return ""; }
  }
  function esc(s){
    s = (s==null) ? "" : (""+s);
    return s
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function pad2(n){ return (n<10) ? ("0"+n) : (""+n); }

  function fmtDateTime(d){
    try{
      var y = d.getFullYear();
      var m = pad2(d.getMonth()+1);
      var da= pad2(d.getDate());
      var hh= pad2(d.getHours());
      var mm= pad2(d.getMinutes());
      return y+"-"+m+"-"+da+" "+hh+":"+mm;
    }catch(e){ return ""; }
  }

  function fmtNowYmd(){
    try{
      var d = new Date();
      return d.getFullYear() + pad2(d.getMonth()+1) + pad2(d.getDate());
    }catch(e){ return "date"; }
  }

  function safeFileName(s){
    s = (s == null) ? "" : (""+s);
    return s.replace(/[\\\/:\*\?"<>\|]/g, "_");
  }

  function firstNonEmpty(arr){
    for(var i=0;i<arr.length;i++){
      var v = trim(arr[i]);
      if(v !== "") return v;
    }
    return "";
  }

  function normalizeSampleText(v){
    v = trim(v);
    if(v === "") return "—";
    var s = v.toLowerCase();
    if(s === "1" || s === "true" || v === "有" || v === "○") return "有";
    if(s === "0" || s === "false" || v === "無" || v === "×") return "無";
    if(v === "-" || v === "―") return "—";
    return v;
  }

  function makeOneLineLabel(label, value){
    value = trim(value);
    if(value === "") return "";
    return '<div class="oneLine"><span class="lbl">' + esc(label) + '：</span><span class="val">' + esc(value) + '</span></div>';
  }

  // =========================================================
  // [PRN-02] BidderState から「取れれば取る」(header/items)
  //  - 取れない場合でも落とさず、PDFは動かす
  // =========================================================
  function tryGetBidderState(){
    try{
      if(window.BidderState){
        if(typeof window.BidderState.get === "function"){
          return window.BidderState.get();
        }
        if(window.BidderState.state){
          return window.BidderState.state;
        }
      }
    }catch(e){}
    return null;
  }

  function tryGetBidHeaderObject(){
    try{
      var st = tryGetBidderState();
      if(st && st.bidHeader) return st.bidHeader;

      if(window.BidderState){
        if(typeof window.BidderState.getBidHeader === "function"){
          return window.BidderState.getBidHeader();
        }
        if(window.BidderState.bidHeader) return window.BidderState.bidHeader;
      }
    }catch(e){}
    return null;
  }

  function tryGetItemsObjectArray(){
    try{
      var st = tryGetBidderState();
      if(st && st.items && st.items.length) return st.items;

      if(window.BidderState){
        if(typeof window.BidderState.getItems === "function"){
          return window.BidderState.getItems();
        }
        if(window.BidderState.items && window.BidderState.items.length) return window.BidderState.items;
      }
    }catch(e){}
    return null;
  }

  function pick(obj, keys){
    for(var i=0;i<keys.length;i++){
      var k = keys[i];
      var v = (obj && obj[k] != null) ? (""+obj[k]) : "";
      v = trim(v);
      if(v !== "") return v;
    }
    return "";
  }

  function normalizeItem(it){
    // it がどんな形でも、印刷用に揃える
    var no    = pick(it, ["no","rowNo","seq","index","番号","id"]);
    var sample= pick(it, ["sample","見本"]);
    var name  = pick(it, ["name","itemName","品名"]);
    var spec  = pick(it, ["spec","規格"]);
    var qty   = pick(it, ["qty","quantity","予定数量"]);
    var unit  = pick(it, ["unit","単位"]);
    var price = pick(it, ["price","unitPrice","入札単価"]);
    var note  = pick(it, ["note","remark","備考"]);

    if(sample === "") sample = "—";

    return {
      no: no,
      sample: sample,
      name: name,
      spec: spec,
      qty: qty,
      unit: unit,
      price: price,
      note: note
    };
  }

  function scrapeItemsFromTable(){
    // 画面の tbodyItems から拾う（見本は画面に無い想定のため "—"）
    var items = [];
    var tbody = $("tbodyItems");
    if(!tbody) return items;

    var trs;
    try{ trs = tbody.getElementsByTagName("tr"); }catch(e){ trs = []; }

    for(var i=0;i<trs.length;i++){
      var tr = trs[i];
      var tds;
      try{ tds = tr.getElementsByTagName("td"); }catch(e2){ tds = null; }
      if(!tds || tds.length < 4) continue;

      // 期待: 0=番号, 1=品名/規格, 2=予定数量, 3=入札単価(input), 4=備考
      var no = trim((tds[0].textContent||""));
      var nameSpec = trim((tds[1].textContent||""));
      var qty = trim((tds[2].textContent||""));
      var unit = ""; // 画面列に無い運用が多い

      var price = "";
      try{
        var inp = tds[3].getElementsByTagName("input");
        if(inp && inp.length) price = trim(inp[0].value||"");
        else price = trim((tds[3].textContent||""));
      }catch(e3){
        price = trim((tds[3].textContent||""));
      }

      var note = "";
      try{
        var inp2 = tds[4] ? tds[4].getElementsByTagName("input") : null;
        if(inp2 && inp2.length) note = trim(inp2[0].value||"");
        else note = tds[4] ? trim((tds[4].textContent||"")) : "";
      }catch(e4){
        note = tds[4] ? trim((tds[4].textContent||"")) : "";
      }

      if(no === "" && nameSpec.indexOf("品目なし") >= 0) continue;

      items.push({
        no: no,
        sample: "—",
        name: nameSpec,
        spec: "",
        qty: qty,
        unit: unit,
        price: price,
        note: note
      });
    }
    return items;
  }

  // =========================================================
  // [PRN-03] 印刷用HTML生成
  // =========================================================
  function buildPrintHtml(data){
    var css = ''
      + '@page{ size:A4 portrait; margin:12mm 10mm 12mm 20mm; }'
      + 'html,body{ height:auto; }'
      + 'body{ font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans JP",sans-serif; color:#0f172a; background:#fff; }'
      + '.sheet{ width:100%; }'
      + '.top{ display:flex; align-items:flex-end; justify-content:space-between; gap:12px; padding-bottom:8px; border-bottom:2px solid #0f172a; }'
      + '.title{ font-size:20px; font-weight:800; letter-spacing:.06em; }'
      + '.meta{ text-align:right; font-size:11px; color:#334155; }'
      + '.meta .b{ font-weight:700; color:#0f172a; }'

      + '.section{ margin-top:10px; }'
      + '.secTitle{ font-size:12px; font-weight:800; color:#0f172a; letter-spacing:.08em; margin:0 0 6px 0; }'
      + '.box{ border:1px solid #cbd5e1; border-radius:10px; padding:10px; background:#fff; }'
      + '.toLine{ font-size:12px; line-height:1.6; }'

      + '.profileBox{ text-align:right; }'
      + '.profileName{ font-weight:800; font-size:13px; }'
      + '.profileLine{ font-size:12px; line-height:1.55; color:#0f172a; }'
      + '.profileSub{ color:#334155; }'

      + '.oneLine{ font-size:12px; line-height:1.6; margin:2px 0; }'
      + '.oneLine .lbl{ font-weight:700; color:#0f172a; }'
      + '.oneLine .val{ color:#0f172a; word-break:break-word; }'

      + '.itemsTitleRow{ display:flex; justify-content:space-between; align-items:flex-end; margin-top:12px; }'
      + '.itemsNote{ font-size:10px; color:#334155; }'

      + 'table{ width:100%; border-collapse:separate; border-spacing:0; margin-top:6px; }'
      + 'thead th{ font-size:11px; color:#0f172a; background:#f1f5f9; border-top:1px solid #cbd5e1; border-bottom:1px solid #cbd5e1; padding:8px 6px; }'
      + 'thead th:first-child{ border-left:1px solid #cbd5e1; border-top-left-radius:10px; }'
      + 'thead th:last-child{ border-right:1px solid #cbd5e1; border-top-right-radius:10px; }'

      + 'tbody td{ font-size:11.5px; border-bottom:1px solid #cbd5e1; padding:8px 6px; vertical-align:top; }'
      + 'tbody tr td:first-child{ border-left:1px solid #cbd5e1; }'
      + 'tbody tr td:last-child{ border-right:1px solid #cbd5e1; }'
      + 'tbody tr:last-child td:first-child{ border-bottom-left-radius:10px; }'
      + 'tbody tr:last-child td:last-child{ border-bottom-right-radius:10px; }'
      + 'tbody tr:last-child td{ border-bottom:1px solid #cbd5e1; }'

      + '.cNo{ width:14mm; text-align:right; font-weight:800; }'
      + '.cSample{ width:12mm; text-align:center; }'
      + '.cName{ width:auto; }'
      + '.cQty{ width:22mm; text-align:right; white-space:nowrap; }'
      + '.cUnit{ width:12mm; text-align:center; white-space:nowrap; }'
      + '.cPrice{ width:26mm; text-align:right; white-space:nowrap; }'
      + '.cNote{ width:26mm; }'
      + '.nameMain{ font-weight:800; }'
      + '.nameSpec{ margin-top:3px; color:#334155; font-size:10.5px; }'

      + '.footer{ margin-top:10px; display:flex; justify-content:space-between; color:#334155; font-size:10px; }'
      + '.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }'

      + '@media print{ .noPrint{ display:none !important; } }';

    // 宛先
    var toHtml = "";
    for(var i=0;i<data.toLines.length;i++){
      toHtml += '<div class="toLine">' + esc(data.toLines[i]) + '</div>';
    }

    // 入札者（右寄せ）
    var p = data.profile || {};
    var profLines = [];
    if(trim(p.company) !== "") profLines.push('<div class="profileName">' + esc(p.company) + '</div>');
    if(trim(p.address) !== "") profLines.push('<div class="profileLine profileSub">' + esc(p.address) + '</div>');
    if(trim(p.rep) !== "") profLines.push('<div class="profileLine">代表者名：' + esc(p.rep) + '</div>');
    if(trim(p.contact) !== "") profLines.push('<div class="profileLine">担当者名：' + esc(p.contact) + '</div>');
    if(trim(p.contactInfo) !== "") profLines.push('<div class="profileLine">連絡先　：' + esc(p.contactInfo) + '</div>');
    if(trim(p.email) !== "") profLines.push('<div class="profileLine">メール　：' + esc(p.email) + '</div>');
    if(!profLines.length) profLines.push('<div class="profileLine profileSub">（入札者情報が未入力です）</div>');

    // 明細
    var rows = "";
    for(i=0;i<data.items.length;i++){
      var it = data.items[i] || {};
      var sample = normalizeSampleText(it.sample);
      var nm = trim(it.name);
      var sp = trim(it.spec);

      var nameHtml = '<div class="nameMain">' + esc(nm || "") + '</div>';
      if(sp !== "") nameHtml += '<div class="nameSpec">' + esc(sp) + '</div>';

      rows += ''
        + '<tr>'
        + '<td class="cNo">' + esc(it.no || "") + '</td>'
        + '<td class="cSample">' + esc(sample) + '</td>'
        + '<td class="cName">' + nameHtml + '</td>'
        + '<td class="cQty">' + esc(it.qty || "") + '</td>'
        + '<td class="cUnit">' + esc(it.unit || "") + '</td>'
        + '<td class="cPrice">' + esc(it.price || "") + '</td>'
        + '<td class="cNote">' + esc(it.note || "") + '</td>'
        + '</tr>';
    }
    if(rows === ""){
      rows = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:14px;">明細がありません</td></tr>';
    }

    var html = ''
      + '<!doctype html>'
      + '<html lang="ja"><head><meta charset="utf-8" />'
      + '<meta name="viewport" content="width=device-width,initial-scale=1" />'
      + '<title>' + esc(data.title) + '</title>'
      + '<style>' + css + '</style>'
      + '</head><body>'
      + '<div class="sheet">'

      + '<div class="top">'
      + '  <div class="title">' + esc(data.title) + '</div>'
      + '  <div class="meta">'
      + '    <div><span class="b">入札番号:</span> <span class="mono">' + esc(data.bidNo) + '</span></div>'
      + '    <div><span class="b">作成:</span> <span class="mono">' + esc(data.createdAt) + '</span></div>'
      + '  </div>'
      + '</div>'

      + '<div class="section">'
      + '  <div class="secTitle">宛先</div>'
      + '  <div class="box">' + toHtml + '</div>'
      + '</div>'

      + '<div class="section">'
      + '  <div class="secTitle" style="text-align:right;">入札者（提出者）</div>'
      + '  <div class="box profileBox">' + profLines.join("") + '</div>'
      + '</div>'

      + '<div class="section">'
      + '  <div class="secTitle">入札概要</div>'
      + '  <div class="box">'
      +       makeOneLineLabel("入札年月日", data.bidDate)
      +       makeOneLineLabel("備考", data.note)
      + '  </div>'
      + '</div>'

      + '<div class="section">'
      + '  <div class="secTitle">納入条件</div>'
      + '  <div class="box">'
      +       makeOneLineLabel("納入場所", data.deliveryPlace)
      +       makeOneLineLabel("納期", data.dueDate)
      + '  </div>'
      + '</div>'

      + '<div class="itemsTitleRow">'
      + '  <div class="secTitle" style="margin:0;">入札明細（単価）</div>'
      + '  <div class="itemsNote">※合計金額は表示しません</div>'
      + '</div>'

      + '<table>'
      + '  <thead>'
      + '    <tr>'
      + '      <th class="cNo">番号</th>'
      + '      <th class="cSample">見本</th>'
      + '      <th class="cName">品名／規格</th>'
      + '      <th class="cQty">予定数量</th>'
      + '      <th class="cUnit">単位</th>'
      + '      <th class="cPrice">入札単価</th>'
      + '      <th class="cNote">備考</th>'
      + '    </tr>'
      + '  </thead>'
      + '  <tbody>' + rows + '</tbody>'
      + '</table>'

      + '<div class="footer">'
      + '  <div>ページ <span class="mono">1 / 1</span></div>'
      + '  <div class="mono">' + esc(FILE + " " + VER) + '</div>'
      + '</div>'

      + '</div></body></html>';

    return html;
  }

  function collectPrintData(){
    var now = new Date();

    // header / bidNo
    var header = tryGetBidHeaderObject() || {};
    var bidNoDom = getText("lblBidNo");

    var bidNo = firstNonEmpty([
      bidNoDom,
      pick(header, ["bidNo","bidNumber","入札番号"]),
      ""
    ]);

    // 宛先
    var to1 = pick(header, ["to1","宛先1"]);
    var to2 = pick(header, ["to2","宛先2"]);
    var to3 = pick(header, ["to3","宛先3"]);
    var toLines = [];
    if(trim(to1)!=="") toLines.push(to1);
    if(trim(to2)!=="") toLines.push(to2);
    if(trim(to3)!=="") toLines.push(to3);

    if(toLines.length){
      var last = toLines[toLines.length-1];
      if(last.indexOf("御中") < 0) toLines[toLines.length-1] = last + " 御中";
    }else{
      toLines.push("（宛先が取得できません）");
    }

    // 概要/条件
    var bidDate = pick(header, ["bidDate","入札年月日","date"]);
    var note = pick(header, ["note","備考","note1"]); // noteが空ならnote1も拾う
    var deliveryPlace = pick(header, ["deliveryPlace","納入場所"]);
    var dueDate = pick(header, ["dueDate","納期"]);

    // 入札者プロフィール（DOM）
    var profile = {
      email: getVal("txtEmail"),
      address: getVal("txtAddress"),
      company: getVal("txtCompanyName"),
      rep: getVal("txtRepresentativeName"),
      contact: getVal("txtContactName"),
      contactInfo: getVal("txtContactInfo")
    };

    // items
    var itemsRaw = tryGetItemsObjectArray();
    var items = [];
    if(itemsRaw && itemsRaw.length){
      for(var i=0;i<itemsRaw.length;i++){
        items.push(normalizeItem(itemsRaw[i]));
      }
    }else{
      items = scrapeItemsFromTable();
      for(var j=0;j<items.length;j++){
        items[j] = normalizeItem(items[j]);
      }
    }

    // sample normalize
    for(var k=0;k<items.length;k++){
      items[k].sample = normalizeSampleText(items[k].sample);
    }

    // ログ（データ確認用）
    try{
      L("pdfData", "bidNo=" + (bidNo||""));
      L("pdfData", "to=" + toLines.join(" / "));
      L("pdfData", "bidDate=" + bidDate + " deliveryPlace=" + deliveryPlace + " dueDate=" + dueDate);
      L("pdfData", "note=" + note);
      L("pdfData", "items=" + (items ? items.length : 0));
    }catch(e){}

    return {
      title: "入札書",
      bidNo: (bidNo || "—"),
      createdAt: fmtDateTime(now),
      toLines: toLines,
      profile: profile,
      bidDate: bidDate,
      note: note,
      deliveryPlace: deliveryPlace,
      dueDate: dueDate,
      items: items
    };
  }

  // =========================================================
  // [PDF-A] html2canvas + jsPDF を動的ロードしてPDF保存
  // =========================================================
  function loadScript(url){
    return new Promise(function(resolve, reject){
      try{
        var s = document.createElement("script");
        s.src = url;
        s.onload = function(){ resolve(); };
        s.onerror = function(){ reject(new Error("load failed: " + url)); };
        document.head.appendChild(s);
      }catch(e){ reject(e); }
    });
  }

  function ensurePdfLibs(){
    return new Promise(function(resolve, reject){
      try{
        var hasH2C  = (typeof window.html2canvas === "function");
        var hasJsPDF= !!(window.jspdf && window.jspdf.jsPDF);
        if(hasH2C && hasJsPDF){ resolve(); return; }
      }catch(e){}

      var URL_H2C   = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      var URL_JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

      loadScript(URL_H2C)
        .then(function(){ return loadScript(URL_JSPDF); })
        .then(function(){
          try{
            if(typeof window.html2canvas === "function" && window.jspdf && window.jspdf.jsPDF){
              resolve();
            }else{
              reject(new Error("pdf libs not available after load"));
            }
          }catch(e2){ reject(e2); }
        })
        .catch(reject);
    });
  }

  function canvasToPdfAndSave(canvas, filename){
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF({ orientation:"p", unit:"mm", format:"a4" });

    var pageW = 210;
    var pageH = 297;

    var imgW = pageW;
    var imgH = canvas.height * (imgW / canvas.width);

    // 1ページ
    if(imgH <= pageH){
      var imgData1 = canvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(imgData1, "JPEG", 0, 0, imgW, imgH);
      pdf.save(filename);
      return;
    }

    // 複数ページ：A4高さをpx換算してスライス
    var pageHPx = Math.floor(canvas.width * (pageH / pageW));
    var y = 0;
    var pageIndex = 0;

    while(y < canvas.height){
      if(pageIndex > 0) pdf.addPage();

      var sliceH = Math.min(pageHPx, canvas.height - y);

      var c2 = document.createElement("canvas");
      c2.width = canvas.width;
      c2.height = sliceH;

      var ctx = c2.getContext("2d");
      ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      var imgData = c2.toDataURL("image/jpeg", 0.95);
      var sliceHmm = sliceH * (imgW / canvas.width);

      pdf.addImage(imgData, "JPEG", 0, 0, imgW, sliceHmm);

      y += sliceH;
      pageIndex++;

      c2.width = 1; c2.height = 1;
    }

    pdf.save(filename);
  }

  function createHiddenFrameWithHtml(html){
    var iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-99999px";
    iframe.style.top = "0";
    iframe.style.width = "900px";
    iframe.style.height = "1300px";
    iframe.style.visibility = "hidden";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    var doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    return iframe;
  }

  function removeFrame(iframe){
    try{ if(iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe); }catch(e){}
  }

  function openPrintWindowAndPrint(html){
    var w = null;
    try{ w = window.open("", "_blank"); }catch(e){ w = null; }
    if(!w){
      L("pdf", "window.open blocked");
      alert("ポップアップがブロックされました。ブラウザ設定で許可してください。");
      return;
    }
    try{
      w.document.open();
      w.document.write(html);
      w.document.close();
    }catch(e2){
      L("pdf", "write failed: " + (e2 && e2.message ? e2.message : e2));
      try{ w.close(); }catch(e3){}
      alert("帳票ページの生成に失敗しました。ログを確認してください。");
      return;
    }

    try{
      var fired = false;
      function doPrint(){
        if(fired) return;
        fired = true;
        try{ w.focus(); }catch(e){}
        try{ w.print(); }catch(e){}
      }
      try{ w.onload = function(){ setTimeout(doPrint, 200); }; }catch(e){}
      setTimeout(doPrint, 600);
    }catch(e4){}
  }

  function doPdfDownloadDesign(){
    L("pdf", "PDF生成開始（帳票HTML→canvas→PDF）");

    ensurePdfLibs().then(function(){
      var data = collectPrintData();
      var html = buildPrintHtml(data);

      var iframe = createHiddenFrameWithHtml(html);

      return new Promise(function(resolve, reject){
        setTimeout(function(){
          try{
            var body = iframe.contentWindow.document.body;
            window.html2canvas(body, {
              backgroundColor: "#ffffff",
              scale: 2,
              useCORS: true
            }).then(function(canvas){
              resolve({ canvas: canvas, iframe: iframe, data: data, html: html });
            }).catch(function(err){
              reject({ err: err, iframe: iframe, html: html });
            });
          }catch(e){
            reject({ err: e, iframe: iframe, html: html });
          }
        }, 450);
      });
    }).then(function(res){
      try{
        var bidNo = (res.data && res.data.bidNo) ? (""+res.data.bidNo) : "";
        var fn = "入札書_" + safeFileName(bidNo || "bid") + "_" + fmtNowYmd() + ".pdf";
        canvasToPdfAndSave(res.canvas, fn);
        L("pdf", "PDF保存完了: " + fn);
      }finally{
        removeFrame(res.iframe);
      }
    }).catch(function(pack){
      var err = pack && pack.err ? pack.err : pack;
      var iframe = pack && pack.iframe ? pack.iframe : null;
      var html = pack && pack.html ? pack.html : "";

      L("pdf", "PDF生成失敗: " + (err && err.message ? err.message : err));
      removeFrame(iframe);

      alert("PDF生成に失敗したため、帳票を開きます。印刷ダイアログからPDF保存してください。");
      try{
        // フォールバック：帳票ウィンドウを開いて print（そこからPDF保存）
        if(html){
          openPrintWindowAndPrint(html);
        }else{
          var data2 = collectPrintData();
          openPrintWindowAndPrint(buildPrintHtml(data2));
        }
      }catch(e2){
        try{ window.print(); }catch(e3){}
      }
    });
  }

  // =========================================================
  // [PRN-04] 公開API
  // =========================================================
  function doPdf(){
    doPdfDownloadDesign();
  }

  // 互換：印刷レイアウトを開くだけ（必要なら使う）
  function doPrintDesign(){
    var data = collectPrintData();
    var html = buildPrintHtml(data);
    openPrintWindowAndPrint(html);
  }

  window.BidderPrint = {
    doPdf: doPdf,
    doPrintDesign: doPrintDesign
  };

})();