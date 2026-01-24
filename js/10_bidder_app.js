/* [JST 2026-01-24 21:00]  09_bidder_print.js v20260124-01 */
(function(){
  var FILE = "09_bidder_print.js";
  var VER  = "v20260124-01";
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

  window.BidderPrint = {
    printPage: printPage
  };
})();
