// [JST 2026-01-22 22:05] bidder/js/10_bidder_app.js v20260122-01
// [BID-10] 起動・イベント配線（最小修正版）
// 目的:
//  - 起動直後に bidNo を確実にstateへ入れる（未設定なら即ログ/エラー）
//  - 認証ボタン押下で必ず画面が変わる（成功/失敗とも）
// 注意:
//  - BID.DB / BID.Profile / BID.Offer 等は既存のまま利用する想定

(function (global) {
  var BID = global.BID = global.BID || {};

  function el(id) { return document.getElementById(id); }
  function nowIso() { return new Date().toISOString(); }

  // =========================================================
  // [10-00] 追加：共通ログ＆画面通知（ボタン無反応対策）
  // =========================================================
  function report(action, ok, detail) {
    var msg = action + " : " + (ok ? "OK" : "NG") + (detail ? (" / " + detail) : "");
    try { BID.Log.write("[ui] " + msg); } catch (e) {}
    try {
      if (ok) BID.Render.setOk(msg);
      else BID.Render.setError(msg);
    } catch (e2) {}
  }

  function safeRun(action, fn) {
    try {
      BID.Log.write("[ui] click: " + action);
      BID.Render.setInfo(action + " を実行中...");
      return fn();
    } catch (e) {
      var m = (e && e.message) ? e.message : String(e);
      report(action, false, "例外: " + m);
    }
  }


  BID.App = {
    boot: function () {
      // =====================================================
      // [10-01] 固定bidNoをstateへ（未設定ならここでエラーが出る）
      // =====================================================
      BID.State.initBidNo();
      var st0 = BID.State.get();
      if (BID.Log && BID.Log.write) BID.Log.write("[boot] bidNo=" + (st0.bidNo || "(empty)"));

      // =====================================================
      // [10-02] 初期表示
      // =====================================================
      BID.Render.clearMessages();
      BID.Render.renderAll();

      // [10-03] ログクリア
      if (el("btnLogClear")) {
        el("btnLogClear").addEventListener("click", function () {
          if (BID.Log && BID.Log.clear) BID.Log.clear();
          if (BID.Log && BID.Log.write) BID.Log.write("[log] cleared");
        });
      }

      // [10-04] Cookie削除
      if (el("btnCookieClear")) {
        el("btnCookieClear").addEventListener("click", function () {
          if (BID.Profile && BID.Profile.clearCookie) BID.Profile.clearCookie();
          BID.Render.renderAll();
        });
      }

      // [10-05] 入力済データの読み込み
      if (el("btnLoadOffer")) {
        el("btnLoadOffer").addEventListener("click", function () {
          BID.App.loadOffer();
        });
      }

      // =====================================================
      // [10-06] 認証（成功/失敗とも tryAuth 内で renderAll される）
      // =====================================================
      if (el("btnAuth")) {
        el("btnAuth").addEventListener("click", function () {
          var ok = BID.Auth.tryAuth(); // 失敗時は tryAuth が必ず setError する

          // [10-06-01] 認証後に profileState 再判定 → モード反映
          BID.App.refreshComputedStates();
          BID.Render.renderAll();

          // [10-06-02] 失敗はここで終了（追加処理をしない）
          if (!ok) return;
        });
      }

      // =====================================================
      // [10-07] bid/items 読込（起動直後）
      // =====================================================
      BID.App.loadBidAndItems();
    },

    // =====================================================
    // [10-10] bid/items 読込
    // =====================================================
    loadBidAndItems: function () {
      var st = BID.State.get();
      var bidNo = st.bidNo;

      if (!bidNo) {
        BID.Render.setError("bidNo が未設定です（js/01_bidder_config.js を確認）。");
        if (BID.Log && BID.Log.write) BID.Log.write("[load] NG: bidNo empty");
        return;
      }

      if (BID.Log && BID.Log.write) BID.Log.write("[load] bids/" + bidNo + " ...");

      BID.DB.getBid(bidNo).then(function (bid) {
        if (!bid) {
          BID.Render.setError("bids/" + bidNo + " が見つかりません。");
          if (BID.Log && BID.Log.write) BID.Log.write("[load] bid not found");
          BID.Render.renderAll();
          return;
        }

        BID.State.setBid(bid);

        return BID.DB.getItems(bidNo).then(function (items) {
          BID.State.setItems(items);
          BID.State.setLastLoadedAt(nowIso());

          if (BID.Log && BID.Log.write) {
            BID.Log.write("[load] OK: status=" + (bid.status || "") + " items=" + (items ? items.length : 0));
          }

          // 状態計算→描画
          BID.App.refreshComputedStates();
          BID.Render.renderAll();
        });
      }).catch(function (e) {
        BID.Render.setError("読込エラー: " + (e && e.message ? e.message : e));
        if (BID.Log && BID.Log.write) BID.Log.write("[load] FAILED: " + (e && e.message ? e.message : e));
        BID.Render.renderAll();
      });
    },

    // =====================================================
    // [10-11] 計算状態（profileStateなど）を更新
    //  - Profileモジュールに合わせて「必須未入力配列」を受け取り COMPLETE 判定
    // =====================================================
    refreshComputedStates: function () {
      try {
        // [10-11-01] Profile入力を読む（存在しない環境でも落ちないよう防御）
        var p = (BID.Profile && BID.Profile.readFromInputs) ? BID.Profile.readFromInputs() : null;

        // [10-11-02] 必須チェック（戻りが配列想定）
        var miss = (BID.Profile && BID.Profile.validateRequired) ? BID.Profile.validateRequired(p) : [];

        // [10-11-03] stateへ
        BID.Render.setProfileStatus(miss);
        BID.State.setProfileState((miss && miss.length) ? "INCOMPLETE" : "COMPLETE");

      } catch (e) {
        // ここで落とさない
        try {
          BID.State.setProfileState("INCOMPLETE");
        } catch (e2) {}
      }
    },

    // =====================================================
    // [10-12] 入力済データ読込（既存実装がある想定）
    //  - ここは既存のままでも良いが、最低限のエラーだけ保証
    // =====================================================
    loadOffer: function () {
      // 既存のBID.App.loadOfferがあるならそれを使用
      if (BID.App && BID.App._loadOfferImpl) return BID.App._loadOfferImpl();

      // ない場合は最低限エラー
      BID.Render.setError("loadOffer 実装が見つかりません（07_bidder_offer.js / 04_bidder_db.js を確認）。");
      if (BID.Log && BID.Log.write) BID.Log.write("[offer] ERROR: loadOffer missing");
      BID.Render.renderAll();
    }
  };

  // [10-99] 起動
  document.addEventListener("DOMContentLoaded", function () {
    BID.App.boot();
  });
})(window);
