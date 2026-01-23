// [JST 2026-01-23 22:10] bidder/js/10_bidder_app.js v20260123-01
// [BID-10] アプリ起動・イベント配線（入札者フォーム）
// 要件対応:
//  - すべてのボタン押下後に「成功/失敗/理由」を必ず表示（ログ＋メッセージ）
//  - 起動直後に bid/items を読み込み、状態を必ず反映
//  - 匿名ログインを試みる（失敗したら理由を表示）
//
// 注意:
//  - Firestore rules が匿名（signedInのみ）を許可していない場合、読込/保存は権限エラーになります。
//    その場合も「理由」を必ず出します。

(function (global) {
  var BID = global.BID = global.BID || {};

  function el(id) { return document.getElementById(id); }
  function nowIso() { return new Date().toISOString(); }
  function msgOf(e) { return (e && e.message) ? e.message : String(e || ""); }
  function trim(s) { return (s == null) ? "" : String(s).replace(/^\s+|\s+$/g, ""); }

  // =========================================================
  // [BID-10-01] 共通ログ/表示
  // =========================================================
  function logInfo(tag, msg) {
    try { if (BID.Log && BID.Log.write) BID.Log.write("[" + tag + "] " + msg); } catch (e) {}
  }
  function uiOk(msg) {
    try { if (BID.Render && BID.Render.setOk) BID.Render.setOk(msg); } catch (e) {}
  }
  function uiErr(msg) {
    try { if (BID.Render && BID.Render.setError) BID.Render.setError(msg); } catch (e) {}
  }
  function uiInfo(msg) {
    try { if (BID.Render && BID.Render.setInfo) BID.Render.setInfo(msg); } catch (e) {}
  }

  // =========================================================
  // [BID-10-02] 例外捕捉（何も起きないを潰す）
  // =========================================================
  window.onerror = function (message, source, lineno, colno) {
    logInfo("EX", "window.onerror: " + message + " (" + source + ":" + lineno + ":" + colno + ")");
    uiErr("実行エラー: " + message);
    return false;
  };
  window.addEventListener("unhandledrejection", function (ev) {
    var reason = ev && ev.reason ? (ev.reason.message || String(ev.reason)) : "(unknown)";
    logInfo("EX", "unhandledrejection: " + reason);
    uiErr("処理エラー: " + reason);
  });

  // =========================================================
  // [BID-10-03] 状態を強制反映（例外で止めない）
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
  // [BID-10-04] profileState の再計算
  // =========================================================
  function refreshProfileState() {
    try {
      if (!BID.Profile || !BID.Profile.readFromUI || !BID.Profile.validate) {
        // Profile未読込は致命的
        BID.State.setProfileState("INCOMPLETE");
        BID.Render.setProfileStatus("Profileモジュール未読込");
        return;
      }
      var p = BID.Profile.readFromUI();
      BID.State.setProfile(p);

      var perr = BID.Profile.validate(p); // 文字列（空ならOK）
      if (perr) {
        BID.State.setProfileState("INCOMPLETE");
        BID.Render.setProfileStatus(perr);
      } else {
        BID.State.setProfileState("COMPLETE");
        BID.Render.setProfileStatus("");
      }
    } catch (e) {
      uiErr("状態更新エラー: " + msgOf(e));
      logInfo("state", "ERROR " + msgOf(e));
    }
  }

  // =========================================================
  // [BID-10-05] App
  // =========================================================
  BID.App = {
    boot: function () {
      // まず固定入札番号をstateへ
      BID.State.initBidNo();
      logInfo("boot", "bidNo=" + (BID.State.get().bidNo || "(empty)"));

      // 初期表示
      if (BID.Render && BID.Render.clearMessages) BID.Render.clearMessages();
      uiInfo("入札データを読み込み中です。");
      safeRenderAll("boot");

      // -----------------------------------------------------
      // ボタン配線（すべて：開始/成功/失敗/理由 を出す）
      // -----------------------------------------------------

      // ログクリア
      if (el("btnLogClear")) {
        el("btnLogClear").addEventListener("click", function () {
          logInfo("btnLogClear", "click");
          try {
            if (BID.Log && BID.Log.clear) BID.Log.clear();
            uiOk("ログをクリアしました。");
            logInfo("btnLogClear", "OK");
          } catch (e) {
            uiErr("ログクリアに失敗: " + msgOf(e));
            logInfo("btnLogClear", "FAILED " + msgOf(e));
          }
        });
      }

      // Cookie削除
      if (el("btnCookieClear")) {
        el("btnCookieClear").addEventListener("click", function () {
          logInfo("btnCookieClear", "click");
          try {
            if (!BID.Profile || !BID.Profile.clearCookie) {
              uiErr("Cookie削除に失敗: Profileモジュール未読込");
              logInfo("btnCookieClear", "FAILED Profile module missing");
              return;
            }
            BID.Profile.clearCookie();
            uiOk("Cookieを削除しました。");
            logInfo("btnCookieClear", "OK");
            refreshProfileState();
            safeRenderAll("btnCookieClear");
          } catch (e) {
            uiErr("Cookie削除に失敗: " + msgOf(e));
            logInfo("btnCookieClear", "FAILED " + msgOf(e));
          }
        });
      }

      // 入力済データの読み込み
      if (el("btnLoadOffer")) {
        el("btnLoadOffer").addEventListener("click", function () {
          logInfo("btnLoadOffer", "click");
          BID.App.loadOffer();
        });
      }

      // 認証
      if (el("btnAuth")) {
        el("btnAuth").addEventListener("click", function () {
          logInfo("btnAuth", "click");
          try {
            if (!BID.Auth || !BID.Auth.tryAuth) {
              uiErr("認証に失敗: Authモジュール未読込（05_bidder_auth.js）");
              logInfo("btnAuth", "FAILED Auth module missing");
              return;
            }
            var ok = BID.Auth.tryAuth(); // 成否はAuth側でも表示される
            logInfo("btnAuth", ok ? "OK" : "NG");

            // 認証後に状態計算→反映
            refreshProfileState();
            safeRenderAll("btnAuth");
          } catch (e) {
            uiErr("認証処理エラー: " + msgOf(e));
            logInfo("btnAuth", "FAILED " + msgOf(e));
          }
        });
      }

      // プロファイル入力（入力のたびに profileState を更新）
      var pids = ["inpBidderId","inpEmail","inpAddress","inpCompanyName","inpRepresentativeName","inpContactName","inpContactInfo"];
      for (var i = 0; i < pids.length; i++) {
        (function (id) {
          var e = el(id);
          if (!e) return;
          e.addEventListener("input", function () {
            try {
              refreshProfileState();
              if (BID.Render && BID.Render.applyMode) BID.Render.applyMode();
            } catch (ex) {
              uiErr("入力反映エラー: " + msgOf(ex));
              logInfo("profile", "ERROR " + msgOf(ex));
            }
          });
        })(pids[i]);
      }

      // 保存（提出）
      if (el("btnSubmit")) {
        el("btnSubmit").addEventListener("click", function () {
          logInfo("btnSubmit", "click");
          BID.App.submitOffer();
        });
      }

      // 印刷 / PDF
      if (el("btnPrint")) {
        el("btnPrint").addEventListener("click", function () {
          logInfo("btnPrint", "click");
          try {
            if (!BID.Print || !BID.Print.doPrint) {
              uiErr("印刷に失敗: Printモジュール未実装（09_bidder_print.js）");
              logInfo("btnPrint", "FAILED Print module missing");
              return;
            }
            BID.Print.doPrint();
            uiOk("印刷を開始しました。");
            logInfo("btnPrint", "OK");
          } catch (e) {
            uiErr("印刷に失敗: " + msgOf(e));
            logInfo("btnPrint", "FAILED " + msgOf(e));
          }
        });
      }

      if (el("btnPdf")) {
        el("btnPdf").addEventListener("click", function () {
          logInfo("btnPdf", "click");
          try {
            if (!BID.Print || !BID.Print.doPrint) {
              uiErr("PDF出力に失敗: Printモジュール未実装（09_bidder_print.js）");
              logInfo("btnPdf", "FAILED Print module missing");
              return;
            }
            BID.Print.doPrint(); // 印刷ダイアログからPDF保存
            uiOk("PDF出力（印刷）を開始しました。");
            logInfo("btnPdf", "OK");
          } catch (e) {
            uiErr("PDF出力に失敗: " + msgOf(e));
            logInfo("btnPdf", "FAILED " + msgOf(e));
          }
        });
      }

      // Cookie自動入力（起動時）
      try {
        if (BID.Profile && BID.Profile.loadFromCookie && BID.Profile.applyToUI) {
          var cp = BID.Profile.loadFromCookie();
          var hasAny = false;
          for (var k in cp) { if (cp.hasOwnProperty(k) && cp[k]) { hasAny = true; break; } }
          if (hasAny) {
            BID.Profile.applyToUI(cp);
            logInfo("cookie", "autofill OK");
          } else {
            logInfo("cookie", "autofill none");
          }
        }
      } catch (e) {
        logInfo("cookie", "autofill FAILED " + msgOf(e));
      }

      // profileState 初期計算
      refreshProfileState();
      safeRenderAll("boot2");

      // 匿名ログイン→読込
      BID.App.ensureSignedInThenLoad();
    },

    // =======================================================
    // 匿名ログイン（可能なら）→ loadBidAndItems
    // =======================================================
    ensureSignedInThenLoad: function () {
      try {
        if (typeof firebase === "undefined" || !firebase.auth) {
          uiErr("Firebaseが初期化されていません（firebase-auth-compat.js を確認）。");
          logInfo("auth", "FAILED: firebase.auth missing");
          return;
        }

        var cur = firebase.auth().currentUser;
        if (cur) {
          logInfo("auth", "already signed in uid=" + cur.uid);
          BID.App.loadBidAndItems();
          return;
        }

        logInfo("auth", "signInAnonymously ...");
        firebase.auth().signInAnonymously().then(function (cred) {
          var u = cred && cred.user ? cred.user : firebase.auth().currentUser;
          logInfo("auth", "signInAnonymously OK uid=" + (u ? u.uid : "?"));
          BID.App.loadBidAndItems();
        }).catch(function (e) {
          uiErr("ログインに失敗: " + msgOf(e));
          logInfo("auth", "signInAnonymously FAILED " + msgOf(e));
        });
      } catch (e) {
        uiErr("初期化エラー: " + msgOf(e));
        logInfo("auth", "ERROR " + msgOf(e));
      }
    },

    // =======================================================
    // bid/items 読込
    // =======================================================
    loadBidAndItems: function () {
      var st = BID.State.get();
      var bidNo = st.bidNo;

      if (!bidNo) {
        uiErr("入札番号が未設定です。js/01_bidder_config.js の BID.CONFIG.BID_NO を設定してください。");
        logInfo("load", "FAILED: bidNo empty");
        return;
      }

      if (!BID.DB || !BID.DB.getBid || !BID.DB.getItems) {
        uiErr("内部エラー：DBモジュール未読込（04_bidder_db.js）。");
        logInfo("load", "FAILED: DB module missing");
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

        logInfo("load", "items ...");
        return BID.DB.getItems(bidNo).then(function (items) {
          BID.State.setItems(items);
          BID.State.setLastLoadedAt(nowIso());

          logInfo("load", "OK status=" + (bid.status || "") + " items=" + items.length);

          refreshProfileState();
          safeRenderAll("load");

          uiOk("入札データを読み込みました。");
        });
      }).catch(function (e) {
        uiErr("読込エラー: " + msgOf(e));
        logInfo("load", "FAILED " + msgOf(e));
      });
    },

    // =======================================================
    // 入力済データ（offers）読込
    // =======================================================
    loadOffer: function () {
      try {
        var st = BID.State.get();
        var bidderId = trim(el("inpBidderId") ? el("inpBidderId").value : "");

        if (!st.bidNo) {
          uiErr("入力済データを読み込めません：入札番号が未設定です。");
          logInfo("offerLoad", "FAILED bidNo empty");
          return;
        }
        if (!bidderId) {
          uiErr("入力済データを読み込むには、入札者番号を入力してください。");
          logInfo("offerLoad", "FAILED bidderId empty");
          return;
        }
        if (!BID.DB || !BID.DB.getOffer) {
          uiErr("内部エラー：DBモジュール未読込（04_bidder_db.js）。");
          logInfo("offerLoad", "FAILED DB missing");
          return;
        }

        uiInfo("入力済データを読み込み中です。");
        logInfo("offerLoad", "bids/" + st.bidNo + "/offers/" + bidderId);

        BID.DB.getOffer(st.bidNo, bidderId).then(function (offer) {
          BID.State.setLastLoadedAt(nowIso());

          if (!offer) {
            BID.State.setOffer(null);
            BID.State.setOfferLines({});
            uiOk("保存済データはありません。");
            logInfo("offerLoad", "OK none");
            safeRenderAll("offerLoad");
            return;
          }

          // state
          BID.State.setOffer(offer);
          BID.State.setOfferLines(offer.lines || {});

          // profile: offer.profile優先（無ければ旧形式も拾う）
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

          try { if (BID.Profile && BID.Profile.applyToUI) BID.Profile.applyToUI(prof); } catch (e1) {}
          BID.State.setProfile(prof);

          // lines反映
          try { if (BID.Offer && BID.Offer.applyLinesToTable) BID.Offer.applyLinesToTable(offer.lines || {}); } catch (e2) {}

          refreshProfileState();
          safeRenderAll("offerLoad");

          uiOk("入力済データを読み込みました。");
          logInfo("offerLoad", "OK loaded");
        }).catch(function (e) {
          uiErr("入力済データ読込に失敗: " + msgOf(e));
          logInfo("offerLoad", "FAILED " + msgOf(e));
        });
      } catch (e) {
        uiErr("入力済データ読込エラー: " + msgOf(e));
        logInfo("offerLoad", "ERROR " + msgOf(e));
      }
    },

    // =======================================================
    // 保存（open中は上書きOK）
    // =======================================================
    submitOffer: function () {
      try {
        var st = BID.State.get();

        logInfo("save", "start");

        if (!st.bidNo) {
          uiErr("保存できません：入札番号が未設定です。");
          logInfo("save", "FAILED bidNo empty");
          return;
        }
        if (!st.bidStatus) {
          uiErr("保存できません：入札データが未読込です。");
          logInfo("save", "FAILED bid not loaded");
          return;
        }
        if (st.bidStatus !== "open") {
          uiErr("保存できません：入札が open ではありません（status=" + st.bidStatus + "）。");
          logInfo("save", "FAILED status=" + st.bidStatus);
          return;
        }
        if (st.authState !== "UNLOCKED") {
          uiErr("保存できません：認証が必要です。");
          logInfo("save", "FAILED auth locked");
          return;
        }

        refreshProfileState();
        if (BID.State.get().profileState !== "COMPLETE") {
          uiErr("保存できません：入札者情報（必須）を入力してください。");
          logInfo("save", "FAILED profile incomplete");
          return;
        }

        if (!BID.Offer || !BID.Offer.buildOfferPayload) {
          uiErr("内部エラー：Offerモジュール未読込（07_bidder_offer.js）。");
          logInfo("save", "FAILED Offer module missing");
          return;
        }

        // payload生成（ここで単価未入力などの理由が出る）
        var payload = BID.Offer.buildOfferPayload();
        if (!payload) {
          logInfo("save", "FAILED payload invalid (see msg)");
          return;
        }

        // Cookie保存（profile）
        try {
          if (BID.Profile && BID.Profile.saveToCookie) {
            BID.Profile.saveToCookie(payload.profile);
            logInfo("cookie", "save OK");
          }
        } catch (e0) {
          logInfo("cookie", "save FAILED " + msgOf(e0));
        }

        // 保存
        if (!BID.DB || !BID.DB.upsertOffer) {
          uiErr("内部エラー：DBモジュール未読込（04_bidder_db.js）。");
          logInfo("save", "FAILED DB missing");
          return;
        }

        uiInfo("保存中です...");
        logInfo("save", "upsertOffer bids/" + st.bidNo + "/offers/" + payload.bidderId);

        BID.DB.upsertOffer(st.bidNo, payload.bidderId, payload, true).then(function (res) {
          BID.State.setLastSavedAt(nowIso());
          uiOk("保存しました。open中は何度でも修正できます。");
          logInfo("save", "OK exists=" + ((res && res.exists) ? "true" : "false"));

          // 念のため再読込
          return BID.DB.getOffer(st.bidNo, payload.bidderId).then(function (offer) {
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

  // 起動
  document.addEventListener("DOMContentLoaded", function () {
    BID.App.boot();
  });

})(window);
