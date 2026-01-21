// [JST 2026-01-20 19:00]  bidder/js/04_bidder_db.js  v20260120-01
(function (global) {
  var BID = global.BID = global.BID || {};

  // =========================================================
  // [04-01] Firebase前提（firebase compat: global firebase）
  //   - firebase.initializeApp(...) 済み
  //   - firebase.auth(), firebase.firestore() が使える想定
  // =========================================================
  function hasFirebase() {
    return (typeof firebase !== "undefined") && firebase.auth && firebase.firestore;
  }

  function nowIso() { return new Date().toISOString(); }

  function getNote(bid, key) {
    if (!bid) return "";
    return (bid[key] != null) ? String(bid[key]) : "";
  }

  // =========================================================
  // [04-02] DB API
  // =========================================================
  BID.DB = {
    // [04-03] 初期チェック
    ensure: function () {
      if (!hasFirebase()) {
        throw new Error("Firebaseが初期化されていません（firebase auth/firestore が見つかりません）。");
      }
    },

    // [04-04] ログイン監視
    onAuthStateChanged: function (cb) {
      BID.DB.ensure();
      return firebase.auth().onAuthStateChanged(cb);
    },

    // [04-05] users/{uid} 取得（role/bidderNo）
    getUserDoc: function (uid) {
      BID.DB.ensure();
      return firebase.firestore().collection("users").doc(uid).get()
        .then(function (snap) {
          if (!snap.exists) return null;
          return snap.data();
        });
    },

    // [04-06] bids/{bidNo} 取得
    getBid: function (bidNo) {
      BID.DB.ensure();
      return firebase.firestore().collection("bids").doc(bidNo).get()
        .then(function (snap) {
          if (!snap.exists) return null;
          return snap.data();
        });
    },

    // [04-07] bids/{bidNo}/items 全件（seq昇順）
    getItems: function (bidNo) {
      BID.DB.ensure();
      return firebase.firestore().collection("bids").doc(bidNo).collection("items").get()
        .then(function (qs) {
          var arr = [];
          qs.forEach(function (doc) {
            var d = doc.data() || {};
            arr.push(d);
          });
          // seq昇順
          arr.sort(function (a, b) { return Number(a.seq) - Number(b.seq); });
          return arr;
        });
    },

    // [04-08] offers 読込: bids/{bidNo}/offers/{bidderNo}
    getOffer: function (bidNo, bidderNo) {
      BID.DB.ensure();
      var sub = BID.CONFIG.OFFERS_SUBCOL || "offers";
      return firebase.firestore().collection("bids").doc(bidNo).collection(sub).doc(String(bidderNo)).get()
        .then(function (snap) {
          if (!snap.exists) return null;
          return snap.data();
        });
    },

    // [04-09] offers 上書き保存（open中のみ：rulesで制御）
    upsertOffer: function (bidNo, bidderNo, payload, isCreateIfMissing) {
      BID.DB.ensure();
      var sub = BID.CONFIG.OFFERS_SUBCOL || "offers";
      var ref = firebase.firestore().collection("bids").doc(bidNo).collection(sub).doc(String(bidderNo));

      // [04-10] createdAt維持（既存があるなら上書きしない）
      return ref.get().then(function (snap) {
        var exists = snap.exists;
        var base = payload || {};
        if (!exists) {
          base.createdAt = nowIso();
        } else {
          // 既存 createdAt があるなら残す
          try {
            var old = snap.data() || {};
            if (old.createdAt) base.createdAt = old.createdAt;
          } catch (e) {}
        }
        base.updatedAt = nowIso();
        base.bidNo = String(bidNo);
        base.bidderNo = String(bidderNo);
        base.updatedByUid = (firebase.auth().currentUser && firebase.auth().currentUser.uid) ? firebase.auth().currentUser.uid : "";

        // set(..., {merge:true}) で上書き更新
        return ref.set(base, { merge: true }).then(function () {
          return { ok: true, exists: exists };
        });
      });
    },

    // [04-11] bidsのnote5（認証コード）取得（フォールバック：旧note）
    getAuthCodeFromBid: function (bidDoc) {
      var k = (BID.CONFIG && BID.CONFIG.NOTE_KEYS) ? BID.CONFIG.NOTE_KEYS : {};
      var code = getNote(bidDoc, k.note5 || "note5");
      if (code) return code;

      // 旧データフォールバック
      var legacy = getNote(bidDoc, k.legacyNote || "note");
      return legacy || "";
    },

    // [04-12] note1-4 表示用（旧noteしかない場合はnote1へ寄せる）
    getPublicNotesFromBid: function (bidDoc) {
      var k = (BID.CONFIG && BID.CONFIG.NOTE_KEYS) ? BID.CONFIG.NOTE_KEYS : {};
      var n1 = getNote(bidDoc, k.note1 || "note1");
      var n2 = getNote(bidDoc, k.note2 || "note2");
      var n3 = getNote(bidDoc, k.note3 || "note3");
      var n4 = getNote(bidDoc, k.note4 || "note4");

      // 旧データ（noteのみ）の場合、note1に入れる
      if (!n1 && !n2 && !n3 && !n4) {
        n1 = getNote(bidDoc, k.legacyNote || "note");
      }
      return { note1: n1, note2: n2, note3: n3, note4: n4 };
    }
  };
})(window);