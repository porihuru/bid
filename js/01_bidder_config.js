/* [JST 2026-01-24 21:00]  01_bidder_config.js v20260124-02 */
(function(){
  var FILE = "01_bidder_config.js";
  var VER  = "v20260124-02";
  var TS   = new Date().toISOString();

  function safeLog(tag, msg){
    try{
      if(window.BidderLog && window.BidderLog.write){ window.BidderLog.write(tag, msg); }
      else if(window.log){ window.log(tag, msg); }
      else { console.log("[" + tag + "] " + msg); }
    }catch(e){ try{ console.log("[" + tag + "] " + msg); }catch(ex){} }
  }

  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });
  safeLog("ver", TS + " " + FILE + " " + VER);

  // [CFG-01] 固定入札番号（URL ?bidNo=XXXX があればそちら優先）
  var BID_NO_DEFAULT = "2026003";

  // [CFG-02] Firebase設定（必ず環境の値に差し替え）
  var FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

  // ★ここが重要★ ルールの isBidderFor() に合わせる
  // 例: bidderId=332b001 → 332b001@bid.local
  var BIDDER_EMAIL_DOMAIN = "@bid.local";

  // Firestore はルールに合わせて bids 配下のサブコレクションを使う
  var PATHS = {
    bids: "bids"
  };

  var COOKIE_KEYS = {
    profile: "BIDDER_PROFILE"
  };

  window.BidderConfig = {
    BID_NO_DEFAULT: BID_NO_DEFAULT,
    FIREBASE_CONFIG: FIREBASE_CONFIG,
    BIDDER_EMAIL_DOMAIN: BIDDER_EMAIL_DOMAIN,
    PATHS: PATHS,
    COOKIE_KEYS: COOKIE_KEYS
  };
})();
