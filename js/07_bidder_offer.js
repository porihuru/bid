// [JST 2026-01-23 21:00] bidder/js/07_bidder_offer.js v20260123-01
// [BID-07] 入札（offers）: 単価入力・保存・読込
// 目的:
//  - 08_bidder_render.js が呼ぶ BID.Offer.applyLinesToTable(...) を提供してエラーを解消
//  - 「入札を保存（提出）」で保存する payload 生成（単価行＋入札者情報）をここに集約

(function (global) {
  var BID = global.BID = global.BID || {};

  BID.Offer = BID.Offer || {};

  // =========================================================
  // [BID-07-01] テーブル⇔lines 変換
  // lines: { "1": 123, "2": 456, ... }  ※seqをキー
  // =========================================================
  function normalizeNum(s) {
    // 全角→半角、カンマ除去、空は空
    if (s == null) return "";
    s = String(s);
    s = s.replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
    s = s.replace(/,/g, "");
    s = s.replace(/^\s+|\s+$/g, "");
    return s;
  }

  function isEmptyPrice(v) {
    return v == null || String(v).replace(/\s+/g, "") === "";
  }

  // [BID-07-02] 画面の単価入力欄から lines を作る
  BID.Offer.readLinesFromTable = function () {
    var st = BID.State.get();
    var items = st.items || [];
    var out = {};

    for (var i = 0; i < items.length; i++) {
      var seq = String(items[i].seq);
      var inp = document.getElementById("unitPrice_" + seq);
      var v = inp ? normalizeNum(inp.value) : "";
      if (!isEmptyPrice(v)) {
        // 数値として保存（整数想定）
        var n = Number(v);
        if (!isFinite(n)) {
          throw new Error("単価が数値ではありません（seq=" + seq + " / 入力=" + (inp ? inp.value : "") + "）。");
        }
        out[seq] = n;
      }
    }
    return out;
  };

  // [BID-07-03] lines をテーブルへ反映
  BID.Offer.applyLinesToTable = function (lines) {
    lines = lines || {};
    var st = BID.State.get();
    var items = st.items || [];

    for (var i = 0; i < items.length; i++) {
      var seq = String(items[i].seq);
      var inp = document.getElementById("unitPrice_" + seq);
      if (!inp) continue;
      if (lines.hasOwnProperty(seq)) {
        inp.value = (lines[seq] == null) ? "" : String(lines[seq]);
      } else {
        inp.value = "";
      }
    }
  };

  // =========================================================
  // [BID-07-10] payload 生成（保存用）
  // =========================================================
  function must(p, key, label) {
    if (!p || !p[key] || String(p[key]).replace(/^\s+|\s+$/g, "") === "") return label;
    return "";
  }

  // [BID-07-11] 保存payloadを構築
  // - bidderId を docId として使う（bids/{bidNo}/offers/{bidderId}）
  // - profile を同梱（集計で業者名等が必ず出る）
  // - lines は seq→unitPrice のみ（合計金額は表示しない）
  BID.Offer.buildOfferPayload = function () {
    var st = BID.State.get();
    var p = (st && st.profile) ? st.profile : {};

    // 必須チェック（ここでユーザーに理由が出るようにする）
    var miss =
      must(p, "bidderId", "入札者番号") ||
      must(p, "email", "メールアドレス") ||
      must(p, "address", "住所") ||
      must(p, "companyName", "会社名") ||
      must(p, "representativeName", "代表者名") ||
      must(p, "contactName", "担当者名") ||
      must(p, "contactInfo", "担当者・連絡先");

    if (miss) {
      if (BID.Render && BID.Render.setError) BID.Render.setError("保存できません：必須未入力（" + miss + "）");
      if (BID.Log && BID.Log.write) BID.Log.write("[save] NG: required missing " + miss);
      return null;
    }

    // lines 取得（単価）
    var lines = {};
    try {
      lines = BID.Offer.readLinesFromTable();
    } catch (e) {
      if (BID.Render && BID.Render.setError) BID.Render.setError("保存できません：" + (e && e.message ? e.message : e));
      if (BID.Log && BID.Log.write) BID.Log.write("[save] NG: " + (e && e.message ? e.message : e));
      return null;
    }

    // 単価が1つも無い場合も許容する/しないは運用次第
    // ここでは「少なくとも1件は入力」を必須にする
    var hasAny = false;
    for (var k in lines) { if (lines.hasOwnProperty(k)) { hasAny = true; break; } }
    if (!hasAny) {
      if (BID.Render && BID.Render.setError) BID.Render.setError("保存できません：入札単価が1件も入力されていません。");
      if (BID.Log && BID.Log.write) BID.Log.write("[save] NG: no unit price");
      return null;
    }

    return {
      bidderId: String(p.bidderId),
      authState: st.authState || "LOCKED",
      profile: {
        bidderId: String(p.bidderId),
        email: String(p.email || ""),
        address: String(p.address || ""),
        companyName: String(p.companyName || ""),
        representativeName: String(p.representativeName || ""),
        contactName: String(p.contactName || ""),
        contactInfo: String(p.contactInfo || "")
      },
      lines: lines,
      updatedAt: new Date().toISOString()
    };
  };

})(window);