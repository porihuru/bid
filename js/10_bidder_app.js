/* [JST 2026-01-24 22:10]  10_bidder_app.js v20260124-01 */
(function(){
  "use strict";

  var FILE = "10_bidder_app.js";
  var VER  = "v20260125-01";
  var TS   = new Date().toISOString();

  // =========================================================
  // [APP-00] 最低限のロガー（03が壊れていても動く）
  // =========================================================
  function nowIso(){ try{ return new Date().toISOString(); }catch(e){ return ""; } }
  function toStr(x){ try{ return (x && x.message) ? x.message : ("" + x); }catch(e){ return "" + x; } }

  // 03_bidder_log.js があればそれを使う。無ければ BOOTLOG / console に流す。
  function L(tag, msg){
    try{
      if(window.BidderLog && window.BidderLog.write) return window.BidderLog.write(tag, msg);
      if(window.BOOTLOG && window.BOOTLOG.write) return window.BOOTLOG.write(tag, msg);
      console.log("[" + tag + "] " + msg);
    }catch(e){
      try{ console.log("[" + tag + "] " + msg); }catch(ex){}
    }
  }

  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });
  L("ver", TS + " " + FILE + " " + VER);

  // =========================================================
  // [APP-01] DOMユーティリティ
  // =========================================================
  function $(id){ return document.getElementById(id); }
  function setText(id, txt){
    var el = $(id);
    if(el) el.textContent = (txt == null ? "" : ("" + txt));
  }
  function showMsg(kind, title, detail){
    var box = $("msgBox");
    if(!box) return;
    box.style.display = "block";
    box.className = "card " + (kind === "ok" ? "ok" : "err");
    var t = "<b>" + esc(title || "") + "</b>";
    var d = detail ? ("<div style='margin-top:6px;white-space:pre-wrap;'>" + esc(detail) + "</div>") : "";
    box.innerHTML = t + d;
  }
  function hideMsg(){
    var box = $("msgBox");
    if(!box) return;
    box.style.display = "none";
    box.innerHTML = "";
  }
  function esc(s){
    return ("" + (s == null ? "" : s))
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function getUrlParam(name){
    try{
      var u = new URL(location.href);
      return u.searchParams.get(name);
    }catch(e){
      // 古い環境フォールバック
      try{
        var q = location.search || "";
        q = q.replace(/^\?/,"");
        var parts = q.split("&");
        for(var i=0;i<parts.length;i++){
          var kv = parts[i].split("=");
          if(decodeURIComponent(kv[0]||"") === name){
            return decodeURIComponent(kv[1]||"");
          }
        }
      }catch(ex){}
      return null;
    }
  }

  // =========================================================
  // [APP-02] アプリ状態（02_bidder_state.js があれば同期して使う）
  // =========================================================
  var S = {
    bidNo: "",
    bidStatus: "",
    authState: "LOCKED",    // LOCKED / UNLOCKED
    loginState: "SIGNED-OUT", // SIGNED-IN / SIGNED-OUT
    viewOnly: false,
    inputEnabled: false,
    lastLoadedAt: "",
    lastSavedAt: "",
    bidderId: "",
    bidderEmail: "",
    userUid: "",
    // items / prices
    items: [],
    prices: {} // seq -> priceStr
  };

  function syncToBidderState(){
    try{
      if(!window.BidderState || !window.BidderState.set) return;
      window.BidderState.set(S);
    }catch(e){}
  }

  function readFromBidderState(){
    try{
      if(!window.BidderState || !window.BidderState.get) return;
      var s2 = window.BidderState.get();
      if(s2 && typeof s2 === "object"){
        // 既存stateに寄せる（あるものだけ）
        if(s2.bidNo) S.bidNo = s2.bidNo;
        if(s2.bidStatus) S.bidStatus = s2.bidStatus;
        if(s2.authState) S.authState = s2.authState;
        if(s2.loginState) S.loginState = s2.loginState;
        if(typeof s2.viewOnly === "boolean") S.viewOnly = s2.viewOnly;
        if(typeof s2.inputEnabled === "boolean") S.inputEnabled = s2.inputEnabled;
        if(s2.bidderId) S.bidderId = s2.bidderId;
        if(s2.bidderEmail) S.bidderEmail = s2.bidderEmail;
        if(s2.userUid) S.userUid = s2.userUid;
      }
    }catch(e){}
  }

  // =========================================================
  // [APP-03] Firebase初期化（ここが死ぬと全部止まるのでログ必須）
  // =========================================================
  function firebaseReady(){
    return (typeof window.firebase !== "undefined"
      && window.firebase
      && window.firebase.apps
      && window.firebase.auth
      && window.firebase.firestore);
  }

  function ensureFirebaseInit(){
    // [APP-03-01] SDKが無い → ここで確定的にログを出す
    if(!firebaseReady()){
      L("fatal", "Firebase SDK が読み込まれていません。index.html の firebase-*-compat.js 読み込みを確認してください。");
      throw new Error("Firebase SDK missing");
    }

    // [APP-03-02] configが未設定 → ここで止める（YOUR_...のままだと当然動かない）
    if(!window.BidderConfig || !window.BidderConfig.FIREBASE_CONFIG){
      L("fatal", "BidderConfig.FIREBASE_CONFIG が見つかりません（01_bidder_config.js を確認）");
      throw new Error("Missing BidderConfig");
    }

    var cfg = window.BidderConfig.FIREBASE_CONFIG || {};
    var raw = JSON.stringify(cfg);
    if(raw.indexOf("YOUR_") >= 0){
      L("fatal", "Firebase設定がプレースホルダ（YOUR_...）のままです。01_bidder_config.js の FIREBASE_CONFIG を実値に差し替えてください。");
      throw new Error("Firebase config placeholder");
    }

    // [APP-03-03] 初期化済みならスキップ
    try{
      if(window.firebase.apps && window.firebase.apps.length){
        L("fb", "firebase already initialized (apps=" + window.firebase.apps.length + ")");
        return true;
      }
    }catch(e){}

    // [APP-03-04] 初期化
    try{
      window.firebase.initializeApp(cfg);
      L("fb", "firebase initialized");
      return true;
    }catch(e){
      L("fatal", "firebase.initializeApp FAILED: " + toStr(e));
      throw e;
    }
  }

  // =========================================================
  // [APP-04] Firestore直アクセス（04_bidder_db.js 不要でも読める）
  // =========================================================
  function db(){
    return window.firebase.firestore();
  }

  function bidDocRef(bidNo){
    return db().collection("bids").doc(bidNo);
  }

  function itemsColRef(bidNo){
    return bidDocRef(bidNo).collection("items");
  }

  function offerDocRef(bidNo, bidderId){
    return bidDocRef(bidNo).collection("offers").doc(bidderId);
  }

  function loadBidAndItems(){
    // [APP-04-01] bids/{bidNo} を取得 → status表示
    // [APP-04-02] bids/{bidNo}/items を取得 → テーブル表示
    var bidNo = S.bidNo;
    if(!bidNo){
      throw new Error("bidNo が空です（URL ?bidNo=XXXX か 01_bidder_config.js の既定値を確認）");
    }

    var t0 = nowIso();
    L("load", "start bidNo=" + bidNo);

    return bidDocRef(bidNo).get().then(function(snap){
      if(!snap.exists){
        throw new Error("bids/" + bidNo + " が存在しません");
      }
      var data = snap.data() || {};
      S.bidStatus = data.status || "";
      L("load", "bid status=" + S.bidStatus);

      // closedは閲覧モード
      S.viewOnly = (S.bidStatus === "closed");
      return itemsColRef(bidNo).orderBy("seq").get();
    }).then(function(qs){
      var arr = [];
      qs.forEach(function(doc){
        var d = doc.data() || {};
        // 期待: seq, name, spec, qty, unit, note 等（無ければ空で表示）
        arr.push({
          id: doc.id,
          seq: d.seq,
          name: d.name,
          spec: d.spec,
          qty: d.qty,
          unit: d.unit,
          note: d.note
        });
      });
      S.items = arr;
      S.lastLoadedAt = t0;
      L("load", "items=" + arr.length);
      return true;
    });
  }

  function loadMyOfferIfAny(){
    // [APP-04-03] 自分の offers を読めるのはルール上 open/closed のとき
    if(!S.bidNo || !S.bidderId) return Promise.resolve(false);
    return offerDocRef(S.bidNo, S.bidderId).get().then(function(snap){
      if(!snap.exists){
        L("offer", "no existing offer");
        return false;
      }
      var d = snap.data() || {};
      var lines = d.lines || {};
      S.prices = {};
      try{
        Object.keys(lines).forEach(function(k){
          S.prices[k] = lines[k];
        });
      }catch(e){}
      L("offer", "loaded existing offer lines=" + Object.keys(S.prices).length);
      return true;
    }).catch(function(e){
      // ここは権限で落ちる可能性もあるので“致命”にはしない
      L("offer", "load offer skipped/failed: " + toStr(e));
      return false;
    });
  }

  // =========================================================
  // [APP-05] 入力可否の判定
  // =========================================================
  function recomputeMode(){
    var signedIn = (S.loginState === "SIGNED-IN");
    var unlocked = (S.authState === "UNLOCKED");
    var open = (S.bidStatus === "open");
    S.viewOnly = (S.bidStatus === "closed");
    S.inputEnabled = (!!signedIn && !!unlocked && !!open && !S.viewOnly);
  }

  // =========================================================
  // [APP-06] 画面描画（08が無くても最低限表示）
  // =========================================================
  function renderTop(){
    setText("lblBidNo", S.bidNo || "-");
    setText("lblBidStatus", S.bidStatus || "-");
    setText("lblAuthState", S.authState || "LOCKED");
    setText("lblInputEnabled", S.inputEnabled ? "可" : "不可");
    setText("lblViewOnly", S.viewOnly ? "VIEW" : "EDIT");
    setText("lblLastLoadedAt", S.lastLoadedAt || "-");
    setText("lblLastSavedAt", S.lastSavedAt || "-");
  }

  function renderItems(){
    var tb = $("tbodyItems");
    if(!tb) return;

    var html = "";
    if(!S.items || !S.items.length){
      html = '<tr><td colspan="5" class="m">品目なし</td></tr>';
      tb.innerHTML = html;
      return;
    }

    for(var i=0;i<S.items.length;i++){
      var it = S.items[i] || {};
      var seq = (it.seq == null ? "" : ("" + it.seq));
      var name = it.name || "";
      var spec = it.spec || "";
      var qty  = (it.qty == null ? "" : ("" + it.qty));
      var unit = it.unit || "";
      var note = it.note || "";
      var price = (S.prices && S.prices[seq]) ? ("" + S.prices[seq]) : "";
      var dis = S.inputEnabled ? "" : "disabled";

      html += ""
        + "<tr>"
        +   "<td>" + esc(seq) + "</td>"
        +   '<td class="td2line">' + esc(name) + '<span class="sub">' + esc(spec) + "</span></td>"
        +   "<td>" + esc(qty) + (unit ? (" " + esc(unit)) : "") + "</td>"
        +   '<td><input type="text" inputmode="decimal" data-seq="' + esc(seq) + '" value="' + esc(price) + '" ' + dis + "></td>"
        +   "<td>" + esc(note) + "</td>"
        + "</tr>";
    }
    tb.innerHTML = html;

    // 入力イベント（pricesに反映）
    var inputs = tb.querySelectorAll("input[data-seq]");
    for(var j=0;j<inputs.length;j++){
      inputs[j].addEventListener("input", function(ev){
        var seq2 = ev.target.getAttribute("data-seq");
        var v = ev.target.value;
        S.prices[seq2] = v;
      });
    }
  }

  function renderVerList(){
    var pre = $("preVerList");
    if(!pre) return;
    var arr = window.__APP_VER__ || [];
    var lines = [];
    for(var i=0;i<arr.length;i++){
      var o = arr[i] || {};
      lines.push((o.ts||"") + "  " + (o.file||"") + "  " + (o.ver||""));
    }
    pre.textContent = lines.join("\n");
  }

  function renderAll(){
    readFromBidderState();
    recomputeMode();
    renderTop();
    renderItems();
    renderVerList();
    syncToBidderState();
  }

  // =========================================================
  // [APP-07] ログUI（停止/コピー/クリア）
  // =========================================================
  var logPaused = false;

  function hookLogTextarea(){
    var ta = $("txtLog");
    if(!ta) return;

    // BOOTLOG バッファをまず反映
    if(window.BOOTLOG && window.BOOTLOG.flushTo){
      window.BOOTLOG.flushTo(ta);
    }

    // 03_bidder_log.js があるなら、そこに textarea を接続しているはずだが、
    // 無い/不完全でも、APP側で最低限動くようにする
    try{
      if(!window.BidderLog){
        window.BidderLog = {};
      }
      if(!window.BidderLog.__appFallback){
        window.BidderLog.__appFallback = { buf: [] };
      }
      if(!window.BidderLog.write){
        window.BidderLog.write = function(tag, msg){
          var line = "[" + nowIso() + "] [" + tag + "] " + msg;
          if(logPaused){
            window.BidderLog.__appFallback.buf.push(line);
            return;
          }
          ta.value += line + "\n";
          ta.scrollTop = ta.scrollHeight;
          try{ console.log(line); }catch(e){}
        };
      }
    }catch(e){}

    // textareaタップで自動停止（コピーしやすく）
    ta.addEventListener("pointerdown", function(){
      setLogPaused(true);
    });
    ta.addEventListener("touchstart", function(){
      setLogPaused(true);
    });

    L("ui", "log textarea hooked");
  }

  function setLogPaused(v){
    logPaused = !!v;
    var btn = $("btnLogPause");
    if(btn) btn.textContent = logPaused ? "ログ再開" : "ログ停止";
    try{
      if(window.BOOTLOG && window.BOOTLOG.pause) window.BOOTLOG.pause(logPaused);
    }catch(e){}
    L("log", logPaused ? "paused" : "resumed");

    // paused中に溜めた分を再開時に吐く
    if(!logPaused){
      try{
        var ta = $("txtLog");
        var buf = window.BidderLog && window.BidderLog.__appFallback && window.BidderLog.__appFallback.buf;
        if(ta && buf && buf.length){
          ta.value += buf.join("\n") + "\n";
          window.BidderLog.__appFallback.buf = [];
          ta.scrollTop = ta.scrollHeight;
        }
      }catch(e){}
    }
  }

  function clearLog(){
    var ta = $("txtLog");
    if(ta) ta.value = "";
    // BOOTLOGは保持（初期エラー消すと原因追えない）→必要ならここで消す設計に変更可
    L("log", "cleared");
  }

  function copyLog(){
    var ta = $("txtLog");
    if(!ta) return;

    setLogPaused(true);

    var text = ta.value || "";
    if(!text){
      showMsg("err", "コピー失敗", "ログが空です。先に再読込/ログイン等を実行してください。");
      return;
    }

    function ok(){
      showMsg("ok", "コピー完了", "ログをクリップボードにコピーしました。");
      L("log", "copy OK");
    }
    function ng(e){
      showMsg("err", "コピー失敗", "ブラウザ制限で自動コピーできません。\nログ欄を長押しして選択→コピーしてください。\n\n" + toStr(e));
      L("log", "copy FAILED: " + toStr(e));
    }

    // iOS Safari: clipboard API が使えない場合があるので execCommand フォールバック
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(ok).catch(function(e){
        try{
          ta.focus();
          ta.select();
          var r = document.execCommand("copy");
          if(r) ok(); else ng(e);
        }catch(ex){ ng(ex); }
      });
    }else{
      try{
        ta.focus();
        ta.select();
        var r2 = document.execCommand("copy");
        if(r2) ok(); else ng(new Error("execCommand copy failed"));
      }catch(ex2){ ng(ex2); }
    }
  }

  // =========================================================
  // [APP-08] プロフィール取得（画面→map）
  // =========================================================
  function getProfileFromInputs(){
    var p = {
      bidderId: S.bidderId || "",
      email: ($("txtEmail") && $("txtEmail").value) ? $("txtEmail").value.trim() : "",
      address: ($("txtAddress") && $("txtAddress").value) ? $("txtAddress").value.trim() : "",
      companyName: ($("txtCompanyName") && $("txtCompanyName").value) ? $("txtCompanyName").value.trim() : "",
      representativeName: ($("txtRepresentativeName") && $("txtRepresentativeName").value) ? $("txtRepresentativeName").value.trim() : "",
      contactName: ($("txtContactName") && $("txtContactName").value) ? $("txtContactName").value.trim() : "",
      contactInfo: ($("txtContactInfo") && $("txtContactInfo").value) ? $("txtContactInfo").value.trim() : ""
    };
    return p;
  }

  function validateProfile(p){
    // ルール validOffer() の必須キーに合わせる（空文字自体はルールで禁止していないが、運用で必須）
    var miss = [];
    if(!p.email) miss.push("メールアドレス");
    if(!p.address) miss.push("住所");
    if(!p.companyName) miss.push("会社名");
    if(!p.representativeName) miss.push("代表者名");
    if(!p.contactName) miss.push("担当者名");
    if(!p.contactInfo) miss.push("担当者連絡先");
    if(miss.length) return "未入力: " + miss.join(" / ");
    return "";
  }

  // =========================================================
  // [APP-09] offers 保存（ルール validOffer に合わせる）
  // =========================================================
  function buildOfferDoc(){
    var p = getProfileFromInputs();
    var v = validateProfile(p);
    if(v){
      throw new Error(v);
    }
    if(!S.bidNo) throw new Error("bidNo が空です");
    if(!S.bidderId) throw new Error("bidderId が空です（先にログインしてください）");

    // lines: seq -> unitPriceStr
    var lines = {};
    var seqs = Object.keys(S.prices || {});
    for(var i=0;i<seqs.length;i++){
      var k = seqs[i];
      var val = (S.prices[k] == null) ? "" : ("" + S.prices[k]).trim();
      // 空は送らない運用にする（必要なら空も送る）
      if(val !== "") lines[k] = val;
    }

    var iso = nowIso();
    var doc = {
      bidNo: S.bidNo,
      bidderId: S.bidderId,
      profile: {
        bidderId: S.bidderId,
        email: p.email,
        address: p.address,
        companyName: p.companyName,
        representativeName: p.representativeName,
        contactName: p.contactName,
        contactInfo: p.contactInfo
      },
      lines: lines,
      createdAt: iso,
      updatedAt: iso,
      updatedByUid: S.userUid || ""
    };
    return doc;
  }

  function saveOffer(){
    hideMsg();

    if(!S.inputEnabled){
      throw new Error("入力不可です（open + ログイン + 認証UNLOCKED の状態でのみ保存できます）");
    }

    var ref = offerDocRef(S.bidNo, S.bidderId);
    return ref.get().then(function(snap){
      var doc = buildOfferDoc();
      if(snap.exists){
        // 既存 createdAt は保持
        try{
          var old = snap.data() || {};
          if(old.createdAt) doc.createdAt = old.createdAt;
        }catch(e){}
      }
      return ref.set(doc, { merge: true }).then(function(){
        S.lastSavedAt = nowIso();
        L("saveOffer", "OK lines=" + Object.keys(doc.lines||{}).length);
        showMsg("ok", "入札保存 成功", "Firestoreに保存しました。");
        renderAll();
        return true;
      });
    });
  }

  // =========================================================
  // [APP-10] 認証/ログイン連携
  // =========================================================
  function doLogin(){
    hideMsg();
    var bidderId = ($("txtBidderId") && $("txtBidderId").value) ? $("txtBidderId").value.trim() : "";
    var pass = ($("txtBidderPass") && $("txtBidderPass").value) ? $("txtBidderPass").value : "";

    if(!bidderId) throw new Error("入札者IDが空です");
    if(!pass) throw new Error("パスワードが空です");

    if(!window.BidderAuth || !window.BidderAuth.signIn){
      throw new Error("BidderAuth.signIn が見つかりません（05_bidder_auth.js を確認）");
    }

    L("ui", "login clicked bidderId=" + bidderId);

    return window.BidderAuth.signIn(bidderId, pass).then(function(u){
      // user反映（05側でstateを更新している前提だが、念のためここでも）
      S.bidderId = bidderId;
      try{
        // 05_bidder_auth.js の bidderIdToEmail と整合させる
        var dom = (window.BidderConfig && window.BidderConfig.BIDDER_EMAIL_DOMAIN) ? window.BidderConfig.BIDDER_EMAIL_DOMAIN : "@bid.local";
        S.bidderEmail = bidderId + dom;
      }catch(e){}
      S.loginState = "SIGNED-IN";
      S.userUid = (u && u.uid) ? u.uid : "";
      L("auth", "SIGNED-IN uid=" + S.userUid);
      showMsg("ok", "ログイン 成功", "ログインしました。");

      renderAll();

      // ログイン後にoffers読み込み（可能なら）
      return loadMyOfferIfAny().then(function(){
        renderAll();
        return true;
      });
    }).catch(function(e){
      var msg = toStr(e);
      showMsg("err", "ログイン 失敗", msg);
      L("auth", "login FAILED " + msg);
      throw e;
    });
  }

  function doLogout(){
    hideMsg();
    if(!window.BidderAuth || !window.BidderAuth.signOut){
      throw new Error("BidderAuth.signOut が見つかりません（05_bidder_auth.js を確認）");
    }
    L("ui", "logout clicked");

    return window.BidderAuth.signOut().then(function(){
      S.loginState = "SIGNED-OUT";
      S.userUid = "";
      S.bidderId = "";
      S.bidderEmail = "";
      S.authState = "LOCKED";
      showMsg("ok", "ログアウト", "ログアウトしました。");
      renderAll();
      return true;
    }).catch(function(e){
      var msg = toStr(e);
      showMsg("err", "ログアウト 失敗", msg);
      throw e;
    });
  }

  function doBidAuth(){
    hideMsg();
    var code = ($("txtAuthCode") && $("txtAuthCode").value) ? $("txtAuthCode").value.trim() : "";
    if(!code) throw new Error("認証コードを入力してください。");

    if(!window.BidderAuth || !window.BidderAuth.bidAuth){
      throw new Error("BidderAuth.bidAuth が見つかりません（05_bidder_auth.js を確認）");
    }

    return Promise.resolve().then(function(){
      window.BidderAuth.bidAuth(code);
      S.authState = "UNLOCKED";
      showMsg("ok", "入札認証 成功", "認証状態を UNLOCKED にしました。");
      renderAll();
      return true;
    }).catch(function(e){
      var msg = toStr(e);
      showMsg("err", "入札認証 失敗", msg);
      throw e;
    });
  }

  // =========================================================
  // [APP-11] 再読込
  // =========================================================
  function doReloadAll(){
    hideMsg();
    L("ui", "reload clicked");

    return Promise.resolve().then(function(){
      ensureFirebaseInit();
      return loadBidAndItems();
    }).then(function(){
      // open/closed でoffers読み込み可否が変わる
      return loadMyOfferIfAny();
    }).then(function(){
      recomputeMode();
      renderAll();
      showMsg("ok", "再読込 完了", "入札データを読み込みました。");
      return true;
    }).catch(function(e){
      var msg = toStr(e);
      showMsg("err", "再読込 失敗", msg);
      L("load", "FAILED " + msg);
      renderAll();
      throw e;
    });
  }

  // =========================================================
  // [APP-12] 画面イベント結線
  // =========================================================
  function bindEvents(){
    function on(id, ev, fn){
      var el = $(id);
      if(!el) return;
      el.addEventListener(ev, function(){
        try{
          Promise.resolve().then(fn).catch(function(e){
            // 例外は既に showMsg 済みの場合があるが、必ずログに残す
            L("err", id + " " + toStr(e));
          });
        }catch(ex){
          L("err", id + " " + toStr(ex));
          showMsg("err", "処理失敗", toStr(ex));
        }
      });
    }

    on("btnLogClear", "click", function(){ clearLog(); });
    on("btnLogPause", "click", function(){ setLogPaused(!logPaused); });
    on("btnLogCopy",  "click", function(){ copyLog(); });

    on("btnLoad", "click", function(){ return doReloadAll(); });
    on("btnLogin", "click", function(){ return doLogin(); });
    on("btnLogout", "click", function(){ return doLogout(); });
    on("btnAuth", "click", function(){ return doBidAuth(); });

    on("btnSaveOffer", "click", function(){
      return Promise.resolve().then(function(){
        ensureFirebaseInit();
        return saveOffer();
      }).catch(function(e){
        var msg = toStr(e);
        showMsg("err", "入札保存 失敗", msg);
        throw e;
      });
    });

    // ここは既存JSに任せつつ、無ければログだけ出す
    on("btnProfileLoad", "click", function(){
      if(window.BidderProfile && window.BidderProfile.loadFromCookie){
        window.BidderProfile.loadFromCookie();
        showMsg("ok", "入力済データ", "Cookieから読み込みました。");
        L("profile", "loadFromCookie OK");
      }else{
        showMsg("err", "未実装", "BidderProfile.loadFromCookie が見つかりません（06_bidder_profile.js を確認）");
      }
    });

    on("btnSaveProfile", "click", function(){
      if(window.BidderProfile && window.BidderProfile.saveToCookie){
        window.BidderProfile.saveToCookie();
        showMsg("ok", "プロフィール保存", "Cookieに保存しました。");
        L("profile", "saveToCookie OK");
      }else{
        showMsg("err", "未実装", "BidderProfile.saveToCookie が見つかりません（06_bidder_profile.js を確認）");
      }
    });

    on("btnCookieClear", "click", function(){
      if(window.BidderProfile && window.BidderProfile.clearCookie){
        window.BidderProfile.clearCookie();
        showMsg("ok", "Cookie削除", "Cookieを削除しました。");
        L("cookie", "cleared");
      }else{
        showMsg("err", "未実装", "BidderProfile.clearCookie が見つかりません（06_bidder_profile.js を確認）");
      }
    });

    on("btnPrint", "click", function(){
      if(window.BidderPrint && window.BidderPrint.doPrint){
        window.BidderPrint.doPrint();
        L("print", "OK");
      }else{
        showMsg("err", "未実装", "BidderPrint.doPrint が見つかりません（09_bidder_print.js を確認）");
      }
    });

    on("btnPdf", "click", function(){
      if(window.BidderPrint && window.BidderPrint.doPdf){
        window.BidderPrint.doPdf();
        L("pdf", "OK");
      }else{
        showMsg("err", "未実装", "BidderPrint.doPdf が見つかりません（09_bidder_print.js を確認）");
      }
    });
  }

  // =========================================================
  // [APP-13] 起動（bidNo確定 → Firebase初期化 → 認証監視 → 初回読込）
  // =========================================================
  function bootstrap(){
    // [APP-13-01] DOM接続（ログ最優先）
    hookLogTextarea();

    // [APP-13-02] bidNo 決定（URL優先→config既定）
    var b = getUrlParam("bidNo");
    if(!b && window.BidderConfig && window.BidderConfig.BID_NO_DEFAULT){
      b = window.BidderConfig.BID_NO_DEFAULT;
    }
    S.bidNo = b || "";
    L("boot", "bidNo=" + (S.bidNo || "(empty)"));

    // [APP-13-03] Firebase初期化（失敗理由を必ずログ化）
    try{
      ensureFirebaseInit();
    }catch(e){
      showMsg("err", "起動失敗", toStr(e));
      renderAll();
      return;
    }

    // [APP-13-04] auth監視（05があれば）
    try{
      if(window.BidderAuth && window.BidderAuth.watchAuthState){
        window.BidderAuth.watchAuthState();
        L("boot", "watchAuthState set");
      }else{
        L("boot", "BidderAuth.watchAuthState not found (05 missing?)");
      }
    }catch(e){
      L("boot", "watchAuthState FAILED: " + toStr(e));
    }

    // [APP-13-05] Firebaseの auth state を直接反映（05が不十分でも最低限合わせる）
    try{
      window.firebase.auth().onAuthStateChanged(function(user){
        if(user){
          S.loginState = "SIGNED-IN";
          S.userUid = user.uid || "";
          L("auth", "onAuthStateChanged SIGNED-IN uid=" + S.userUid);
        }else{
          S.loginState = "SIGNED-OUT";
          S.userUid = "";
          S.authState = "LOCKED";
          L("auth", "onAuthStateChanged SIGNED-OUT");
        }
        renderAll();
      });
    }catch(e){
      L("auth", "onAuthStateChanged hook FAILED: " + toStr(e));
    }

    // [APP-13-06] ボタン結線
    bindEvents();

    // [APP-13-07] 初回読込（失敗しても必ずメッセージとログを残す）
    doReloadAll().catch(function(){ /* 失敗表示済み */ });
  }

  // DOM ready
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bootstrap);
  }else{
    bootstrap();
  }

