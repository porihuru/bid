// [JST 2026-01-24 21:00] bidder/js/08_bidder_render.js v20260124-01
// [BID-08] 描画・表示制御（ログイン→認証→入力可否）
// 要件:
//  - 常に「今どういう状態か」を msgInfo と submitStatus と ログに出す
//  - closed は完全閲覧
(function (global) {
  var BID = global.BID = global.BID || {};
  if (BID.Build && BID.Build.register) BID.Build.register("08_bidder_render.js", "v20260124-01");

  function el(id) { return document.getElementById(id); }

  function show(id, yes) {
    var e = el(id);
    if (!e) return;
    e.style.display = yes ? "" : "none";
  }

  function setText(id, s) {
    var e = el(id);
    if (e) e.textContent = (s == null) ? "" : String(s);
  }

  BID.Render = {
    // [08-01] メッセージ
    clearMessages: function () {
      show("msgError", false); setText("msgError", "");
      show("msgOk", false); setText("msgOk", "");
      setText("msgInfo", BID.CONFIG.MSG_AUTH_PROMPT);
    },

    setError: function (msg) {
      show("msgError", true);
      setText("msgError", msg || "");
      show("msgOk", false);
      setText("msgOk", "");
    },

    setOk: function (msg) {
      show("msgOk", true);
      setText("msgOk", msg || "");
      show("msgError", false);
      setText("msgError", "");
    },

    setInfo: function (msg) {
      setText("msgInfo", msg || "");
    },

    setAuthResult: function (msg) {
      setText("authResult", msg || "");
    },

    setLoginResult: function (msg) {
      setText("loginResult", msg || "");
    },

    setProfileStatus: function (missArr) {
      missArr = missArr || [];
      if (!missArr.length) setText("profileStatus", "必須入力：OK");
      else setText("profileStatus", "必須未入力： " + missArr.join(" / "));
    },

    // [08-02] ステータスバー
    renderStatusBar: function () {
      var st = BID.State.get();
      setText("sbBidNo", st.bidNo || "(未設定)");
      setText("sbBidStatus", st.bidStatus ? (BID.CONFIG.STATUS_LABELS[st.bidStatus] || st.bidStatus) : "(未読込)");
      setText("sbLoginState", st.loginState || "SIGNED-OUT");
      setText("sbBidderId", st.bidderNo || "-");
      setText("sbAuthState", st.authState || "LOCKED");
      setText("sbInputState", st.inputEnabled ? "可" : "不可");
      setText("sbMode", st.viewOnly ? "VIEW-ONLY" : "EDIT");
      setText("sbLastLoaded", st.lastLoadedAt || "-");
      setText("sbLastSaved", st.lastSavedAt || "-");
    },

    // [08-03] 入札概要
    renderBidInfo: function () {
      var st = BID.State.get();
      var b = st.bid || {};
      var notes = BID.DB.getPublicNotesFromBid(b);

      setText("txtTo1", b.to1 || "");
      setText("txtTo2", b.to2 || "");
      setText("txtTo3", b.to3 || "");
      setText("txtDeliveryPlace", b.deliveryPlace || "");
      setText("txtDueDate", b.dueDate || "");
      setText("txtBidDate", b.bidDate || "");

      setText("txtNote1", notes.note1 || "");
      setText("txtNote2", notes.note2 || "");
      setText("txtNote3", notes.note3 || "");
      setText("txtNote4", notes.note4 || "");
    },

    // [08-04] 品目
    renderItems: function () {
      var st = BID.State.get();
      var tbody = el("itemsTbody");
      if (!tbody) return;

      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

      var items = st.items || [];
      if (!items.length) {
        show("itemsEmpty", true);
        return;
      }
      show("itemsEmpty", false);

      for (var i = 0; i < items.length; i++) {
        var it = items[i];

        var tr = document.createElement("tr");
        tr.id = "itemRow_" + it.seq;

        var tdSeq = document.createElement("td");
        tdSeq.textContent = String(it.seq);
        tr.appendChild(tdSeq);

        var tdS = document.createElement("td");
        tdS.textContent = it.sample ? "〇" : "";
        tr.appendChild(tdS);

        var tdNS = document.createElement("td");
        var dn = document.createElement("div");
        dn.className = "itemName";
        dn.textContent = it.name || "";
        var ds = document.createElement("div");
        ds.className = "itemSpec";
        ds.textContent = it.spec || "";
        tdNS.appendChild(dn);
        tdNS.appendChild(ds);
        tr.appendChild(tdNS);

        var tdQ = document.createElement("td");
        tdQ.textContent = (it.qty == null) ? "" : String(it.qty);
        tr.appendChild(tdQ);

        var tdU = document.createElement("td");
        tdU.textContent = it.unit || "";
        tr.appendChild(tdU);

        var tdN = document.createElement("td");
        tdN.textContent = it.note || "";
        tr.appendChild(tdN);

        var tdP = document.createElement("td");
        var inp = document.createElement("input");
        inp.id = "unitPrice_" + it.seq;
        inp.type = "text";
        inp.inputMode = "numeric";
        inp.className = "priceInput";
        inp.placeholder = "単価";
        inp.autocomplete = "off";
        tdP.appendChild(inp);
        tr.appendChild(tdP);

        tbody.appendChild(tr);
      }

      // 既存反映
      if (BID.Offer && BID.Offer.applyLinesToTable) {
        BID.Offer.applyLinesToTable(st.offerLines);
      }
    },

    // [08-05] 画面制御（常に理由を出す）
    applyMode: function () {
      var st = BID.State.get();
      var status = st.bidStatus || "";

      // closedは完全閲覧
      var viewOnly = (status === "closed");
      BID.State.setViewOnly(viewOnly);

      // 入力可能条件:
      // open AND SIGNED-IN AND UNLOCKED AND profile COMPLETE AND not viewOnly
      var canInput = false;
      if (!viewOnly &&
          status === "open" &&
          st.loginState === "SIGNED-IN" &&
          st.authState === "UNLOCKED" &&
          st.profileState === "COMPLETE") {
        canInput = true;
      }
      BID.State.setInputEnabled(canInput);

      // ログインUI
      var loginEditable = (st.loginState !== "SIGNED-IN");
      if (el("loginBidderId")) el("loginBidderId").disabled = !loginEditable;
      if (el("loginPassword")) el("loginPassword").disabled = !loginEditable;
      if (el("btnLogin")) el("btnLogin").disabled = !loginEditable;
      if (el("btnLogout")) el("btnLogout").disabled = (st.loginState !== "SIGNED-IN");

      // 認証UI（openのときだけ有効、かつログイン必須）
      show("authSection", true);
      var authEnable = (status === "open" && st.loginState === "SIGNED-IN");
      if (el("authCode")) el("authCode").disabled = !authEnable;
      if (el("btnAuth")) el("btnAuth").disabled = !authEnable;

      // 入札者情報UI（open + ログイン + 認証後のみ入力可）
      var profileInputs = ["inpEmail","inpAddress","inpCompanyName","inpRepresentativeName","inpContactName","inpContactInfo"];
      var profileEditable = (!viewOnly && status === "open" && st.loginState === "SIGNED-IN" && st.authState === "UNLOCKED");
      for (var i = 0; i < profileInputs.length; i++) {
        var ei = el(profileInputs[i]);
        if (ei) ei.disabled = !profileEditable;
      }

      // 単価入力欄
      var items = st.items || [];
      for (var j = 0; j < items.length; j++) {
        var seq = String(items[j].seq);
        var ip = el("unitPrice_" + seq);
        if (ip) ip.disabled = !canInput;
      }

      // 保存ボタン
      if (el("btnSubmit")) el("btnSubmit").disabled = !canInput;

      // 「入力済データの読み込み」はログイン後のみ
      if (el("btnLoadOffer")) el("btnLoadOffer").disabled = (st.loginState !== "SIGNED-IN");

      // 理由（常時）
      var reason = "";
      if (!st.bidNo) reason = "入札番号が未設定です。";
      else if (st.loginState !== "SIGNED-IN") reason = "先にログインしてください。";
      else if (!status) reason = "入札データを読み込み中です。";
      else if (status === "draft") reason = "この入札は準備中（draft）です。入札開始までお待ちください。";
      else if (status === "closed") reason = "入札は終了しました（closed）。完全閲覧モードです。";
      else if (status === "open" && st.authState !== "UNLOCKED") reason = BID.CONFIG.MSG_AUTH_PROMPT;
      else if (status === "open" && st.authState === "UNLOCKED" && st.profileState !== "COMPLETE") reason = "入札者情報（必須）を入力してください。";
      else if (canInput) reason = "入札可能です。単価を入力して保存してください。（open中は上書き可）";
      else reason = "状態を確認中です。";

      BID.Render.setInfo(reason);

      // 追加：submitStatusにも必ず出す
      var ss = el("submitStatus");
      if (ss) {
        ss.textContent =
          "判定: status=" + (status || "(none)") +
          " / login=" + (st.loginState || "(none)") +
          " / bidderId=" + (st.bidderNo || "(none)") +
          " / auth=" + (st.authState || "(none)") +
          " / profile=" + (st.profileState || "(none)") +
          " / inputEnabled=" + (st.inputEnabled ? "true" : "false") +
          " / viewOnly=" + (st.viewOnly ? "true" : "false") +
          " / reason=" + reason;
      }

      // ログ（うるさければ後で抑制可能）
      try {
        if (BID.Log && BID.Log.write) {
          BID.Log.write("[mode] status=" + (status || "(none)") +
            " login=" + (st.loginState || "(none)") +
            " bidderId=" + (st.bidderNo || "(none)") +
            " auth=" + (st.authState || "(none)") +
            " profile=" + (st.profileState || "(none)") +
            " input=" + (st.inputEnabled ? "true" : "false") +
            " viewOnly=" + (st.viewOnly ? "true" : "false"));
        }
      } catch (e) {}

      BID.Render.renderStatusBar();
    },

    // [08-99] 全体描画
    renderAll: function () {
      BID.Render.renderStatusBar();
      BID.Render.renderBidInfo();
      BID.Render.renderItems();
      BID.Render.applyMode();
    }
  };

})(window);
