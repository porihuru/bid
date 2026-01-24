// [JST 2026-01-24 21:00] bidder/js/02_bidder_state.js v20260124-01
// [BID-02] 状態管理（bidNo固定・ログイン→認証→入力可否）
(function (global) {
  var BID = global.BID = global.BID || {};

  if (BID.Build && BID.Build.register) BID.Build.register("02_bidder_state.js", "v20260124-01");

  var state = {
    // [02-01] 固定入札番号
    bidNo: "",

    // [02-02] Firebaseログイン状態
    user: null,
    loginState: "SIGNED-OUT", // SIGNED-OUT / SIGNED-IN
    bidderId: "",             // 入札者ID（ユーザー入力）
    bidderNo: "",             // 入札者番号（＝入札者ID）

    // [02-03] 入札データ
    bid: null,
    bidStatus: "",

    // [02-04] 品目
    items: [],

    // [02-05] offers（入札者の保存データ）
    offer: null,
    offerLines: {},

    // [02-06] 入札認証状態（備考5）
    authState: "LOCKED", // LOCKED / UNLOCKED

    // [02-07] 入札者情報
    profile: {
      email: "",
      address: "",
      companyName: "",
      representativeName: "",
      contactName: "",
      contactInfo: ""
    },
    profileState: "INCOMPLETE", // INCOMPLETE / COMPLETE

    // [02-08] 画面モード
    viewOnly: false,
    inputEnabled: false,

    // [02-09] 時刻
    lastLoadedAt: "",
    lastSavedAt: ""
  };

  function nowIso() { return new Date().toISOString(); }

  function safeLog(msg) {
    try { if (BID.Log && BID.Log.write) BID.Log.write(msg); } catch (e) {}
  }
  function safeError(msg) {
    try { if (BID.Render && BID.Render.setError) BID.Render.setError(msg); } catch (e) {}
  }

  BID.State = {
    get: function () { return state; },

    // [02-10] bidNo 初期化
    initBidNo: function () {
      var fromConfig = (BID.CONFIG && BID.CONFIG.BID_NO) ? String(BID.CONFIG.BID_NO) : "";
      state.bidNo = fromConfig;
      if (!state.bidNo) {
        safeError("入札番号が未設定です。js/01_bidder_config.js の BID.CONFIG.BID_NO を設定してください。");
        safeLog("[config] ERROR: BID_NO is empty.");
      } else {
        safeLog("[config] BID_NO=" + state.bidNo);
      }
    },

    // [02-11] ログイン関連
    setUser: function (user) {
      state.user = user || null;
      state.loginState = user ? "SIGNED-IN" : "SIGNED-OUT";
      safeLog("[state] setUser: " + (user ? ("uid=" + user.uid) : "null"));
    },
    setBidderId: function (bidderId) {
      state.bidderId = String(bidderId || "");
      state.bidderNo = state.bidderId; // 同一ルール
      safeLog("[state] setBidderId: " + (state.bidderId || "(empty)"));
    },

    // [02-12] bid / items / offer
    setBid: function (bid) {
      state.bid = bid || null;
      state.bidStatus = (bid && bid.status) ? String(bid.status) : "";
      safeLog("[state] setBid: status=" + (state.bidStatus || "(empty)"));
    },
    setItems: function (items) {
      state.items = items || [];
      safeLog("[state] setItems: " + state.items.length);
    },
    setOffer: function (offer) {
      state.offer = offer || null;
      try { state.offerLines = (offer && offer.lines) ? offer.lines : {}; }
      catch (e) { state.offerLines = {}; }
      safeLog("[state] setOffer: " + (offer ? "exists" : "null"));
    },
    setOfferLines: function (lines) {
      state.offerLines = lines || {};
      safeLog("[state] setOfferLines");
    },

    // [02-13] 認証
    setAuthState: function (s) {
      state.authState = s || "LOCKED";
      safeLog("[state] setAuthState: " + state.authState);
    },

    // [02-14] profile
    setProfile: function (p) {
      p = p || {};
      state.profile.email = (p.email != null) ? String(p.email) : "";
      state.profile.address = (p.address != null) ? String(p.address) : "";
      state.profile.companyName = (p.companyName != null) ? String(p.companyName) : "";
      state.profile.representativeName = (p.representativeName != null) ? String(p.representativeName) : "";
      state.profile.contactName = (p.contactName != null) ? String(p.contactName) : "";
      state.profile.contactInfo = (p.contactInfo != null) ? String(p.contactInfo) : "";
      safeLog("[state] setProfile");
    },
    setProfileState: function (s) {
      state.profileState = s || "INCOMPLETE";
      safeLog("[state] setProfileState: " + state.profileState);
    },

    // [02-15] mode
    setViewOnly: function (yes) {
      state.viewOnly = !!yes;
      safeLog("[state] setViewOnly: " + (state.viewOnly ? "true" : "false"));
    },
    setInputEnabled: function (yes) {
      state.inputEnabled = !!yes;
      safeLog("[state] setInputEnabled: " + (state.inputEnabled ? "true" : "false"));
    },

    // [02-16] timestamps
    setLastLoadedAt: function (iso) { state.lastLoadedAt = iso || nowIso(); safeLog("[state] lastLoadedAt=" + state.lastLoadedAt); },
    setLastSavedAt: function (iso) { state.lastSavedAt = iso || nowIso(); safeLog("[state] lastSavedAt=" + state.lastSavedAt); }
  };

})(window);
