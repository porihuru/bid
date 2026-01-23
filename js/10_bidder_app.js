// [JST 2026-01-23 21:30] bidder/js/10_bidder_app.js v20260123-01
// [BID-10] アプリ起動・イベント配線（入札者フォーム）
// 要件対応:
//  - すべてのボタン押下後に「成功/失敗/理由」を必ず表示（ログ＋メッセージ）
//  - 起動直後と「入力済データの読み込み」直後に、常に現在状態を反映
//  - 入札者は「誰でも入れる」前提：Firebaseは匿名ログインを自動実行（可能なら）

(function (global) {
  var BID = global.BID = global.BID || {};

  function el(id) { return document.getElementById(id); }
  function nowIso() { return new Date().toISOString(); }
  function msgOf(e) { return (e && e.message) ? e.message : String(e || ""); }

  // =========================================================
  // [BID-10-01] 共通ログ/表示
  // =========================================================
  function logInfo(tag, msg) {
    if (BID.Log && BID.Log.write) BID.Log.write("[" + tag + "] " + msg);
  }
  function uiOk(msg) {
    if (BID.Render && BID.Render.setOk) BID.Render.setOk(msg);
  }
  function uiErr(msg) {
    if (BID.Render && BID.Render.setError) BID.Render.setError(msg);
  }
  function uiInfo(msg) {
    if (BID.Render && BID.Render.setInfo) BID.Render.setInfo(msg);
  }

  // =========================================================
  // [BID-10-02] 状態を強制反映（例外で止めない）
  // =========================================================
  function safeRenderAll(tag) {
    try {
      if (BID.Render && BID.Render.renderAll) BID.Render.renderAll();
      logInfo(tag || "render", "renderAll OK");
    } catch (e) {
      uiErr("画面描画エラー: " + msgOf(e));
      logInfo(tag || "render", "ERROR: " + msgOf(e));
    }
  }

  // =========================================================
  // [BID-10-03] 起動
  // =========================================================
  BID.App = {
    boot: function () {
      // [BID-10-03-01] まず bidNo 固定値を state に取り込む
      BID.State.initBidNo();
      logInfo("boot", "bidNo=" + (BID.State.get().bidNo || "(empty)"));

      // [BID-10-03-02] 初期メッセージ/描画
      if (BID.Render && BID.Render.clearMessages) BID.Render.clearMessages();
      uiInfo("入札データを読み込み中です。");
      safeRenderAll("boot");

      // [BID-10-03-03] ボタン: ログクリア
      if (el("btnLogClear")) {
        el("btnLogClear").addEventListener("click", function () {
          try {
            BID.Log.clear();
            logInfo("btn", "ログクリア: OK");
            uiOk("ログをクリアしました。");
          } catch (e) {
            uiErr("ログクリアに失敗: " + msgOf(e));
            logInfo("btn", "ログクリア: FAILED " + msgOf(e));
          }
        });
      }

      // [BID-10-03-04] ボタン: Cookie削除
      if (el("btnCookieClear")) {
        el("btnCookieClear").addEventListener("click", function () {
          try {
            BID.Profile.clearCookie();
            uiOk("Cookieを削除しました。");
            logInfo("cookie", "clear OK");
            safeRenderAll("cookie");
          } catch (e) {
            uiErr("Cookie削除に失敗: " + msgOf(e));
            logInfo("cookie", "clear FAILED " + msgOf(e));
          }
        });
      }

      // [BID-10-03-05] ボタン: 入力済データの読み込み（offers）
      if (el("btnLoadOffer")) {
        el("btnLoadOffer").addEventListener("click", function () {
          BID.App.loadOffer();
        });
      }

      // [BID-10-03-06] ボタン: 認証
      if (el("btnAuth")) {
        el("btnAuth").addEventListener("click", function () {
          try {
            logInfo("auth", "clicked");
            var ok = BID.Auth.tryAuth();
            logInfo("auth", ok ? "OK" : "NG");
            // 認証後に状態計算→反映
            BID.App.refreshComputedStates();
            safeRenderAll("auth");
          } catch (e) {
            uiErr("認証処理エラー: " + msgOf(e));
            logInfo("auth", "ERROR " + msgOf(e));
          }
        });
      }

      // [BID-10-03-07] プロファイル入力イベント（入力のたびに必須判定）
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
            try {
              BID.App.refreshComputedStates();
              // applyModeは renderAll 内で呼ぶが、軽量化のため直接も呼ぶ
              if (BID.Render && BID.Render.applyMode) BID.Render.applyMode();
            } catch (ex) {
              uiErr("入力反映エラー: " + msgOf(ex));
              logInfo("profile", "ERROR " + msgOf(ex));
            }
          });
        })(pids[i]);
      }

      // [BID-10-03-08] ボタン: 保存（提出）
      if (el("btnSubmit")) {
        el("btnSubmit").addEventListener("click", function () {
          BID.App.submitOffer();
        });
      }

      // [BID-10-03-09] ボタン: 印刷 / PDF
      if (el("btnPrint")) {
        el("btnPrint").addEventListener("click", function () {
          try {
            logInfo("print", "clicked");
            if (!BID.Print || !BID.Print.doPrint) {
              uiErr("印刷機能が未実装です（09_bidder_print.js を確認してください）。");
              logInfo("print", "FAILED: Print module missing");
              return;
            }
            BID.Print.doPrint();
            uiOk("印刷を開始しました。");
            logInfo("print", "OK");
          } catch (e) {
            uiErr("印刷に失敗: " + msgOf(e));
            logInfo("print", "FAILED " + msgOf(e));
          }
        });
      }
      if (el("btnPdf")) {
        el("btnPdf").addEventListener("click", function () {
          // PDF出力は「印刷ダイアログからPDF保存」に統一
          try {
            logInfo("pdf", "clicked");
            if (!BID.Print || !BID.Print.doPrint) {
              uiErr("PDF出力機能が未実装です（09_bidder_print.js を確認してください）。");
              logInfo("pdf", "FAILED: Print module missing");
              return;
            }
            BID.Print.doPrint();
            uiOk("PDF出力（印刷）を開始しました。");
            logInfo("pdf", "OK");
          } catch (e) {
            uiErr("PDF出力に失敗: " + msgOf(e));
            logInfo("pdf", "FAILED " + msgOf(e));
          }
        });
      }

      // [BID-10-03-10] Cookie自動入力（起動時）
      try {
        var cp = BID.Profile.loadFromCookie();
        var hasAny = false;
        for (var k in cp) { if (cp.hasOwnProperty(k) && cp[k]) { hasAny = true; break; } }
        if (hasAny) {
          BID.Profile.applyToInputs(cp);
          logInfo("cookie", "autofill OK");
        }
      } catch (e) {
        logInfo("cookie", "autofill FAILED " + msgOf(e));
      }

      // [BID-10-03-11] Firebase匿名ログイン → bid/items 読込
      BID.App.ensureSignedInThenLoad();
    },

    // =======================================================
    // [BID-10-10] 匿名ログイン（可能なら）→ loadBidAndItems
    // =======================================================
    ensureSignedInThenLoad: function () {
      try {
        if (!firebase || !firebase.auth) {
          uiErr("Firebaseが初期化されていません（firebase-auth-compat.js を確認してください）。");
          logInfo("boot", "FAILED: firebase.auth missing");
          return;
        }

        // 既にログイン済みならそのまま
        var cur = firebase.auth().currentUser;
        if (cur) {
          logInfo("auth", "already signed in (uid=" + cur.uid + ")");
          BID.App.loadBidAndItems();
          return;
        }

        // 匿名ログインを試す
        logInfo("auth", "signInAnonymously ...");
        firebase.auth().signInAnonymously().then(function (cred) {
          var u = cred && cred.user ? cred.user : firebase.auth().currentUser;
          logInfo("auth", "signInAnonymously OK uid=" + (u ? u.uid : "?") );
          BID.App.loadBidAndItems();
        }).catch(function (e) {
          // ルール/設定で匿名が無効の場合もある
          uiErr("ログインに失敗: " + msgOf(e));
          logInfo("auth", "signInAnonymously FAILED " + msgOf(e));
        });
      } catch (e) {
        uiErr("初期化エラー: " + msgOf(e));
        logInfo("boot", "ERROR " + msgOf(e));
      }
    },

    // =======================================================
    // [BID-10-11] bid/items 読込
    // =======================================================
    loadBidAndItems: function () {
      var st = BID.State.get();
      var bidNo = st.bidNo;

      if (!bidNo) {
        uiErr("入札番号が未設定です。js/01_bidder_config.js の BID.CONFIG.BID_NO を設定してください。");
        logInfo("load", "FAILED: bidNo empty");
        return;
      }

      uiInfo("入札データを読み込み中です。");
      logInfo("load", "bids/" + bidNo + " ...");

      BID.DB.getBid(bidNo).then(function (bid) {
        if (!bid) {
          uiErr("bids/" + bidNo + " が見つかりません。");
          logInfo("load", "FAILED: bid not found");
          return;
        }

        BID.State.setBid(bid);

        // items
        logInfo("load", "items ...");
        return BID.DB.getItems(bidNo).then(function (items) {
          BID.State.setItems(items);
          BID.State.setLastLoadedAt(nowIso());
          logInfo("load", "OK: status=" + (bid.status || "") + " items=" + items.length);

          // 初回状態計算→描画
          BID.App.refreshComputedStates();
          safeRenderAll("load");

          // 状態メッセージ（最低1回は明示）
          uiOk("入札データを読み込みました。");
        });
      }).catch(function (e) {
        uiErr("読込エラー: " + msgOf(e));
        logInfo("load", "ERROR " + msgOf(e));
      });
    },

    // =======================================================
    // [BID-10-12] 計算状態（profileState等）を更新
    // =======================================================
    refreshComputedStates: function () {
      try {
        var p = BID.Profile.readFromInputs();
        BID.State.setProfile(p);

        var miss = BID.Profile.validateRequired(p);
        BID.State.setProfileState(miss.length ? "INCOMPLETE" : "COMPLETE");

        if (BID.Render && BID.Render.setProfileStatus) {
          BID.Render.setProfileStatus(miss);
        }
      } catch (e) {
        uiErr("状態更新エラー: " + msgOf(e));
        logInfo("state", "ERROR " + msgOf(e));
      }
    },

    // =======================================================
    // [BID-10-13] 入力済データ読込（offers）
    // =======================================================
    loadOffer: function () {
      try {
        var st = BID.State.get();
        var bidderId = (el("inpBidderId") && el("inpBidderId").value) ? String(el("inpBidderId").value).trim() : "";

        logInfo("offer", "load clicked");

        if (!st.bidNo) {
          uiErr("入札番号が未設定です。");
          logInfo("offer", "FAILED: bidNo empty");
          return;
        }
        if (!bidderId) {
          uiErr("入力済データを読み込むには、入札者番号を入力してください。");
          logInfo("offer", "FAILED: bidderId empty");
          return;
        }

        uiInfo("入力済データを読み込み中です。");
        logInfo("offer", "getOffer bids/" + st.bidNo + "/offers/" + bidderId);

        BID.DB.getOffer(st.bidNo, bidderId).then(function (offer) {
          if (!offer) {
            BID.State.setOffer(null);
            BID.State.setOfferLines({});
            BID.State.setLastLoadedAt(nowIso());
            uiOk("保存済データはありません。");
            logInfo("offer", "none");
            safeRenderAll("offer");
            return;
          }

          // stateへ
          BID.State.setOffer(offer);
          BID.State.setOfferLines(offer.lines || {});
          BID.State.setLastLoadedAt(nowIso());
          logInfo("offer", "loaded");

          // profile反映（offer.profile優先、なければ直下キーの旧形式も拾う）
          var prof = offer.profile || {
            bidderId: offer.bidderId || bidderId,
            email: offer.email || "",
            address: offer.address || "",
            companyName: offer.companyName || "",
            representativeName: offer.representativeName || "",
            contactName: offer.contactName || "",
            contactInfo: offer.contactInfo || ""
          };
          prof.bidderId = bidderId;
          BID.Profile.applyToInputs(prof);
          BID.State.setProfile(prof);

          // lines反映
          if (BID.Offer && BID.Offer.applyLinesToTable) {
            BID.Offer.applyLinesToTable(offer.lines || {});
          }

          // 状態更新・描画
          BID.App.refreshComputedStates();
          safeRenderAll("offer");

          uiOk("入力済データを読み込みました。");
          logInfo("offer", "OK");
        }).catch(function (e) {
          uiErr("入力済データ読込に失敗: " + msgOf(e));
          logInfo("offer", "FAILED " + msgOf(e));
        });
      } catch (e) {
        uiErr("入力済データ読込エラー: " + msgOf(e));
        logInfo("offer", "ERROR " + msgOf(e));
      }
    },

    // =======================================================
    // [BID-10-14] 保存（open中は上書きOK）
    // =======================================================
    submitOffer: function () {
      try {
        var st = BID.State.get();
        logInfo("save", "clicked");

        if (!st.bidNo) {
          uiErr("保存できません：入札番号が未設定です。");
          logInfo("save", "FAILED: bidNo empty");
          return;
        }
        if (!st.bidStatus) {
          uiErr("保存できません：入札データが未読込です。");
          logInfo("save", "FAILED: bid not loaded");
          return;
        }
        if (st.bidStatus !== "open") {
          uiErr("保存できません：入札が open ではありません（status=" + st.bidStatus + "）。");
          logInfo("save", "FAILED: status=" + st.bidStatus);
          return;
        }
        if (st.authState !== "UNLOCKED") {
          uiErr("保存できません：認証が必要です。");
          logInfo("save", "FAILED: locked");
          return;
        }

        BID.App.refreshComputedStates();
        if (st.profileState !== "COMPLETE") {
          uiErr("保存できません：入札者情報（必須）を入力してください。");
          logInfo("save", "FAILED: profile incomplete");
          return;
        }

        // payload生成（ここで必須/単価を検証してエラーを返す）
        var payload = BID.Offer.buildOfferPayload();
        if (!payload) {
          logInfo("save", "FAILED: payload invalid");
          return;
        }

        // Cookie保存（必須OKなので保存）
        try {
          BID.Profile.saveToCookie(payload.profile);
          logInfo("cookie", "save OK");
        } catch (e1) {
          logInfo("cookie", "save FAILED " + msgOf(e1));
        }

        uiInfo("保存中です...");
        logInfo("save", "upsertOffer ...");

        // bidderId（入札者番号）をドキュメントIDとして保存
        var bidderId = payload.bidderId;

        BID.DB.upsertOffer(st.bidNo, bidderId, payload, true).then(function (res) {
          BID.State.setLastSavedAt(nowIso());
          logInfo("save", "OK (exists=" + (res && res.exists ? "true" : "false") + ")");
          uiOk("保存しました。open中は何度でも修正できます。");

          // 念のため再読込して state を整合
          return BID.DB.getOffer(st.bidNo, bidderId).then(function (offer) {
            BID.State.setOffer(offer);
            BID.State.setOfferLines((offer && offer.lines) ? offer.lines : {});
            safeRenderAll("save");
          });
        }).catch(function (e) {
          uiErr("保存に失敗: " + msgOf(e));
          logInfo("save", "FAILED " + msgOf(e));
        });
      } catch (e) {
        uiErr("保存エラー: " + msgOf(e));
        logInfo("save", "ERROR " + msgOf(e));
      }
    }
  };

  // =========================================================
  // [BID-10-99] 起動
  // =========================================================
  document.addEventListener("DOMContentLoaded", function () {
    BID.App.boot();
  });
})(window);