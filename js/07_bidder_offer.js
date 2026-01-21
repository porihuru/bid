// [JST 2026-01-21 19:00] 07_bidder_offer.js  v20260121-01
// [BID-07] 入札（offers）: 単価入力・保存・読込
(function (global) {
  var BID = global.BID = global.BID || {};

  // =========================================================
  // [BID-07-01] Firestore パス生成
  // =========================================================
  function offerDocRef(db, bidNo, bidderId) {
    return db.collection("bids").doc(bidNo).collection("offers").doc(bidderId);
  }

  // =========================================================
  // [BID-07-02] offers 読込（入力済データの読み込み用）
  // =========================================================
  BID.Offer = BID.Offer || {};
  BID.Offer.load = function (bidNo, bidderId) {
    var db = BID.DB.getDB();
    return offerDocRef(db, bidNo, bidderId).get().then(function (snap) {
      if (!snap.exists) return null;
      return snap.data();
    });
  };

  // =========================================================
  // [BID-07-03] offers 保存（open中は上書きOK）
  // - bidderId（入札者番号）をキーに関連付け
  // - profile（業者情報）を同梱 → 集計で正確に出る
  // =========================================================
  BID.Offer.save = function (bidNo, bidderId, authCode, profile, lines) {
    var db = BID.DB.getDB();

    // [BID-07-03-01] 保存ドキュメント（集計に必要な情報を同梱）
    var doc = {
      bidderId: bidderId,                 // 冗長だが、集計・監査で便利
      authCode: authCode || "",           // ※不要なら後で削除可（最小修正のため保持）
      profile: {
        email: (profile && profile.email) ? profile.email : "",
        address: (profile && profile.address) ? profile.address : "",
        companyName: (profile && profile.companyName) ? profile.companyName : "",
        representativeName: (profile && profile.representativeName) ? profile.representativeName : "",
        contactName: (profile && profile.contactName) ? profile.contactName : "",
        contactInfo: (profile && profile.contactInfo) ? profile.contactInfo : ""
      },
      lines: lines || {},                 // { "1": 123, "2": 456, ... }
      updatedAt: new Date().toISOString()
    };

    // [BID-07-03-02] set(merge:true) で上書き更新
    return offerDocRef(db, bidNo, bidderId).set(doc, { merge: true });
  };

})(window);