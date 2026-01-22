// [JST 2026-01-20 19:00]  bidder/js/01_bidder_config.js  v20260120-01
(function (global) {
  // =========================================================
  // [01-01] 名前空間
  // =========================================================
  var BID = global.BID = global.BID || {};

  // =========================================================
  // [01-02] 固定設定（運用で変わるものは基本ここだけ）
  // =========================================================
  BID.CONFIG = {
    // [01-03] 単一入札固定（HTML内に固定する方針）
    BID_NO: "2026003",

    // [01-04] Firestore サブコレクション名
    OFFERS_SUBCOL: "offers",

    // [01-05] 文言（統一）
    MSG_AUTH_PROMPT: "認証コードを入力してください。",

    // [01-06] Cookie（入札者情報）キー
    COOKIE_PREFIX: "BIDDER_FORM_",
    COOKIE_DAYS: 180,

    // [01-07] UI表示（状態の日本語）
    STATUS_LABELS: {
      draft: "draft（準備中）",
      open: "open（入札中）",
      closed: "closed（終了）"
    },

    // [01-08] bidsヘッダーの備考キー（移行吸収）
    // note5 を正とする。旧データは note しかない場合があるのでフォールバックする。
    NOTE_KEYS: {
      note1: "note1",
      note2: "note2",
      note3: "note3",
      note4: "note4",
      note5: "note5",
      legacyNote: "note"
    }
  };
})(window);