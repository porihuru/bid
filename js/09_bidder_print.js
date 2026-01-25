/* [JST 2026-01-25 10:00]  09_bidder_print.js v20260125-01
   変更点:
     - BidderPrint.doPdf を追加（PDF出力ボタンの呼び出し先）
     - 中身は最小実装：window.print() を呼ぶ（保存はOS/ブラウザのPDF機能に任せる）
*/
(function(){
  var FILE = "09_bidder_print.js";
  var VER  = "v20260126-01";
  var TS   = new Date().toISOString();

  function L(tag, msg){
    if(window.BidderLog && window.BidderLog.write) window.BidderLog.write(tag, msg);
    else if(window.log) window.log(tag, msg);
    else try{ console.log("[" + tag + "] " + msg); }catch(e){}
  }
  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });
  L("ver", TS + " " + FILE + " " + VER);

  function printPage(){
    L("print", "window.print");
    try{ window.print(); }catch(e){}
  }

  // ★これを追加★：PDF出力（最小実装＝印刷ダイアログを開く）
  // - iPhone/Safari: 共有→プリント→ピンチアウトでPDF→保存/共有
  // - PC/Edge: 印刷先「Microsoft Print to PDF」等で保存
  function doPdf(){
    L("pdf", "doPdf -> window.print (PDF is handled by browser/OS)");
    try{ window.print(); }catch(e){ L("pdf", "print failed: " + (e && e.message ? e.message : e)); }
  }
  // ★ここまで追加★

  window.BidderPrint = {
    printPage: printPage,
    // ★これを追加★：PDF出力ボタンが呼ぶ関数名
    doPdf: doPdf
    // ★ここまで追加★
  };
})();