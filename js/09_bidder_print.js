/* 
[JST 2026-01-27 20:00]  09_bidder_print.js v20260127-01
入札フォーム（入札者）- 印刷/PDF出力（帳票デザイン版）

反映要件:
  - 1番上: 「入札書」タイトル + 入札番号 + 作成年月日（状態は出さない）
  - 次: 宛先（左寄せ）
  - 次: 入札者（右寄せ）
  - 入札概要: 左寄せ・1行表示（長い場合は同一行で折り返し）
  - 納入条件: 左寄せ・1行表示（長い場合は同一行で折り返し）
  - 明細: 見本列あり、合計金額なし、署名押印欄なし
制約:
  - bidder側は最小修正: このファイル(09)だけで完結（他JSに強依存しない）
改善点:
  - PDFのレイアウト崩れ対策:
    * iframe を visibility:hidden にせず opacity:0＋画面外配置
    * キャプチャ対象を body ではなく .sheet にする
    * .sheet 幅を A4実寸(余白込み)に固定し、テーブル計算の揺れを抑える
    * (可能なら) フォント確定(document.fonts.ready)を待つ
*/
(function(){
  var FILE = "09_bidder_print.js";
  var VER  = "v20260127-01";
  var TS   = new Date().toISOString();

  function L(tag, msg){
    if(window.BidderLog && window.BidderLog.write) window.BidderLog.write(tag, msg);
    else if(window.log) window.log(tag, msg);
    else try{ console.log("[" + tag + "] " + msg); }catch(e){}
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
  function fmtDateTime(d){
    try{
      var y = d.getFullYear();
      var m = ("0"+(d.getMonth()+1)).slice(-2);
      var da= ("0"+d.getDate()).slice(-2);
      var hh= ("0"+d.getHours()).slice(-2);
      var mm= ("0"+d.getMinutes()).slice(-2);
      return y+"-"+m+"-"+da+" "+hh+":"+mm;
    }catch(e){ return ""; }
  }

  function firstNonEmpty(arr){
    var i, v;
    for(i=0;i<arr.length;i++){
      v = arr[i];
      if(trim(v) !== "") return v;
    }
    return "";
  }

  // =========================================================
  // [PRN-02] header/profile/items を「取れれば取る」
  //  - 取れない場合でも落とさず、帳票生成だけは動かす
  // =========================================================
  function tryGetBidHeaderObject(){
    // いろいろな形に「存在すれば対応」する（強依存しない）
    try{
      if(window.BidderState){
        if(typeof window.BidderState.getBidHeader === "function"){
          return window.BidderState.getBidHeader();
        }
        if(window.BidderState.state && window.BidderState.state.bidHeader){
          return window.BidderState.state.bidHeader;
        }
        if(window.BidderState.bidHeader){
          return window.BidderState.bidHeader;
        }
      }
    }catch(e){}
    return null;
  }

  function tryGetItemsObjectArray(){
    try{
      if(window.BidderState){
        if(typeof window.BidderState.getItems === "function"){
          return window.BidderState.getItems();
        }
        if(window.BidderState.state && window.BidderState.state.items && window.BidderState.state.items.length){
          return window.BidderState.state.items;
        }
        if(window.BidderState.items && window.BidderState.items.length){
          return window.BidderState.items;
        }
      }
    }catch(e){}
    return null;
  }

  function scrapeItemsFromTable(){
    // 画面の tbodyItems を読み取る（見本は画面に無い想定のため "—"）
    var items = [];
    var tbody = $("tbodyItems");
    if(!tbody) return items;

    var trs, i, tr, tds, no, nameSpec, qty, unit, price, note;
    try{ trs = tbody.getElementsByTagName("tr"); }catch(e){ trs = []; }

    for(i=0;i<trs.length;i++){
      tr = trs[i];
      try{ tds = tr.getElementsByTagName("td"); }catch(e){ tds = null; }
      if(!tds || tds.length < 4) continue;

      // 期待: 0=番号, 1=品名/規格, 2=予定数量, 3=入札単価, 4=備考
      no = trim((tds[0].textContent||""));
      nameSpec = trim((tds[1].textContent||""));
      qty = trim((tds[2].textContent||""));

      // 単価は input の可能性が高い
      price = "";
      try{
        var inp = tds[3].getElementsByTagName("input");
        if(inp && inp.length){ price = trim(inp[0].value||""); }
        else price = trim((tds[3].textContent||""));
      }catch(e){ price = trim((tds[3].textContent||"")); }

      // 備考も input の可能性
      note = "";
      try{
        var inp2 = tds[4] ? tds[4].getElementsByTagName("input") : null;
        if(inp2 && inp2.length){ note = trim(inp2[0].value||""); }
        else note = tds[4] ? trim((tds[4].textContent||"")) : "";
      }catch(e){ note = tds[4] ? trim((tds[4].textContent||"")) : ""; }

      // unit は画面列に無いので空
      unit = "";

      // 「品目なし」行の除外
      if(no === "" && nameSpec.indexOf("品目なし") >= 0) continue;

      items.push({
        no: no,
        sample: "—",
        name: nameSpec,   // 画面表示の2段分がまとまっている
        spec: "",
        qty: qty,
        unit: unit,
        price: price,
        note: note
      });
    }
    return items;
  }

  function normalizeItem(it){
    // it がどんな形でも、印刷用に揃える
    function pick(obj, keys){
      var k, v;
      for(var i=0;i<keys.length;i++){
        k = keys[i];
        v = (obj && obj[k] != null) ? (""+obj[k]) : "";
        v = trim(v);
        if(v !== "") return v;
      }
      return "";
    }

    var no    = pick(it, ["no","rowNo","seq","index","番号"]);
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

  function normalizeSampleText(v){
    v = trim(v);
    if(v === "") return "—";
    // よくある表現を寄せる（帳票として読みやすい）
    var s = v.toLowerCase();
    if(s === "1" || s === "true" || v === "有" || v === "○") return "有";
    if(s === "0" || s === "false" || v === "無" || v === "×") return "無";
    if(v === "-" || v === "―") return "—";
    return v;
  }

  function makeOneLineLabel(label, value){
    // 「ラベル：値」を同一行で折り返し可能にする
    value = trim(value);
    if(value === "") return "";
    return '<div class="oneLine"><span class="lbl">' + esc(label) + '：</span><span class="val">' + esc(value) + '</span></div>';
  }

  // =========================================================
  // [PRN-03] 帳票HTML生成
  // =========================================================
  function buildPrintHtml(data){
    // data: { title, bidNo, createdAt, toLines[], profile{}, bidDate, note, deliveryPlace, dueDate, items[] }
    // ★A4余白: 左20mm(2cm) / 右10mm / 上下12mm → 本文幅 = 210 - 20 - 10 = 180mm
    var css = ''
      + '@page{ size:A4 portrait; margin:12mm 10mm 12mm 20mm; }'
      + 'html,body{ height:auto; margin:0; padding:0; }'
      + 'body{ font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans JP",sans-serif; color:#0f172a; background:#fff; }'
      + '*,*::before,*::after{ box-sizing:border-box; }'
      + '.sheet{ width:180mm; margin:0 auto; }'

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

      // mm列幅（A4実寸系。PDFもここが効く）
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
    var toHtml = '';
    var i;
    for(i=0;i<data.toLines.length;i++){
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
    var rows = '';
    for(i=0;i<data.items.length;i++){
      var it = data.items[i];
      var sample = normalizeSampleText(it.sample);
      var nm = trim(it.name);
      var sp = trim(it.spec);

      var nameHtml = '';
      nameHtml += '<div class="nameMain">' + esc(nm || "") + '</div>';
      if(sp !== ''){
        nameHtml += '<div class="nameSpec">' + esc(sp) + '</div>';
      }

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
    if(rows === ''){
      rows = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:14px;">明細がありません</td></tr>';
    }

    // HTML組み立て
    var html = ''
      + '<!doctype html>'
      + '<html lang="ja"><head><meta charset="utf-8" />'
      + '<meta name="viewport" content="width=device-width,initial-scale=1" />'
      + '<title>' + esc(data.title) + '</title>'
      + '<style>' + css + '</style>'
      + '</head><body>'
      + '<div class="sheet">'

      // TOP
      + '<div class="top">'
      + '  <div class="title">' + esc(data.title) + '</div>'
      + '  <div class="meta">'
      + '    <div><span class="b">入札番号:</span> <span class="mono">' + esc(data.bidNo) + '</span></div>'
      + '    <div><span class="b">作成:</span> <span class="mono">' + esc(data.createdAt) + '</span></div>'
      + '  </div>'
      + '</div>'

      // 宛先
      + '<div class="section">'
      + '  <div class="secTitle">宛先</div>'
      + '  <div class="box">' + toHtml + '</div>'
      + '</div>'

      // 入札者
      + '<div class="section">'
      + '  <div class="secTitle" style="text-align:right;">入札者（提出者）</div>'
      + '  <div class="box profileBox">' + profLines.join("") + '</div>'
      + '</div>'

      // 入札概要
      + '<div class="section">'
      + '  <div class="secTitle">入札概要</div>'
      + '  <div class="box">'
      +       makeOneLineLabel("入札年月日", data.bidDate)
      +       makeOneLineLabel("備考", data.note)
      + '  </div>'
      + '</div>'

      // 納入条件
      + '<div class="section">'
      + '  <div class="secTitle">納入条件</div>'
      + '  <div class="box">'
      +       makeOneLineLabel("納入場所", data.deliveryPlace)
      +       makeOneLineLabel("納期", data.dueDate)
      + '  </div>'
      + '</div>'

      // 明細
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

      // footer
      + '<div class="footer">'
      + '  <div class="mono">' + esc(FILE + " " + VER) + '</div>'
      + '  <div class="mono">' + esc(data.createdAt) + '</div>'
      + '</div>'

      + '</div></body></html>';

    return html;
  }

  function collectPrintData(){
    var now = new Date();

    var bidNoDom = getText("lblBidNo");
    var header = tryGetBidHeaderObject() || {};

    function pickHeader(keys){
      for(var i=0;i<keys.length;i++){
        var k = keys[i];
        if(header && header[k] != null){
          var v = trim(header[k]);
          if(v !== "") return v;
        }
      }
      return "";
    }

    var bidNo = firstNonEmpty([
      bidNoDom,
      pickHeader(["bidNo","bidNumber","入札番号"]),
      ""
    ]);

    // 宛先
    var to1 = pickHeader(["to1","宛先1"]);
    var to2 = pickHeader(["to2","宛先2"]);
    var to3 = pickHeader(["to3","宛先3"]);
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

    // 入札概要/納入条件
    var bidDate = pickHeader(["bidDate","入札年月日","date"]);
    var note = pickHeader(["note","備考"]);
    var deliveryPlace = pickHeader(["deliveryPlace","納入場所"]);
    var dueDate = pickHeader(["dueDate","納期"]);

    // 入札者プロフィール（DOM）
    var profile = {
      email: getVal("txtEmail"),
      address: getVal("txtAddress"),
      company: getVal("txtCompanyName"),
      rep: getVal("txtRepresentativeName"),
      contact: getVal("txtContactName"),
      contactInfo: getVal("txtContactInfo")
    };

    // 明細（state優先→DOM）
    var itemsRaw = tryGetItemsObjectArray();
    var items = [];
    if(itemsRaw && itemsRaw.length){
      for(var i=0;i<itemsRaw.length;i++){
        items.push(normalizeItem(itemsRaw[i]));
      }
    }else{
      items = scrapeItemsFromTable();
    }

    for(var j=0;j<items.length;j++){
      items[j].sample = normalizeSampleText(items[j].sample);
    }

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

  function openPrintWindowAndPrint(){
    var data = collectPrintData();
    var html = buildPrintHtml(data);

    var w = null;
    try{ w = window.open("", "_blank"); }catch(e){ w = null; }
    if(!w){
      L("print", "window.open blocked");
      alert("ポップアップがブロックされました。ブラウザ設定で許可してください。");
      return;
    }

    try{
      w.document.open();
      w.document.write(html);
      w.document.close();
    }catch(e2){
      L("print", "write failed: " + (e2 && e2.message ? e2.message : e2));
      try{ w.close(); }catch(e3){}
      alert("印刷用ページの生成に失敗しました。ログを確認してください。");
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

  // =========================================================
  // [PDF] libs
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
        var hasH2C   = (typeof window.html2canvas === "function");
        var hasJsPDF = !!(window.jspdf && window.jspdf.jsPDF);
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
          }catch(e){ reject(e); }
        })
        .catch(reject);
    });
  }

  function safeFileName(s){
    s = (s == null) ? "" : (""+s);
    return s.replace(/[\\\/:\*\?"<>\|]/g, "_");
  }

  function fmtNow(){
    try{
      var d = new Date();
      var y = d.getFullYear();
      var m = ("0"+(d.getMonth()+1)).slice(-2);
      var da= ("0"+d.getDate()).slice(-2);
      return y + m + da;
    }catch(e){
      return "date";
    }
  }

  function canvasToPdfAndSave(canvas, filename){
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF({ orientation:"p", unit:"mm", format:"a4" });

    var pageW = 210;
    var pageH = 297;

    var imgW = pageW;
    var imgH = canvas.height * (imgW / canvas.width);

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

  // =========================================================
  // [PDF] 帳票HTML → iframe生成 → .sheet をキャプチャ → PDF保存
  // =========================================================
  function doPdfDownloadSameAsPrint(){
    L("pdf", "PDF生成開始（帳票デザインをPDF化）");

    function createFrameWithHtml(html){
      var iframe = document.createElement("iframe");
      // ★visibility:hidden を使わない（レイアウトが崩れる原因になりやすい）
      iframe.style.position = "fixed";
      iframe.style.left = "-99999px";
      iframe.style.top = "0";
      iframe.style.width = "1100px";
      iframe.style.height = "1600px";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";
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

    ensurePdfLibs().then(function(){
      var data = collectPrintData();
      var html = buildPrintHtml(data);
      var iframe = createFrameWithHtml(html);

      return new Promise(function(resolve, reject){
        var win = iframe.contentWindow;
        var doc = win.document;

        // フォント確定待ち（使える環境のみ）
        var waitFonts = (doc.fonts && doc.fonts.ready) ? doc.fonts.ready : Promise.resolve();

        waitFonts.then(function(){
          // レイアウト確定を少し待つ
          setTimeout(function(){
            try{
              var target = doc.querySelector(".sheet") || doc.body;

              window.html2canvas(target, {
                backgroundColor: "#ffffff",
                scale: 2,
                useCORS: true,
                scrollX: 0,
                scrollY: 0,
                windowWidth: target.scrollWidth,
                windowHeight: target.scrollHeight
              }).then(function(canvas){
                resolve({ canvas: canvas, iframe: iframe, data: data });
              }).catch(function(err){
                reject({ err: err, iframe: iframe });
              });
            }catch(e){
              reject({ err: e, iframe: iframe });
            }
          }, 350);
        }).catch(function(e){
          // fonts.ready が落ちても続行
          setTimeout(function(){
            try{
              var target2 = doc.querySelector(".sheet") || doc.body;
              window.html2canvas(target2, {
                backgroundColor: "#ffffff",
                scale: 2,
                useCORS: true,
                scrollX: 0,
                scrollY: 0,
                windowWidth: target2.scrollWidth,
                windowHeight: target2.scrollHeight
              }).then(function(canvas){
                resolve({ canvas: canvas, iframe: iframe, data: data });
              }).catch(function(err){
                reject({ err: err, iframe: iframe });
              });
            }catch(e2){
              reject({ err: e2, iframe: iframe });
            }
          }, 350);
        });
      });
    }).then(function(res){
      try{
        var bidNo = (res.data && res.data.bidNo) ? (""+res.data.bidNo) : "";
        var fn = "入札書_" + safeFileName(bidNo || "bid") + "_" + fmtNow() + ".pdf";
        canvasToPdfAndSave(res.canvas, fn);
        L("pdf", "PDF保存完了: " + fn);
      }finally{
        removeFrame(res.iframe);
      }
    }).catch(function(pack){
      var err = pack && pack.err ? pack.err : pack;
      var iframe = pack && pack.iframe ? pack.iframe : null;

      L("pdf", "PDF生成失敗: " + (err && err.message ? err.message : err));
      removeFrame(iframe);

      // 保険：印刷ダイアログ（ここからPDF保存も可能）
      alert("PDF生成に失敗したため、印刷ダイアログでPDF保存してください。");
      try{ openPrintWindowAndPrint(); }catch(e2){ try{ window.print(); }catch(e3){} }
    });
  }

  // =========================================================
  // [PRN-04] 公開API
  // =========================================================
  function printPage(){
    // 互換用に残す（UIからは消してOK）
    L("print", "window.print (current page)");
    try{ window.print(); }catch(e){}
  }

  function doPdf(){
    // PDF出力ボタン：帳票デザインをPDFファイルとして保存
    L("pdf", "doPdf -> generate PDF (design)");
    doPdfDownloadSameAsPrint();
  }

  function doPrintDesign(){
    // 互換用に残す（UIからは消してOK）
    L("print", "doPrintDesign -> open print layout window");
    openPrintWindowAndPrint();
  }

  window.BidderPrint = {
    printPage: printPage,
    doPdf: doPdf,
    doPrintDesign: doPrintDesign
  };
})();
