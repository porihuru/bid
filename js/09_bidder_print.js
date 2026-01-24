// [JST 2026-01-24 21:00] bidder/js/09_bidder_print.js v20260124-01
// [BID-09] 印刷（PDF出力は印刷ダイアログで対応）
// ※ 印刷レイアウトは今後「作りながら整える」前提。まずは動作優先。
(function (global) {
  var BID = global.BID = global.BID || {};
  if (BID.Build && BID.Build.register) BID.Build.register("09_bidder_print.js", "v20260124-01");

  function el(id) { return document.getElementById(id); }

  function esc(s) {
    s = (s == null) ? "" : String(s);
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  BID.Print = {
    doPrint: function () {
      var st = BID.State.get();

      // 印刷用へ反映（最小）
      if (el("printDatetime")) el("printDatetime").textContent = new Date().toISOString();
      if (el("printBidNo")) el("printBidNo").textContent = st.bidNo || "-";

      // profile
      var p = st.profile || {};
      var prof =
        "入札者ID: " + esc(st.bidderNo || "-") + "\n" +
        "メール: " + esc(p.email || "") + "\n" +
        "住所: " + esc(p.address || "") + "\n" +
        "会社名: " + esc(p.companyName || "") + "\n" +
        "代表者名: " + esc(p.representativeName || "") + "\n" +
        "担当者名: " + esc(p.contactName || "") + "\n" +
        "連絡先: " + esc(p.contactInfo || "");
      if (el("printProfile")) el("printProfile").textContent = prof;

      // bid
      var b = st.bid || {};
      var info =
        "宛先1: " + esc(b.to1 || "") + "\n" +
        "宛先2: " + esc(b.to2 || "") + "\n" +
        "宛先3: " + esc(b.to3 || "") + "\n" +
        "納入場所: " + esc(b.deliveryPlace || "") + "\n" +
        "納期: " + esc(b.dueDate || "") + "\n" +
        "入札年月日: " + esc(b.bidDate || "");
      if (el("printBidInfo")) el("printBidInfo").textContent = info;

      // items（単価含むが合計は出さない）
      var items = st.items || [];
      var lines = st.offerLines || {};
      var out = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var seq = String(it.seq);
        out.push(
          seq + " " +
          esc(it.name || "") + " / " + esc(it.spec || "") +
          " 予定数量:" + esc(it.qty == null ? "" : it.qty) + esc(it.unit || "") +
          " 単価:" + ((lines[seq] != null) ? String(lines[seq]) : "")
        );
      }
      if (el("printItems")) el("printItems").textContent = out.join("\n");

      window.print();
    }
  };

})(window);
