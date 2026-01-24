// [JST 2026-01-23 22:30] js/09_bidder_print.js v20260123-01
// [BID-09] 印刷（PDF出力は印刷ダイアログで保存）
(function (global) {
  var BID = global.BID = global.BID || {};

  function el(id){ return document.getElementById(id); }
  function esc(s){ return String(s||"").replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });}

  function buildPrintProfile(p){
    return [
      "入札者番号: " + esc(p.bidderId),
      "メール: " + esc(p.email),
      "住所: " + esc(p.address),
      "会社名: " + esc(p.companyName),
      "代表者名: " + esc(p.representativeName),
      "担当者名: " + esc(p.contactName),
      "担当者・連絡先: " + esc(p.contactInfo)
    ].join("<br>");
  }

  function buildPrintBidInfo(b){
    return [
      "宛先1: " + esc(b.to1 || ""),
      "宛先2: " + esc(b.to2 || ""),
      "宛先3: " + esc(b.to3 || ""),
      "納入場所: " + esc(b.deliveryPlace || ""),
      "納期: " + esc(b.dueDate || ""),
      "入札年月日: " + esc(b.bidDate || "")
    ].join("<br>");
  }

  function buildPrintItems(items, lines){
    items = items || [];
    lines = lines || {};
    var html = "<table style='width:100%;border-collapse:collapse;' border='1' cellpadding='6'>";
    html += "<tr><th>seq</th><th>品名</th><th>規格</th><th>予定数量</th><th>単位</th><th>備考</th><th>単価</th></tr>";
    for (var i=0;i<items.length;i++){
      var it = items[i];
      var seq = String(it.seq);
      html += "<tr>";
      html += "<td>" + esc(seq) + "</td>";
      html += "<td>" + esc(it.name||"") + "</td>";
      html += "<td>" + esc(it.spec||"") + "</td>";
      html += "<td>" + esc(it.qty==null?"":String(it.qty)) + "</td>";
      html += "<td>" + esc(it.unit||"") + "</td>";
      html += "<td>" + esc(it.note||"") + "</td>";
      html += "<td>" + esc(lines[seq]||"") + "</td>";
      html += "</tr>";
    }
    html += "</table>";
    return html;
  }

  BID.Print = {
    doPrint: function () {
      var st = BID.State.get();
      var b = st.bid || {};
      var p = BID.Offer ? BID.Offer.readProfileFromInputs() : (st.profile || {});
      var lines = (BID.Offer && BID.Offer.readLinesFromTable) ? BID.Offer.readLinesFromTable() : (st.offerLines || {});

      if (el("printDatetime")) el("printDatetime").textContent = new Date().toLocaleString();
      if (el("printBidNo")) el("printBidNo").textContent = st.bidNo || "";
      if (el("printProfile")) el("printProfile").innerHTML = buildPrintProfile(p);
      if (el("printBidInfo")) el("printBidInfo").innerHTML = buildPrintBidInfo(b);
      if (el("printItems")) el("printItems").innerHTML = buildPrintItems(st.items || [], lines);

      // 印刷実行
      window.print();
      BID.Log.write("[print] window.print called");
    }
  };

  try { if (BID.Log && BID.Log.ver) BID.Log.ver("09_bidder_print.js", "v20260123-01"); } catch (e) {}
})(window);
