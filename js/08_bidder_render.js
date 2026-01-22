// [JST 2026-01-22 21:40]  bidder/js/08_bidder_render.js  v20260122-01
// [BID-08] 描画・表示制御（ログイン不要版）
// 変更点:
//  - [08-08-20] 「未ログインです。」判定を撤廃（誰でも入札できる仕様に合わせる）
//  - [08-08-30] 認証/必須入力/状態に応じた案内を常に出す（認証押下で変化が見える）
//  - 既存のUI制御（open/closed/draft, LOCK/UNLOCK, profileState）を維持
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

  // =========================================================
  // [08-01] 描画・表示制御
  // =========================================================
  BID.Render = {
    // =======================================================
    // [08-02] メッセージ（統一）
    // =======================================================
    clearMessages: function () {
      // [08-02-01] error/ok を消す
      show("msgError", false); setText("msgError", "");
      show("msgOk", false); setText("msgOk", "");
      // [08-02-02] info は常時表示（状態で上書き）
      setText("msgInfo", BID.CONFIG.MSG_AUTH_PROMPT);
    },

    // [08-02-10] エラー表示（失敗時は必ずここ）
    setError: function (msg) {
      show("msgError", true);
      setText("msgError", msg || "");
      show("msgOk", false);
      setText("msgOk", "");
    },

    // [08-02-20] OK表示
    setOk: function (msg) {
      show("msgOk", true);
      setText("msgOk", msg || "");
      show("msgError", false);
      setText("msgError", "");
    },

    // [08-02-30] INFO表示（常時）
    setInfo: function (msg) {
      setText("msgInfo", msg || "");
    },

    // =======================================================
    // [08-03] 認証結果（文言表示のみ）
    // =======================================================
    setAuthResult: function (msg) {
      setText("authResult", msg || "");
    },

    // =======================================================
    // [08-04] プロファイル状態表示
    // 期待: missArr = ["メール", "住所", ...] の配列
    // =======================================================
    setProfileStatus: function (missArr) {
      missArr = missArr || [];
      if (!missArr.length) {
        setText("profileStatus", "必須入力：OK");
      } else {
        setText("profileStatus", "必須未入力： " + missArr.join(" / "));
      }
    },

    setProfileAutoFillNote: function (msg) {
      setText("profileAutoFillNote", msg || "");
    },

    // =======================================================
    // [08-05] ステータスバー（常時）
    // =======================================================
    renderStatusBar: function () {
      var st = BID.State.get();

      // [08-05-01] 固定入札番号
      setText("sbBidNo", st.bidNo || "(未設定)");

      // [08-05-02] 状態表示（ラベルがあれば使用）
      setText(
        "sbBidStatus",
        st.bidStatus ? (BID.CONFIG.STATUS_LABELS[st.bidStatus] || st.bidStatus) : "(未読込)"
      );

      // [08-05-03] 認証状態
      setText("sbAuthState", st.authState || "LOCKED");

      // [08-05-04] 入力可否・モード
      setText("sbInputState", st.inputEnabled ? "可" : "不可");
      setText("sbMode", st.viewOnly ? "VIEW-ONLY" : "EDIT");

      // [08-05-05] 時刻
      setText("sbLastLoaded", st.lastLoadedAt || "-");
      setText("sbLastSaved", st.lastSavedAt || "-");
    },

    // =======================================================
    // [08-06] 入札概要（ヘッダー）
    // =======================================================
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

    // =======================================================
    // [08-07] 品目テーブル生成（品名/規格2段、予定数量、合計なし）
    // =======================================================
    renderItems: function () {
      var st = BID.State.get();
      var tbody = el("itemsTbody");
      if (!tbody) return;

      // [08-07-01] クリア
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

        // seq
        var tdSeq = document.createElement("td");
        tdSeq.textContent = String(it.seq);
        tr.appendChild(tdSeq);

        // sample
        var tdS = document.createElement("td");
        tdS.textContent = it.sample ? "〇" : "";
        tr.appendChild(tdS);

        // name/spec 2段
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

        // qty (予定数量)
        var tdQ = document.createElement("td");
        tdQ.textContent = (it.qty == null) ? "" : String(it.qty);
        tr.appendChild(tdQ);

        // unit
        var tdU = document.createElement("td");
        tdU.textContent = it.unit || "";
        tr.appendChild(tdU);

        // note
        var tdN = document.createElement("td");
        tdN.textContent = it.note || "";
        tr.appendChild(tdN);

        // unit price input
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

      // [08-07-90] 既存のofferLinesがあれば反映
      BID.Offer.applyLinesToTable(st.offerLines);
    },

    // =======================================================
    // [08-08] 入力可否・モード制御（draft/open/closed + LOCK/UNLOCK + profile）
    // =======================================================
    applyMode: function () {
      var st = BID.State.get();

      // -------------------------------------------------------
      // [08-08-01] 状態判定
      // -------------------------------------------------------
      var status = st.bidStatus || "";
      var viewOnly = false;

      // [08-08-02] closedは完全閲覧
      if (status === "closed") viewOnly = true;

      BID.State.setViewOnly(viewOnly);

      // -------------------------------------------------------
      // [08-08-03] 入力可能条件
      //  open AND UNLOCKED AND profile COMPLETE AND not viewOnly
      // -------------------------------------------------------
      var canInput = false;
      if (!viewOnly && status === "open" && st.authState === "UNLOCKED" && st.profileState === "COMPLETE") {
        canInput = true;
      }
      BID.State.setInputEnabled(canInput);

      // -------------------------------------------------------
      // [08-08-10] 認証UI（open以外は無効化）
      // -------------------------------------------------------
      show("authSection", true);

      if (status === "open") {
        if (el("authCode")) el("authCode").disabled = false;
        if (el("btnAuth")) el("btnAuth").disabled = false;
      } else {
        // draft/closed は認証不要（ここでは表示は残しつつ無効化）
        if (el("authCode")) el("authCode").disabled = true;
        if (el("btnAuth")) el("btnAuth").disabled = true;
      }

      // -------------------------------------------------------
      // [08-08-11] 入札者情報UI（openかつ認証後のみ入力可）
      // -------------------------------------------------------
      var profileInputs = ["inpBidderId","inpEmail","inpAddress","inpCompanyName","inpRepresentativeName","inpContactName","inpContactInfo"];
      var profileEditable = (!viewOnly && status === "open" && st.authState === "UNLOCKED");
      for (var i = 0; i < profileInputs.length; i++) {
        var ei = el(profileInputs[i]);
        if (ei) ei.disabled = !profileEditable;
      }

      // -------------------------------------------------------
      // [08-08-12] 単価入力欄
      // -------------------------------------------------------
      var items = st.items || [];
      for (var j = 0; j < items.length; j++) {
        var seq = String(items[j].seq);
        var inp = el("unitPrice_" + seq);
        if (inp) inp.disabled = !canInput;
      }

      // -------------------------------------------------------
      // [08-08-13] 保存ボタン
      // -------------------------------------------------------
      if (el("btnSubmit")) el("btnSubmit").disabled = !canInput;

      // -------------------------------------------------------
      // [08-08-20] 画面メッセージ（常時理由を出す）
      //  ★重要: ログイン不要仕様なので st.user 判定を撤廃
      // -------------------------------------------------------
      var reason = "";

      if (!status) {
        reason = "入札データを読み込み中です。";
      } else if (status === "draft") {
        reason = "この入札は準備中（draft）です。入札開始までお待ちください。";
      } else if (status === "closed") {
        reason = "入札は終了しました（closed）。完全閲覧モードです。";
      } else if (status === "open" && st.authState !== "UNLOCKED") {
        reason = BID.CONFIG.MSG_AUTH_PROMPT; // 「認証コードを入力してください。」
      } else if (status === "open" && st.authState === "UNLOCKED" && st.profileState !== "COMPLETE") {
        reason = "入札者情報（必須）を入力してください。";
      } else if (canInput) {
        reason = "入札可能です。単価を入力して保存してください。（open中は上書き可）";
      } else {
        reason = "状態を確認中です。";
      }

      BID.Render.setInfo(reason);

      // -------------------------------------------------------
      // [08-08-90] ステータスバー反映
      // -------------------------------------------------------
      BID.Render.renderStatusBar();
    },

    // =======================================================
    // [08-09] 全体描画（起動・再描画の入口）
    // =======================================================
    renderAll: function () {
      BID.Render.renderStatusBar();
      BID.Render.renderBidInfo();
      BID.Render.renderItems();
      BID.Render.applyMode();
    }
  };
})(window);
