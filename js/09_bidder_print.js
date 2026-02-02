/* [JST 2026-02-02 18:50]  09_bidder_print.js v20260202-MIN01
   目的:
   - まず「何でもいいからPDFを1枚作れる」状態を作る（外部ライブラリ不要）
   - pdf-lib / html2canvas / jsPDF が無くても動く
   - 10_bidder_app.js の btnPdf → BidderPrint.doPdf() から呼ばれる前提

   制約:
   - 日本語本文は未対応（標準Helveticaで英数字のみ確実に出る）
   - まず動作確認用。次にデザイン/日本語/セクションを足す。
*/
(function(){
  "use strict";

  // =========================================================
  // [MIN-00] メタ
  // =========================================================
  var FILE = "09_bidder_print.js";
  var VER  = "v20260202-MIN01";
  var TS   = new Date().toISOString();

  // =========================================================
  // [MIN-01] ログ
  // =========================================================
  function toStr(x){
    try{ return (x && x.message) ? x.message : ("" + x); }catch(e){ return "" + x; }
  }
  function L(tag, msg){
    try{
      if(window.BidderLog && window.BidderLog.write) return window.BidderLog.write(tag, msg);
      if(window.BOOTLOG && window.BOOTLOG.write) return window.BOOTLOG.write(tag, msg);
      console.log("[" + tag + "] " + msg);
    }catch(e){
      try{ console.log("[" + tag + "] " + msg); }catch(ex){}
    }
  }

  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });
  L("ver", TS + " " + FILE + " " + VER);

  // =========================================================
  // [MIN-02] ユーティリティ
  // =========================================================
  function yyyymmdd(d){
    var dt = d || new Date();
    function p2(n){ return (n<10) ? ("0"+n) : (""+n); }
    return dt.getFullYear() + p2(dt.getMonth()+1) + p2(dt.getDate());
  }
  function escapePdfString(s){
    // PDF文字列の最低限エスケープ: \ ( ) を逃がす
    var t = (s == null) ? "" : ("" + s);
    return t.replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
  }

  // =========================================================
  // [MIN-03] 最小PDF生成（Type1 Helvetica + 1ページ + テキスト）
  // =========================================================
  function buildMinimalPdfBytes(lines){
    // [MIN-03-01] ページサイズ：A4 (pt)
    var W = 595.28, H = 841.89;

    // [MIN-03-02] 描画命令（テキスト）
    // 余白をそれっぽく：左72pt / 上から72pt
    var x = 72;
    var y = H - 72;

    var content = "";
    content += "BT\n";
    content += "/F1 24 Tf\n";           // フォント24pt
    content += x + " " + y + " Td\n";
    content += "(" + escapePdfString(lines[0] || "Hello PDF") + ") Tj\n";

    // 2行目以降（14ptで）
    if(lines.length > 1){
      content += "/F1 14 Tf\n";
      for(var i=1;i<lines.length;i++){
        content += "0 -18 Td\n";        // 18pt下へ
        content += "(" + escapePdfString(lines[i]) + ") Tj\n";
      }
    }

    content += "ET\n";

    // [MIN-03-03] PDFオブジェクトを順に積む（xref用にオフセットも記録）
    var parts = [];
    function push(str){ parts.push(str); }

    // ヘッダ
    push("%PDF-1.4\n");

    // オブジェクト開始位置（バイトオフセット）
    var offsets = [0]; // 0番は未使用（PDF仕様）
    function currentOffset(){
      var n = 0;
      for(var i=0;i<parts.length;i++){
        // ここでは ASCII のみ扱う前提（日本語は次段）
        n += parts[i].length;
      }
      return n;
    }

    function addObj(objNum, body){
      offsets[objNum] = currentOffset();
      push(objNum + " 0 obj\n");
      push(body);
      if(body.charAt(body.length-1) !== "\n") push("\n");
      push("endobj\n");
    }

    // 1: Catalog
    addObj(1,
      "<< /Type /Catalog /Pages 2 0 R >>"
    );

    // 2: Pages
    addObj(2,
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"
    );

    // 3: Page
    addObj(3,
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "]\n" +
      "   /Resources << /Font << /F1 4 0 R >> >>\n" +
      "   /Contents 5 0 R >>"
    );

    // 4: Font
    addObj(4,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    );

    // 5: Contents stream
    var stream = content;
    var len = stream.length; // ASCII前提
    addObj(5,
      "<< /Length " + len + " >>\n" +
      "stream\n" +
      stream +
      "endstream"
    );

    // [MIN-03-04] xref
    var xrefOffset = currentOffset();
    push("xref\n");
    push("0 6\n");
    push("0000000000 65535 f \n");
    for(var nObj=1;nObj<=5;nObj++){
      var off = offsets[nObj] || 0;
      var off10 = ("0000000000" + off).slice(-10);
      push(off10 + " 00000 n \n");
    }

    // trailer
    push("trailer\n");
    push("<< /Size 6 /Root 1 0 R >>\n");
    push("startxref\n");
    push(String(xrefOffset) + "\n");
    push("%%EOF\n");

    // [MIN-03-05] 文字列→Uint8Array
    var pdfStr = parts.join("");
    var bytes = new Uint8Array(pdfStr.length);
    for(var i2=0;i2<pdfStr.length;i2++){
      bytes[i2] = pdfStr.charCodeAt(i2) & 0xFF;
    }
    return bytes;
  }

  // =========================================================
  // [MIN-04] 保存（download）
  // =========================================================
  function saveBytes(bytes, filename){
    var blob = new Blob([bytes], { type: "application/pdf" });
    var url = URL.createObjectURL(blob);

    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(function(){
      try{ URL.revokeObjectURL(url); }catch(e){}
    }, 5000);
  }

  // =========================================================
  // [MIN-05] 公開API（10から呼ばれる）
  // =========================================================
  function doPdf(){
    try{
      L("pdf", "PDF生成開始（MIN: 外部ライブラリ不要）");

      // まず何でもいいので固定テキストでOK
      var lines = [
        "Hello PDF (MIN)",
        "This PDF is generated without pdf-lib.",
        "Next: add bid data + layout."
      ];

      var bytes = buildMinimalPdfBytes(lines);
      var name = "test_" + yyyymmdd(new Date()) + ".pdf";
      saveBytes(bytes, name);

      L("pdf", "PDF保存完了: " + name);
      return Promise.resolve(true);
    }catch(e){
      L("pdf", "FAILED: " + toStr(e));
      return Promise.reject(e);
    }
  }

  function doPrint(){
    // まずはPDF保存で統一
    return doPdf();
  }

  if(!window.BidderPrint){ window.BidderPrint = {}; }
  window.BidderPrint.doPdf = doPdf;
  window.BidderPrint.doPrint = doPrint;

})();