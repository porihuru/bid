// [JST 2026-01-24 21:00] bidder/js/07_bidder_offer.js v20260124-01
// [BID-07] offers: 単価入力の収集・反映・payload生成
(function (global) {
  var BID = global.BID = global.BID || {};
  if (BID.Build && BID.Build.register) BID.Build.register("07_bidder_offer.js", "v20260124-01");

  function el(id) { return document.getElementById(id); }

  function trim(s) { return (s == null) ? "" : String(s).replace(/^\s+|\s+$/g, ""); }

  function toNumberOrNull(s) {
    s = trim(s);
    if (!s) return null;
    // カンマ除去
    s = s.replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }

  BID.Offer = BID.Offer || {};

  // [07-01] 既存linesをテーブルへ反映
  BID.Offer.applyLinesToTable = function (lines) {
    lines = lines || {};
    var st = BID.State.get();
    var items = st.items || [];
    for (var i = 0; i < items.length; i++) {
      var seq = String(items[i].seq);
      var inp = el("unitPrice_" + seq);
      if (!inp) continue;
      var v = (lines[seq] != null) ? String(lines[seq]) : "";
      inp.value = v;
    }
  };

  // [07-02] テーブルからlinesを収集（{seq: unitPrice}）
  BID.Offer.collectLinesFromTable = function () {
    var st = BID.State.get();
    var items = st.items || [];
    var out = {};
    for (var i = 0; i < items.length; i++) {
      var seq = String(items[i].seq);
      var inp = el("unitPrice_" + seq);
      var v = inp ? inp.value : "";
      var num = toNumberOrNull(v);

      if (num === null) {
        // 未入力は入れない（保存は許可するが、後段で必須にするなら変更）
        continue;
      }
      if (isNaN(num)) {
        return { error: "単価が数値ではありません（seq=" + seq + "）", lines: null };
      }
      out[seq] = num;
    }
    return { error: "", lines: out };
  };

  // [07-03] 保存payload生成（必須/単価チェック）
  BID.Offer.buildOfferPayload = function () {
    var st = BID.State.get();

    // bidderId（入札者番号）
    var bidderId = st.bidderNo || "";
    if (!bidderId) {
      if (BID.Render) BID.Render.setError("入札者IDが確定していません。ログインをやり直してください。");
      if (BID.Log) BID.Log.write("[payload] NG: bidderId empty");
      return null;
    }

    // profile
    var p = BID.Profile.readFromInputs();
    var miss = BID.Profile.validateRequired(p);
    if (miss.length) {
      if (BID.Render) BID.Render.setError("入札者情報（必須）が未入力です: " + miss.join(" / "));
      if (BID.Log) BID.Log.write("[payload] NG: profile incomplete");
      return null;
    }

    // lines
    var r = BID.Offer.collectLinesFromTable();
    if (r.error) {
      if (BID.Render) BID.Render.setError(r.error);
      if (BID.Log) BID.Log.write("[payload] NG: " + r.error);
      return null;
    }

    // ここで「単価の必須」を強制したいならチェックを追加
    // 例：全品必須の場合は items.length と入力数の一致を要求する等

    return {
      bidderId: bidderId,
      bidderNo: bidderId, // 同一
      profile: {
        email: p.email,
        address: p.address,
        companyName: p.companyName,
        representativeName: p.representativeName,
        contactName: p.contactName,
        contactInfo: p.contactInfo
      },
      lines: r.lines || {}
    };
  };

})(window);
