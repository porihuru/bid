// [JST 2026-01-23 22:30] js/02_bidder_state.js v20260123-01
// [BID-02] 状態管理（ログイン→認証→入力）
(function (global) {
  var BID = global.BID = global.BID || {};

  var state = {
    bidNo: "",

    // firebase user
    user: null,
    loginState: "SIGNED_OUT", // SIGNED_OUT / SIGNED_IN

    // bidderId（=入札者ID）
    bidderId: "",

    // bid/items
    bid: null,
    bidStatus: "",
    items: [],

    // offer
    offer: null,
    offerLines: {},

    // auth
    authState: "LOCKED",

    // profile
    profile: {
      bidderId: "",
      email: "",
      address: "",
      companyName: "",
      representativeName: "",
      contactName: "",
      contactInfo: ""
    },
    profileState: "INCOMPLETE",

    // mode
    viewOnly: false,
    inputEnabled: false,

    // times
    lastLoadedAt: "",
    lastSavedAt: ""
  };

  function safeLog(s) { try { if (BID.Log && BID.Log.write) BID.Log.write(s); } catch (e) {} }

  BID.State = {
    get: function () { return state; },

    initBidNo: function () {
      var fromConfig = (BID.CONFIG && BID.CONFIG.BID_NO) ? String(BID.CONFIG.BID_NO) : "";
      state.bidNo = fromConfig;
      if (!state.bidNo) {
        safeLog("[config] ERROR: BID_NO empty (js/01_bidder_config.js)");
      } else {
        safeLog("[config] BID_NO=" + state.bidNo);
      }
    },

    setUser: function (user) {
      state.user = user || null;
      state.loginState = user ? "SIGNED_IN" : "SIGNED_OUT";
      safeLog("[state] setUser: " + (user ? ("SIGNED_IN uid=" + user.uid) : "SIGNED_OUT"));
    },

    setBidderId: function (bidderId) {
      state.bidderId = bidderId || "";
      safeLog("[state] setBidderId: " + (state.bidderId || "(empty)"));
    },

    // bid/items
    setBid: function (bid) {
      state.bid = bid || null;
      state.bidStatus = (bid && bid.status) ? String(bid.status) : "";
      safeLog("[state] setBid: status=" + (state.bidStatus || "(none)"));
    },
    setItems: function (items) {
      state.items = items || [];
      safeLog("[state] setItems: " + state.items.length);
    },

    // offer
    setOffer: function (offer) {
      state.offer = offer || null;
      try { state.offerLines = (offer && offer.lines) ? offer.lines : {}; } catch (e) { state.offerLines = {}; }
      safeLog("[state] setOffer: " + (offer ? "exists" : "null"));
    },
    setOfferLines: function (lines) {
      state.offerLines = lines || {};
      safeLog("[state] setOfferLines");
    },

    // auth
    setAuthState: function (s) {
      state.authState = s || "LOCKED";
      safeLog("[state] setAuthState: " + state.authState);
    },

    // profile
    setProfile: function (p) {
      p = p || {};
      state.profile.bidderId = (p.bidderId != null) ? String(p.bidderId) : "";
      state.profile.email = (p.email != null) ? String(p.email) : "";
      state.profile.address = (p.address != null) ? String(p.address) : "";
      state.profile.companyName = (p.companyName != null) ? String(p.companyName) : "";
      state.profile.representativeName = (p.representativeName != null) ? String(p.representativeName) : "";
      state.profile.contactName = (p.contactName != null) ? String(p.contactName) : "";
      state.profile.contactInfo = (p.contactInfo != null) ? String(p.contactInfo) : "";
      safeLog("[state] setProfile: bidderId=" + (state.profile.bidderId || "(empty)"));
    },

    setProfileState: function (s) {
      state.profileState = s || "INCOMPLETE";
      safeLog("[state] setProfileState: " + state.profileState);
    },

    // mode
    setViewOnly: function (yes) {
      state.viewOnly = !!yes;
      safeLog("[state] setViewOnly: " + (state.viewOnly ? "true" : "false"));
    },
    setInputEnabled: function (yes) {
      state.inputEnabled = !!yes;
      safeLog("[state] setInputEnabled: " + (state.inputEnabled ? "true" : "false"));
    },

    // times
    setLastLoadedAt: function (iso) { state.lastLoadedAt = iso || ""; },
    setLastSavedAt: function (iso) { state.lastSavedAt = iso || ""; }
  };

  try { if (BID.Log && BID.Log.ver) BID.Log.ver("02_bidder_state.js", "v20260123-01"); } catch (e) {}
})(window);
