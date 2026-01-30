/* [JST 2026-01-30 22:35]  10_bidder_app.js v20260130-01
   変更点（最小修正方針）:
   - bids/{bidNo} のデータを S.bidHeader に保持し、BidderState にも渡す（PDF/09が拾えるように）
   - 読み込んだヘッダー（to1/to2/to3/bidDate/deliveryPlace/dueDate/note 等）をログに必ず出す
   - ログ停止/再開（pointerdown等で止まる）を完全無効化（ログは常時継続）
   - txtLog があれば 03_bidder_log.js の bindTextArea を呼んで接続（BOOTLOGも残る）
*/
(function(){
  "use strict";

  var FILE = "10_bidder_app.js";
  var VER  = "v20260130-01";
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

  // JSONをログに出す（03側に writeJson があれば使う）
  function LJ(tag, obj){
    try{
      if(window.BidderLog && (window.BidderLog.writeJson || window.BidderLog.writeObj)){
        var fn = window.BidderLog.writeJson || window.BidderLog.writeObj;
        return fn(tag, obj);
      }
    }catch(e){}
    // fallback（長すぎ防止）
    try{
      var s = JSON.stringify(obj, null, 2);
      if(s && s.length > 8000) s = s.slice(0, 8000) + "\n... (truncated)";
      L(tag, s);
    }catch(ex){
      L(tag, "[json error] " + toStr(ex));
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
    bidHeader: null,         // ★追加：bids/{bidNo} 全体（to1/to2/...などを保持）
    authState: "LOCKED",     // LOCKED / UNLOCKED
    loginState: "SIGNED-OUT",// SIGNED-IN / SIGNED-OUT
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
      if(window.BidderState){
        // 02側APIがあれば使う
        if(typeof window.BidderState.set === "function"){
          window.BidderState.set(S);
        }
        if(typeof window.BidderState.setBidHeader === "function"){
          window.BidderState.setBidHeader(S.bidHeader || null);
        }else{
          // 02側が state.bidHeader を見ている可能性に備えて入れておく（壊さない）
          if(window.BidderState.state && typeof window.BidderState.state === "object"){
            window.BidderState.state.bidHeader = (S.bidHeader || null);
          }
        }
      }
    }catch(e){}
  }

  function readFromBidderState(){
    try{
      if(!window.BidderState || !window.BidderState.get) return;
      var s2 = window.BidderState.get();
      if(s2 && typeof s2 === "object"){
        if(s2.bidNo) S.bidNo = s2.bidNo;
        if(s2.bidStatus) S.bidStatus = s2.bidStatus;
        if(s2.authState) S.authState = s2.authState;
        if(s2.loginState) S.loginState = s2.loginState;
        if(typeof s2.viewOnly === "boolean") S.viewOnly = s2.viewOnly;
        if(typeof s2.inputEnabled === "boolean") S.inputEnabled = s2.inputEnabled;
        if(s2.bidderId) S.bidderId = s2.bidderId;
        if(s2.bidderEmail) S.bidderEmail = s2.bidderEmail;
        if(s2.userUid) S.userUid = s2.userUid;

        // bidHeader も拾えるなら拾う
        if(s2.bidHeader) S.bidHeader = s2.bidHeader;
      }
    }catch(e){}
  }

  function setBidHeader(hdr){
    S.bidHeader = hdr || null;
    // PDF側が拾うため、BidderStateにも即反映
    syncToBidderState();

    // ログに必ず出す（必要な項目が取れているか確認）
    try{
      if(!hdr){
        L("hdr", "bidHeader=null");
        return;
      }
      // まず要点
      var to1 = hdr.to1 || "";
      var to2 = hdr.to2 || "";
      var to3 = hdr.to3 || "";
      L("hdr", "to1=" + to1 + " / to2=" + to2 + " / to3=" + to3);
      L("hdr", "bidDate=" + (hdr.bidDate||"") + " / deliveryPlace=" + (hdr.deliveryPlace||"") + " / dueDate=" + (hdr.dueDate||""));
      L("hdr", "note=" + (hdr.note||""));
      // 全体も出す（長い場合は03側でtruncateされる）
      LJ("hdrFull", hdr);
    }catch(e){
      L("hdr", "log header failed: " + toStr(e));
    }
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
    if(!firebaseReady()){
      L("fatal", "Firebase SDK が読み込まれていません。index.html の firebase-*-compat.js 読み込みを確認してください。");
      throw new Error("Firebase SDK missing");
    }

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

    try{
      if(window.firebase.apps && window.firebase.apps.length){
        L("fb", "firebase already initialized (apps=" + window.firebase.apps.length + ")");
        return true;
      }
    }catch(e){}

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
  function db(){ return window.firebase.firestore(); }

  function bidDocRef(bidNo){ return db().collection("bids").doc(bidNo); }
  function itemsColRef(bidNo){ return bidDocRef(bidNo).collection("items"); }
  function offerDocRef(bidNo, bidderId){ return bidDocRef(bidNo).collection("offers").doc(bidderId); }

  function loadBidAndItems(){
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

      // ★重要：bidHeaderとして保持（PDFが拾う）
      setBidHeader(data);

      S.bidStatus = data.status || "";
      L("load", "bid status=" + S.bidStatus);

      // closedは閲覧モード
      S.viewOnly = (S.bidStatus === "closed");
      return itemsColRef(bidNo).orderBy("seq").get();
    }).then(function(qs){
      var arr = [];
      qs.forEach(function(doc){
        var d = doc.data() || {};
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

      // itemsの先頭数件もログ（確認用）
      try{
        var peek = [];
        for(var i=0;i<Math.min(5, arr.length); i++){
          peek.push(arr[i]);
        }
        LJ("itemsPeek", peek);
      }catch(e){}

      return true;
    });
  }

  function loadMyOfferIfAny(){
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
  // [APP-07] ログUI（クリア/コピー）
  //   ※停止/再開はしない（ログは常時）
  // =========================================================
  function hookLogTextarea(){
    var ta = $("txtLog");
    if(!ta) return;

    // BOOTLOG バッファを先に反映（初期エラーが見える）
    try{
      if(window.BOOTLOG && window.BOOTLOG.flushTo){
        window.BOOTLOG.flushTo(ta);
      }
    }catch(e){}

    // 03_bidder_log.js があれば textarea に接続（ここが重要）
    try{
      if(window.BidderLog && window.BidderLog.bindTextArea){
        window.BidderLog.bindTextArea(ta);
        L("ui", "BidderLog.bindTextArea OK");
      }
    }catch(e){
      L("ui", "BidderLog.bindTextArea FAILED: " + toStr(e));
    }

    // 03が無い/壊れている場合の最低限フォールバック
    try{
      if(!window.BidderLog){ window.BidderLog = {}; }
      if(!window.BidderLog.__appFallback){ window.BidderLog.__appFallback = {}; }
      if(!window.BidderLog.write){
        window.BidderLog.write = function(tag, msg){
          var line = "[" + nowIso() + "] [" + tag + "] " + msg;
          try{
            ta.value += line + "\n";
            ta.scrollTop = ta.scrollHeight;
          }catch(e){}
          try{ console.log(line); }catch(ex){}
        };
      }
    }catch(e){}

    L("ui", "log textarea hooked (always-on)");
  }

  function clearLog(){
    // 03があればそっちを優先
    try{
      if(window.BidderLog && window.BidderLog.clear){
        window.BidderLog.clear();
      }else{
        var ta = $("txtLog");
        if(ta) ta.value = "";
      }
      L("log", "cleared");
    }catch(e){
      L("log", "clear failed: " + toStr(e));
    }
  }

  function copyLog(){
    // 03があれば copyAll を優先（Edge/iOSも含めて対策済）
    try{
      if(window.BidderLog && window.BidderLog.copyAll){
        return window.BidderLog.copyAll().then(function(ok){
          if(ok){
            showMsg("ok", "コピー完了", "ログをクリップボードにコピーしました。");
          }else{
            showMsg("err", "コピー失敗", "ブラウザ制限で自動コピーできません。\nログ欄を長押しして選択→コピーしてください。");
          }
          return ok;
        });
      }
    }catch(e){}

    // fallback
    try{
      var ta = $("txtLog");
      var text = ta ? (ta.value || "") : "";
      if(!text){
        showMsg("err", "コピー失敗", "ログが空です。");
        return Promise.resolve(false);
      }
      if(navigator.clipboard && navigator.clipboard.writeText){
        return navigator.clipboard.writeText(text).then(function(){
          showMsg("ok", "コピー完了", "ログをクリップボードにコピーしました。");
          return true;
        }).catch(function(){
          showMsg("err", "コピー失敗", "ログ欄を長押しして選択→コピーしてください。");
          return false;
        });
      }
      showMsg("err", "コピー失敗", "ログ欄を長押しして選択→コピーしてください。");
      return Promise.resolve(false);
    }catch(ex){
      showMsg("err", "コピー失敗", toStr(ex));
      return Promise.resolve(false);
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
    if(v){ throw new Error(v); }
    if(!S.bidNo) throw new Error("bidNo が空です");
    if(!S.bidderId) throw new Error("bidderId が空です（先にログインしてください）");

    var lines = {};
    var seqs = Object.keys(S.prices || {});
    for(var i=0;i<seqs.length;i++){
      var k = seqs[i];
      var val = (S.prices[k] == null) ? "" : ("" + S.prices[k]).trim();
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
      S.bidderId = bidderId;
      try{
        var dom = (window.BidderConfig && window.BidderConfig.BIDDER_EMAIL_DOMAIN) ? window.BidderConfig.BIDDER_EMAIL_DOMAIN : "@bid.local";
        S.bidderEmail = bidderId + dom;
      }catch(e){}
      S.loginState = "SIGNED-IN";
      S.userUid = (u && u.uid) ? u.uid : "";
      L("auth", "SIGNED-IN uid=" + S.userUid);
      showMsg("ok", "ログイン 成功", "ログインしました。");

      renderAll();

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
  // [APP-11] 再読込（起動時に自動実行）
  // =========================================================
  function doReloadAll(){
    hideMsg();
    L("ui", "reload start");

    return Promise.resolve().then(function(){
      ensureFirebaseInit();
      return loadBidAndItems();
    }).then(function(){
      return loadMyOfferIfAny();
    }).then(function(){
      recomputeMode();
      renderAll();
      showMsg("ok", "再読込 完了", "入札データを読み込みました。");
      L("ui", "reload done");
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
            L("err", id + " " + toStr(e));
          });
        }catch(ex){
          L("err", id + " " + toStr(ex));
          showMsg("err", "処理失敗", toStr(ex));
        }
      });
    }

    on("btnLogClear", "click", function(){ clearLog(); });
    on("btnLogCopy",  "click", function(){ return copyLog(); });

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
  // [APP-13] 起動（bidNo確定 → Firebase初期化 → 初回読込）
  // =========================================================
  function bootstrap(){
    hookLogTextarea();

    var b = getUrlParam("bidNo");
    if(!b && window.BidderConfig && window.BidderConfig.BID_NO_DEFAULT){
      b = window.BidderConfig.BID_NO_DEFAULT;
    }
    S.bidNo = b || "";
    L("boot", "bidNo=" + (S.bidNo || "(empty)"));

    try{
      ensureFirebaseInit();
    }catch(e){
      showMsg("err", "起動失敗", toStr(e));
      renderAll();
      return;
    }

    // auth監視（05があれば）
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

    // auth state を直接反映（05が不十分でも最低限合わせる）
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

    bindEvents();

    // 初回読込（HTMLを開いたら自動で走る）
    doReloadAll().catch(function(){});
  }

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
          dst.className = src.className;
          dst.style.cssText = src.style.cssText;
          dst.innerHTML = src.innerHTML;
        }

        sync();

        var mo = new MutationObserver(function(){ sync(); });
        mo.observe(src, { attributes:true, childList:true, subtree:true });

      }catch(e){
        try{
          if(window.BidderLog && window.BidderLog.write){
            window.BidderLog.write("warn", "[MSG-MIRROR-01] failed: " + (e && e.message ? e.message : String(e)));
          }else{
            console.log("[MSG-MIRROR-01] failed:", e);
          }
        }catch(ex){}
      }
    }

    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", mirrorMsgBox);
    }else{
      mirrorMsgBox();
    }
  })();
  // 1/25 ★ここまで追加★ ----------------------------------------------------------

})();