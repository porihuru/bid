/* [JST 2026-01-24 21:00]  01_bidder_config.js v20260124-01 */
(function(){
  var FILE = "01_bidder_config.js";
  var VER  = "v20260124-01";
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

  // =========================
  // [CFG-01] 固定入札番号（URL ?bidNo=XXXX があればそちら優先）
  // =========================
  var BID_NO_DEFAULT = "2026003";

  // =========================
  // [CFG-02] Firebase設定（必ず環境の値に差し替え）
  // =========================
  var FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

  // =========================
  // [CFG-03] 入札者ID→メール変換（Email/Password認証を使うため）
  //   例: bidderId=332b001 -> 332b001@bidder.local
  //   ※Firebase Auth側はこのメールで事前登録してください
  // =========================
  var BIDDER_EMAIL_DOMAIN = "@bidder.local";

  // =========================
  // [CFG-04] Firestore コレクション構成
  // =========================
  var PATHS = {
    bids:  "bids",     // bids/{bidNo}
    items: "items",    // items/{bidNo}/lines (例) など環境差がある場合は合わせる
    offers:"offers"    // offers/{bidNo}_{bidderId} など（環境に合わせて変更）
  };

  // =========================
  // [CFG-05] Cookieキー（入札者フォーム入力保存）
  // =========================
  var COOKIE_KEYS = {
    profile: "BIDDER_PROFILE"
  };

  // 公開
  window.BidderConfig = {
    BID_NO_DEFAULT: BID_NO_DEFAULT,
    FIREBASE_CONFIG: FIREBASE_CONFIG,
    BIDDER_EMAIL_DOMAIN: BIDDER_EMAIL_DOMAIN,
    PATHS: PATHS,
    COOKIE_KEYS: COOKIE_KEYS
  };
})();
