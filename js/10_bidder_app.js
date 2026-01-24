/* [JST 2026-01-24 21:30]  10_bidder_app.js v20260124-02
   目的:
   - HTML側ボタンのイベントを集約（ログイン→入札認証→プロフィール→保存）
   - ログ停止/コピーでiPhoneでも確実にログが取れる
   - 既存の各モジュール(window.BidderXXX)が無い場合も落ちないよう防御的に実装
   期待する外部API（存在すれば呼ぶ）:
     - window.BidderLog.write(tag,msg), clear(), bindTextArea(el), setPaused(flag), togglePaused(), copyAll()
     - window.BidderDB.loadAll(bidNo)  ※ bids/items/offers等の読込をまとめた想定
     - window.BidderAuth.signIn(bidderId, pass), signOut(), unlockByCode(code)
     - window.BidderProfile.loadFromCookie(), saveToCookie(profileObj?), readForm(), writeForm(profile)
     - window.BidderOffer.upsertOffer()
     - window.BidderRender.renderAll()
     - window.BidderPrint.print(), pdf()
*/
(function(){
  var FILE = "10_bidder_app.js";
  var VER  = "v20260124-02";
  var TS   = new Date().toISOString();

  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });

  function $(id){ return document.getElementById(id); }

  function log(tag, msg){
    if(window.BidderLog && window.BidderLog.write){
      window.BidderLog.write(tag, msg);
    }else{
      try{ console.log("[" + tag + "] " + msg); }catch(e){}
    }
  }

  function showMsg(kind, text){
    var box = $("msgBox");
    if(!box) return;
    box.style.display = "block";
    box.className = "card " + (kind === "ok" ? "ok" : (kind === "err" ? "err" : ""));
    box.textContent = text;
  }

  function clearMsg(){
    var box = $("msgBox");
    if(!box) return;
    box.style.display = "none";
    box.textContent = "";
    box.className = "card";
  }

  function updateVerList(){
    var pre = $("preVerList");
    if(!pre) return;
    var arr = window.__APP_VER__ || [];
    var lines = [];
    for(var i=0;i<arr.length;i++){
      lines.push(arr[i].ts + "  " + arr[i].file + "  " + arr[i].ver);
    }
    pre.textContent = lines.join("\n");
  }

  // 画面の基本ステータス欄（存在すれば更新）
  function updateHeaderByState(){
    try{
      var bidNo = (window.BID_NO || (window.BidderConfig && window.BidderConfig.BID_NO) || "");
      if($("lblBidNo")) $("lblBidNo").textContent = bidNo || "-";

      // stateモジュールがある場合は参照（無ければ何もしない）
      var st = (window.BidderState && window.BidderState.getState) ? window.BidderState.getState() : null;

      if(st){
        if($("lblBidStatus")) $("lblBidStatus").textContent = st.bid && st.bid.status ? st.bid.status : "-";
        if($("lblAuthState")) $("lblAuthState").textContent = st.authState || "LOCKED";
        if($("lblInputEnabled")) $("lblInputEnabled").textContent = st.inputEnabled ? "可" : "不可";
        if($("lblViewOnly")) $("lblViewOnly").textContent = st.viewOnly ? "VIEW" : "EDIT";
        if($("lblLastLoadedAt")) $("lblLastLoadedAt").textContent = st.lastLoadedAt || "-";
        if($("lblLastSavedAt")) $("lblLastSavedAt").textContent = st.lastSavedAt || "-";
      }
    }catch(e){
      log("ui", "updateHeaderByState FAILED " + (e && e.message ? e.message : e));
    }
  }

  async function doRenderAll(){
    try{
      if(window.BidderRender && window.BidderRender.renderAll){
        await window.BidderRender.renderAll();
        log("render", "renderAll OK");
      }else{
        log("render", "BidderRender.renderAll not found");
      }
      updateHeaderByState();
      updateVerList();
    }catch(e){
      log("render", "renderAll FAILED " + (e && e.message ? e.message : e));
    }
  }

  async function doLoad(){
    clearMsg();
    try{
      var bidNo = (window.BID_NO || (window.BidderConfig && window.BidderConfig.BID_NO) || "");
      log("load", "clicked bidNo=" + (bidNo || "(empty)"));

      if(window.BidderDB && window.BidderDB.loadAll){
        await window.BidderDB.loadAll(bidNo);
        log("load", "OK");
        showMsg("ok", "再読込に成功しました。");
      }else{
        log("load", "BidderDB.loadAll not found");
        showMsg("err", "再読込に失敗：DBロード関数が見つかりません。");
      }
      await doRenderAll();
    }catch(e){
      log("load", "FAILED " + (e && e.message ? e.message : e));
      showMsg("err", "再読込に失敗：" + (e && e.message ? e.message : e));
    }
  }

  async function doLogin(){
    clearMsg();
    try{
      var bidderId = ($("txtBidderId") && $("txtBidderId").value || "").trim();
      var pass     = ($("txtBidderPass") && $("txtBidderPass").value || "").trim();

      if(!bidderId){
        showMsg("err", "入札者IDを入力してください。");
        return;
      }
      if(!pass){
        showMsg("err", "パスワードを入力してください。");
        return;
      }

      // stateに bidderId を入れたい場合
      if(window.BidderState && window.BidderState.setBidderId){
        window.BidderState.setBidderId(bidderId);
      }

      log("login", "clicked bidderId=" + bidderId);

      if(window.BidderAuth && window.BidderAuth.signIn){
        await window.BidderAuth.signIn(bidderId, pass);
        log("login", "OK");
        showMsg("ok", "ログインに成功しました。");
      }else{
        log("login", "BidderAuth.signIn not found");
        showMsg("err", "ログインに失敗：Auth関数が見つかりません。");
      }

      // ログイン直後にデータ再読込
      await doLoad();
    }catch(e){
      log("login", "FAILED " + (e && e.message ? e.message : e));
      showMsg("err", "ログインに失敗：" + (e && e.message ? e.message : e));
    }
  }

  async function doLogout(){
    clearMsg();
    try{
      log("logout", "clicked");
      if(window.BidderAuth && window.BidderAuth.signOut){
        await window.BidderAuth.signOut();
        log("logout", "OK");
        showMsg("ok", "ログアウトしました。");
      }else{
        log("logout", "BidderAuth.signOut not found");
        showMsg("err", "ログアウトに失敗：Auth関数が見つかりません。");
      }
      await doRenderAll();
    }catch(e){
      log("logout", "FAILED " + (e && e.message ? e.message : e));
      showMsg("err", "ログアウトに失敗：" + (e && e.message ? e.message : e));
    }
  }

  async function doUnlock(){
    clearMsg();
    try{
      var code = ($("txtAuthCode") && $("txtAuthCode").value || "").trim();
      if(!code){
        showMsg("err", "認証コードを入力してください。");
        return;
      }
      log("auth", "clicked");

      if(window.BidderAuth && window.BidderAuth.unlockByCode){
        await window.BidderAuth.unlockByCode(code);
        log("auth", "OK");
        showMsg("ok", "入札認証に成功しました。");
      }else{
        log("auth", "BidderAuth.unlockByCode not found");
        showMsg("err", "入札認証に失敗：認証関数が見つかりません。");
      }
      await doRenderAll();
    }catch(e){
      log("auth", "FAILED " + (e && e.message ? e.message : e));
      showMsg("err", "入札認証に失敗：" + (e && e.message ? e.message : e));
    }
  }

  function readProfileForm(){
    return {
      bidderId: ($("txtBidderId") && $("txtBidderId").value || "").trim(),
      email: ($("txtEmail") && $("txtEmail").value || "").trim(),
      address: ($("txtAddress") && $("txtAddress").value || "").trim(),
      companyName: ($("txtCompanyName") && $("txtCompanyName").value || "").trim(),
      representativeName: ($("txtRepresentativeName") && $("txtRepresentativeName").value || "").trim(),
      contactName: ($("txtContactName") && $("txtContactName").value || "").trim(),
      contactInfo: ($("txtContactInfo") && $("txtContactInfo").value || "").trim()
    };
  }

  function writeProfileForm(p){
    if(!p) return;
    if($("txtEmail")) $("txtEmail").value = p.email || "";
    if($("txtAddress")) $("txtAddress").value = p.address || "";
    if($("txtCompanyName")) $("txtCompanyName").value = p.companyName || "";
    if($("txtRepresentativeName")) $("txtRepresentativeName").value = p.representativeName || "";
    if($("txtContactName")) $("txtContactName").value = p.contactName || "";
    if($("txtContactInfo")) $("txtContactInfo").value = p.contactInfo || "";
  }

  async function doProfileLoad(){
    clearMsg();
    try{
      log("cookie", "load clicked");
      if(window.BidderProfile && window.BidderProfile.loadFromCookie){
        var p = window.BidderProfile.loadFromCookie();
        writeProfileForm(p);
        log("cookie", "load OK");
        showMsg("ok", "入力済データを読み込みました。");
      }else{
        log("cookie", "BidderProfile.loadFromCookie not found");
        showMsg("err", "読み込みに失敗：Cookie読込関数が見つかりません。");
      }
      await doRenderAll();
    }catch(e){
      log("cookie", "load FAILED " + (e && e.message ? e.message : e));
      showMsg("err", "入力済データの読み込みに失敗：" + (e && e.message ? e.message : e));
    }
  }

  async function doProfileSave(){
    clearMsg();
    try{
      var p = readProfileForm();
      log("save", "profile cookie save ...");
      if(window.BidderProfile && window.BidderProfile.saveToCookie){
        window.BidderProfile.saveToCookie(p);
        log("cookie", "save OK");
        showMsg("ok", "プロフィールをCookieに保存しました。");
      }else{
        log("cookie", "BidderProfile.saveToCookie not found");
        showMsg("err", "保存に失敗：Cookie保存関数が見つかりません。");
      }
    }catch(e){
      log("cookie", "save FAILED " + (e && e.message ? e.message : e));
      showMsg("err", "プロフィール保存に失敗：" + (e && e.message ? e.message : e));
    }
  }

  async function doOfferSave(){
    clearMsg();
    try{
      // 保存前にCookieへも保存（要件：必須項目をCookie保存し次回自動入力）
      await doProfileSave();

      log("save", "upsertOffer ...");
      if(window.BidderOffer && window.BidderOffer.upsertOffer){
        await window.BidderOffer.upsertOffer();
        log("save", "OK");
        showMsg("ok", "入札を保存しました。");
      }else{
        log("save", "BidderOffer.upsertOffer not found");
        showMsg("err", "入札保存に失敗：保存関数が見つかりません。");
      }
      await doRenderAll();
    }catch(e){
      log("save", "FAILED " + (e && e.message ? e.message : e));
      showMsg("err", "入札保存に失敗：" + (e && e.message ? e.message : e));
    }
  }

  async function doPrint(){
    clearMsg();
    try{
      log("print", "clicked");
      if(window.BidderPrint && window.BidderPrint.print){
        await window.BidderPrint.print();
        log("print", "OK");
        showMsg("ok", "印刷を開始しました。");
      }else{
        log("print", "BidderPrint.print not found");
        showMsg("err", "印刷に失敗：印刷関数が見つかりません。");
      }
    }catch(e){
      log("print", "FAILED " + (e && e.message ? e.message : e));
      showMsg("err", "印刷に失敗：" + (e && e.message ? e.message : e));
    }
  }

  async function doPdf(){
    clearMsg();
    try{
      log("pdf", "clicked");
      if(window.BidderPrint && window.BidderPrint.pdf){
        await window.BidderPrint.pdf();
        log("pdf", "OK");
        showMsg("ok", "PDF出力を開始しました。");
      }else{
        log("pdf", "BidderPrint.pdf not found");
        showMsg("err", "PDF出力に失敗：PDF関数が見つかりません。");
      }
    }catch(e){
      log("pdf", "FAILED " + (e && e.message ? e.message : e));
      showMsg("err", "PDF出力に失敗：" + (e && e.message ? e.message : e));
    }
  }

  function doCookieClear(){
    clearMsg();
    try{
      log("cookie", "clear clicked");
      if(window.BidderProfile && window.BidderProfile.clearCookie){
        window.BidderProfile.clearCookie();
        log("cookie", "clear OK");
        showMsg("ok", "Cookieを削除しました。");
      }else{
        // 最低限：全Cookie削除は危険なので、ここでは関数未実装扱いにする
        log("cookie", "BidderProfile.clearCookie not found");
        showMsg("err", "Cookie削除に失敗：削除関数が見つかりません。");
      }
    }catch(e){
      log("cookie", "clear FAILED " + (e && e.message ? e.message : e));
      showMsg("err", "Cookie削除に失敗：" + (e && e.message ? e.message : e));
    }
  }

  function bindLogUi(){
    // ログtextareaをバインド（タップで自動停止）
    var logEl = $("txtLog");
    if(window.BidderLog && window.BidderLog.bindTextArea){
      window.BidderLog.bindTextArea(logEl);
    }

    // クリア
    var btnLogClear = $("btnLogClear");
    if(btnLogClear){
      btnLogClear.onclick = function(){
        if(window.BidderLog && window.BidderLog.clear){
          window.BidderLog.clear();
          log("ui", "log cleared");
        }
      };
    }

    // 停止/再開
    var btnLogPause = $("btnLogPause");
    if(btnLogPause){
      btnLogPause.onclick = function(){
        if(window.BidderLog && window.BidderLog.togglePaused){
          var paused = window.BidderLog.togglePaused();
          btnLogPause.textContent = paused ? "ログ再開" : "ログ停止";
        }
      };
    }

    // 全コピー（コピー前に必ず停止）
    var btnLogCopy = $("btnLogCopy");
    if(btnLogCopy){
      btnLogCopy.onclick = function(){
        if(window.BidderLog && window.BidderLog.setPaused){
          window.BidderLog.setPaused(true);
        }
        if(btnLogPause) btnLogPause.textContent = "ログ再開";

        if(window.BidderLog && window.BidderLog.copyAll){
          window.BidderLog.copyAll().then(function(ok){
            log("copy", ok ? "copied" : "copy failed");
            showMsg(ok ? "ok" : "err", ok ? "ログをコピーしました。" : "ログコピーに失敗しました。");
          });
        }else{
          showMsg("err", "ログコピーに失敗：copy関数が見つかりません。");
        }
      };
    }
  }

  function bindMainButtons(){
    var btnLoad = $("btnLoad");
    if(btnLoad) btnLoad.onclick = doLoad;

    var btnLogin = $("btnLogin");
    if(btnLogin) btnLogin.onclick = doLogin;

    var btnLogout = $("btnLogout");
    if(btnLogout) btnLogout.onclick = doLogout;

    var btnAuth = $("btnAuth");
    if(btnAuth) btnAuth.onclick = doUnlock;

    var btnProfileLoad = $("btnProfileLoad");
    if(btnProfileLoad) btnProfileLoad.onclick = doProfileLoad;

    var btnSaveProfile = $("btnSaveProfile");
    if(btnSaveProfile) btnSaveProfile.onclick = doProfileSave;

    var btnSaveOffer = $("btnSaveOffer");
    if(btnSaveOffer) btnSaveOffer.onclick = doOfferSave;

    var btnPrint = $("btnPrint");
    if(btnPrint) btnPrint.onclick = doPrint;

    var btnPdf = $("btnPdf");
    if(btnPdf) btnPdf.onclick = doPdf;

    var btnCookieClear = $("btnCookieClear");
    if(btnCookieClear) btnCookieClear.onclick = doCookieClear;
  }

  async function boot(){
    try{
      log("ver", TS + " " + FILE + " " + VER);

      // configのBID_NOを表示
      var bidNo = (window.BID_NO || (window.BidderConfig && window.BidderConfig.BID_NO) || "");
      if($("lblBidNo")) $("lblBidNo").textContent = bidNo || "-";
      log("config", "BID_NO=" + (bidNo || "(empty)"));

      bindLogUi();
      bindMainButtons();

      // 初期描画
      await doRenderAll();

      // Cookie自動反映（あれば）
      try{
        if(window.BidderProfile && window.BidderProfile.loadFromCookie){
          var p = window.BidderProfile.loadFromCookie();
          if(p){
            writeProfileForm(p);
            log("cookie", "autofill OK");
          }else{
            log("cookie", "autofill none");
          }
        }else{
          log("cookie", "autofill skipped");
        }
      }catch(e){
        log("cookie", "autofill FAILED " + (e && e.message ? e.message : e));
      }

      // ※自動ロードは運用次第。必要ならON:
      // await doLoad();

    }catch(e){
      log("boot", "FAILED " + (e && e.message ? e.message : e));
      showMsg("err", "起動に失敗：" + (e && e.message ? e.message : e));
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();