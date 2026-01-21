// [JST 2026-01-20 19:00]  bidder/js/09_bidder_print.js  v20260120-01
(function (global) {
  var BID = global.BID = global.BID || {};

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    s = (s == null) ? "" : String(s);
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function nowJP() {
    // 簡易（JST固定表示のための文字列）
    var d = new Date();
    var y = d.getFullYear();
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    var day = ("0" + d.getDate()).slice(-2);
    var hh = ("0" + d.getHours()).slice(-2);
    var mm = ("0" + d.getMinutes()).slice(-2);
    return y + "-" + m + "-" + day + " " + hh + ":" + mm;
  }

  // =========================================================
  // [09-01] 印刷エリア生成（合計金額は表示しない）
  // =========================================================
  BID.Print = {
    buildPrintArea: function () {
      var st = BID.State.get();
      var b = st.bid || {};
      var notes = BID.DB.getPublicNotesFromBid(b);

      // 印刷日時
      if (el("printDatetime")) el("printDatetime").textContent = nowJP();

      // 入札番号
      if (el("printBidNo")) el("printBidNo").textContent = st.bidNo || "";

      // 入札者情報
      var p = st.profile || {};
      if (el("printProfile")) {
        el("printProfile").innerHTML =
          "<div>会社名: " + esc(p.companyName) + "</div>" +
          "<div>住所: " + esc(p.address) + "</div>" +
          "<div>代表者名: " + esc(p.representativeName) + "</div>" +
          "<div>担当者名: " + esc(p.contactName) + "</div>" +
          "<div>担当者・連絡先: " + esc(p.contactInfo) + "</div>" +
          "<div>メールアドレス: " + esc(p.email) + "</div>";
      }

      // 入札概要（備考1-4）
      if (el("printBidInfo")) {
        el("printBidInfo").innerHTML =
          "<div>宛先: " + esc(b.to1) + " / " + esc(b.to2) + " / " + esc(b.to3) + "</div>" +
          "<div>納入場所: " + esc(b.deliveryPlace) + "</div>" +
          "<div>納期: " + esc(b.dueDate) + "</div>" +
          "<div>入札年月日: " + esc(b.bidDate) + "</div>" +
          "<div>備考1: " + esc(notes.note1) + "</div>" +
          "<div>備考2: " + esc(notes.note2) + "</div>" +
          "<div>備考3: " + esc(notes.note3) + "</div>" +
          "<div>備考4: " + esc(notes.note4) + "</div>";
      }

      // 品目（2段表示のまま、単価も表示）
      var items = st.items || [];
      var lines = st.offerLines || {};
      var html = "";
      html += "<table><thead><tr>" +
        "<th>seq</th><th>見本</th><th>品名/規格</th><th>予定数量</th><th>単位</th><th>備考</th><th>入札単価</th>" +
        "</tr></thead><tbody>";

      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var seq = String(it.seq);
        var lp = lines[seq] ? lines[seq].unitPrice : "";
        html += "<tr>" +
          "<td>" + esc(it.seq) + "</td>" +
          "<td>" + (it.sample ? "〇" : "") + "</td>" +
          "<td><div><strong>" + esc(it.name) + "</strong></div><div>" + esc(it.spec) + "</div></td>" +
          "<td>" + esc(it.qty == null ? "" : it.qty) + "</td>" +
          "<td>" + esc(it.unit) + "</td>" +
          "<td>" + esc(it.note) + "</td>" +
          "<td style='text-align:right;'>" + esc(lp) + "</td>" +
          "</tr>";
      }
      html += "</tbody></table>";

      if (el("printItems")) el("printItems").innerHTML = html;
    },

    // [09-02] 印刷（PDFはブラウザの保存で対応）
    doPrint: function () {
      try {
        BID.Print.buildPrintArea();
      } catch (e) {
        BID.Log.write("[print] build failed: " + (e && e.message ? e.message : e));
      }
      BID.Log.write("[print] window.print()");
      window.print();
    }
  };
})(window);