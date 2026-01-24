/* [JST 2026-01-24 21:45]  10_bidder_app.js v20260124-01 */
(function(){
  // =========================================================
  // [APP-00] メタ
  // =========================================================
  var FILE = "10_bidder_app.js";
  var VER  = "v20260124-01";
  var TS   = new Date().toISOString();

  // =========================================================
  // [APP-01] DOMユーティリティ
  // =========================================================
  function $(id){ return document.getElementById(id); }
  function setText(id, text){
    var el = $(id);
    if(!el) return;
    el.textContent = (text == null ? "" : String(text));
  }
  function nowStr(){
    try{
      var d = new Date();
      // “時計が動いてコピーできない”対策：秒以下は出さない
      return d.getFullYear() + "-" + z2(d.getMonth()+1) + "-" + z2(d.getDate())
        + " " + z2(d.getHours()) + ":" + z2(d.getMinutes()) + ":" + z2(d.getSeconds());
    }catch(e){
      return "";
    }
  }
  function z2(n){ return (n<10 ? "0"+n : ""+n); }

  // =========================================================
  // [APP-02] ログ（最優先：どの段階で落ちてもtextareaへ出す）
  // =========================================================
  var LOG_PAUSED = false;
  var lastLine = "";

  function appendLog(line){
    var ta = $("txtLog");
    if(!ta) { try{ console.log(line); }catch(e){} return; }

    if(LOG_PAUSED) return;

    // 連続重複の抑制（stateの連打対策）
    if(line === lastLine) return;
    lastLine = line;

    ta.value += (ta.value ? "\n" : "") + line;
    // 自動スクロール（停止中はしない）
    ta.scrollTop = ta.scrollHeight;
  }

  function L(tag, msg){
    var line = "[" + nowStr() + "] [" + tag + "] " + msg;

    // 既存 logger があれば併用
    try{
      if(window.BidderLog && typeof window.BidderLog.write === "function"){
        // BidderLog 側が暴れる場合があるので、こちらも必ず残す
        // （BidderLog 側が停止中でも、textareaには出す）
        try{ window.BidderLog.write(tag, msg); }catch(e){}
      }
    }catch(e){}

    appendLog(line);
    try{ console.log(line); }catch(e){}
  }

  function setPaused(v){
    LOG_PAUSED = !!v;
    setText("btnLogPause", LOG_PAUSED ? "ログ再開" : "ログ停止");
  }

  function clearLog(){
    var ta = $("txtLog");
    if(ta) ta.value = "";
    lastLine = "";
  }

  async function copyLog(){
    var ta = $("txtLog");
    if(!ta) return false;
    var text = ta.value || "";
    if(!text){
      showMsg("err", "ログが空です。");
      return false;
    }

    // iPhone Safari 対応（clipboard APIが使えない場合もある）
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(text);
        showMsg("ok", "ログをコピーしました。");
        return true;
      }
    }catch(e){}

    try{
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var ok = document.execCommand("copy");
      if(ok){
        showMsg("ok", "ログをコピーしました。");
        return true;
      }
    }catch(e){}

    showMsg("err", "コピーに失敗しました（iPhoneの場合は共有→コピーも検討してください）。");
    return false;
  }

  // =========================================================
  // [APP-03] メッセージ表示（成功/失敗/理由）
  // =========================================================
  function showMsg(kind, text){
    var box = $("msgBox");
    if(!box) return;
    box.style.display = "block";
    box.className = "card " + (kind === "ok" ? "ok" : "err");
    box.textContent = String(text || "");
  }
  function hideMsg(){
    var box = $("msgBox");
    if(!box) return;
    box.style.display = "none";
    box.textContent = "";
  }

  // =========================================================
  // [APP-04] バージョン表示
  // =========================================================
  function pushVer(){
    if(!window.__APP_VER__) window.__APP_VER__ = [];
    window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });
    setText("lblPageVer", "v20260124-03");
    renderVerList();
  }

  function renderVerList(){
    var pre = $("preVerList");
    if(!pre) return;
    var list = window.__APP_VER__ || [];
    var lines = [];
    for(var i=0;i<list.length;i++){
      var it = list[i];
      lines.push((it.ts||"") + " " + (it.file||"") + " " + (it.ver||""));
    }
    pre.textContent = lines.join("\n");
  }

  // =========================================================
  // [APP-05] 入札番号の決定（URL優先）
  //   - ?bidNo=2026002
  //   - ?bid=2026002
  //   - #2026002
  //   - BidderConfig.DEFAULT_BID_NO
  // =========================================================
  function resolveBidNo(){
    try{
      var sp = new URLSearchParams(location.search || "");
      var bidNo = sp.get("bidNo") || sp.get("bid") || "";
      if(!bidNo){
        var h = (location.hash||"").replace("#","").trim();
        if(h) bidNo = h;
      }
      if(!bidNo && window.BidderConfig && window.BidderConfig.DEFAULT_BID_NO){
        bidNo = window.BidderConfig.DEFAULT_BID_NO;
      }
      return (bidNo || "").trim();
    }catch(e){
      return "";
    }
  }

  // =========================================================
  // [APP-06] 状態描画（BidderStateが無くても落ちない）
  // =========================================================
  function getStateSafe(){
    try{
      if(window.BidderState && typeof window.BidderState.get === "function"){
        return window.BidderState.get() || {};
      }
    }catch(e){}
    return {};
  }

  function renderStatus(){
    var st = getStateSafe();

    setText("lblBidNo", st.bidNo || "-");
    setText("lblBidStatus", st.status || "-");
    setText("lblAuthState", st.authState || "LOCKED");

    // inputEnabled/viewOnly はStateが無ければ画面表示だけ最低限
    var inputEnabled = !!st.inputEnabled;
    setText("lblInputEnabled", inputEnabled ? "可" : "不可");

    var viewOnly = !!st.viewOnly;
    setText("lblViewOnly", viewOnly ? "VIEW" : "EDIT");

    setText("lblLastLoadedAt", st.lastLoadedAt || "-");
    setText("lblLastSavedAt", st.lastSavedAt || "-");
  }

  // =========================================================
  // [APP-07] DBロード（BidderDBの実装差異を吸収）
  // =========================================================
  function ensureBidNoInState(bidNo){
    try{
      if(window.BidderState && typeof window.BidderState.setBidNo === "function"){
        window.BidderState.setBidNo(bidNo);
      }else{
        // 最低限の描画
        setText("lblBidNo", bidNo || "-");
      }
    }catch(e){}
  }

  function loadAll(){
    hideMsg();
    var bidNo = resolveBidNo();
    if(!bidNo){
      showMsg("err", "入札番号が指定されていません。URLに ?bidNo=2026002 を付けてください。");
      L("load", "FAILED bidNo missing");
      renderStatus();
      return Promise.reject(new Error("bidNo missing"));
    }

    ensureBidNoInState(bidNo);
    L("load", "start bidNo=" + bidNo);

    // Firebaseの存在確認（ここで原因が即わかる）
    if(typeof firebase === "undefined"){
      var m = "firebase が未定義です。index.html の Firebase SDK 読み込み（firebase-*-compat.js）を確認してください。";
      showMsg("err", m);
      L("fatal", m);
      renderStatus();
      return Promise.reject(new Error(m));
    }

    // BidderDB 経由でロード
    try{
      if(window.BidderDB && typeof window.BidderDB.loadAll === "function"){
        return window.BidderDB.loadAll(bidNo)
          .then(function(){
            L("load", "OK");
            safeRenderAll();
            return true;
          })
          .catch(function(e){
            fail("loadAll", e);
            throw e;
          });
      }

      // 旧API想定：loadBid + loadItems + loadOffer 等
      var p = Promise.resolve(true);

      if(window.BidderDB && typeof window.BidderDB.loadBid === "function"){
        p = p.then(function(){ return window.BidderDB.loadBid(bidNo); });
      }
      if(window.BidderDB && typeof window.BidderDB.loadItems === "function"){
        p = p.then(function(){ return window.BidderDB.loadItems(bidNo); });
      }
      if(window.BidderDB && typeof window.BidderDB.loadMyOffer === "function"){
        p = p.then(function(){ return window.BidderDB.loadMyOffer(bidNo); });
      }

      return p.then(function(){
        L("load", "OK");
        safeRenderAll();
        return true;
      }).catch(function(e){
        fail("load", e);
        throw e;
      });

    }catch(e){
      fail("load", e);
      return Promise.reject(e);
    }
  }

  function safeRenderAll(){
    try{
      if(window.BidderRender && typeof window.BidderRender.renderAll === "function"){
        window.BidderRender.renderAll();
      }
    }catch(e){
      // renderが死んでも状態は出す
      L("render", "FAILED " + (e && e.message ? e.message : String(e)));
    }
    renderStatus();
    renderVerList();
  }

  // =========================================================
  // [APP-08] 失敗共通
  // =========================================================
  function fail(op, e){
    var msg = (e && e.message) ? e.message : String(e);
    showMsg("err", op + " 失敗: " + msg);
    L(op, "FAILED " + msg);
    renderStatus();
  }

  // =========================================================
  // [APP-09] ボタン処理
  // =========================================================
  function bindButtons(){
    var ta = $("txtLog");
    if(ta){
      ta.addEventListener("pointerdown", function(){
        // タップで自動停止（コピーしやすく）
        if(!LOG_PAUSED){
          setPaused(true);
          L("log", "auto paused by tap");
        }
      });
    }

    var btn;

    btn = $("btnLogClear");
    if(btn) btn.addEventListener("click", function(){
      clearLog();
      hideMsg();
      L("log", "cleared");
    });

    btn = $("btnLogPause");
    if(btn) btn.addEventListener("click", function(){
      setPaused(!LOG_PAUSED);
      L("log", LOG_PAUSED ? "paused" : "resumed");
    });

    btn = $("btnLogCopy");
    if(btn) btn.addEventListener("click", function(){
      // コピー時は必ず止める
      setPaused(true);
      copyLog();
    });

    btn = $("btnLoad");
    if(btn) btn.addEventListener("click", function(){
      loadAll();
    });

    btn = $("btnLogin");
    if(btn) btn.addEventListener("click", function(){
      hideMsg();
      try{
        var bidderId = ($("txtBidderId") && $("txtBidderId").value || "").trim();
        var pass = ($("txtBidderPass") && $("txtBidderPass").value || "").trim();
        if(!bidderId) throw new Error("入札者IDが空です");
        if(!pass) throw new Error("パスワードが空です");

        if(!window.BidderAuth || typeof window.BidderAuth.signIn !== "function"){
          throw new Error("BidderAuth.signIn が見つかりません（05_bidder_auth.js を確認）");
        }

        L("ui", "login click bidderId=" + bidderId);
        window.BidderAuth.signIn(bidderId, pass)
          .then(function(){
            showMsg("ok", "ログイン成功");
            L("auth", "OK");
            safeRenderAll();
          })
          .catch(function(e){
            fail("login", e);
          });

      }catch(e){
        fail("login", e);
      }
    });

    btn = $("btnLogout");
    if(btn) btn.addEventListener("click", function(){
      hideMsg();
      try{
        if(!window.BidderAuth || typeof window.BidderAuth.signOut !== "function"){
          throw new Error("BidderAuth.signOut が見つかりません");
        }
        L("ui", "logout click");
        window.BidderAuth.signOut()
          .then(function(){
            showMsg("ok", "ログアウトしました");
            safeRenderAll();
          })
          .catch(function(e){
            fail("logout", e);
          });
      }catch(e){
        fail("logout", e);
      }
    });

    btn = $("btnAuth");
    if(btn) btn.addEventListener("click", function(){
      hideMsg();
      try{
        var code = ($("txtAuthCode") && $("txtAuthCode").value || "").trim();
        if(!code) throw new Error("認証コードを入力してください。");
        if(!window.BidderAuth || typeof window.BidderAuth.bidAuth !== "function"){
          throw new Error("BidderAuth.bidAuth が見つかりません");
        }
        L("ui", "bidAuth click");
        var ok = window.BidderAuth.bidAuth(code);
        showMsg("ok", "認証OK");
        L("auth", "bidAuth OK " + ok);
        safeRenderAll();
      }catch(e){
        fail("bidAuth", e);
      }
    });

    btn = $("btnSaveProfile");
    if(btn) btn.addEventListener("click", function(){
      hideMsg();
      try{
        if(!window.BidderProfile || typeof window.BidderProfile.saveToCookie !== "function"){
          throw new Error("BidderProfile.saveToCookie が見つかりません（06_bidder_profile.jsを確認）");
        }
        var profile = readProfileFromUI();
        window.BidderProfile.saveToCookie(profile);
        showMsg("ok", "プロフィールをCookieに保存しました");
        L("profile", "save cookie OK");
      }catch(e){
        fail("profileSave", e);
      }
    });

    btn = $("btnProfileLoad");
    if(btn) btn.addEventListener("click", function(){
      hideMsg();
      try{
        if(!window.BidderProfile || typeof window.BidderProfile.loadFromCookie !== "function"){
          throw new Error("BidderProfile.loadFromCookie が見つかりません");
        }
        var p = window.BidderProfile.loadFromCookie();
        if(!p) throw new Error("Cookieに保存されたプロフィールがありません");
        writeProfileToUI(p);
        showMsg("ok", "入力済データを読み込みました");
        L("profile", "load cookie OK");
      }catch(e){
        fail("profileLoad", e);
      }
    });

    btn = $("btnCookieClear");
    if(btn) btn.addEventListener("click", function(){
      hideMsg();
      try{
        if(window.BidderProfile && typeof window.BidderProfile.clearCookie === "function"){
          window.BidderProfile.clearCookie();
        }
        showMsg("ok", "Cookieを削除しました");
        L("cookie", "clear OK");
      }catch(e){
        fail("cookieClear", e);
      }
    });

    btn = $("btnSaveOffer");
    if(btn) btn.addEventListener("click", function(){
      hideMsg();
      try{
        if(!window.BidderOffer || typeof window.BidderOffer.saveOffer !== "function"){
          throw new Error("BidderOffer.saveOffer が見つかりません（07_bidder_offer.jsを確認）");
        }
        L("ui", "saveOffer click");
        window.BidderOffer.saveOffer()
          .then(function(){
            showMsg("ok", "入札を保存しました");
            L("offer", "save OK");
            safeRenderAll();
          })
          .catch(function(e){
            fail("saveOffer", e);
          });
      }catch(e){
        fail("saveOffer", e);
      }
    });

    btn = $("btnPrint");
    if(btn) btn.addEventListener("click", function(){
      hideMsg();
      try{
        if(window.BidderPrint && typeof window.BidderPrint.print === "function"){
          window.BidderPrint.print();
          showMsg("ok", "印刷を開始しました");
          L("print", "OK");
        }else{
          throw new Error("BidderPrint.print が見つかりません（09_bidder_print.jsを確認）");
        }
      }catch(e){
        fail("print", e);
      }
    });

    btn = $("btnPdf");
    if(btn) btn.addEventListener("click", function(){
      hideMsg();
      try{
        if(window.BidderPrint && typeof window.BidderPrint.exportPdf === "function"){
          window.BidderPrint.exportPdf();
          showMsg("ok", "PDF出力を開始しました");
          L("pdf", "OK");
        }else{
          throw new Error("BidderPrint.exportPdf が見つかりません（09_bidder_print.jsを確認）");
        }
      }catch(e){
        fail("pdf", e);
      }
    });
  }

  function readProfileFromUI(){
    return {
      email: ($("txtEmail") && $("txtEmail").value || "").trim(),
      address: ($("txtAddress") && $("txtAddress").value || "").trim(),
      companyName: ($("txtCompanyName") && $("txtCompanyName").value || "").trim(),
      representativeName: ($("txtRepresentativeName") && $("txtRepresentativeName").value || "").trim(),
      contactName: ($("txtContactName") && $("txtContactName").value || "").trim(),
      contactInfo: ($("txtContactInfo") && $("txtContactInfo").value || "").trim()
    };
  }

  function writeProfileToUI(p){
    if(!p) return;
    if($("txtEmail")) $("txtEmail").value = p.email || "";
    if($("txtAddress")) $("txtAddress").value = p.address || "";
    if($("txtCompanyName")) $("txtCompanyName").value = p.companyName || "";
    if($("txtRepresentativeName")) $("txtRepresentativeName").value = p.representativeName || "";
    if($("txtContactName")) $("txtContactName").value = p.contactName || "";
    if($("txtContactInfo")) $("txtContactInfo").value = p.contactInfo || "";
  }

  // =========================================================
  // [APP-10] 起動
  // =========================================================
  function boot(){
    pushVer();
    // 初期は「止め気味」にして、コピー邪魔を抑止
    setPaused(false);

    // ここで必ず1行出る（＝10まで到達しているか確認できる）
    L("boot", "start " + FILE + " " + VER);

    // BidderAuth監視（存在するなら）
    try{
      if(window.BidderAuth && typeof window.BidderAuth.watchAuthState === "function"){
        window.BidderAuth.watchAuthState();
        L("boot", "watchAuthState OK");
      }else{
        L("boot", "watchAuthState skipped");
      }
    }catch(e){
      L("boot", "watchAuthState FAILED " + (e && e.message ? e.message : String(e)));
    }

    bindButtons();

    // bidNoを状態に反映＆初回ロード
    var bidNo = resolveBidNo();
    if(bidNo){
      ensureBidNoInState(bidNo);
    }else{
      showMsg("err", "入札番号が未指定です。URLに ?bidNo=XXXX を付けてください。");
      L("boot", "bidNo missing");
    }

    // 初回レンダリング
    safeRenderAll();

    // 初回ロードは「bidNoがある場合のみ」実行
    if(bidNo){
      loadAll().catch(function(){});
    }
  }

  // DOM準備後
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})();