/* [JST 2026-01-24 21:00]  00_bidder_build.js v20260124-01
   目的:
     - ビルド生成物ではなく「共通の起動前初期化」を置く場所として復活
     - __APP_VER__（バージョン一覧）格納
     - [ver] ログ出力（log未初期化でもconsoleに落とす）
*/
(function(){
  var FILE = "00_bidder_build.js";
  var VER  = "v20260124-01";
  var TS   = new Date().toISOString();

  function safeConsole(tag, msg){
    try{ console.log("[" + tag + "] " + msg); }catch(e){}
  }

  // 先に一覧コンテナ確保
  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });

  // log未初期化想定
  safeConsole("ver", TS + " " + FILE + " " + VER);

  // アプリ名前空間（必要ならここに共通関数を置く）
  if(!window.BidderApp){ window.BidderApp = {}; }
})();
