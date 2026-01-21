// [JST 2026-01-20 19:00]  bidder/js/05_bidder_auth.js  v20260120-01
(function (global) {
  var BID = global.BID = global.BID || {};

  function trim(s) { return (s == null) ? "" : String(s).replace(/^\s+|\s+$/g, ""); }

  // =========================================================
  // [05-01] 認証（備考5）
  // =========================================================
  BID.Auth = {
    // [05-02] 認証実行
    tryAuth: function () {
      var st = BID.State.get();
      var bid = st.bid;

      if (!bid) {
        BID.Render.setError("入札データが未読込です。");
        BID.Log.write("[auth] NG: bid未読込");
        return false;
      }

      // draft/closed は実務上 認証しても入力できない（UIは後段で制御）
      var input = document.getElementById("authCode");
      var codeIn = input ? trim(input.value) : "";
      if (!codeIn) {
        BID.Render.setInfo(BID.CONFIG.MSG_AUTH_PROMPT);
        BID.Render.setAuthResult("認証コードを入力してください。");
        BID.Log.write("[auth] NG: empty");
        return false;
      }

      var correct = trim(BID.DB.getAuthCodeFromBid(bid));
      if (!correct) {
        BID.Render.setError("認証コード（備考5）が設定されていません。");
        BID.Render.setAuthResult("認証コードが設定されていません。");
        BID.Log.write("[auth] NG: bid.note5 empty");
        return false;
      }

      if (codeIn === correct) {
        BID.State.setAuthState("UNLOCKED");
        BID.Render.setAuthResult("認証に成功しました。");
        BID.Render.setOk("認証に成功しました。");
        BID.Log.write("[auth] OK");
        return true;
      } else {
        BID.State.setAuthState("LOCKED");
        BID.Render.setAuthResult("認証に失敗しました。");
        BID.Render.setError("認証に失敗しました。");
        BID.Log.write("[auth] NG: mismatch");
        return false;
      }
    }
  };
})(window);