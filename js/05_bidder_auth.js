// [JST 2026-01-22 22:05] bidder/js/05_bidder_auth.js v20260122-01
// [BID-05] 認証（備考5）
// 目的:
//  - 認証ボタン押下で必ず画面が変わる
//  - 失敗時は必ずエラー表示を返す（要求事項）

(function (global) {
  var BID = global.BID = global.BID || {};

  function trim(s) {
    return (s == null) ? "" : String(s).replace(/^\s+|\s+$/g, "");
  }

  BID.Auth = {
    // [BID-05-01] 認証実行（成功:true / 失敗:false）
    tryAuth: function () {
      var st = BID.State.get();
      var bid = st.bid;

      // [BID-05-02] bid未読込は失敗
      if (!bid) {
        BID.State.setAuthState("LOCKED");
        BID.Render.setError("入札データが未読込です。");
        if (BID.Log && BID.Log.write) BID.Log.write("[auth] NG: bid not loaded");
        BID.Render.renderAll();
        return false;
      }

      // [BID-05-03] 入力取得
      var input = document.getElementById("authCode");
      var codeIn = input ? trim(input.value) : "";

      // [BID-05-04] 空入力は失敗（必ずエラー）
      if (!codeIn) {
        BID.State.setAuthState("LOCKED");
        BID.Render.setError("認証コードを入力してください。");
        if (BID.Log && BID.Log.write) BID.Log.write("[auth] NG: empty");
        BID.Render.renderAll();
        return false;
      }

      // [BID-05-05] 正解コード取得（note5優先）
      var correct = trim(BID.DB.getAuthCodeFromBid(bid));
      if (!correct) {
        BID.State.setAuthState("LOCKED");
        BID.Render.setError("認証コードが設定されていません。");
        if (BID.Log && BID.Log.write) BID.Log.write("[auth] NG: code not set");
        BID.Render.renderAll();
        return false;
      }

      // [BID-05-06] 判定
      if (codeIn === correct) {
        BID.State.setAuthState("UNLOCKED");
        BID.Render.setOk("認証に成功しました。");
        if (BID.Log && BID.Log.write) BID.Log.write("[auth] OK");
        BID.Render.renderAll();
        return true;
      } else {
        BID.State.setAuthState("LOCKED");
        BID.Render.setError("認証に失敗しました。");
        if (BID.Log && BID.Log.write) BID.Log.write("[auth] NG: mismatch");
        BID.Render.renderAll();
        return false;
      }
    }
  };
})(window);
