// [JST 2026-01-24 21:00] bidder/js/04_bidder_db.js v20260124-01
// [BID-04] Firestoreアクセス（bids / items / offers / note1-5）
(function (global) {
  var BID = global.BID = global.BID || {};
  if (BID.Build && BID.Build.register) BID.Build.register("04_bidder_db.js", "v20260124-01");

  function hasFirebase() {
    return (typeof firebase !== "undefined") && firebase.auth && firebase.firestore;
  }

  function nowIso() { return new Date().toISOString(); }

  function getNote(bid, key) {
    if (!bid) return "";
    return (bid[key] != null) ? String(bid[key]) : "";
  }

  BID.DB = {
    // [04-01] 前提チェック
    ensure: function () {
      if (!hasFirebase()) {
        throw new Error("Firebaseが初期化されていません（firebase auth/firestore が見つかりません）。");
      }
    },

    // [04-02] 認証監視
    onAuthStateChanged: function (cb) {
      BID.DB.ensure();
      return firebase.auth().onAuthStateChanged(cb);
    },

    // [04-03] ログイン
    signInWithBidderId: function (bidderId, password) {
      BID.DB.ensure();
      var suffix = (BID.CONFIG && BID.CONFIG.LOGIN_EMAIL_SUFFIX) ? String(BID.CONFIG.LOGIN_EMAIL_SUFFIX) : "@bid.local";
      var email = String(bidderId || "") + suffix;
      return firebase.auth().signInWithEmailAndPassword(email, String(password || ""));
    },

    // [04-04] ログアウト
    signOut: function () {
      BID.DB.ensure();
      return firebase.auth().signOut();
    },

    // [04-05] bids/{bidNo}
    getBid: function (bidNo) {
      BID.DB.ensure();
      return firebase.firestore().collection("bids").doc(String(bidNo)).get()
        .then(function (snap) {
          if (!snap.exists) return null;
          return snap.data();
        });
    },

    // [04-06] bids/{bidNo}/items（seq昇順）
    getItems: function (bidNo) {
      BID.DB.ensure();
      return firebase.firestore().collection("bids").doc(String(bidNo)).collection("items").get()
        .then(function (qs) {
          var arr = [];
          qs.forEach(function (doc) { arr.push(doc.data() || {}); });
          arr.sort(function (a, b) { return Number(a.seq) - Number(b.seq); });
          return arr;
        });
    },

    // [04-07] offers 読込: bids/{bidNo}/offers/{bidderNo}
    getOffer: function (bidNo, bidderNo) {
      BID.DB.ensure();
      var sub = BID.CONFIG.OFFERS_SUBCOL || "offers";
      return firebase.firestore().collection("bids").doc(String(bidNo)).collection(sub).doc(String(bidderNo)).get()
        .then(function (snap) {
          if (!snap.exists) return null;
          return snap.data();
        });
    },

    // [04-08] offers 上書き保存（rulesで open のみ許可）
    upsertOffer: function (bidNo, bidderNo, payload) {
      BID.DB.ensure();
      var sub = BID.CONFIG.OFFERS_SUBCOL || "offers";
      var ref = firebase.firestore().collection("bids").doc(String(bidNo)).collection(sub).doc(String(bidderNo));

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

        return ref.set(base, { merge: true }).then(function () {
          return { ok: true, exists: exists };
        });
      });
    },

    // [04-09] note5（認証コード）取得（旧noteフォールバック）
    getAuthCodeFromBid: function (bidDoc) {
      var k = (BID.CONFIG && BID.CONFIG.NOTE_KEYS) ? BID.CONFIG.NOTE_KEYS : {};
      var code = getNote(bidDoc, k.note5 || "note5");
      if (code) return code;
      return getNote(bidDoc, k.legacyNote || "note") || "";
    },

    // [04-10] note1-4 表示用（旧noteしかない場合はnote1へ寄せる）
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

})(window);