// ★ 1/25 これを追加★ ------------------------------------------------------------
// [MSG-MIRROR-01] 下部msgBoxの内容を上部msgBoxTopへミラー（既存処理は触らない）
(function(){
  function mirrorMsgBox(){
    try{
      var src = document.getElementById("msgBox");     // 既存（下部）
      var dst = document.getElementById("msgBoxTop");  // 追加（上部）
      if(!src || !dst) return;

      function sync(){
        // class / style / 中身を丸ごと同期（ok/errなどの見た目も一致）
        dst.className = src.className;
        dst.style.cssText = src.style.cssText;
        dst.innerHTML = src.innerHTML;
      }

      // 初回同期
      sync();

      // 変更監視（テキスト更新・表示/非表示・クラス変更など）
      var mo = new MutationObserver(function(){
        sync();
      });
      mo.observe(src, { attributes:true, childList:true, subtree:true });

    }catch(e){
      // ここは壊れないように握りつぶし（ログがあるなら出す）
      try{
        if(window.BidderLog && window.BidderLog.write){
          window.BidderLog.write("warn", "[MSG-MIRROR-01] failed: " + (e && e.message ? e.message : String(e)));
        }else{
          console.log("[MSG-MIRROR-01] failed:", e);
        }
      }catch(ex){}
    }
  }

  // 10_bidder_app.js は body末尾で読み込まれているので DOM は基本できている想定。
  // 念のため両対応（即時 / DOMContentLoaded）
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", mirrorMsgBox);
  }else{
    mirrorMsgBox();
  }
})();
 // 1/25 ★ここまで追加★ ----------------------------------------------------------

})();
