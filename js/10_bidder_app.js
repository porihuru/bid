/* [JST 2026-01-24 22:10]  10_bidder_app.js v20260124-02
   目的:
   - 個別JS構成で動く「入札フォーム（入札者）」の起動・イベント結線・制御（メイン）
   - ログが流れ続けてコピー不能になる問題を避ける（無駄な連続renderをしない）
   - 05_bidder_auth.js の watchAuthState / unlockByCode に対応

   依存（想定）:
   - BidderConfig (01)
   - BidderState  (02)
   - BidderLog    (03)
   - BidderDB     (04)
   - BidderAuth   (05)
   - BidderProfile(06)
   - BidderOffer  (07)
   - BidderRender (08)
   - BidderPrint  (09)
*/
(function(){
  "use strict";

  var FILE = "10_bidder_app.js";
  var VER  = "v20260124-02";
  var TS   = new Date().toISOString();

  // =========================================================
  // ログ・バージョン
  // =========================================================
  function L(tag, msg){
    if(window.BidderLog && window.BidderLog.write) window.BidderLog.write(tag, msg);
    else try{ console.log("[" + tag + "] " + msg); }catch(e){}
  }
  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });
  L("ver", TS + " " + FILE + " " + VER);

  // =========================================================
  // ユーティリティ
  // =========================================================
  function $(sel){ try{ return document.querySelector(sel); }catch(e){ return null; } }
  function val(sel){
    var el = $(sel);
    if(!el) return "";
    return (el.value != null) ? String(el.value).trim() : "";
  }
  function setText(sel, text){
    var el = $(sel);
    if(el) el.textContent = (text == null ? "" : String(text));
  }

  function safeCall(obj, fnName /*, args... */){
    try{
      if(obj && typeof obj[fnName] === "function"){
        return obj[fnName].apply(obj, Array.prototype.slice.call(arguments, 2));
      }
    }catch(e){
      L("app", "safeCall FAILED " + fnName + " " + (e && e.message ? e.message : e));
    }
    return undefined;
  }

  function getState(){
    try{
      if(window.BidderState && typeof window.BidderState.get === "function"){
        return window.BidderState.get();
      }
    }catch(e){}
    return {};
  }

  // =========================================================
  // render の「連打防止」
  // =========================================================
  var __renderScheduled = false;
  function scheduleRender(reason){
    if(__renderScheduled) return;
    __renderScheduled = true;
    setTimeout(function(){
      __renderScheduled = false;
      try{
        if(window.BidderRender && typeof window.BidderRender.renderAll === "function"){
          window.BidderRender.renderAll();
          if(reason) L("render", "renderAll OK (" + reason + ")");
        }else{
          if(reason) L("render", "renderAll SKIP (BidderRender.renderAll missing) (" + reason + ")");
        }
      }catch(e){
        L("render", "renderAll FAILED " + (e && e.message ? e.message : e));
      }
    }, 0);
  }

  // =========================================================
  // モード判定（入力可否・閲覧モード）
  // =========================================================
  function computeMode(){
    var st = getState();

    var bidStatus    = (st.bid && st.bid.status) ? st.bid.status : "(none)";
    var loginState   = st.loginState   || "SIGNED-OUT";
    var authState    = st.authState    || "LOCKED";       // LOCKED / UNLOCKED
    var profileState = st.profileState || "INCOMPLETE";   // INCOMPLETE / COMPLETE

    // closed 後は閲覧のみ
    var viewOnly = (bidStatus === "closed");

    // 入力可能条件:
    // - bidStatus=open
    // - login=SIGNED-IN
    // - auth=UNLOCKED
    // - profile=COMPLETE
    var inputEnabled = (
      bidStatus === "open" &&
      loginState === "SIGNED-IN" &&
      authState === "UNLOCKED" &&
      profileState === "COMPLETE" &&
      !viewOnly
    );

    return {
      bidStatus: bidStatus,
      loginState: loginState,
      authState: authState,
      profileState: profileState,
      viewOnly: !!viewOnly,
      inputEnabled: !!inputEnabled
    };
  }

  function applyMode(reason){
    var m = computeMode();

    // 既存 State API があれば更新（無ければスキップ）
    safeCall(window.BidderState, "setViewOnly", m.viewOnly);
    safeCall(window.BidderState, "setInputEnabled", m.inputEnabled);

    L("mode",
      "status=" + m.bidStatus +
      " login=" + m.loginState +
      " bidderId=" + ((getState().bidderId)||"(none)") +
      " auth=" + m.authState +
      " profile=" + m.profileState +
      " input=" + (m.inputEnabled ? "true" : "false") +
      " viewOnly=" + (m.viewOnly ? "true" : "false")
    );

    scheduleRender(reason || "applyMode");
  }

  // =========================================================
  // データロード
  // =========================================================
  function loadAll(reason){
    var st = getState();
    var bidNo = (window.BidderConfig && window.BidderConfig.BID_NO) ? window.BidderConfig.BID_NO : (st.bidNo || "");
    if(!bidNo){
      L("load", "FAILED BID_NO is empty");
      return Promise.reject(new Error("BID_NO が未設定です"));
    }

    L("load", "bids/" + bidNo + " ...");

    // BidderDB 側のAPI差異に対応
    // 優先: loadAll(bidNo) -> loadBid + loadItems
    var p;
    if(window.BidderDB && typeof window.BidderDB.loadAll === "function"){
      p = window.BidderDB.loadAll(bidNo);
    }else{
      var p1 = (window.BidderDB && typeof window.BidderDB.loadBid === "function") ? window.BidderDB.loadBid(bidNo) : Promise.resolve(null);
      var p2 = (window.BidderDB && typeof window.BidderDB.loadItems === "function") ? window.BidderDB.loadItems(bidNo) : Promise.resolve([]);
      p = Promise.all([p1, p2]).then(function(){ return true; });
    }

    return Promise.resolve(p).then(function(){
      applyMode(reason || "loadAll");
      L("load", "OK");
      return true;
    }).catch(function(e){
      L("load", "FAILED " + (e && e.message ? e.message : e));
      applyMode("loadAll-failed");
      throw e;
    });
  }

  function clearAll(reason){
    // ログアウト後の表示クリア
    safeCall(window.BidderState, "setOffer", null);
    safeCall(window.BidderState, "setOfferLines", {});
    safeCall(window.BidderState, "setBid", { status:"(empty)" });
    safeCall(window.BidderState, "setItems", []);
    safeCall(window.BidderState, "setProfileState", "INCOMPLETE");
    applyMode(reason || "clearAll");
  }

  // =========================================================
  // ボタン処理
  // =========================================================
  function onLogin(){
    // 入札者ID/PW
    var bidderId = val("#bidderId");
    var password = val("#bidderPassword");

    if(!bidderId){
      L("login", "FAILED 入札者IDが空です");
      return;
    }
    if(!password){
      L("login", "FAILED パスワードが空です");
      return;
    }

    L("login", "clicked bidderId=" + bidderId);

    if(!(window.BidderAuth && typeof window.BidderAuth.signIn === "function")){
      L("login", "FAILED BidderAuth.signIn missing");
      return;
    }

    // loginState を先に出す（体感の改善）
    safeCall(window.BidderState, "setBidderId", bidderId, "");
    safeCall(window.BidderState, "setLoginState", "SIGNING-IN"); // 実装が無ければ無視される
    scheduleRender("login-clicked");

    window.BidderAuth.signIn(bidderId, password)
      .then(function(){
        L("login", "OK");
        return loadAll("after-login");
      })
      .catch(function(e){
        L("login", "FAILED " + (e && e.message ? e.message : e));
        applyMode("login-failed");
      });
  }

  function onLogout(){
    L("logout", "clicked");
    if(!(window.BidderAuth && typeof window.BidderAuth.signOut === "function")){
      L("logout", "FAILED BidderAuth.signOut missing");
      return;
    }
    window.BidderAuth.signOut()
      .then(function(){
        L("logout", "OK");
        clearAll("after-logout");
      })
      .catch(function(e){
        L("logout", "FAILED " + (e && e.message ? e.message : e));
      });
  }

  function onBidAuth(){
    // 認証コード（備考5など）
    var code = val("#bidAuthCode");
    L("auth", "clicked");

    if(!(window.BidderAuth && typeof window.BidderAuth.unlockByCode === "function")){
      L("auth", "FAILED BidderAuth.unlockByCode missing");
      return;
    }

    window.BidderAuth.unlockByCode(code)
      .then(function(){
        L("auth", "OK");
        // 認証が通れば入力可否が変わる
        applyMode("after-auth");
      })
      .catch(function(e){
        L("auth", "FAILED " + (e && e.message ? e.message : e));
        applyMode("auth-failed");
      });
  }

  function onReload(){
    L("reload", "clicked");
    loadAll("reload").catch(function(){});
  }

  function onLoadProfile(){
    // Cookie/保存データの読込
    L("cookie", "load clicked");
    if(window.BidderProfile && typeof window.BidderProfile.loadFromCookie === "function"){
      try{
        var ok = window.BidderProfile.loadFromCookie();
        L("cookie", ok ? "load OK" : "load none");
        applyMode("after-cookie-load");
      }catch(e){
        L("cookie", "load FAILED " + (e && e.message ? e.message : e));
      }
    }else{
      L("cookie", "load SKIP (BidderProfile.loadFromCookie missing)");
    }
  }

  function onClearCookie(){
    L("cookie", "clear clicked");
    if(window.BidderProfile && typeof window.BidderProfile.clearCookie === "function"){
      try{
        window.BidderProfile.clearCookie();
        L("cookie", "clear OK");
        applyMode("after-cookie-clear");
      }catch(e){
        L("cookie", "clear FAILED " + (e && e.message ? e.message : e));
      }
    }else{
      L("cookie", "clear SKIP (BidderProfile.clearCookie missing)");
    }
  }

  function onSaveOffer(){
    // 1) profile をCookie保存（要件）
    if(window.BidderProfile && typeof window.BidderProfile.saveToCookie === "function"){
      try{
        var ok = window.BidderProfile.saveToCookie();
        L("cookie", ok ? "save OK" : "save FAILED");
      }catch(e){
        L("cookie", "save FAILED " + (e && e.message ? e.message : e));
      }
    }else{
      L("cookie", "save SKIP (BidderProfile.saveToCookie missing)");
    }

    // 2) 入札(offer)保存
    var st = getState();
    var bidNo = (window.BidderConfig && window.BidderConfig.BID_NO) ? window.BidderConfig.BID_NO : (st.bidNo || "");
    var bidderId = st.bidderId || "";

    L("save", "clicked");
    if(!bidNo){
      L("save", "FAILED bidNo empty");
      return;
    }
    if(!bidderId){
      L("save", "FAILED bidderId empty");
      return;
    }

    // Offer保存API差異に対応
    // 優先: BidderOffer.upsertOffer(bidNo, bidderId) -> BidderDB.upsertOffer(bidNo, bidderId, data)
    var p = null;

    if(window.BidderOffer && typeof window.BidderOffer.upsertOffer === "function"){
      L("save", "upsertOffer ... bidderId=" + bidderId);
      p = window.BidderOffer.upsertOffer(); // 既存が state 参照型の場合
    }else if(window.BidderDB && typeof window.BidderDB.upsertOffer === "function"){
      // state から data を組み立て（rulesの validOffer に合わせる）
      var nowIso = new Date().toISOString();
      var data = {
        bidNo: bidNo,
        bidderId: bidderId,
        profile: st.profile || {},
        lines: st.offerLines || st.lines || {},
        createdAt: (st.offer && st.offer.createdAt) ? st.offer.createdAt : nowIso,
        updatedAt: nowIso,
        updatedByUid: (st.user && st.user.uid) ? st.user.uid : ""
      };
      L("save", "upsertOffer(DB) ... bidderId=" + bidderId);
      p = window.BidderDB.upsertOffer(bidNo, bidderId, data);
    }else{
      L("save", "FAILED no upsert API (BidderOffer.upsertOffer / BidderDB.upsertOffer missing)");
      return;
    }

    Promise.resolve(p).then(function(){
      L("save", "OK");
      // 再読込して確定状態を表示したい場合
      return loadAll("after-save");
    }).catch(function(e){
      // ここで rules / 権限エラーが来る
      L("save", "FAILED " + (e && e.message ? e.message : e));
      applyMode("save-failed");
    });
  }

  function onPrint(){
    L("print", "clicked");
    if(window.BidderPrint && typeof window.BidderPrint.print === "function"){
      try{
        window.BidderPrint.print();
        L("print", "OK");
      }catch(e){
        L("print", "FAILED " + (e && e.message ? e.message : e));
      }
    }else{
      L("print", "SKIP (BidderPrint.print missing)");
    }
  }

  function onPdf(){
    L("pdf", "clicked");
    if(window.BidderPrint && typeof window.BidderPrint.pdf === "function"){
      try{
        window.BidderPrint.pdf();
        L("pdf", "OK");
      }catch(e){
        L("pdf", "FAILED " + (e && e.message ? e.message : e));
      }
    }else{
      L("pdf", "SKIP (BidderPrint.pdf missing)");
    }
  }

  function onLogClear(){
    if(window.BidderLog && typeof window.BidderLog.clear === "function"){
      window.BidderLog.clear();
      L("log", "clear OK");
    }else{
      // BidderLog.clear が無くても console には出せる
      L("log", "clear SKIP (BidderLog.clear missing)");
    }
    scheduleRender("log-clear");
  }

  // =========================================================
  // イベント結線
  // =========================================================
  function bind(id, handler){
    var el = document.getElementById(id);
    if(!el) return;
    el.addEventListener("click", function(ev){
      try{
        ev.preventDefault();
      }catch(e){}
      handler();
    });
  }

  // =========================================================
  // 起動
  // =========================================================
  function boot(){
    var bidNo = (window.BidderConfig && window.BidderConfig.BID_NO) ? window.BidderConfig.BID_NO : "";
    L("config", "BID_NO=" + (bidNo || "(empty)"));
    L("boot", "bidNo=" + (bidNo || "(empty)"));

    // 初期表示（最低限）
    safeCall(window.BidderState, "setViewOnly", false);
    safeCall(window.BidderState, "setInputEnabled", false);
    applyMode("boot");

    // Auth監視（重要）
    if(window.BidderAuth && typeof window.BidderAuth.watchAuthState === "function"){
      window.BidderAuth.watchAuthState();
      L("auth", "watchAuthState OK");
    }else{
      L("auth", "watchAuthState missing");
    }

    // ボタンIDはHTMLに合わせておく（存在しない場合は無視される）
    bind("btnLogin", onLogin);
    bind("btnLogout", onLogout);
    bind("btnBidAuth", onBidAuth);
    bind("btnReload", onReload);
    bind("btnSave", onSaveOffer);
    bind("btnLoadProfile", onLoadProfile);
    bind("btnPrint", onPrint);
    bind("btnPdf", onPdf);
    bind("btnCookieClear", onClearCookie);
    bind("btnLogClear", onLogClear);

    // 起動時：ログイン済みなら自動ロード
    // （Auth監視が走った後に user が入る場合があるので少し遅らせる）
    setTimeout(function(){
      var st = getState();
      if(st && st.user){
        loadAll("boot-autoload").catch(function(){});
      }else{
        scheduleRender("boot-noautologin");
      }
    }, 50);
  }

  // DOM ready
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  // 公開（デバッグ用途）
  window.BidderApp = {
    boot: boot,
    loadAll: loadAll,
    applyMode: applyMode
  };
})();