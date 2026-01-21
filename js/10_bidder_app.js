// [JST 2026-01-20 19:30]  bidder/js/10_bidder_app.js  v20260120-02
// [BID-10] アプリ起動・イベント制御（ログイン不要）
(function (global) {
  var BID = global.BID = global.BID || {};

  function el(id) { return document.getElementById(id); }
  function nowIso() { return new Date().toISOString(); }

  // =========================================================
  // [10-01] 起動
  // =========================================================
  BID.App = {
    boot: function () {

      // [10-02] bidNo 初期化（01_bidder_config.js）
      BID.State.initBidNo();

      // [10-03] Cookie から入札者情報を自動入力
      BID.Profile.applyToInputs(
        BID.Profile.loadFromCookie()
      );

      // [10-04] 初期描画
      BID.Render.clearMessages();
      BID.Render.renderAll();

      // -----------------------------------------------------
      // イベント配線
      // -----------------------------------------------------

      // ログクリア
      if (el("btnLogClear")) {
        el("btnLogClear").addEventListener("click", function () {
          BID.Log.clear();
          BID.Log.write("[log] cleared");
        });
      }

      // Cookie削除
      if (el("btnCookieClear")) {
        el("btnCookieClear").addEventListener("click", function () {
          BID.Profile.clearCookie();
          BID.Render.renderAll();
          BID.Log.write("[cookie] cleared");
        });
      }

      // 入力済データ読込
      if (el("btnLoadOffer")) {
        el("btnLoadOffer").addEventListener("click", function () {
          BID.App.loadOffer();
        });
      }

      // 認証
      if (el("btnAuth")) {
        el("btnAuth").addEventListener("click", function () {
          BID.Auth.tryAuth();
          BID.App.refreshComputedStates();
          BID.Render.renderAll();
        });
      }

      // プロファイル入力監視
      var pids = [
        "inpBidderId",
        "inpEmail",
        "inpAddress",
        "inpCompanyName",
        "inpRepresentativeName",
        "inpContactName",
        "inpContactInfo"
      ];
      for (var i = 0; i < pids.length; i++) {
        (function (id) {
          var e = el(id);
          if (!e) return;
          e.addEventListener("input", function () {
            BID.App.refreshComputedStates();
            BID.Render.applyMode();
          });
        })(pids[i]);
      }

      // 保存（提出）
      if (el("btnSubmit")) {
        el("btnSubmit").addEventListener("click", function () {
          BID.App.submitOffer();
        });
      }

      // 印刷 / PDF
      if (el("btnPrint")) {
        el("btnPrint").addEventListener("click", function () {
          BID.Print.doPrint();
        });
      }
      if (el("btnPdf")) {
        el("btnPdf").addEventListener("click", function () {
          BID.Print.doPrint();
        });
      }

      // -----------------------------------------------------
      // 初回データ読込（ログイン不要）
      // -----------------------------------------------------
      BID.Log.write("[boot] auth-less bidder mode");
      BID.App.loadBidAndItems();
    },

    // ======================================================
    // [10-10] 入札 & 品目 読込
    // ======================================================
    loadBidAndItems: function () {
      var st = BID.State.get();
      var bidNo = st.bidNo;

      if (!bidNo) {
        BID.Render.setError("bidNo が設定されていません。");
        BID.Log.write("[load] bidNo empty");
        return;
      }

      BID.Log.write("[load] bids/" + bidNo);

      BID.DB.getBid(bidNo).then(function (bid) {
        if (!bid) {
          BID.Render.setError("入札が見つかりません。");
          return;
        }

        BID.State.setBid(bid);

        return BID.DB.getItems(bidNo).then(function (items) {
          BID.State.setItems(items);
          BID.State.setLastLoadedAt(nowIso());

          BID.Log.write("[load] OK status=" + bid.status + " items=" + items.length);

          BID.App.refreshComputedStates();
          BID.Render.renderAll();
        });
      }).catch(function (e) {
        BID.Render.setError("読込エラー: " + e.message);
      });
    },

    // ======================================================
    // [10-11] 状態再計算
    // ======================================================
    refreshComputedStates: function () {
      var p = BID.Profile.readFromInputs();
      var miss = BID.Profile.validate(p);
      BID.Render.setProfileStatus(miss);
    },

    // ======================================================
    // [10-12] 入力済データ読込
    // ======================================================
    loadOffer: function () {
      var st = BID.State.get();
      var p = BID.Profile.readFromInputs();

      if (!p.bidderId) {
        BID.Render.setError("入札者番号を入力してください。");
        return;
      }

      BID.DB.getOffer(st.bidNo, p.bidderId).then(function (offer) {
        if (!offer) {
          BID.Render.setInfo("保存済データはありません。");
          return;
        }

        BID.State.setOffer(offer);
        BID.Profile.applyToInputs(offer.profile || {});
        BID.Offer.applyLinesToTable(offer.lines || {});
        BID.State.setLastLoadedAt(nowIso());

        BID.Render.renderAll();
        BID.Render.setOk("入力済データを読み込みました。");
        BID.Log.write("[offer] loaded");
      });
    },

    // ======================================================
    // [10-13] 保存（open中のみ）
    // ======================================================
    submitOffer: function () {
      var st = BID.State.get();
      var bid = st.bid;

      if (!bid || bid.status !== "open") {
        BID.Render.setError("保存できません：入札は open 中のみ可能です。");
        return;
      }

      if (st.authState !== "UNLOCKED") {
        BID.Render.setError("保存できません：認証が必要です。");
        return;
      }

      var p = BID.Profile.readFromInputs();
      var miss = BID.Profile.validate(p);
      if (miss) {
        BID.Render.setError(miss);
        return;
      }

      var payload = BID.Offer.buildOfferPayload();
      if (!payload) return;

      // Cookie保存
      BID.Profile.saveToCookie(p);

      BID.DB.upsertOffer(st.bidNo, p.bidderId, payload, true).then(function () {
        BID.State.setLastSavedAt(nowIso());
        BID.Render.setOk("保存しました。open中は何度でも修正できます。");
        BID.Log.write("[save] OK");
      }).catch(function (e) {
        BID.Render.setError("保存失敗: " + e.message);
      });
    }
  };

  // ======================================================
  // [10-99] 起動
  // ======================================================
  document.addEventListener("DOMContentLoaded", function () {
    BID.App.boot();
  });

})(window);