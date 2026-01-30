/* 
[JST 2026-01-30 21:10]  09_bidder_print.js v20260130-01
入札フォーム（入札者）- PDF出力（帳票デザイン版：印刷=PDF保存方式）

反映要件:
  - PDF出力のみ（印刷ボタンはUI側で非表示）
  - PDFは「印刷ダイアログ → PDF保存」（＝印刷時と同一レイアウトで崩れにくい）
  - 1番上: 「入札書」タイトル + 入札番号 + 作成年月日（状態は出さない）
  - 次: 宛先（左寄せ）
  - 次: 入札者（右寄せ）
  - 入札概要: 左寄せ・1行表示（長い場合は同一行で折り返し）
  - 納入条件: 左寄せ・1行表示（長い場合は同一行で折り返し）
  - 明細: 見本列あり、合計金額なし、署名押印欄なし
  - 左余白 2cm（@page margin 左 20mm）
制約:
  - bidder側は最小修正: このファイル(09)だけで完結（他JSに強依存しない）
*/
(function(){
  var FILE = "09_bidder_print.js";
  var VER  = "v20260130-01";
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
  function fmtDateOnly(d){
    try{
      var y = d.getFullYear();
      var m = ("0"+(d.getMonth()+1)).slice(-2);
      var da= ("0"+d.getDate()).slice(-2);
      return y+"-"+m+"-"+da;
    }catch(e){ return ""; }
  }
  function firstNonEmpty(arr){
    for(var i=0;i<arr.length;i++){
      var v = arr[i];
      if(trim(v) !== "") return v;
    }
    return "";
  }
  function safeFileName(s){
    s = (s == null) ? "" : (""+s);
    return s.replace(/[\\\/:\*\?"<>\|]/g, "_");
  }

  // =========================================================
  // [PRN-02] header/items を「取れれば取る」(強依存しない)
  // =========================================================
  function tryGetBidHeaderObject(){
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

    var trs;
    try{ trs = tbody.getElementsByTagName("tr"); }catch(e){ trs = []; }

    for(var i=0;i<trs.length;i++){
      var tr = trs[i];
      var tds;
      try{ tds = tr.getElementsByTagName("td"); }catch(e){ tds = null; }
      if(!tds || tds.length < 4) continue;

      // 期待: 0=番号, 1=品名/規格, 2=予定数量, 3=入札単価, 4=備考
      var no = trim((tds[0].textContent||""));
      var nameSpec = trim((tds[1].textContent||""));
      var qty = trim((tds[2].textContent||""));

      var price = "";
      try{
        var inp = tds[3].getElementsByTagName("input");
        if(inp && inp.length){ price = trim(inp[0].value||""); }
        else price = trim((tds[3].textContent||""));
      }catch(e){ price = trim((tds[3].textContent||"")); }

      var note = "";
      try{
        var inp2 = tds[4] ? tds[4].getElementsByTagName("input") : null;
        if(inp2 && inp2.length){ note = trim(inp2[0].value||""); }
        else note = tds[4] ? trim((tds[4].textContent||"")) : "";
      }catch(e){ note = tds[4] ? trim((tds[4].textContent||"")) : ""; }

      if(no === "" && nameSpec.indexOf("品目なし") >= 0) continue;

      items.push({
        no: no,
        sample: "—",
        name: nameSpec,
        spec: "",
        qty: qty,
        unit: "",
        price: price,
        note: note
      });
    }
    return items;
  }

  function normalizeItem(it){
    function pick(obj, keys){
      for(var i=0;i<keys.length;i++){
        var k = keys[i];
        var v = (obj && obj[k] != null) ? (""+obj[k]) : "";
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
    if(qty === "") qty = "—";
    if(price === "") price = "—";

    // ★軽い補正：qty に「500 kg」等が入って unit が空なら分離
    if(unit === "" && qty.indexOf(" ") > 0){
      var parts = qty.split(/\s+/);
      if(parts.length >= 2){
        var last = parts[parts.length-1];
        var head = parts.slice(0, parts.length-1).join(" ");
        // 単位っぽい短い文字列なら採用（kg, 個, 本 等）
        if(last.length <= 4){
          qty = head;
          unit = last;
        }
      }
    }

    return {
      no: no || "—",
      sample: sample,
      name: name || "—",
      spec: spec,
      qty: qty,
      unit: unit || "—",
      price: price,
      note: note || "—"
    };
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

  function oneLine(label, value){
    value = trim(value);
    if(value === "") value = "—";
    return '<div class="line"><span class="lbl">' + esc(label) + '：</span><span class="val">' + esc(value) + '</span></div>';
  }

  // =========================================================
  // [PRN-03] 印刷(PDF保存)用HTML生成
  // =========================================================
  function buildPrintHtml(data){
    var css = ''
      // ★左余白2cm
      + '@page{ size:A4 portrait; margin:12mm 10mm 12mm 20mm; }'
      + 'html,body{ height:auto; }'
      + 'body{ font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans JP",sans-serif; color:#0f172a; background:#fff; }'
      + '.sheet{ width:100%; }'

      // header
      + '.top{ display:flex; align-items:flex-end; justify-content:space-between; gap:12px; padding-bottom:8px; border-bottom:2px solid #0f172a; }'
      + '.title{ font-size:20px; font-weight:900; letter-spacing:.10em; }'
      + '.meta{ text-align:right; font-size:11px; color:#334155; }'
      + '.meta .b{ font-weight:800; color:#0f172a; }'
      + '.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }'

      // two columns (to / profile)
      + '.row2{ display:flex; gap:12px; margin-top:10px; }'
      + '.colL{ flex:1.2; }'
      + '.colR{ flex:0.8; }'

      // boxes
      + '.box{ border:1px solid #cbd5e1; border-radius:10px; padding:10px; background:#fff; }'
      + '.secTitle{ font-size:11px; font-weight:900; color:#0f172a; letter-spacing:.12em; margin:0 0 6px 0; }'
      + '.toLine{ font-size:12px; line-height:1.65; }'

      + '.profileBox{ text-align:right; }'
      + '.profileName{ font-weight:900; font-size:13px; }'
      + '.profileLine{ font-size:11.5px; line-height:1.55; }'
      + '.profileSub{ color:#334155; }'

      // one-line wrap blocks
      + '.block{ margin-top:10px; }'
      + '.line{ font-size:12px; line-height:1.65; margin:2px 0; }'
      + '.lbl{ font-weight:800; }'
      + '.val{ word-break:break-word; }'

      // table
      + 'table{ width:100%; border-collapse:separate; border-spacing:0; margin-top:8px; }'
      + 'thead th{ font-size:11px; color:#0f172a; background:#f1f5f9; border-top:1px solid #cbd5e1; border-bottom:1px solid #cbd5e1; padding:8px 6px; }'
      + 'thead th:first-child{ border-left:1px solid #cbd5e1; border-top-left-radius:10px; }'
      + 'thead th:last-child{ border-right:1px solid #cbd5e1; border-top-right-radius:10px; }'
      + 'tbody td{ font-size:11.5px; border-bottom:1px solid #cbd5e1; padding:8px 6px; vertical-align:top; }'
      + 'tbody tr td:first-child{ border-left:1px solid #cbd5e1; }'
      + 'tbody tr td:last-child{ border-right:1px solid #cbd5e1; }'
      + 'tbody tr:last-child td:first-child{ border-bottom-left-radius:10px; }'
      + 'tbody tr:last-child td:last-child{ border-bottom-right-radius:10px; }'

      + '.cNo{ width:14mm; text-align:right; font-weight:900; }'
      + '.cSample{ width:12mm; text-align:center; }'
      + '.cName{ width:auto; }'
      + '.cQty{ width:22mm; text-align:right; white-space:nowrap; }'
      + '.cUnit{ width:12mm; text-align:center; white-space:nowrap; }'
      + '.cPrice{ width:28mm; text-align:right; white-space:nowrap; }'
      + '.cNote{ width:26mm; }'
      + '.nameMain{ font-weight:900; }'
      + '.nameSpec{ margin-top:3px; color:#334155; font-size:10.5px; }'

      // footer
      + '.footer{ margin-top:10px; display:flex; justify-content:space-between; color:#334155; font-size:10px; }'
      + '.muted{ color:#64748b; }'

      + '@media print{ .noPrint{ display:none !important; } }';

    // 宛先
    var toHtml = '';
    for(var i=0;i<data.toLines.length;i++){
      toHtml += '<div class="toLine">' + esc(data.toLines[i]) + '</div>';
    }

    // 入札者
    var p = data.profile || {};
    var prof = [];
    if(trim(p.company) !== "") prof.push('<div class="profileName">' + esc(p.company) + '</div>');
    if(trim(p.address) !== "") prof.push('<div class="profileLine profileSub">' + esc(p.address) + '</div>');
    prof.push('<div class="profileLine">代表者名：' + esc(trim(p.rep)||"—") + '</div>');
    prof.push('<div class="profileLine">担当者名：' + esc(trim(p.contact)||"—") + '</div>');
    prof.push('<div class="profileLine">連絡先　：' + esc(trim(p.contactInfo)||"—") + '</div>');
    prof.push('<div class="profileLine">メール　：' + esc(trim(p.email)||"—") + '</div>');

    // 明細
    var rows = '';
    for(i=0;i<data.items.length;i++){
      var it = data.items[i];
      var sample = normalizeSampleText(it.sample);

      var nm = trim(it.name);
      var sp = trim(it.spec);

      var nameHtml = '<div class="nameMain">' + esc(nm || "—") + '</div>';
      if(sp !== ''){
        nameHtml += '<div class="nameSpec">' + esc(sp) + '</div>';
      }

      rows += ''
        + '<tr>'
        + '<td class="cNo">' + esc(it.no || "—") + '</td>'
        + '<td class="cSample">' + esc(sample) + '</td>'
        + '<td class="cName">' + nameHtml + '</td>'
        + '<td class="cQty">' + esc(it.qty || "—") + '</td>'
        + '<td class="cUnit">' + esc(it.unit || "—") + '</td>'
        + '<td class="cPrice">' + esc(it.price || "—") + '</td>'
        + '<td class="cNote">' + esc(it.note || "—") + '</td>'
        + '</tr>';
    }
    if(rows === ''){
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

      // TOP
      + '<div class="top">'
      + '  <div class="title">' + esc(data.title) + '</div>'
      + '  <div class="meta">'
      + '    <div><span class="b">入札番号:</span> <span class="mono">' + esc(data.bidNo) + '</span></div>'
      + '    <div><span class="b">作成:</span> <span class="mono">' + esc(data.createdAt) + '</span></div>'
      + '  </div>'
      + '</div>'

      // 宛先 / 入札者（2カラムで詰める）
      + '<div class="row2">'
      + '  <div class="colL">'
      + '    <div class="secTitle">宛先</div>'
      + '    <div class="box">' + toHtml + '</div>'
      + '  </div>'
      + '  <div class="colR">'
      + '    <div class="secTitle" style="text-align:right;">入札者</div>'
      + '    <div class="box profileBox">' + prof.join("") + '</div>'
      + '  </div>'
      + '</div>'

      // 入札概要
      + '<div class="block">'
      + '  <div class="secTitle">入札概要</div>'
      + '  <div class="box">'
      +       oneLine("入札年月日", data.bidDate)
      +       oneLine("備考", data.note)
      + '  </div>'
      + '</div>'

      // 納入条件
      + '<div class="block">'
      + '  <div class="secTitle">納入条件</div>'
      + '  <div class="box">'
      +       oneLine("納入場所", data.deliveryPlace)
      +       oneLine("納期", data.dueDate)
      + '  </div>'
      + '</div>'

      // 明細
      + '<div class="block">'
      + '  <div class="secTitle">入札明細（単価） <span class="muted" style="font-weight:700;letter-spacing:0;">※合計金額は表示しません</span></div>'
      + '  <table>'
      + '    <thead>'
      + '      <tr>'
      + '        <th class="cNo">番号</th>'
      + '        <th class="cSample">見本</th>'
      + '        <th class="cName">品名／規格</th>'
      + '        <th class="cQty">予定数量</th>'
      + '        <th class="cUnit">単位</th>'
      + '        <th class="cPrice">入札単価</th>'
      + '        <th class="cNote">備考</th>'
      + '      </tr>'
      + '    </thead>'
      + '    <tbody>' + rows + '</tbody>'
      + '  </table>'
      + '</div>'

      // footer（印刷/PDFでの確認用）
      + '<div class="footer">'
      + '  <div class="mono">' + esc(FILE + " " + VER) + '</div>'
      + '  <div class="mono">' + esc(data.createdAt) + '</div>'
      + '</div>'

      + '</div></body></html>';

    return html;
  }

  function collectPrintData(){
    var now = new Date();

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
      getText("lblBidNo"),
      pickHeader(["bidNo","bidNumber","入札番号"]),
      "—"
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
      var scraped = scrapeItemsFromTable();
      for(var j=0;j<scraped.length;j++){
        items.push(normalizeItem(scraped[j]));
      }
    }

    // 見本 正規化
    for(var k=0;k<items.length;k++){
      items[k].sample = normalizeSampleText(items[k].sample);
    }

    return {
      title: "入札書",
      bidNo: bidNo,
      createdAt: fmtDateTime(now),
      createdFileDate: fmtDateOnly(now),
      toLines: toLines,
      profile: profile,
      bidDate: bidDate,
      note: note,
      deliveryPlace: deliveryPlace,
      dueDate: dueDate,
      items: items
    };
  }

  function openPrintWindowAndPrintForPdf(){
    var data = collectPrintData();
    var html = buildPrintHtml(data);

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
      alert("PDF用ページの生成に失敗しました。ログを確認してください。");
      return;
    }

    // タイトルにファイル名を寄せる（保存時の目安）
    try{
      w.document.title = "入札書_" + safeFileName(data.bidNo || "bid") + "_" + safeFileName(data.createdFileDate) ;
    }catch(e4){}

    // 印刷ダイアログ（ここで「PDFとして保存」）
    try{
      var fired = false;
      function doPrint(){
        if(fired) return;
        fired = true;
        try{ w.focus(); }catch(e){}
        try{ w.print(); }catch(e){}
      }
      try{ w.onload = function(){ setTimeout(doPrint, 250); }; }catch(e){}
      setTimeout(doPrint, 700);
    }catch(e5){}
  }

  // =========================================================
  // [PRN-04] 公開API
  // =========================================================
  function doPdf(){
    // ★PDF出力ボタン：帳票HTMLを印刷→PDF保存（印刷と同じレイアウト）
    L("pdf", "doPdf -> open print dialog (save as PDF)");
    openPrintWindowAndPrintForPdf();
  }

  // 互換のため残す（他JSが参照しても落とさない）
  function printPage(){
    L("print", "printPage is deprecated. Use doPdf.");
    try{ openPrintWindowAndPrintForPdf(); }catch(e){}
  }
  function doPrintDesign(){
    L("print", "doPrintDesign is deprecated. Use doPdf.");
    try{ openPrintWindowAndPrintForPdf(); }catch(e){}
  }

  window.BidderPrint = {
    printPage: printPage,      // 互換
    doPdf: doPdf,              // 本命（PDF）
    doPrintDesign: doPrintDesign // 互換
  };
})();