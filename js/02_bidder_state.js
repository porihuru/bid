// [JST 2026-01-20 19:00]  bidder/js/02_bidder_state.js  v20260120-01
(function (global) {
  var BID = global.BID = global.BID || {};

  // =========================================================
  // [02-01] 画面状態（単一のstateに集約：修正点を最小にする）
  // =========================================================
  var state = {
    // [02-02] auth
    user: null,
    uid: "",
    role: "",
    bidderNo: "",

    // [02-03] bid
    bidNo: "",
    bid: null,          // bids/{bidNo} の生データ
    bidStatus: "",

    // [02-04] items
    items: [],

    // [02-05] auth state
    authState: "LOCKED",  // LOCKED / UNLOCKED

    // [02-06] profile state
    profile: {
      email: "",
      address: "",
      companyName: "",
      representativeName: "",
      contactName: "",
      contactInfo: ""
    },
    profileState: "INCOMPLETE", // INCOMPLETE / COMPLETE

    // [02-07] offer
    offer: null,         // offers/{bidderNo}
    offerExists: false,
    offerLines: {},      // { "1": {unitPrice: 123}, ... }

    // [02-08] mode
    viewOnly: false,     // closed等の完全閲覧
    inputEnabled: false, // 単価入力・保存が可能か

    // [02-09] timestamps
    lastLoadedAt: "",
    lastSavedAt: ""
  };

  // =========================================================
  // [02-10] 公開API
  // =========================================================
  BID.State = {
    get: function () { return state; },

    // [02-11] 初期化
    initBidNo: function () {
      state.bidNo = (BID.CONFIG && BID.CONFIG.BID_NO) ? BID.CONFIG.BID_NO : "";
    },

    // [02-12] ログイン状態
    setUser: function (user) {
      state.user = user || null;
      state.uid = user ? (user.uid || "") : "";
    },

    // [02-13] users/{uid} 由来
    setUserProfileFromDb: function (role, bidderNo) {
      state.role = role || "";
      state.bidderNo = bidderNo || "";
    },

    // [02-14] bid 読込結果
    setBid: function (bidDoc) {
      state.bid = bidDoc || null;
      state.bidStatus = bidDoc ? (bidDoc.status || "") : "";
    },

    // [02-15] items
    setItems: function (itemsArr) {
      state.items = itemsArr || [];
    },

    // [02-16] auth lock
    setAuthState: function (lockedOrUnlocked) {
      state.authState = lockedOrUnlocked || "LOCKED";
    },

    // [02-17] profile
    setProfile: function (p) {
      p = p || {};
      state.profile.email = p.email || "";
      state.profile.address = p.address || "";
      state.profile.companyName = p.companyName || "";
      state.profile.representativeName = p.representativeName || "";
      state.profile.contactName = p.contactName || "";
      state.profile.contactInfo = p.contactInfo || "";
    },

    // [02-18] profile state
    setProfileState: function (s) {
      state.profileState = s || "INCOMPLETE";
    },

    // [02-19] offer
    setOffer: function (offerDocOrNull) {
      state.offer = offerDocOrNull || null;
      state.offerExists = !!offerDocOrNull;
      state.offerLines = (offerDocOrNull && offerDocOrNull.lines) ? offerDocOrNull.lines : {};
    },

    // [02-20] mode
    setViewOnly: function (b) {
      state.viewOnly = !!b;
    },
    setInputEnabled: function (b) {
      state.inputEnabled = !!b;
    },

    // [02-21] timestamps
    setLastLoadedAt: function (iso) { state.lastLoadedAt = iso || ""; },
    setLastSavedAt: function (iso) { state.lastSavedAt = iso || ""; }
  };
})(window);