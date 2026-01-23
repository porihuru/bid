// [JST 2026-01-23 22:10] bidder/js/07_bidder_offer.js v20260123-01
// [BID-07] 入札（offers）: 単価入力の反映/収集 + 保存ペイロード生成
// 目的:
//  - renderItems() が呼ぶ BID.Offer.applyLinesToTable を必ず提供（エラー潰し）
//  - 保存時に単価未入力/不正値を検知して「理由」を必ず返す
//  - payload を統一: { bidderId, profile, lines }

(function (global) {
  var BID = global.BID = global.BID || {};
  BID.Offer = BID.Offer || {};

  function el(id) { return document.getElementById(id); }
  function trim(s) { return (s == null) ? "" : String(s).replace(/^\s+|\s+$/g, ""); }

  function log(msg) {
    try { if (BID.Log && BID.Log.write) BID.Log.write(msg); } catch (e) {}
  }
  function uiErr(msg) {
    try { if (BID.Render && BID.Render.setError) BID.Render.setError(msg); } catch (e) {}
  }

  // =========================================================
  // [BID-07-01] テーブルへ反映（lines: { "1": 123, "2": 456, ... }）
  // =========================================================
  BID.Offer.applyLinesToTable = function (lines) {
    try {
      lines = lines || {};
      var st = (BID.State && BID.State.get) ? BID.State.get() : null;
      var items = st && st.items ? st.items : [];

      for (var i = 0; i < items.length; i++) {
        var seq = String(items[i].seq);
        var ip = el("unitPrice_" + seq);
        if (!ip) continue;

        var v = (lines[seq] != null) ? lines[seq] : "";
        ip.value = (v == null) ? "" : String(v);
      }
      log("[offer] applyLinesToTable OK");
    } catch (e) {
      log("[offer] applyLinesToTable ERROR: " + (e && e.message ? e.message : e));
    }
  };

  // =========================================================
  // [BID-07-02] テーブルから収集（数値化）
  // ルール:
  //  - 全品目で「入札単価」は必須（未入力があればNG）
  //  - 数値でない場合はNG
  // =========================================================
  function collectLinesRequired() {
    var st = BID.State.get();
    var items = st.items || [];
    var lines = {};

    for (var i = 0; i < items.length; i++) {
      var seq = String(items[i].seq);
      var ip = el("unitPrice_" + seq);
      var raw = ip ? trim(ip.value) : "";

      if (!raw) {
        return { ok: false, reason: "単価が未入力です（seq=" + seq + "）。" };
      }

      // カンマ除去（1,234対応）
      var norm = raw.replace(/,/g, "");
      // 数値判定
      if (!/^\d+(\.\d+)?$/.test(norm)) {
        return { ok: false, reason: "単価が数値ではありません（seq=" + seq + " / 入力=" + raw + "）。" };
      }

      lines[seq] = Number(norm);
    }

    return { ok: true, lines: lines };
  }

  // =========================================================
  // [BID-07-03] 保存payload生成（submitが呼ぶ）
  // payload:
  //   bidderId: 入札者番号（inpBidderId）
  //   profile:  入札者情報（必須6項目＋bidderId）
  //   lines:    単価 {seq: number}
  // =========================================================
  BID.Offer.buildOfferPayload = function () {
    try {
      // 入札者番号
      var bidderId = trim(el("inpBidderId") ? el("inpBidderId").value : "");
      if (!bidderId) {
        uiErr("保存できません：入札者番号が未入力です。");
        log("[save] NG: bidderId empty");
        return null;
      }

      // profile（06_profile.jsのAPIに合わせる）
      if (!BID.Profile || !BID.Profile.readFromUI || !BID.Profile.validate) {
        uiErr("内部エラー：Profileモジュールが未読込です（06_bidder_profile.js）。");
        log("[save] NG: Profile module missing");
        return null;
      }

      var p = BID.Profile.readFromUI();
      // 念のため bidderId を上書き
      p.bidderId = bidderId;

      var perr = BID.Profile.validate(p); // 文字列（空ならOK）
      if (perr) {
        uiErr("保存できません：" + perr);
        log("[save] NG: profile invalid: " + perr);
        return null;
      }

      // lines
      var cl = collectLinesRequired();
      if (!cl.ok) {
        uiErr("保存できません：" + cl.reason);
        log("[save] NG: lines invalid: " + cl.reason);
        return null;
      }

      return {
        bidderId: bidderId,
        profile: {
          bidderId: bidderId,
          email: p.email || "",
          address: p.address || "",
          companyName: p.companyName || "",
          representativeName: p.representativeName || "",
          contactName: p.contactName || "",
          contactInfo: p.contactInfo || ""
        },
        lines: cl.lines
      };
    } catch (e) {
      uiErr("保存できません：内部エラー " + (e && e.message ? e.message : e));
      log("[save] ERROR: " + (e && e.message ? e.message : e));
      return null;
    }
  };

})(window);
