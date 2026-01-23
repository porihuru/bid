// [JST 2026-01-23 22:10] bidder/js/08_bidder_render.js v20260123-01
// [BID-08] 描画・表示制御（ログイン不要対応）
// 変更点（重要）:
//  - renderItems() で BID.Offer.applyLinesToTable が無い場合でも落ちない
//  - applyMode() の末尾で submitStatus に判定結果を常時表示（理由が分かる）

BID.Build && BID.Build.report && BID.Build.report("08_bidder_render.js", "v20260123-01");


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

  function safeLog(msg) {
    try { if (BID.Log && BID.Log.write) BID.Log.write(msg); } catch (e) {}
  }

  // =========================================================
  // [08-01] 描画・表示制御
  // =========================================================
  BID.Render = {
    // [08-02] メッセージ（統一）
    clearMessages: function () {
      show("msgError", false); setText("msgError", "");
      show("msgOk", false); setText("msgOk", "");
      setText("msgInfo", (BID.CONFIG && BID.CONFIG.MSG_AUTH_PROMPT) ? BID.CONFIG.MSG_AUTH_PROMPT : "認証コードを入力してください。");
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

    // [08-03] 認証結果
    setAuthResult: function (msg) {
      setText("authResult", msg || "");
    },

    // [08-04] プロファイル状態表示（missArr でも文字列でも可）
    setProfileStatus: function (miss) {
      // miss: [] / "エラー文" / "" などを許容
      if (typeof miss === "string") {
        setText("profileStatus", miss ? ("必須未入力： " + miss) : "必須入力：OK");
        return;
      }
      miss = miss || [];
      if (!miss.length) setText("profileStatus", "必須入力：OK");
      else setText("profileStatus", "必須未入力： " + miss.join(" / "));
    },

    setProfileAutoFillNote: function (msg) {
      setText("profileAutoFillNote", msg || "");
    },

    // [08-05] ステータスバー（常時）
    renderStatusBar: function () {
      var st = BID.State.get();
      setText("sbBidNo", st.bidNo || "(未設定)");

      var labels = (BID.CONFIG && BID.CONFIG.STATUS_LABELS) ? BID.CONFIG.STATUS_LABELS : {};
      setText("sbBidStatus", st.bidStatus ? (labels[st.bidStatus] || st.bidStatus) : "(未読込)");

      setText("sbAuthState", st.authState || "LOCKED");
      setText("sbInputState", st.inputEnabled ? "可" : "不可");
      setText("sbMode", st.viewOnly ? "VIEW-ONLY" : "EDIT");
      setText("sbLastLoaded", st.lastLoadedAt || "-");
      setText("sbLastSaved", st.lastSavedAt || "-");
    },

    // [08-06] 入札概要（ヘッダー）
    renderBidInfo: function () {
      var st = BID.State.get();
      var b = st.bid || {};
      var notes = (BID.DB && BID.DB.getPublicNotesFromBid) ? BID.DB.getPublicNotesFromBid(b) : { note1:"",note2:"",note3:"",note4:"" };

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

    // [08-07] 品目テーブル生成
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

      // 既存 lines を反映（Offerが未読込でも落とさない）
      try {
        if (BID.Offer && BID.Offer.applyLinesToTable) {
          BID.Offer.applyLinesToTable(st.offerLines);
        } else {
          safeLog("[render] NOTE: BID.Offer.applyLinesToTable is missing");
        }
      } catch (e) {
        safeLog("[render] applyLinesToTable ERROR: " + (e && e.message ? e.message : e));
      }
    },

    // [08-08] 入力可否・モード制御
    applyMode: function () {
      var st = BID.State.get();

      var status = st.bidStatus || "";
      var viewOnly = false;

      if (status === "closed") viewOnly = true;
      BID.State.setViewOnly(viewOnly);

      // open AND UNLOCKED AND profile COMPLETE AND not viewOnly
      var canInput = false;
      if (!viewOnly && status === "open" && st.authState === "UNLOCKED" && st.profileState === "COMPLETE") {
        canInput = true;
      }
      BID.State.setInputEnabled(canInput);

      // 認証UI（open以外は無効）
      show("authSection", true);
      if (status === "open") {
        if (el("authCode")) el("authCode").disabled = false;
        if (el("btnAuth")) el("btnAuth").disabled = false;
      } else {
        if (el("authCode")) el("authCode").disabled = true;
        if (el("btnAuth")) el("btnAuth").disabled = true;
      }

      // 入札者情報UI（openかつ認証後のみ入力可）
      var profileInputs = ["inpBidderId","inpEmail","inpAddress","inpCompanyName","inpRepresentativeName","inpContactName","inpContactInfo"];
      var profileEditable = (!viewOnly && status === "open" && st.authState === "UNLOCKED");
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

      // 画面メッセージ（常時理由）
      var reason = "";
      if (!status) reason = "入札データを読み込み中です。";
      else if (status === "draft") reason = "この入札は準備中（draft）です。入札開始までお待ちください。";
      else if (status === "closed") reason = "入札は終了しました（closed）。完全閲覧モードです。";
      else if (status === "open" && st.authState !== "UNLOCKED") reason = (BID.CONFIG && BID.CONFIG.MSG_AUTH_PROMPT) ? BID.CONFIG.MSG_AUTH_PROMPT : "認証コードを入力してください。";
      else if (status === "open" && st.authState === "UNLOCKED" && st.profileState !== "COMPLETE") reason = "入札者情報（必須）を入力してください。";
      else if (canInput) reason = "入札可能です。単価を入力して保存してください。（open中は上書き可）";
      else reason = "状態を確認中です。";

      BID.Render.setInfo(reason);

      // [08-08-90] 追加：判定結果を submitStatus に常時表示（押せない理由が分かる）
      try {
        var ss = el("submitStatus");
        if (ss) {
          ss.textContent =
            "判定: status=" + (status || "(none)") +
            " / auth=" + (st.authState || "(none)") +
            " / profile=" + (st.profileState || "(none)") +
            " / inputEnabled=" + (st.inputEnabled ? "true" : "false") +
            " / viewOnly=" + (st.viewOnly ? "true" : "false");
        }
      } catch (e2) {}

      // ステータスバー反映
      BID.Render.renderStatusBar();
    },

    // [08-09] 全体描画
    renderAll: function () {
      BID.Render.renderStatusBar();
      BID.Render.renderBidInfo();
      BID.Render.renderItems();
      BID.Render.applyMode();
    }
  };
})(window);
