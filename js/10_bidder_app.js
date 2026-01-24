// [JST 2026-01-23 22:30] js/10_bidder_app.js v20260123-01
// [BID-10] 起動・イベント配線（ログイン→読込→認証→入力）
// すべてのボタン押下で「成功/失敗/理由」をログ＋画面に必ず出す
(function (global) {
  var BID = global.BID = global.BID || {};

  function el(id){ return document.getElementById(id); }
  function nowIso(){ return new Date().toISOString(); }
  function msgOf(e){ return (e && e.message) ? e.message : String(e || ""); }

  function log(tag, msg){
    if (BID.Log && BID.Log.write) BID.Log.write("[" + tag + "] " + msg);
  }
  function ok(msg){
    if (BID.Render && BID.Render.setOk) BID.Render.setOk(msg);
  }
  function err(msg){
    if (BID.Render && BID.Render.setError) BID.Render.setError(msg);
  }
  function info(msg){
    if (BID.Render && BID.Render.setInfo) BID.Render.setInfo(msg);
  }

  function safeRender(tag){
    try {
      if (BID.Render && BID.Render.renderAll) BID.Render.renderAll();
      log(tag||"render", "renderAll OK");
    } catch(e){
      err("画面描画エラー: " + msgOf(e));
      log(tag||"render", "FAILED " + msgOf(e));
    }
  }

  // 状態計算（profileState）
  function refreshProfileState(){
    try {
      var st = BID.State.get();
      var p = BID.Offer.readProfileFromInputs();

      // bidderId はログイン由来を優先固定
      if (st.bidderId) p.bidderId = st.bidderId;
      BID.State.setProfile(p);

      var miss = BID.Offer.validateRequired(p);
      BID.State.setProfileState(miss.length ? "INCOMPLETE" : "COMPLETE");
      if (BID.Render && BID.Render.setProfileStatus) BID.Render.setProfileStatus(miss);

      log("state", "profileState=" + (miss.length ? "INCOMPLETE" : "COMPLETE") + (miss.length ? (" miss=" + miss.join(",")) : ""));
    } catch(e){
      err("状態更新エラー: " + msgOf(e));
      log("state", "FAILED " + msgOf(e));
    }
  }

  BID.App = {
    boot: function () {
      // bidNo
      BID.State.initBidNo();

      // 初期メッセージ
      if (BID.Render && BID.Render.clearMessages) BID.Render.clearMessages();
      info("ログインしてください。");
      safeRender("boot");

      // 版本ログ（読み込み確認）
      log("boot", "bidNo=" + (BID.State.get().bidNo || "(empty)"));

      // ボタン：ログクリア
      if (el("btnLogClear")) el("btnLogClear").addEventListener("click", function(){
        try { BID.Log.clear(); ok("ログをクリアしました。"); log("btn", "log clear OK"); }
        catch(e){ err("ログクリアに失敗: " + msgOf(e)); log("btn", "log clear FAILED " + msgOf(e)); }
      });

      // ボタン：Cookie削除
      if (el("btnCookieClear")) el("btnCookieClear").addEventListener("click", function(){
        try {
          BID.Offer.clearProfileCookie();
          ok("Cookieを削除しました。");
          log("cookie", "clear OK");
          safeRender("cookie");
        } catch(e){
          err("Cookie削除に失敗: " + msgOf(e));
          log("cookie", "clear FAILED " + msgOf(e));
        }
      });

      // ボタン：ログイン
      if (el("btnLogin")) el("btnLogin").addEventListener("click", function(){
        try {
          log("login", "clicked");
          info("ログイン中です...");
          BID.Login.signIn().then(function(){
            ok("ログインしました。入札データを読み込みます。");
            log("login", "OK");
            BID.App.loadBidAndItems();
          }).catch(function(e){
            err("ログインに失敗: " + msgOf(e));
            log("login", "FAILED " + msgOf(e));
          }).finally(function(){
            safeRender("login");
          });
        } catch(e){
          err("ログイン処理エラー: " + msgOf(e));
          log("login", "ERROR " + msgOf(e));
        }
      });

      // ボタン：ログアウト
      if (el("btnLogout")) el("btnLogout").addEventListener("click", function(){
        try {
          log("logout", "clicked");
          BID.Login.signOut().then(function(){
            ok("ログアウトしました。");
            // 状態初期化（最低限）
            BID.State.setAuthState("LOCKED");
            BID.State.setBid(null);
            BID.State.setItems([]);
            BID.State.setOffer(null);
            BID.State.setOfferLines({});
            safeRender("logout");
          }).catch(function(e){
            err("ログアウトに失敗: " + msgOf(e));
            log("logout", "FAILED " + msgOf(e));
          });
        } catch(e){
          err("ログアウト処理エラー: " + msgOf(e));
          log("logout", "ERROR " + msgOf(e));
        }
      });

      // ボタン：認証
      if (el("btnAuth")) el("btnAuth").addEventListener("click", function(){
        try {
          log("auth", "clicked");
          var okv = BID.Auth.tryAuth();
          log("auth", okv ? "OK" : "NG");
          refreshProfileState();
          safeRender("auth");
        } catch(e){
          err("認証処理エラー: " + msgOf(e));
          log("auth", "FAILED " + msgOf(e));
        }
      });

      // profile入力
      var pids = ["inpEmail","inpAddress","inpCompanyName","inpRepresentativeName","inpContactName","inpContactInfo"];
      for (var i=0;i<pids.length;i++){
        (function(id){
          var e = el(id);
          if (!e) return;
          e.addEventListener("input", function(){
            refreshProfileState();
            if (BID.Render && BID.Render.applyMode) BID.Render.applyMode();
          });
        })(pids[i]);
      }

      // ボタン：入力済データの読み込み
      if (el("btnLoadOffer")) el("btnLoadOffer").addEventListener("click", function(){
        BID.App.loadOffer();
      });

      // ボタン：保存
      if (el("btnSubmit")) el("btnSubmit").addEventListener("click", function(){
        BID.App.submitOffer();
      });

      // 印刷 / PDF
      if (el("btnPrint")) el("btnPrint").addEventListener("click", function(){
        try {
          log("print", "clicked");
          if (!BID.Print || !BID.Print.doPrint) throw new Error("印刷機能が未実装です（09_bidder_print.js を確認）。");
          BID.Print.doPrint();
          ok("印刷を開始しました。");
          log("print", "OK");
        } catch(e){
          err("印刷に失敗: " + msgOf(e));
          log("print", "FAILED " + msgOf(e));
        }
      });

      if (el("btnPdf")) el("btnPdf").addEventListener("click", function(){
        try {
          log("pdf", "clicked");
          if (!BID.Print || !BID.Print.doPrint) throw new Error("PDF出力機能が未実装です（09_bidder_print.js を確認）。");
          BID.Print.doPrint();
          ok("PDF出力（印刷）を開始しました。");
          log("pdf", "OK");
        } catch(e){
          err("PDF出力に失敗: " + msgOf(e));
          log("pdf", "FAILED " + msgOf(e));
        }
      });

      // Cookie自動入力（起動時）
      try {
        var cp = BID.Offer.loadProfileFromCookie();
        var hasAny = false;
        for (var k in cp) { if (cp.hasOwnProperty(k) && cp[k]) { hasAny = true; break; } }
        if (hasAny) {
          BID.Offer.applyProfileToInputs(cp);
          log("cookie", "autofill OK");
        } else {
          log("cookie", "autofill none");
        }
      } catch(e){
        log("cookie", "autofill FAILED " + msgOf(e));
      }

      // Auth状態監視（画面反映だけ）
      try {
        BID.DB.auth().onAuthStateChanged(function(user){
          BID.State.setUser(user || null);
          if (!user) {
            BID.State.setBidderId("");
            info("ログインしてください。");
          }
          safeRender("authState");
        });
      } catch(e){
        err("初期化エラー: " + msgOf(e));
        log("boot", "FAILED " + msgOf(e));
      }

      // 最初は読み込まない（ログインしてから）
      safeRender("boot2");
    },

    // bid/items 読込
    loadBidAndItems: function () {
      try {
        var st = BID.State.get();
        if (!st.user) { err("読込できません：ログインしてください。"); log("load", "FAILED not signed in"); return; }
        if (!st.bidNo) { err("入札番号が未設定です（01_bidder_config.js）。"); log("load", "FAILED bidNo empty"); return; }

        info("入札データを読み込み中です。");
        log("load", "bids/" + st.bidNo + " ...");

        BID.DB.getBid(st.bidNo).then(function(bid){
          if (!bid) throw new Error("bids/" + st.bidNo + " が見つかりません。");
          BID.State.setBid(bid);

          log("load", "items ...");
          return BID.DB.getItems(st.bidNo).then(function(items){
            BID.State.setItems(items);
            BID.State.setLastLoadedAt(nowIso());
            log("load", "OK status=" + (bid.status||"") + " items=" + items.length);

            refreshProfileState();
            safeRender("load");
            ok("入札データを読み込みました。");
          });
        }).catch(function(e){
          err("読込エラー: " + msgOf(e));
          log("load", "FAILED " + msgOf(e));
          safeRender("load_fail");
        });

      } catch(e){
        err("読込処理エラー: " + msgOf(e));
        log("load", "ERROR " + msgOf(e));
      }
    },

    // 入力済データ読込（offers）
    loadOffer: function () {
      try {
        var st = BID.State.get();
        log("offer", "clicked");

        if (!st.user) { err("読み込めません：ログインしてください。"); log("offer", "FAILED not signed in"); return; }
        if (!st.bidNo) { err("入札番号が未設定です。"); log("offer", "FAILED bidNo empty"); return; }
        if (!st.bidderId) { err("入札者IDが未設定です（ログイン状態を確認）。"); log("offer", "FAILED bidderId empty"); return; }

        info("入力済データを読み込み中です。");
        log("offer", "getOffer bids/" + st.bidNo + "/offers/" + st.bidderId);

        BID.DB.getOffer(st.bidNo, st.bidderId).then(function(offer){
          if (!offer) {
            BID.State.setOffer(null);
            BID.State.setOfferLines({});
            BID.State.setLastLoadedAt(nowIso());
            ok("保存済データはありません。");
            log("offer", "none");
            safeRender("offer_none");
            return;
          }

          BID.State.setOffer(offer);
          BID.State.setOfferLines(offer.lines || {});
          BID.State.setLastLoadedAt(nowIso());

          // profile反映（offer.profile優先）
          var prof = offer.profile || {};
          prof.bidderId = st.bidderId;
          BID.Offer.applyProfileToInputs({
            bidderId: st.bidderId,
            email: prof.email || "",
            address: prof.address || "",
            companyName: prof.companyName || "",
            representativeName: prof.representativeName || "",
            contactName: prof.contactName || "",
            contactInfo: prof.contactInfo || ""
          });

          // lines
          if (BID.Offer && BID.Offer.applyLinesToTable) BID.Offer.applyLinesToTable(offer.lines || {});

          refreshProfileState();
          safeRender("offer_ok");

          ok("入力済データを読み込みました。");
          log("offer", "OK");
        }).catch(function(e){
          err("入力済データ読込に失敗: " + msgOf(e));
          log("offer", "FAILED " + msgOf(e));
        });

      } catch(e){
        err("入力済データ読込エラー: " + msgOf(e));
        log("offer", "ERROR " + msgOf(e));
      }
    },

    // 保存（提出）
    submitOffer: function () {
      try {
        var st = BID.State.get();
        log("save", "clicked");

        if (!st.user) { err("保存できません：ログインしてください。"); log("save", "FAILED not signed in"); return; }
        if (!st.bidNo) { err("保存できません：入札番号が未設定です。"); log("save", "FAILED bidNo empty"); return; }
        if (!st.bidStatus) { err("保存できません：入札データが未読込です。"); log("save", "FAILED bid not loaded"); return; }
        if (st.bidStatus !== "open") { err("保存できません：openではありません（status=" + st.bidStatus + "）。"); log("save", "FAILED status=" + st.bidStatus); return; }
        if (st.authState !== "UNLOCKED") { err("保存できません：認証が必要です。"); log("save", "FAILED locked"); return; }

        refreshProfileState();
        if (BID.State.get().profileState !== "COMPLETE") { err("保存できません：入札者情報（必須）を入力してください。"); log("save", "FAILED profile incomplete"); return; }

        var payload = BID.Offer.buildOfferPayload();
        if (!payload) { log("save", "FAILED payload invalid"); return; }

        // Cookie保存
        try { BID.Offer.saveProfileToCookie(payload.profile); } catch(e1){ log("cookie", "save FAILED " + msgOf(e1)); }

        info("保存中です...");
        log("save", "upsertOffer ... bidderId=" + payload.bidderId);

        BID.DB.upsertOffer(st.bidNo, payload.bidderId, payload).then(function(res){
          BID.State.setLastSavedAt(nowIso());
          ok("保存しました。open中は何度でも修正できます。");
          log("save", "OK exists=" + (res && res.exists ? "true" : "false"));

          // 念のため再読込
          return BID.DB.getOffer(st.bidNo, payload.bidderId).then(function(offer){
            BID.State.setOffer(offer);
            BID.State.setOfferLines((offer && offer.lines) ? offer.lines : {});
            safeRender("save_ok");
          });
        }).catch(function(e){
          err("保存に失敗: " + msgOf(e));
          log("save", "FAILED " + msgOf(e));
        });

      } catch(e){
        err("保存エラー: " + msgOf(e));
        log("save", "ERROR " + msgOf(e));
      }
    }
  };

  document.addEventListener("DOMContentLoaded", function(){
    BID.App.boot();
  });

  try { if (BID.Log && BID.Log.ver) BID.Log.ver("10_bidder_app.js", "v20260123-01"); } catch (e) {}
})(window);
