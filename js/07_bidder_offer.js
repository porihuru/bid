// [JST 2026-01-20 19:00]  bidder/js/07_bidder_offer.js  v20260120-01
(function (global) {
  var BID = global.BID = global.BID || {};

  function el(id) { return document.getElementById(id); }
  function trim(s) { return (s == null) ? "" : String(s).replace(/^\s+|\s+$/g, ""); }

  function toNumberOrNull(s) {
    s = trim(s);
    if (s === "") return null;
    // カンマ除去
    s = s.replace(/,/g, "");
    var n = Number(s);
    if (isNaN(n)) return null;
    return n;
  }

  // =========================================================
  // [07-01] Offer（単価 lines）処理
  // =========================================================
  BID.Offer = {
    // [07-02] テーブル入力 → lines(map)
    readLinesFromTable: function () {
      var st = BID.State.get();
      var items = st.items || [];
      var lines = {};

      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var seq = String(it.seq);
        var inp = el("unitPrice_" + seq);
        var v = inp ? trim(inp.value) : "";
        var n = toNumberOrNull(v);

        // 未入力は保存しない（= 空で上書きしない運用も可能だが、ここは明示保存しない）
        if (n == null) continue;

        lines[seq] = { unitPrice: n };
      }
      return lines;
    },

    // [07-03] lines(map) → テーブル反映
    applyLinesToTable: function (lines) {
      lines = lines || {};
      var st = BID.State.get();
      var items = st.items || [];

      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var seq = String(it.seq);
        var inp = el("unitPrice_" + seq);
        if (!inp) continue;

        var obj = lines[seq];
        if (obj && obj.unitPrice != null) {
          inp.value = String(obj.unitPrice);
        }
      }
    },

    // [07-04] 保存payload組み立て（profile＋lines）
    buildOfferPayload: function () {
      var st = BID.State.get();

      // profileは入力欄を最新化
      var p = BID.Profile.readFromInputs();
      var miss = BID.Profile.validateRequired(p);
      if (miss.length) {
        BID.Render.setError("入札者情報が未入力です: " + miss.join(" / "));
        BID.Log.write("[offer] profile incomplete: " + miss.join(","));
        return null;
      }

      // lines
      var lines = BID.Offer.readLinesFromTable();

      // 保存payload
      return {
        email: p.email,
        address: p.address,
        companyName: p.companyName,
        representativeName: p.representativeName,
        contactName: p.contactName,
        contactInfo: p.contactInfo,
        lines: lines
      };
    }
  };
})(window);