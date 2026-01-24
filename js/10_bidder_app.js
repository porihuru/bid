/* [JST 2026-01-24 22:25]  10_bidder_app.js v20260124-03
   - index.html のIDに完全一致（btnLoad, txtBidderId, btnAuth, btnSaveOffer等）
   - 05_bidder_auth.js が bidAuth() しか持たない場合にも対応
   - ログが流れ続ける問題を避ける：不要な連続描画・連続ログを抑制
*/
(function(){
  "use strict";

  var FILE = "10_bidder_app.js";
  var VER  = "v20260124-03";
  var TS   = new Date().toISOString();

  // ----------------------------
  // logging / version
  // ----------------------------
  function L(tag, msg){
    if(window.BidderLog && typeof window.BidderLog.write === "function"){
      window.BidderLog.write(tag, msg);
    }else{
      try{ console.log("[" + tag + "] " + msg); }catch(e){}
    }
  }
  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });
  L("ver", TS + " " + FILE + " " + VER);

  // ----------------------------
  // DOM helpers
  // ----------------------------
  function $(id){
    try{ return document.getElementById(id); }catch(e){ return null; }
  }
  function V(id){
    var el = $(id);
    if(!el) return "";
    return (el.value == null) ? "" : String(el.value).trim();
  }

  function safeCall(obj, fn /*, args */){
    try{
      if(obj && typeof obj[fn] === "function"){
        return obj[fn].apply(obj, Array.prototype.slice.call(arguments, 2));
      }
    }catch(e){
      L("app", "safeCall FAILED " + fn + " " + (e && e.message ? e.message : e));
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

  // ----------------------------
  // render throttle (copy邪魔対策)
  // ----------------------------
  var _renderScheduled = false;
  function scheduleRender(reason){
    if(_renderScheduled) return;
    _renderScheduled = true;
    setTimeout(function(){
      _renderScheduled = false;
      try{
        if(window.BidderRender && typeof window.BidderRender.renderAll === "function"){
          window.BidderRender.renderAll();
          if(reason) L("render", "OK (" + reason + ")");
        }
      }catch(e){
        L("render", "FAILED " + (e && e.message ? e.message : e));
      }
    }, 0);
  }

  // ----------------------------
  // mode compute
  // ----------------------------
  function computeMode(){
    var st = getState();

    // loginState が State に無い場合、userの有無で補正（重要）
    var user = st.user || null;
    var loginState = st.loginState || (user ? "SIGNED-IN" : "SIGNED-OUT");

    var bidStatus  = (st.bid && st.bid.status) ? st.bid.status : "(none)";
    var authState  = st.authState || "LOCKED";              // LOCKED / UNLOCKED
    var profState  = st.profileState || "INCOMPLETE";       // INCOMPLETE / COMPLETE

    var viewOnly   = (bidStatus === "closed");

    var inputEnabled = (
      bidStatus === "open" &&
      loginState === "SIGNED-IN" &&
      authState === "UNLOCKED" &&
      profState === "COMPLETE" &&
      !viewOnly
    );

    return {
      bidStatus: bidStatus,
      loginState: loginState,
      authState: authState,
      profileState: profState,
      viewOnly: !!viewOnly,
      inputEnabled: !!inputEnabled
    };
  }

  function applyMode(reason){
    var m = computeMode();

    safeCall(window.BidderState, "setViewOnly", m.viewOnly);
    safeCall(window.BidderState, "setInputEnabled", m.inputEnabled);
    safeCall(window.BidderState, "setLoginState", m.loginState); // 実装が無ければ無視

    // 連続で同じ内容を出しやすいので、ここは「必要最小限」にする
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

  // ----------------------------
  // load
  // ----------------------------
  function loadAll(reason){
    var st = getState();
    var bidNo = (window.BidderConfig && window.BidderConfig.BID_NO) ? window.BidderConfig.BID_NO : (st.bidNo || "");
    if(!bidNo){
      L("load", "FAILED BID_NO is empty");
      return Promise.reject(new Error("BID_NO が未設定です"));
    }

    L("load", "bids/" + bidNo + " ...");

    var p;
    if(window.BidderDB && typeof window.BidderDB.loadAll === "function"){
      p = window.BidderDB.loadAll(bidNo);
    }else{
      var p1 = (window.BidderDB && typeof window.BidderDB.loadBid === "function") ? window.BidderDB.loadBid(bidNo) : Promise.resolve(null);
      var p2 = (window.BidderDB && typeof window.BidderDB.loadItems === "function") ? window.BidderDB.loadItems(bidNo) : Promise.resolve([]);
      p = Promise.all([p1, p2]).then(function(){ return true; });
    }

    return Promise.resolve(p).then(function(){
      safeCall(window.BidderState, "setLastLoadedAt", new Date().toISOString());
      L("load", "OK");
      applyMode(reason || "loadAll");
      return true;
    }).catch(function(e){
      L("load", "FAILED " + (e && e.message ? e.message : e));
      applyMode("loadAll-failed");
      throw e;
    });
  }

  // ----------------------------
  // actions
  // ----------------------------
  function onReload(){
    L("reload", "clicked");
    loadAll("reload").catch(function(){});
  }

  function onLogin(){
    var bidderId = V("txtBidderId");
    var pass     = V("txtBidderPass");
    if(!bidderId){ L("login", "FAILED 入札者IDが空です"); return; }
    if(!pass){     L("login", "FAILED パスワードが空です"); return; }

    if(!(window.BidderAuth && typeof window.BidderAuth.signIn === "function")){
      L("login", "FAILED BidderAuth.signIn missing");
      return;
    }

    L("login", "clicked bidderId=" + bidderId);

    // 体感改善（先に状態反映）
    safeCall(window.BidderState, "setBidderId", bidderId, "");
    safeCall(window.BidderState, "setLoginState", "SIGNING-IN");
    scheduleRender("login-clicked");

    window.BidderAuth.signIn(bidderId, pass)
      .then(function(){
        safeCall(window.BidderState, "setLoginState", "SIGNED-IN");
        L("login", "OK");
        return loadAll("after-login");
      })
      .catch(function(e){
        safeCall(window.BidderState, "setLoginState", "SIGNED-OUT");
        L("login", "FAILED " + (e && e.message ? e.message : e));
        applyMode("login-failed");
      });
  }

  function onLogout(){
    if(!(window.BidderAuth && typeof window.BidderAuth.signOut === "function")){
      L("logout", "FAILED BidderAuth.signOut missing");
      return;
    }
    L("logout", "clicked");

    window.BidderAuth.signOut()
      .then(function(){
        safeCall(window.BidderState, "setLoginState", "SIGNED-OUT");
        L("logout", "OK");
        applyMode("after-logout");
      })
      .catch(function(e){
        L("logout", "FAILED " + (e && e.message ? e.message : e));
      });
  }

  function onBidAuth(){
    var code = V("txtAuthCode");
    L("auth", "clicked");

    // 05が unlockByCode を持つ場合
    if(window.BidderAuth && typeof window.BidderAuth.unlockByCode === "function"){
      window.BidderAuth.unlockByCode(code)
        .then(function(){
          L("auth", "OK");
          applyMode("after-auth");
        })
        .catch(function(e){
          L("auth", "FAILED " + (e && e.message ? e.message : e));
          applyMode("auth-failed");
        });
      return;
    }

    // 05が bidAuth を持つ場合（あなたの提示はこれ）
    if(window.BidderAuth && typeof window.BidderAuth.bidAuth === "function"){
      try{
        var ok = window.BidderAuth.bidAuth(code); // throwする設計
        L("auth", ok ? "OK" : "FAILED");
        applyMode("after-auth");
      }catch(e){
        L("auth", "FAILED " + (e && e.message ? e.message : e));
        applyMode("auth-failed");
      }
      return;
    }

    L("auth", "FAILED BidderAuth.unlockByCode / bidAuth missing");
  }

  function onProfileLoad(){
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
      L("cookie", "load SKIP (loadFromCookie missing)");
    }
  }

  function onProfileSave(){
    L("cookie", "save clicked");
    if(window.BidderProfile && typeof window.BidderProfile.saveToCookie === "function"){
      try{
        var ok = window.BidderProfile.saveToCookie();
        L("cookie", ok ? "save OK" : "save FAILED");
        applyMode("after-cookie-save");
      }catch(e){
        L("cookie", "save FAILED " + (e && e.message ? e.message : e));
      }
    }else{
      L("cookie", "save SKIP (saveToCookie missing)");
    }
  }

  function onCookieClear(){
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
      L("cookie", "clear SKIP (clearCookie missing)");
    }
  }

  function onSaveOffer(){
    L("save", "clicked");

    // プロフィールは保存しておく（要件）
    if(window.BidderProfile && typeof window.BidderProfile.saveToCookie === "function"){
      try{
        window.BidderProfile.saveToCookie();
        L("cookie", "save OK (auto)");
      }catch(e){
        L("cookie", "save FAILED (auto) " + (e && e.message ? e.message : e));
      }
    }

    var st = getState();
    var bidNo = (window.BidderConfig && window.BidderConfig.BID_NO) ? window.BidderConfig.BID_NO : (st.bidNo || "");
    var bidderId = st.bidderId || "";
    if(!bidNo){ L("save", "FAILED bidNo empty"); return; }
    if(!bidderId){ L("save", "FAILED bidderId empty"); return; }

    // 優先：07側の upsertOffer があれば呼ぶ（state参照型）
    if(window.BidderOffer && typeof window.BidderOffer.upsertOffer === "function"){
      Promise.resolve(window.BidderOffer.upsertOffer())
        .then(function(){
          safeCall(window.BidderState, "setLastSavedAt", new Date().toISOString());
          L("save", "OK");
          return loadAll("after-save");
        })
        .catch(function(e){
          L("save", "FAILED " + (e && e.message ? e.message : e));
          applyMode("save-failed");
        });
      return;
    }

    // 04側に upsertOffer がある場合（rules validOffer形に寄せる）
    if(window.BidderDB && typeof window.BidderDB.upsertOffer === "function"){
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

      Promise.resolve(window.BidderDB.upsertOffer(bidNo, bidderId, data))
        .then(function(){
          safeCall(window.BidderState, "setLastSavedAt", new Date().toISOString());
          L("save", "OK");
          return loadAll("after-save");
        })
        .catch(function(e){
          L("save", "FAILED " + (e && e.message ? e.message : e));
          applyMode("save-failed");
        });
      return;
    }

    L("save", "FAILED upsert API missing (BidderOffer.upsertOffer / BidderDB.upsertOffer)");
  }

  function onPrint(){
    L("print", "clicked");
    if(window.BidderPrint && typeof window.BidderPrint.print === "function"){
      try{ window.BidderPrint.print(); L("print", "OK"); }
      catch(e){ L("print", "FAILED " + (e && e.message ? e.message : e)); }
    }else{
      L("print", "SKIP (BidderPrint.print missing)");
    }
  }

  function onPdf(){
    L("pdf", "clicked");
    if(window.BidderPrint && typeof window.BidderPrint.pdf === "function"){
      try{ window.BidderPrint.pdf(); L("pdf", "OK"); }
      catch(e){ L("pdf", "FAILED " + (e && e.message ? e.message : e)); }
    }else{
      L("pdf", "SKIP (BidderPrint.pdf missing)");
    }
  }

  // ----------------------------
  // log controls (存在すれば使う)
  // ----------------------------
  var _logPaused = false;

  function onLogClear(){
    if(window.BidderLog && typeof window.BidderLog.clear === "function"){
      window.BidderLog.clear();
      L("log", "clear OK");
    }else{
      // txtLog を直接消すフォールバック
      var t = $("txtLog");
      if(t) t.value = "";
      L("log", "clear OK (fallback)");
    }
    scheduleRender("log-clear");
  }

  function onLogPause(){
    _logPaused = !_logPaused;

    // 03側に pause/resume か setPaused があれば使用
    if(window.BidderLog && typeof window.BidderLog.setPaused === "function"){
      window.BidderLog.setPaused(_logPaused);
    }else if(window.BidderLog && _logPaused && typeof window.BidderLog.pause === "function"){
      window.BidderLog.pause();
    }else if(window.BidderLog && !_logPaused && typeof window.BidderLog.resume === "function"){
      window.BidderLog.resume();
    }

    var btn = $("btnLogPause");
    if(btn) btn.textContent = _logPaused ? "ログ再開" : "ログ停止";
    L("log", _logPaused ? "paused" : "resumed");
  }

  function onLogCopy(){
    // 03側に copyAll があればそれを優先
    if(window.BidderLog && typeof window.BidderLog.copyAll === "function"){
      window.BidderLog.copyAll();
      L("log", "copy OK (BidderLog.copyAll)");
      return;
    }

    // フォールバック：txtLog を clipboard へ
    var t = $("txtLog");
    if(!t){ L("log", "copy FAILED (txtLog missing)"); return; }
    try{
      // iOS対策：まず停止
      if(!_logPaused) onLogPause();

      var text = t.value || "";
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text)
          .then(function(){ L("log", "copy OK"); })
          .catch(function(e){
            L("log", "copy FAILED " + (e && e.message ? e.message : e));
          });
      }else{
        // 旧方式
        t.focus();
        t.select();
        var ok = document.execCommand("copy");
        L("log", ok ? "copy OK (execCommand)" : "copy FAILED (execCommand)");
      }
    }catch(e){
      L("log", "copy FAILED " + (e && e.message ? e.message : e));
    }
  }

  function onLogTapAutoPause(){
    // 「ログ欄をタップすると停止」要件
    if(!_logPaused) onLogPause();
  }

  // ----------------------------
  // bind
  // ----------------------------
  function bind(id, fn){
    var el = $(id);
    if(!el) return;
    el.addEventListener("click", function(ev){
      try{ ev.preventDefault(); }catch(e){}
      fn();
    });
  }

  // ----------------------------
  // boot
  // ----------------------------
  function boot(){
    var bidNo = (window.BidderConfig && window.BidderConfig.BID_NO) ? window.BidderConfig.BID_NO : "";
    L("boot", "BID_NO=" + (bidNo || "(empty)"));

    // Auth監視（05がやる）
    if(window.BidderAuth && typeof window.BidderAuth.watchAuthState === "function"){
      window.BidderAuth.watchAuthState();
      L("auth", "watchAuthState OK");
    }else{
      L("auth", "watchAuthState missing");
    }

    // buttons
    bind("btnLoad", onReload);
    bind("btnProfileLoad", onProfileLoad);
    bind("btnPrint", onPrint);
    bind("btnPdf", onPdf);
    bind("btnCookieClear", onCookieClear);

    bind("btnLogin", onLogin);
    bind("btnLogout", onLogout);
    bind("btnAuth", onBidAuth);

    bind("btnSaveProfile", onProfileSave);
    bind("btnSaveOffer", onSaveOffer);

    bind("btnLogClear", onLogClear);
    bind("btnLogPause", onLogPause);
    bind("btnLogCopy", onLogCopy);

    // log tap auto pause
    var logBox = $("txtLog");
    if(logBox){
      logBox.addEventListener("touchstart", onLogTapAutoPause, { passive:true });
      logBox.addEventListener("mousedown", onLogTapAutoPause);
    }

    // 初回描画（状態反映）
    applyMode("boot");

    // 起動直後は「ログイン済みならロード」だけ実施（連打はしない）
    setTimeout(function(){
      var st = getState();
      if(st && st.user){
        safeCall(window.BidderState, "setLoginState", "SIGNED-IN");
        loadAll("boot-autoload").catch(function(){});
      }else{
        safeCall(window.BidderState, "setLoginState", "SIGNED-OUT");
        scheduleRender("boot-noautologin");
      }
    }, 60);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  window.BidderApp = {
    boot: boot,
    loadAll: loadAll,
    applyMode: applyMode
  };
})();