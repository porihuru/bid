/* [JST 2026-01-24 21:00]  05_bidder_auth.js v20260124-01 */
(function(){
  var FILE = "05_bidder_auth.js";
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

  function bidderIdToEmail(bidderId){
    return bidderId + window.BidderConfig.BIDDER_EMAIL_DOMAIN;
  }

  function signIn(bidderId, password){
    // [AUTH-01] 入札者ID+PW -> Email/PW に変換してログイン
    var email = bidderIdToEmail(bidderId);
    L("auth", "signInWithEmailAndPassword ... bidderId=" + bidderId);

    return firebase.auth().signInWithEmailAndPassword(email, password)
      .then(function(cred){
        var u = cred.user;
        window.BidderState.setBidderId(bidderId, email);
        window.BidderState.setUser(u);
        L("auth", "signed in (uid=" + u.uid + ")");
        return u;
      })
      .catch(function(e){
        var msg = (e && e.message) ? e.message : (""+e);
        L("auth", "signIn FAILED " + msg);
        throw e;
      });
  }

  function signOut(){
    // [AUTH-02] ログアウト
    L("logout", "clicked");
    return firebase.auth().signOut()
      .then(function(){
        window.BidderState.setUser(null);
        window.BidderState.setAuthState("LOCKED");
        window.BidderState.setBidderId("", "");
        L("logout", "OK");
        return true;
      })
      .catch(function(e){
        var msg = (e && e.message) ? e.message : (""+e);
        L("logout", "FAILED " + msg);
        throw e;
      });
  }

  function watchAuthState(){
    // [AUTH-03] onAuthStateChanged
    firebase.auth().onAuthStateChanged(function(user){
      window.BidderState.setUser(user || null);
      if(!user){
        // 状態リセット（最低限）
        window.BidderState.setAuthState("LOCKED");
      }
      // NOTE: data load は app 側で実施
      L("authStateChanged", "renderAll OK");
    });
  }

  function bidAuth(authCode){
    // [AUTH-04] 入札認証（従来どおり）
    // ここは「bids/{bidNo}.note / memo / authCode」等の仕様に合わせる必要があります。
    // 今回は「画面入力が空でない」かつ「ログイン済み」ならUNLOCKするサンプル。
    if(!authCode){
      throw new Error("認証コードが空です");
    }
    if(window.BidderState.get().loginState !== "SIGNED-IN"){
      throw new Error("未ログインです");
    }

    // 既存の仕様が「bids の備考5と照合」なら、DBから値を取り出して比較してください。
    window.BidderState.setAuthState("UNLOCKED");
    L("auth", "OK");
    return true;
  }

  window.BidderAuth = {
    bidderIdToEmail: bidderIdToEmail,
    signIn: signIn,
    signOut: signOut,
    watchAuthState: watchAuthState,
    bidAuth: bidAuth
  };
})();
