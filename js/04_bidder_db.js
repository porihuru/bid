// [JST 2026-01-23 22:30] js/04_bidder_db.js v20260123-01
// [BID-04] Firestore I/O
(function (global) {
  var BID = global.BID = global.BID || {};

  function hasFirebase() {
    return (typeof firebase !== "undefined") && firebase.auth && firebase.firestore;
  }
  function nowIso(){ return new Date().toISOString(); }

  function getNote(bid, key) {
    if (!bid) return "";
    return (bid[key] != null) ? String(bid[key]) : "";
  }

  BID.DB = {
    ensure: function () {
      if (!hasFirebase()) throw new Error("Firebaseが初期化されていません（compatの読み込み順を確認）。");
    },

    auth: function () {
      BID.DB.ensure();
      return firebase.auth();
    },

    fs: function () {
      BID.DB.ensure();
      return firebase.firestore();
    },

    // bids/{bidNo}
    getBid: function (bidNo) {
      return BID.DB.fs().collection("bids").doc(String(bidNo)).get().then(function (snap) {
        if (!snap.exists) return null;
        return snap.data();
      });
    },

    // bids/{bidNo}/items
    getItems: function (bidNo) {
      return BID.DB.fs().collection("bids").doc(String(bidNo)).collection("items").get().then(function (qs) {
        var arr = [];
        qs.forEach(function (doc) {
          var d = doc.data() || {};
          arr.push(d);
        });
        arr.sort(function (a, b) { return Number(a.seq) - Number(b.seq); });
        return arr;
      });
    },

    // offers
    getOffer: function (bidNo, bidderId) {
      var sub = BID.CONFIG.OFFERS_SUBCOL || "offers";
      return BID.DB.fs().collection("bids").doc(String(bidNo)).collection(sub).doc(String(bidderId)).get()
        .then(function (snap) {
          if (!snap.exists) return null;
          return snap.data();
        });
    },

    upsertOffer: function (bidNo, bidderId, payload) {
      var sub = BID.CONFIG.OFFERS_SUBCOL || "offers";
      var ref = BID.DB.fs().collection("bids").doc(String(bidNo)).collection(sub).doc(String(bidderId));

      return ref.get().then(function (snap) {
        var exists = snap.exists;
        var base = payload || {};
        if (!exists) base.createdAt = nowIso();
        else {
          try {
            var old = snap.data() || {};
            if (old.createdAt) base.createdAt = old.createdAt;
          } catch (e) {}
        }
        base.updatedAt = nowIso();
        base.bidNo = String(bidNo);
        base.bidderId = String(bidderId);
        base.updatedByUid = (BID.DB.auth().currentUser && BID.DB.auth().currentUser.uid) ? BID.DB.auth().currentUser.uid : "";

        return ref.set(base, { merge: true }).then(function () {
          return { ok: true, exists: exists };
        });
      });
    },

    // 認証コード（備考5）
    getAuthCodeFromBid: function (bidDoc) {
      var k = (BID.CONFIG && BID.CONFIG.NOTE_KEYS) ? BID.CONFIG.NOTE_KEYS : {};
      var code = getNote(bidDoc, k.note5 || "note5");
      if (code) return code;
      var legacy = getNote(bidDoc, k.legacyNote || "note");
      return legacy || "";
    },

    // 公開備考1-4
    getPublicNotesFromBid: function (bidDoc) {
      var k = (BID.CONFIG && BID.CONFIG.NOTE_KEYS) ? BID.CONFIG.NOTE_KEYS : {};
      var n1 = getNote(bidDoc, k.note1 || "note1");
      var n2 = getNote(bidDoc, k.note2 || "note2");
      var n3 = getNote(bidDoc, k.note3 || "note3");
      var n4 = getNote(bidDoc, k.note4 || "note4");
      if (!n1 && !n2 && !n3 && !n4) n1 = getNote(bidDoc, k.legacyNote || "note");
      return { note1: n1, note2: n2, note3: n3, note4: n4 };
    }
  };

  try { if (BID.Log && BID.Log.ver) BID.Log.ver("04_bidder_db.js", "v20260123-01"); } catch (e) {}
})(window);
