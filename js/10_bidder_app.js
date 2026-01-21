// [JST 2026-01-20 19:00]  bidder/js/10_bidder_app.js  v20260120-01
(function (global) {
  var BID = global.BID = global.BID || {};

  function el(id) { return document.getElementById(id); }
  function nowIso() { return new Date().toISOString(); }

  // =========================================================
  // [10-01] 起動・イベント配線（ロジックは各モジュールへ）
  // =========================================================
  BID.App = {
    boot: function () {
      // [10-02] 初期state
      BID.State.initBidNo();
      var st = BID.State.get();

      // [10-03] 初期表示
      BID.Render.clearMessages();
      BID.Render.renderAll();

      // [10-04] ログクリア
      if (el("btnLogClear")) {
        el("btnLogClear").addEventListener("click", function () {
          BID.Log.clear();
          BID.Log.write("[log] cleared");
        });
      }

      // [10-05] Cookie削除
      if (el("btnCookieClear")) {
        el("btnCookieClear").addEventListener("click", function () {
          BID.Profile.clearCookie();
          BID.Render.renderAll();
        });
      }

      // [10-06] 入力済データの読み込み
      if (el("btnLoadOffer")) {
        el("btnLoadOffer").addEventListener("click", function () {
          BID.App.loadOffer();
        });
      }

      // [10-07] 認証
      if (el("btnAuth")) {
        el("btnAuth").addEventListener("click", function () {
          var ok = BID.Auth.tryAuth();
          // 認証後、profile入力可否など更新
          BID.App.refreshComputedStates();
          BID.Render.renderAll();
        });
      }

      // [10-08] プロファイル入力イベント（入力のたびに必須判定→モード再計算）
      var pids = ["inpEmail","inpAddress","inpCompanyName","inpRepresentativeName","inpContactName","inpContactInfo"];
      for (var i = 0; i < pids.length; i++) {
        (function (id) {
          var e = el(id);
          if (!e) return;
          e.addEventListener("input", function () {
            var p = BID.Profile.readFromInputs();
            var miss = BID.Profile.validateRequired(p);
            BID.Render.setProfileStatus(miss);
            BID.App.refreshComputedStates();
            BID.Render.applyMode();
          });
        })(pids[i]);
      }

      // [10-09] 保存（提出）
      if (el("btnSubmit")) {
        el("btnSubmit").addEventListener("click", function () {
          BID.App.submitOffer();
        });
      }

      // [10-10] 印刷 / PDF
      if (el("btnPrint")) {
        el("btnPrint").addEventListener("click", function () {
          BID.Print.doPrint();
        });
      }
      if (el("btnPdf")) {
        el("btnPdf").addEventListener("click", function () {
          // ブラウザの印刷ダイアログからPDF保存
          BID.Print.doPrint();
        });
      }

      // [10-11] Firebase auth監視→初回ロード
      try {
        BID.DB.onAuthStateChanged(function (user) {
          BID.State.setUser(user);

          if (!user) {
            BID.Render.setError("未ログインです。ログインしてから再度開いてください。");
            BID.Log.write("[auth] signed out");
            BID.App.refreshComputedStates();
            BID.Render.renderAll();
            return;
          }

          BID.Log.write("[auth] signed in: uid=" + user.uid);

          // users/{uid} 取得（role/bidderNo）
          BID.DB.getUserDoc(user.uid).then(function (ud) {
            var role = ud ? (ud.role || "") : "";
            var bidderNo = ud ? (ud.bidderNo || "") : "";
            BID.State.setUserProfileFromDb(role, bidderNo);

            if (role !== "bidder") {
              BID.Render.setError("入札者権限がありません（role=" + role + "）。");
              BID.Log.write("[role] NG: " + role);
            } else if (!bidderNo) {
              BID.Render.setError("bidderNo が設定されていません（users/{uid}.bidderNo）。");
              BID.Log.write("[role] bidderNo empty");
            }

            // Cookie自動入力
            BID.Profile.loadFromCookie();

            // bid/items 読込
            BID.App.loadBidAndItems();
          });
        });
      } catch (e) {
        BID.Render.setError("初期化エラー: " + (e && e.message ? e.message : e));
        BID.Log.write("[boot] failed: " + (e && e.message ? e.message : e));
      }
    },

    // [10-12] bid/items 読込
    loadBidAndItems: function () {
      var st = BID.State.get();
      var bidNo = st.bidNo;

      if (!bidNo) {
        BID.Render.setError("bidNo が設定されていません（01_bidder_config.js）。");
        BID.Log.write("[load] bidNo empty");
        return;
      }

      BID.Log.write("[load] bids/" + bidNo + " ...");
      BID.DB.getBid(bidNo).then(function (bid) {
        if (!bid) {
          BID.Render.setError("bids/" + bidNo + " が見つかりません。");
          BID.Log.write("[load] bid not found");
          return;
        }
        BID.State.setBid(bid);

        // items
        BID.Log.write("[load] items ...");
        return BID.DB.getItems(bidNo).then(function (items) {
          BID.State.setItems(items);
          BID.State.setLastLoadedAt(nowIso());
          BID.Log.write("[load] OK: status=" + (bid.status || "") + " items=" + items.length);

          // 初回状態計算→描画
          BID.App.refreshComputedStates();
          BID.Render.renderAll();

          // open/closed でも「入力済データ読込」は押せるが、ここで自動読込はしない（最小運用）
        });
      }).catch(function (e) {
        BID.Render.setError("読込エラー: " + (e && e.message ? e.message : e));
        BID.Log.write("[load] failed: " + (e && e.message ? e.message : e));
      });
    },

    // [10-13] 計算状態（profileState等）を更新
    refreshComputedStates: function () {
      // profile必須チェック結果をstateへ
      var p = BID.Profile.readFromInputs();
      var miss = BID.Profile.validateRequired(p);
      BID.Render.setProfileStatus(miss);

      // applyModeがviewOnly/inputEnabledを更新する（render側に集約）
      // ここでは何もしない（入口だけ用意）
    },

    // [10-14] 入力済データ読込
    loadOffer: function () {
      var st = BID.State.get();

      if (!st.user) {
        BID.Render.setError("未ログインです。");
        BID.Log.write("[offer] load NG: not signed in");
        return;
      }
      if (st.role !== "bidder") {
        BID.Render.setError("入札者権限がありません（role=" + st.role + "）。");
        BID.Log.write("[offer] load NG: role=" + st.role);
        return;
      }
      if (!st.bidderNo) {
        BID.Render.setError("bidderNo が設定されていません。");
        BID.Log.write("[offer] load NG: bidderNo empty");
        return;
      }

      BID.Log.write("[offer] load: bids/" + st.bidNo + "/offers/" + st.bidderNo);
      BID.DB.getOffer(st.bidNo, st.bidderNo).then(function (offer) {
        if (!offer) {
          BID.State.setOffer(null);
          BID.Render.setInfo("保存済データはありません。");
          BID.Log.write("[offer] none");
          BID.Render.renderAll();
          return;
        }

        // stateへ
        BID.State.setOffer(offer);
        BID.Log.write("[offer] loaded");

        // profile反映（offersに入っている前提）
        var p = {
          email: offer.email || "",
          address: offer.address || "",
          companyName: offer.companyName || "",
          representativeName: offer.representativeName || "",
          contactName: offer.contactName || "",
          contactInfo: offer.contactInfo || ""
        };
        BID.State.setProfile(p);
        BID.Profile.applyToInputs(p);

        // lines反映
        BID.Offer.applyLinesToTable(offer.lines || {});
        BID.State.setLastLoadedAt(nowIso());

        // 状態更新・描画
        BID.App.refreshComputedStates();
        BID.Render.renderAll();

        BID.Render.setOk("入力済データを読み込みました。");
      }).catch(function (e) {
        BID.Render.setError("入力済データ読込に失敗: " + (e && e.message ? e.message : e));
        BID.Log.write("[offer] load failed: " + (e && e.message ? e.message : e));
      });
    },

    // [10-15] 保存（open中は上書きOK）
    submitOffer: function () {
      var st = BID.State.get();

      // 画面制御上は押せないはずだが、二重防御
      if (!st.user) return BID.Render.setError("未ログインです。");
      if (st.role !== "bidder") return BID.Render.setError("入札者権限がありません。");
      if (!st.bidderNo) return BID.Render.setError("bidderNo が設定されていません。");

      if (st.bidStatus !== "open") {
        // closedは完全閲覧
        BID.Render.setError("保存できません：入札が open ではありません（status=" + st.bidStatus + "）。");
        BID.Log.write("[save] NG: status=" + st.bidStatus);
        return;
      }
      if (st.authState !== "UNLOCKED") {
        BID.Render.setError("保存できません：認証が必要です。");
        BID.Log.write("[save] NG: locked");
        return;
      }

      var payload = BID.Offer.buildOfferPayload();
      if (!payload) return; // エラーメッセージはbuild内で出す

      // Cookie保存（必須OKなので保存）
      BID.Profile.saveToCookie(payload);

      BID.Log.write("[save] start...");
      BID.DB.upsertOffer(st.bidNo, st.bidderNo, payload, true).then(function (res) {
        BID.State.setLastSavedAt(nowIso());
        BID.Log.write("[save] OK (upsert)");
        BID.Render.setOk("保存しました。open中は何度でも修正できます。");

        // 再読込して state.offerLines を整合
        return BID.DB.getOffer(st.bidNo, st.bidderNo).then(function (offer) {
          BID.State.setOffer(offer);
          BID.Render.renderAll();
        });
      }).catch(function (e) {
        BID.Render.setError("保存に失敗: " + (e && e.message ? e.message : e));
        BID.Log.write("[save] FAILED: " + (e && e.message ? e.message : e));
      });
    }
  };

  // [10-16] 起動
  document.addEventListener("DOMContentLoaded", function () {
    BID.App.boot();
  });
})(window);