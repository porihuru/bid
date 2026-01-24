// [JST 2026-01-24 21:00] bidder/js/05_bidder_auth.js v20260124-01
// [BID-05] 入札認証（備考5）: ログイン後に実施
(function (global) {
  var BID = global.BID = global.BID || {};
  if (BID.Build && BID.Build.register) BID.Build.register("05_bidder_auth.js", "v20260124-01");

  function trim(s) { return (s == null) ? "" : String(s).replace(/^\s+|\s+$/g, ""); }

  BID.Auth = {
    tryAuth: function () {
      var st = BID.State.get();
      var bid = st.bid;

      if (!st.user) {
        if (BID.Render) BID.Render.setError("先にログインしてください。");
        if (BID.Log) BID.Log.write("[auth] NG: not signed in");
        return false;
      }
      if (!bid) {
        if (BID.Render) BID.Render.setError("入札データが未読込です。");
        if (BID.Log) BID.Log.write("[auth] NG: bid not loaded");
        return false;
      }

      var codeIn = "";
      var input = document.getElementById("authCode");
      if (input) codeIn = trim(input.value);
      if (!codeIn) {
        if (BID.Render) {
          BID.Render.setInfo(BID.CONFIG.MSG_AUTH_PROMPT);
          BID.Render.setAuthResult("認証コードを入力してください。");
        }
        if (BID.Log) BID.Log.write("[auth] NG: empty");
        return false;
      }

      var correct = trim(BID.DB.getAuthCodeFromBid(bid));
      if (!correct) {
        if (BID.Render) {
          BID.Render.setError("認証コード（備考5）が設定されていません。");
          BID.Render.setAuthResult("認証コードが設定されていません。");
        }
        if (BID.Log) BID.Log.write("[auth] NG: bid.note5 empty");
        return false;
      }

      if (codeIn === correct) {
        BID.State.setAuthState("UNLOCKED");
        if (BID.Render) {
          BID.Render.setAuthResult("認証に成功しました。");
          BID.Render.setOk("認証に成功しました。");
        }
        if (BID.Log) BID.Log.write("[auth] OK");
        return true;
      } else {
        BID.State.setAuthState("LOCKED");
        if (BID.Render) {
          BID.Render.setAuthResult("認証に失敗しました。");
          BID.Render.setError("認証に失敗しました。");
        }
        if (BID.Log) BID.Log.write("[auth] NG: mismatch");
        return false;
      }
    }
  };

})(window);
