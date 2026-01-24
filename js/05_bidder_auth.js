/* [JST 2026-01-24 21:40]  05_bidder_auth.js v20260124-02
   変更点:
   - [AUTH-04] 10_bidder_app.js 側が呼ぶ unlockByCode() を追加（bidAuthの別名）
   - [AUTH-03] watchAuthState() で loginState を可能な範囲で更新（setLoginState / set / get がある場合に対応）
   - firebase 未初期化時に分かるログを追加
   - エラーメッセージを要件に合わせて一部統一（空入力:「認証コードを入力してください。」）
*/
(function(){
  var FILE = "05_bidder_auth.js";
  var VER  = "v20260124-02";
  var TS   = new Date().toISOString();

  function L(tag, msg){
    if(window.BidderLog && window.BidderLog.write) window.BidderLog.write(tag, msg);
    else try{ console.log("[" + tag + "] " + msg); }catch(e){}
  }

  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });
  L("ver", TS + " " + FILE + " " + VER);

  // =========================================================
  // 内部ユーティリティ
  // =========================================================
  function ensureFirebaseAuth(){
    if(!window.firebase || !firebase.auth){
      L("auth", "ERROR firebase/auth not initialized. (firebase or firebase.auth missing)");
      throw new Error("Firebase Auth が初期化されていません。");
    }
    return firebase.auth();
  }

  function safeCall(obj, fnName /*, args... */){
    try{
      if(obj && typeof obj[fnName] === "function"){
        return obj[fnName].apply(obj, Array.prototype.slice.call(arguments, 2));
      }
    }catch(e){
      L("auth", "safeCall FAILED " + fnName + " " + (e && e.message ? e.message : e));
    }
    return undefined;
  }

  function setLoginState(stateStr){
    // BidderState 実装差異に対応
    // 優先: setLoginState -> set("loginState", ...) -> 何もしない
    if(window.BidderState){
      if(typeof window.BidderState.setLoginState === "function"){
        window.BidderState.setLoginState(stateStr);
        return;
      }
      if(typeof window.BidderState.set === "function"){
        window.BidderState.set("loginState", stateStr);
        return;
      }
      // get() が返すオブジェクトを直接触れる設計でない可能性があるので、ここでは触らない
    }
  }

  function getLoginState(){
    try{
      if(window.BidderState){
        if(typeof window.BidderState.get === "function"){
          var st = window.BidderState.get();
          return st && st.loginState ? st.loginState : "";
        }
        if(typeof window.BidderState.getState === "function"){
          var st2 = window.BidderState.getState();
          return st2 && st2.loginState ? st2.loginState : "";
        }
      }
    }catch(e){}
    return "";
  }

  // bidderId -> email 変換
  function bidderIdToEmail(bidderId){
    // BidderConfig.BIDDER_EMAIL_DOMAIN が "@bid.local" のように先頭@込み想定
    var dom = (window.BidderConfig && window.BidderConfig.BIDDER_EMAIL_DOMAIN) ? window.BidderConfig.BIDDER_EMAIL_DOMAIN : "@bid.local";
    return bidderId + dom;
  }

  // =========================================================
  // [AUTH-01] ログイン
  // =========================================================
  function signIn(bidderId, password){
    var auth = ensureFirebaseAuth();

    var email = bidderIdToEmail(bidderId);
    L("auth", "signInWithEmailAndPassword ... bidderId=" + bidderId + " email=" + email);

    return auth.signInWithEmailAndPassword(email, password)
      .then(function(cred){
        var u = cred.user;

        // state反映（存在するものだけ呼ぶ）
        safeCall(window.BidderState, "setBidderId", bidderId, email);
        safeCall(window.BidderState, "setUser", u);
        setLoginState("SIGNED-IN");

        // ログイン時は認証はLOCKEDのまま（入札認証が別工程）
        safeCall(window.BidderState, "setAuthState", "LOCKED");

        L("auth", "SIGNED-IN uid=" + (u ? u.uid : "(none)"));
        return u;
      })
      .catch(function(e){
        var msg = (e && e.message) ? e.message : (""+e);
        L("auth", "signIn FAILED " + msg);
        throw e;
      });
  }

  // =========================================================
  // [AUTH-02] ログアウト
  // =========================================================
  function signOut(){
    var auth = ensureFirebaseAuth();

    L("logout", "clicked");
    return auth.signOut()
      .then(function(){
        safeCall(window.BidderState, "setUser", null);
        safeCall(window.BidderState, "setAuthState", "LOCKED");
        safeCall(window.BidderState, "setBidderId", "", "");
        setLoginState("SIGNED-OUT");

        L("logout", "OK");
        return true;
      })
      .catch(function(e){
        var msg = (e && e.message) ? e.message : (""+e);
        L("logout", "FAILED " + msg);
        throw e;
      });
  }

  // =========================================================
  // [AUTH-03] 認証状態の監視（起動時に1回呼ぶ想定）
  // =========================================================
  function watchAuthState(){
    var auth = ensureFirebaseAuth();

    auth.onAuthStateChanged(function(user){
      safeCall(window.BidderState, "setUser", user || null);

      if(!user){
        safeCall(window.BidderState, "setAuthState", "LOCKED");
        setLoginState("SIGNED-OUT");
        L("authStateChanged", "SIGNED-OUT (auth=LOCKED)");
      }else{
        setLoginState("SIGNED-IN");
        // 入札認証は別工程なのでここではLOCKEDのままにする（上書きしない）
        L("authStateChanged", "SIGNED-IN uid=" + user.uid);
      }
    });
  }

  // =========================================================
  // [AUTH-04] 入札認証（従来どおり：現状は簡易）
  // =========================================================
  function bidAuth(authCode){
    // 要件: 空の場合は「認証コードを入力してください。」
    if(!authCode){
      throw new Error("認証コードを入力してください。");
    }

    var ls = getLoginState();
    if(ls !== "SIGNED-IN"){
      throw new Error("未ログインです");
    }

    // TODO: 既存仕様が「bids の備考5と照合」なら、ここでDB照合を実装
    safeCall(window.BidderState, "setAuthState", "UNLOCKED");
    L("auth", "UNLOCKED (bidAuth OK)");
    return true;
  }

  // =========================================================
  // [AUTH-05] 互換：10_bidder_app.js が呼ぶ名前に合わせる
  // =========================================================
  function unlockByCode(authCode){
    // await されてもOKなように Promise 化
    try{
      var r = bidAuth(authCode);
      return Promise.resolve(r);
    }catch(e){
      return Promise.reject(e);
    }
  }

  // 公開API
  window.BidderAuth = {
    bidderIdToEmail: bidderIdToEmail,
    signIn: signIn,
    signOut: signOut,
    watchAuthState: watchAuthState,

    // 既存名
    bidAuth: bidAuth,

    // 追加名（10側互換）
    unlockByCode: unlockByCode
  };
})();