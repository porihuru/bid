// [JST 2026-01-21 19:00]  bidder/js/04_bidder_db.js  v20260121-01
// [BID-04] Firestoreアクセス層（Edge95 / firebase compat）
//   - 「誰でも入れる」方針のため、Authは必須にしない（Firestoreのみで動作可）
(function (global) {
  var BID = global.BID = global.BID || {};

  // =========================================================
  // [04-01] Firebase前提（firebase compat: global firebase）
  //   - firebase.initializeApp(...) 済み
  //   - firebase.firestore() が使える想定
  //   - firebase.auth() は「あれば使う」程度（無くても動く）
  // =========================================================
  function hasFirebaseFirestore() {
    return (typeof firebase !== "undefined") && firebase.firestore;
  }

  function hasFirebaseAuth() {
    return (typeof firebase !== "undefined") && firebase.auth;
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
    // ---------------------------------------------------------
    // [04-03] 初期チェック（Firestoreのみ必須）
    // ---------------------------------------------------------
    ensure: function () {
      if (!hasFirebaseFirestore()) {
        throw new Error("Firebaseが初期化されていません（firebase.firestore が見つかりません）。");
      }
    },

    // ---------------------------------------------------------
    // [04-04] ★追加★ Firestore インスタンス取得（07_bidder_offer.js と整合）
    // ---------------------------------------------------------
    getDB: function () {
      BID.DB.ensure();
      return firebase.firestore();
    },

    // ---------------------------------------------------------
    // [04-05] （互換）ログイン監視：Authがある場合のみ
    //   ※「誰でも入れる」では必須ではない
    // ---------------------------------------------------------
    onAuthStateChanged: function (cb) {
      if (!hasFirebaseAuth()) {
        // auth無し運用：即時に null を返す
        if (cb) cb(null);
        return function () {};
      }
      return firebase.auth().onAuthStateChanged(cb);
    },

    // ---------------------------------------------------------
    // [04-06] （互換）users/{uid} 取得：Auth前提機能（未使用なら呼ばない）
    // ---------------------------------------------------------
    getUserDoc: function (uid) {
      BID.DB.ensure();
      return firebase.firestore().collection("users").doc(uid).get()
        .then(function (snap) {
          if (!snap.exists) return null;
          return snap.data();
        });
    },

    // ---------------------------------------------------------
    // [04-07] bids/{bidNo} 取得
    // ---------------------------------------------------------
    getBid: function (bidNo) {
      BID.DB.ensure();
      return firebase.firestore().collection("bids").doc(bidNo).get()
        .then(function (snap) {
          if (!snap.exists) return null;
          return snap.data();
        });
    },

    // ---------------------------------------------------------
    // [04-08] bids/{bidNo}/items 全件（seq昇順）
    // ---------------------------------------------------------
    getItems: function (bidNo) {
      BID.DB.ensure();
      return firebase.firestore().collection("bids").doc(bidNo).collection("items").get()
        .then(function (qs) {
          var arr = [];
          qs.forEach(function (doc) {
            var d = doc.data() || {};
            arr.push(d);
          });
          arr.sort(function (a, b) { return Number(a.seq) - Number(b.seq); });
          return arr;
        });
    },

    // ---------------------------------------------------------
    // [04-09] offers 読込: bids/{bidNo}/offers/{bidderId}
    // ---------------------------------------------------------
    getOffer: function (bidNo, bidderId) {
      BID.DB.ensure();
      var sub = BID.CONFIG.OFFERS_SUBCOL || "offers";
      return firebase.firestore().collection("bids").doc(bidNo).collection(sub).doc(String(bidderId)).get()
        .then(function (snap) {
          if (!snap.exists) return null;
          return snap.data();
        });
    },

    // ---------------------------------------------------------
    // [04-10] offers 上書き保存（open中のみ：rulesで制御）
    //   - 誰でも入れる運用：Authが無い場合も落ちないようにする
    // ---------------------------------------------------------
    upsertOffer: function (bidNo, bidderId, payload) {
      BID.DB.ensure();
      var sub = BID.CONFIG.OFFERS_SUBCOL || "offers";
      var ref = firebase.firestore().collection("bids").doc(bidNo).collection(sub).doc(String(bidderId));

      return ref.get().then(function (snap) {
        var exists = snap.exists;
        var base = payload || {};

        // createdAt は初回のみ付与（既存があれば維持）
        if (!exists) {
          base.createdAt = nowIso();
        } else {
          try {
            var old = snap.data() || {};
            if (old.createdAt) base.createdAt = old.createdAt;
          } catch (e) {}
        }

        base.updatedAt = nowIso();

        // 集計・監査のため冗長に入れる（キーと同じでもOK）
        base.bidNo = String(bidNo);
        base.bidderId = String(bidderId);   // ★主キー
        base.bidderNo = String(bidderId);   // ★互換（旧名が残っても困らないように）

        // auth があれば uid を入れる（無ければ空）
        var uid = "";
        try {
          if (hasFirebaseAuth() && firebase.auth().currentUser && firebase.auth().currentUser.uid) {
            uid = firebase.auth().currentUser.uid;
          }
        } catch (e) {}
        base.updatedByUid = uid;

        // set(..., {merge:true}) で上書き更新
        return ref.set(base, { merge: true }).then(function () {
          return { ok: true, exists: exists };
        });
      });
    },

    // ---------------------------------------------------------
    // [04-11] bidsのnote5（認証コード）取得（フォールバック：旧note）
    // ---------------------------------------------------------
    getAuthCodeFromBid: function (bidDoc) {
      var k = (BID.CONFIG && BID.CONFIG.NOTE_KEYS) ? BID.CONFIG.NOTE_KEYS : {};
      var code = getNote(bidDoc, k.note5 || "note5");
      if (code) return code;

      // 旧データフォールバック
      var legacy = getNote(bidDoc, k.legacyNote || "note");
      return legacy || "";
    },

    // ---------------------------------------------------------
    // [04-12] note1-4 表示用（旧noteしかない場合はnote1へ寄せる）
    // ---------------------------------------------------------
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