// [JST 2026-01-20 20:10] bidder/js/05_bidder_auth.js v20260120-03
// [BID-05] 入札認証（認証コード：備考5）
(function (global) {
  var BID = global.BID = global.BID || {};

  function trim(s) {
    return (s == null) ? "" : String(s).replace(/^\s+|\s+$/g, "");
  }

  BID.Auth = {
    tryAuth: function () {
      var st = BID.State.get();
      var bid = st.bid;

      if (!bid) {
        BID.State.setAuthState("LOCKED");
        BID.Render.setError("入札データが未読込です。");
        BID.Log.write("[auth] NG: bid not loaded");
        BID.Render.renderAll();
        return false;
      }

      var input = document.getElementById("authCode");
      var codeIn = input ? trim(input.value) : "";

      if (!codeIn) {
        BID.State.setAuthState("LOCKED");
        BID.Render.setError("認証コードを入力してください。");
        BID.Log.write("[auth] NG: empty");
        BID.Render.renderAll();
        return false;
      }

      var correct = trim(BID.DB.getAuthCodeFromBid(bid));
      if (!correct) {
        BID.State.setAuthState("LOCKED");
        BID.Render.setError("認証コードが設定されていません。");
        BID.Log.write("[auth] NG: code not set");
        BID.Render.renderAll();
        return false;
      }

      if (codeIn === correct) {
        BID.State.setAuthState("UNLOCKED");
        BID.Render.setOk("認証に成功しました。");
        BID.Log.write("[auth] OK");
        BID.Render.renderAll();
        return true;
      } else {
        BID.State.setAuthState("LOCKED");
        BID.Render.setError("認証に失敗しました。");
        BID.Log.write("[auth] NG: mismatch");
        BID.Render.renderAll();
        return false;
      }
    }
  };
})(window);
