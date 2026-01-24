// [JST 2026-01-23 22:30] js/01_bidder_config.js v20260123-01
// [BID-01] 設定（入札番号固定・ログイン方式）
(function (global) {
  var BID = global.BID = global.BID || {};
  BID.CONFIG = {
    // ★ここに固定入札番号を入れる★
    BID_NO: "2026003",

    // 入札認証（備考5）
    MSG_AUTH_PROMPT: "認証コードを入力してください。",

    // Firebase Auth：入札者ID → email化
    AUTH_EMAIL_DOMAIN: "bid.local",

    // bids の備考キー
    NOTE_KEYS: {
      note1: "note1",
      note2: "note2",
      note3: "note3",
      note4: "note4",
      note5: "note5",
      legacyNote: "note"
    },

    STATUS_LABELS: {
      draft: "draft（準備中）",
      open: "open（入札中）",
      closed: "closed（終了）"
    },

    OFFERS_SUBCOL: "offers"
  };

  // version log（03_log.js が先に来る場合もあるので安全に）
  try { if (BID.Log && BID.Log.ver) BID.Log.ver("01_bidder_config.js", "v20260123-01"); } catch (e) {}
})(window);
