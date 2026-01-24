// [JST 2026-01-23 22:30] js/05_bidder_login.js v20260123-01
// [BID-05] ログイン（入札者ID+PW → email化して signInWithEmailAndPassword）
(function (global) {
  var BID = global.BID = global.BID || {};

  function el(id){ return document.getElementById(id); }
  function trim(s){ return (s==null) ? "" : String(s).replace(/^\s+|\s+$/g,""); }
  function msgOf(e){ return (e && e.message) ? e.message : String(e || ""); }

  function bidderIdToEmail(bidderId){
    var dom = (BID.CONFIG && BID.CONFIG.AUTH_EMAIL_DOMAIN) ? BID.CONFIG.AUTH_EMAIL_DOMAIN : "bid.local";
    return String(bidderId) + "@" + dom;
  }

  BID.Login = {
    bidderIdToEmail: bidderIdToEmail,

    applyBidderIdToProfileUI: function (bidderId) {
      var inp = el("inpBidderId");
      if (inp) inp.value = bidderId || "";
    },

    signIn: function () {
      var bidderId = trim(el("loginId") ? el("loginId").value : "");
      var pw = trim(el("loginPw") ? el("loginPw").value : "");
      if (!bidderId) throw new Error("入札者IDが未入力です。");
      if (!pw) throw new Error("パスワードが未入力です。");

      var email = bidderIdToEmail(bidderId);
      BID.Log.write("[login] start: " + bidderId + " (" + email + ")");

      return BID.DB.auth().signInWithEmailAndPassword(email, pw).then(function (cred) {
        var u = cred && cred.user ? cred.user : BID.DB.auth().currentUser;
        BID.State.setUser(u);
        BID.State.setBidderId(bidderId);

        // profile欄にも反映（入札者番号=ID）
        BID.Login.applyBidderIdToProfileUI(bidderId);

        // 表示
        if (el("loginResult")) el("loginResult").textContent = "ログイン成功: " + bidderId;
        BID.Log.write("[login] OK uid=" + (u ? u.uid : "?"));
        return { ok:true, bidderId: bidderId };
      }).catch(function (e) {
        var m = msgOf(e);
        if (el("loginResult")) el("loginResult").textContent = "ログイン失敗: " + m;
        BID.Log.write("[login] FAILED " + m);
        throw e;
      });
    },

    signOut: function () {
      BID.Log.write("[logout] start");
      return BID.DB.auth().signOut().then(function () {
        BID.State.setUser(null);
        BID.State.setBidderId("");
        if (el("loginResult")) el("loginResult").textContent = "ログアウトしました。";
        BID.Log.write("[logout] OK");
        return { ok:true };
      }).catch(function (e) {
        var m = msgOf(e);
        BID.Log.write("[logout] FAILED " + m);
        throw e;
      });
    }
  };

  try { if (BID.Log && BID.Log.ver) BID.Log.ver("05_bidder_login.js", "v20260123-01"); } catch (e) {}
})(window);
