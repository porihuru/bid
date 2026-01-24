// [JST 2026-01-23 22:30] js/08_bidder_render.js v20260123-01
// [BID-08] 描画・表示制御（ログイン方式）
(function (global) {
  var BID = global.BID = global.BID || {};

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
    clearMessages: function () {
      show("msgError", false); setText("msgError", "");
      show("msgOk", false); setText("msgOk", "");
      setText("msgInfo", BID.CONFIG.MSG_AUTH_PROMPT);
    },

    setError: function (msg) {
      show("msgError", true); setText("msgError", msg || "");
      show("msgOk", false); setText("msgOk", "");
    },
    setOk: function (msg) {
      show("msgOk", true); setText("msgOk", msg || "");
      show("msgError", false); setText("msgError", "");
    },
    setInfo: function (msg) {
      setText("msgInfo", msg || "");
    },

    setAuthResult: function (msg) {
      setText("authResult", msg || "");
    },

    setProfileStatus: function (missArr) {
      missArr = missArr || [];
      if (!missArr.length) setText("profileStatus", "必須入力：OK");
      else setText("profileStatus", "必須未入力： " + missArr.join(" / "));
    },

    renderStatusBar: function () {
      var st = BID.State.get();
      setText("sbBidNo", st.bidNo || "(未設定)");
      setText("sbBidStatus", st.bidStatus ? (BID.CONFIG.STATUS_LABELS[st.bidStatus] || st.bidStatus) : "(未読込)");
      setText("sbLoginState", st.user ? "OK" : "NG");
      setText("sbBidderId", st.bidderId || "-");
      setText("sbAuthState", st.authState || "LOCKED");
      setText("sbInputState", st.inputEnabled ? "可" : "不可");
      setText("sbMode", st.viewOnly ? "VIEW-ONLY" : "EDIT");
      setText("sbLastLoaded", st.lastLoadedAt || "-");
      setText("sbLastSaved", st.lastSavedAt || "-");
    },

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

    applyMode: function () {
      var st = BID.State.get();

      // logged in required
      var signedIn = !!st.user;

      // status
      var status = st.bidStatus || "";
      var viewOnly = (status === "closed");
      BID.State.setViewOnly(viewOnly);

      // profile editable: open + signedIn + unlocked
      var profileEditable = (signedIn && !viewOnly && status === "open" && st.authState === "UNLOCKED");

      // bidderId はログイン由来なので基本固定（入力は不可にする）
      if (el("inpBidderId")) {
        el("inpBidderId").disabled = true;
        el("inpBidderId").value = st.bidderId || "";
      }

      var profileInputs = ["inpEmail","inpAddress","inpCompanyName","inpRepresentativeName","inpContactName","inpContactInfo"];
      for (var i = 0; i < profileInputs.length; i++) {
        var ei = el(profileInputs[i]);
        if (ei) ei.disabled = !profileEditable;
      }

      // auth section enabled: signedIn + open
      show("authSection", true);
      if (el("authCode")) el("authCode").disabled = !(signedIn && status === "open" && !viewOnly);
      if (el("btnAuth")) el("btnAuth").disabled = !(signedIn && status === "open" && !viewOnly);

      // can input: signedIn + open + unlocked + profile complete + not viewOnly
      var canInput = false;
      if (signedIn && !viewOnly && status === "open" && st.authState === "UNLOCKED" && st.profileState === "COMPLETE") {
        canInput = true;
      }
      BID.State.setInputEnabled(canInput);

      // unit price inputs
      var items = st.items || [];
      for (var j = 0; j < items.length; j++) {
        var seq = String(items[j].seq);
        var ip = el("unitPrice_" + seq);
        if (ip) ip.disabled = !canInput;
      }

      // buttons
      if (el("btnSubmit")) el("btnSubmit").disabled = !canInput;

      // load offer / print / pdf はログイン必須（closedでも閲覧可）
      if (el("btnLoadOffer")) el("btnLoadOffer").disabled = !signedIn;
      if (el("btnPrint")) el("btnPrint").disabled = false;
      if (el("btnPdf")) el("btnPdf").disabled = false;

      // reason
      var reason = "";
      if (!signedIn) reason = "ログインしてください。";
      else if (!status) reason = "入札データを読み込み中です。";
      else if (status === "draft") reason = "この入札は準備中（draft）です。入札開始までお待ちください。";
      else if (status === "closed") reason = "入札は終了しました（closed）。完全閲覧モードです。";
      else if (status === "open" && st.authState !== "UNLOCKED") reason = BID.CONFIG.MSG_AUTH_PROMPT;
      else if (status === "open" && st.authState === "UNLOCKED" && st.profileState !== "COMPLETE") reason = "入札者情報（必須）を入力してください。";
      else if (canInput) reason = "入札可能です。単価を入力して保存してください。（open中は上書き可）";
      else reason = "状態を確認中です。";

      BID.Render.setInfo(reason);

      // submitStatus（押せない理由が見える）
      var ss = el("submitStatus");
      if (ss) {
        ss.textContent =
          "判定: signedIn=" + (signedIn ? "true" : "false") +
          " / status=" + (status || "(none)") +
          " / auth=" + (st.authState || "(none)") +
          " / profile=" + (st.profileState || "(none)") +
          " / inputEnabled=" + (st.inputEnabled ? "true" : "false") +
          " / viewOnly=" + (st.viewOnly ? "true" : "false");
      }

      BID.Render.renderStatusBar();
    },

    renderAll: function () {
      BID.Render.renderStatusBar();
      BID.Render.renderBidInfo();
      BID.Render.renderItems();
      BID.Render.applyMode();
    }
  };

  try { if (BID.Log && BID.Log.ver) BID.Log.ver("08_bidder_render.js", "v20260123-01"); } catch (e) {}
})(window);
