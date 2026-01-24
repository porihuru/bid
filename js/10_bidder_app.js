// [JST 2026-01-24 21:00] bidder/js/10_bidder_app.js v20260124-01
// [BID-10] 起動・イベント配線
// 変更点（最新方針）:
//  - 匿名ログインはしない
//  - 「入札者ID＋パスワード」で signInWithEmailAndPassword
//  - ログイン成功後に bids/items 読込
//  - すべてのボタン押下後に 成功/失敗/理由 を必ずログ＋画面に出す

(function (global) {
  var BID = global.BID = global.BID || {};
  if (BID.Build && BID.Build.register) BID.Build.register("10_bidder_app.js", "v20260124-01");

  function el(id) { return document.getElementById(id); }
  function nowIso() { return new Date().toISOString(); }
  function msgOf(e) { return (e && e.message) ? e.message : String(e || ""); }
  function trim(s) { return (s == null) ? "" : String(s).replace(/^\s+|\s+$/g, ""); }

  function log(tag, msg) {
    try { if (BID.Log && BID.Log.write) BID.Log.write("[" + tag + "] " + msg); } catch (e) {}
  }
  function uiOk(msg) { try { if (BID.Render) BID.Render.setOk(msg); } catch (e) {} }
  function uiErr(msg) { try { if (BID.Render) BID.Render.setError(msg); } catch (e) {} }
  function uiInfo(msg) { try { if (BID.Render) BID.Render.setInfo(msg); } catch (e) {} }

  function safeRenderAll(tag) {
    try {
      if (BID.Render && BID.Render.renderAll) BID.Render.renderAll();
      log(tag || "render", "renderAll OK");
    } catch (e) {
      uiErr("画面描画エラー: " + msgOf(e));
      log(tag || "render", "ERROR: " + msgOf(e));
    }
  }

  BID.App = {
    boot: function () {
      // [10-01] bidNo固定値をstateへ
      BID.State.initBidNo();
      log("boot", "bidNo=" + (BID.State.get().bidNo || "(empty)"));

      // [10-02] 初期表示
      if (BID.Render && BID.Render.clearMessages) BID.Render.clearMessages();
      uiInfo("先にログインしてください。");
      safeRenderAll("boot");

      // [10-03] ログクリア
      if (el("btnLogClear")) {
        el("btnLogClear").addEventListener("click", function () {
          try {
            BID.Log.clear();
            uiOk("ログをクリアしました。");
            log("btn", "ログクリア OK");
          } catch (e) {
            uiErr("ログクリアに失敗: " + msgOf(e));
            log("btn", "ログクリア FAILED " + msgOf(e));
          }
        });
      }

      // [10-04] Cookie削除
      if (el("btnCookieClear")) {
        el("btnCookieClear").addEventListener("click", function () {
          try {
            BID.Profile.clearCookie();
            uiOk("Cookieを削除しました。");
            log("cookie", "clear OK");
            safeRenderAll("cookie");
          } catch (e) {
            uiErr("Cookie削除に失敗: " + msgOf(e));
            log("cookie", "clear FAILED " + msgOf(e));
          }
        });
      }

      // [10-05] 入力済データの読み込み
      if (el("btnLoadOffer")) {
        el("btnLoadOffer").addEventListener("click", function () {
          BID.App.loadOffer();
        });
      }

      // [10-06] 認証（備考5）
      if (el("btnAuth")) {
        el("btnAuth").addEventListener("click", function () {
          try {
            log("auth", "clicked");
            var ok = BID.Auth.tryAuth();
            log("auth", ok ? "OK" : "NG");
            BID.App.refreshComputedStates();
            safeRenderAll("auth");
          } catch (e) {
            uiErr("認証処理エラー: " + msgOf(e));
            log("auth", "ERROR " + msgOf(e));
          }
        });
      }

      // [10-07] 保存
      if (el("btnSubmit")) {
        el("btnSubmit").addEventListener("click", function () {
          BID.App.submitOffer();
        });
      }

      // [10-08] 印刷 / PDF
      if (el("btnPrint")) {
        el("btnPrint").addEventListener("click", function () {
          try {
            log("print", "clicked");
            BID.Print.doPrint();
            uiOk("印刷を開始しました。");
            log("print", "OK");
          } catch (e) {
            uiErr("印刷に失敗: " + msgOf(e));
            log("print", "FAILED " + msgOf(e));
          }
        });
      }
      if (el("btnPdf")) {
        el("btnPdf").addEventListener("click", function () {
          try {
            log("pdf", "clicked");
            BID.Print.doPrint();
            uiOk("PDF出力（印刷）を開始しました。");
            log("pdf", "OK");
          } catch (e) {
            uiErr("PDF出力に失敗: " + msgOf(e));
            log("pdf", "FAILED " + msgOf(e));
          }
        });
      }

      // [10-09] プロファイル入力イベント
      var pids = ["inpEmail","inpAddress","inpCompanyName","inpRepresentativeName","inpContactName","inpContactInfo"];
      for (var i = 0; i < pids.length; i++) {
        (function (id) {
          var e = el(id);
          if (!e) return;
          e.addEventListener("input", function () {
            try {
              BID.App.refreshComputedStates();
              if (BID.Render && BID.Render.applyMode) BID.Render.applyMode();
            } catch (ex) {
              uiErr("入力反映エラー: " + msgOf(ex));
              log("profile", "ERROR " + msgOf(ex));
            }
          });
        })(pids[i]);
      }

      // [10-10] ログイン/ログアウト
      if (el("btnLogin")) {
        el("btnLogin").addEventListener("click", function () {
          BID.App.doLogin();
        });
      }
      if (el("btnLogout")) {
        el("btnLogout").addEventListener("click", function () {
          BID.App.doLogout();
        });
      }

      // [10-11] Cookie自動入力（起動時）
      try {
        var cp = BID.Profile.loadFromCookie();
        var hasAny = false;
        for (var k in cp) { if (cp.hasOwnProperty(k) && cp[k]) { hasAny = true; break; } }
        if (hasAny) {
          BID.Profile.applyToInputs(cp);
          log("cookie", "autofill OK");
          if (BID.Render) BID.Render.setProfileAutoFillNote("Cookieから自動入力しました。");
        } else {
          log("cookie", "autofill none");
        }
      } catch (e) {
        log("cookie", "autofill FAILED " + msgOf(e));
      }

      // [10-12] Auth監視（ログイン済みなら復帰）
      try {
        BID.DB.onAuthStateChanged(function (user) {
          BID.State.setUser(user);

          if (user) {
            // ログイン済み復帰時、bid/items 読込（まだ未読込なら）
            log("auth", "signed in (uid=" + user.uid + ")");
            if (!BID.State.get().bidStatus) {
              BID.App.loadBidAndItems();
            }
            uiOk("ログイン済みです。");
          } else {
            log("auth", "signed out");
            BID.State.setAuthState("LOCKED");
            uiInfo("先にログインしてください。");
          }

          BID.App.refreshComputedStates();
          safeRenderAll("authStateChanged");
        });
      } catch (e) {
        uiErr("初期化エラー: " + msgOf(e));
        log("boot", "ERROR " + msgOf(e));
      }
    },

    // [10-20] ログイン
    doLogin: function () {
      try {
        log("login", "clicked");

        var bidderId = trim(el("loginBidderId") ? el("loginBidderId").value : "");
        var pw = String(el("loginPassword") ? el("loginPassword").value : "");

        if (!bidderId) {
          uiErr("ログインできません：入札者IDが未入力です。");
          log("login", "FAILED: bidderId empty");
          return;
        }
        if (!pw) {
          uiErr("ログインできません：パスワードが未入力です。");
          log("login", "FAILED: password empty");
          return;
        }

        // stateに入札者IDセット（＝入札者番号）
        BID.State.setBidderId(bidderId);

        uiInfo("ログイン中です...");
        if (BID.Render) BID.Render.setLoginResult("ログイン中...");

        BID.DB.signInWithBidderId(bidderId, pw).then(function (cred) {
          log("login", "OK uid=" + (cred && cred.user ? cred.user.uid : "?"));
          if (BID.Render) BID.Render.setLoginResult("ログインに成功しました。");
          uiOk("ログインに成功しました。");

          // ログイン成功後に bid/items 読込
          BID.App.loadBidAndItems();

          BID.App.refreshComputedStates();
          safeRenderAll("login");
        }).catch(function (e) {
          uiErr("ログインに失敗: " + msgOf(e));
          if (BID.Render) BID.Render.setLoginResult("ログインに失敗しました。");
          log("login", "FAILED " + msgOf(e));
          safeRenderAll("loginFail");
        });
      } catch (e) {
        uiErr("ログイン処理エラー: " + msgOf(e));
        log("login", "ERROR " + msgOf(e));
      }
    },

    // [10-21] ログアウト
    doLogout: function () {
      try {
        log("logout", "clicked");
        uiInfo("ログアウト中です...");
        BID.DB.signOut().then(function () {
          uiOk("ログアウトしました。");
          log("logout", "OK");
          if (BID.Render) BID.Render.setLoginResult("ログアウトしました。");

          // 状態リセット（最低限）
          BID.State.setBidderId("");
          BID.State.setAuthState("LOCKED");
          BID.State.setOffer(null);
          BID.State.setOfferLines({});
          BID.State.setBid(null);
          BID.State.setItems([]);

          BID.App.refreshComputedStates();
          safeRenderAll("logout");
        }).catch(function (e) {
          uiErr("ログアウトに失敗: " + msgOf(e));
          log("logout", "FAILED " + msgOf(e));
        });
      } catch (e) {
        uiErr("ログアウト処理エラー: " + msgOf(e));
        log("logout", "ERROR " + msgOf(e));
      }
    },

    // [10-30] bid/items 読込（ログイン後に呼ぶ）
    loadBidAndItems: function () {
      var st = BID.State.get();
      var bidNo = st.bidNo;

      if (!bidNo) {
        uiErr("入札番号が未設定です。js/01_bidder_config.js の BID.CONFIG.BID_NO を設定してください。");
        log("load", "FAILED: bidNo empty");
        return;
      }
      if (!st.user) {
        uiErr("入札データを読めません：未ログインです。");
        log("load", "FAILED: not signed in");
        return;
      }

      uiInfo("入札データを読み込み中です。");
      log("load", "bids/" + bidNo + " ...");

      BID.DB.getBid(bidNo).then(function (bid) {
        if (!bid) {
          uiErr("bids/" + bidNo + " が見つかりません。");
          log("load", "FAILED: bid not found");
          return;
        }

        BID.State.setBid(bid);

        log("load", "items ...");
        return BID.DB.getItems(bidNo).then(function (items) {
          BID.State.setItems(items);
          BID.State.setLastLoadedAt(nowIso());
          log("load", "OK: status=" + (bid.status || "") + " items=" + items.length);

          BID.App.refreshComputedStates();
          safeRenderAll("load");

          uiOk("入札データを読み込みました。");
        });
      }).catch(function (e) {
        uiErr("読込エラー: " + msgOf(e));
        log("load", "FAILED " + msgOf(e));
      });
    },

    // [10-40] 計算状態更新
    refreshComputedStates: function () {
      try {
        var st = BID.State.get();

        // profile
        var p = BID.Profile.readFromInputs();
        BID.State.setProfile(p);

        var miss = BID.Profile.validateRequired(p);
        BID.State.setProfileState(miss.length ? "INCOMPLETE" : "COMPLETE");

        if (BID.Render && BID.Render.setProfileStatus) BID.Render.setProfileStatus(miss);
      } catch (e) {
        uiErr("状態更新エラー: " + msgOf(e));
        log("state", "ERROR " + msgOf(e));
      }
    },

    // [10-50] 入力済データ読込（offers）
    loadOffer: function () {
      try {
        var st = BID.State.get();
        log("offer", "clicked");

        if (!st.user) {
          uiErr("入力済データを読み込めません：未ログインです。");
          log("offer", "FAILED: not signed in");
          return;
        }
        if (!st.bidNo) {
          uiErr("入札番号が未設定です。");
          log("offer", "FAILED: bidNo empty");
          return;
        }
        if (!st.bidderNo) {
          uiErr("入札者IDが未設定です。ログインし直してください。");
          log("offer", "FAILED: bidderNo empty");
          return;
        }

        uiInfo("入力済データを読み込み中です。");
        log("offer", "getOffer bids/" + st.bidNo + "/offers/" + st.bidderNo);

        BID.DB.getOffer(st.bidNo, st.bidderNo).then(function (offer) {
          BID.State.setLastLoadedAt(nowIso());

          if (!offer) {
            BID.State.setOffer(null);
            BID.State.setOfferLines({});
            uiOk("保存済データはありません。");
            log("offer", "none");
            safeRenderAll("offer");
            return;
          }

          BID.State.setOffer(offer);
          BID.State.setOfferLines(offer.lines || {});
          log("offer", "loaded");

          // profile反映（offer.profile優先、旧形式も拾う）
          var prof = offer.profile || {
            email: offer.email || "",
            address: offer.address || "",
            companyName: offer.companyName || "",
            representativeName: offer.representativeName || "",
            contactName: offer.contactName || "",
            contactInfo: offer.contactInfo || ""
          };
          BID.Profile.applyToInputs(prof);
          BID.State.setProfile(prof);

          if (BID.Offer && BID.Offer.applyLinesToTable) BID.Offer.applyLinesToTable(offer.lines || {});

          BID.App.refreshComputedStates();
          safeRenderAll("offer");

          uiOk("入力済データを読み込みました。");
          log("offer", "OK");
        }).catch(function (e) {
          uiErr("入力済データ読込に失敗: " + msgOf(e));
          log("offer", "FAILED " + msgOf(e));
        });
      } catch (e) {
        uiErr("入力済データ読込エラー: " + msgOf(e));
        log("offer", "ERROR " + msgOf(e));
      }
    },

    // [10-60] 保存（open中は上書きOK）
    submitOffer: function () {
      try {
        var st = BID.State.get();
        log("save", "clicked");

        if (!st.user) {
          uiErr("保存できません：未ログインです。");
          log("save", "FAILED: not signed in");
          return;
        }
        if (!st.bidNo) {
          uiErr("保存できません：入札番号が未設定です。");
          log("save", "FAILED: bidNo empty");
          return;
        }
        if (!st.bidStatus) {
          uiErr("保存できません：入札データが未読込です。");
          log("save", "FAILED: bid not loaded");
          return;
        }
        if (st.bidStatus !== "open") {
          uiErr("保存できません：入札が open ではありません（status=" + st.bidStatus + "）。");
          log("save", "FAILED: status=" + st.bidStatus);
          return;
        }
        if (st.authState !== "UNLOCKED") {
          uiErr("保存できません：入札認証が必要です。");
          log("save", "FAILED: locked");
          return;
        }

        BID.App.refreshComputedStates();
        if (BID.State.get().profileState !== "COMPLETE") {
          uiErr("保存できません：入札者情報（必須）を入力してください。");
          log("save", "FAILED: profile incomplete");
          return;
        }

        var payload = BID.Offer.buildOfferPayload();
        if (!payload) {
          log("save", "FAILED: payload invalid");
          return;
        }

        // Cookie保存
        try {
          BID.Profile.saveToCookie(payload.profile);
          log("cookie", "save OK");
        } catch (e1) {
          log("cookie", "save FAILED " + msgOf(e1));
        }

        uiInfo("保存中です...");
        log("save", "upsertOffer ... bidderId=" + payload.bidderId);

        BID.DB.upsertOffer(st.bidNo, payload.bidderId, payload).then(function (res) {
          BID.State.setLastSavedAt(nowIso());
          uiOk("保存しました。open中は何度でも修正できます。");
          log("save", "OK exists=" + (res && res.exists ? "true" : "false"));

          // 再読込して整合
          return BID.DB.getOffer(st.bidNo, payload.bidderId).then(function (offer) {
            BID.State.setOffer(offer);
            BID.State.setOfferLines((offer && offer.lines) ? offer.lines : {});
            safeRenderAll("save");
          });
        }).catch(function (e) {
          uiErr("保存に失敗: " + msgOf(e));
          log("save", "FAILED " + msgOf(e));
        });
      } catch (e) {
        uiErr("保存エラー: " + msgOf(e));
        log("save", "ERROR " + msgOf(e));
      }
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    BID.App.boot();
  });

})(window);
