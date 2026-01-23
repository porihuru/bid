// [JST 2026-01-22 22:05] bidder/js/02_bidder_state.js v20260122-01
// [BID-02] 状態管理（bidNo固定・ログイン不要対応）
//
// 目的:
//  - CONFIGのBID_NOを確実にstateへ取り込み「未設定」を潰す
//  - 認証状態や入力可否などを一元管理する
//
// 依存:
//  - js/01_bidder_config.js が先に読み込まれていること（BID.CONFIG.BID_NO）
//
// 変更履歴:
//  - [BID-02-10] initBidNo() で BID_NO を確実に取り込み、未設定なら画面エラー＆ログ
//  - [BID-02-11] setBid() で bidStatus を state に必ず反映（status未読込問題の対策）
//  - [BID-02-13] setOffer() で offer.lines を offerLines に展開（table反映用）

(function (global) {
  "use strict";

  var BID = global.BID = global.BID || {};

  // =========================================================
  // [BID-02-01] 内部state（単一ソース）
  // =========================================================
  var state = {
    // [BID-02-01-01] 固定入札番号（CONFIGからセット）
    bidNo: "",

    // [BID-02-01-02] 入札データ（bids/{bidNo}）
    bid: null,
    bidStatus: "",

    // [BID-02-01-03] 品目（bids/{bidNo}/items）
    items: [],

    // [BID-02-01-04] 入札者の保存データ（bids/{bidNo}/offers/{bidderId}）
    offer: null,
    offerLines: {},

    // [BID-02-01-05] 認証状態
    authState: "LOCKED", // LOCKED / UNLOCKED

    // [BID-02-01-06] 入札者情報（Cookie or offers から復元）
    profile: {
      bidderId: "",
      email: "",
      address: "",
      companyName: "",
      representativeName: "",
      contactName: "",
      contactInfo: ""
    },
    profileState: "INCOMPLETE", // INCOMPLETE / COMPLETE

    // [BID-02-01-07] 画面モード
    viewOnly: false,      // closed なら true
    inputEnabled: false,  // open + UNLOCKED + profile COMPLETE の時のみ true

    // [BID-02-01-08] 時刻（表示用）
    lastLoadedAt: "",
    lastSavedAt: ""
  };

  // =========================================================
  // [BID-02-02] セーフログ／セーフ表示（失敗しても止めない）
  // =========================================================
  function safeLog(msg) {
    try { if (BID.Log && BID.Log.write) BID.Log.write(msg); } catch (e) {}
  }
  function safeError(msg) {
    try { if (BID.Render && BID.Render.setError) BID.Render.setError(msg); } catch (e) {}
  }

  // =========================================================
  // [BID-02-03] API
  // =========================================================
  BID.State = {
    // [BID-02-03-01] getter
    get: function () { return state; },

    // =======================================================
    // [BID-02-10] bidNo 初期化（CONFIGから固定値を読む）
    // - 未設定なら即エラー＆ログ（要求: ダメならエラーを返す）
    // =======================================================
    initBidNo: function () {
      var fromConfig = (BID.CONFIG && BID.CONFIG.BID_NO) ? String(BID.CONFIG.BID_NO) : "";
      state.bidNo = fromConfig;

      if (!state.bidNo) {
        safeError("入札番号が未設定です。js/01_bidder_config.js の BID.CONFIG.BID_NO を設定してください。");
        safeLog("[config] ERROR: BID_NO is empty. check js/01_bidder_config.js and script load order.");
      } else {
        safeLog("[config] BID_NO=" + state.bidNo);
      }
    },

    // =======================================================
    // [BID-02-11] bid セット（bids/{bidNo}）
    // - ★重要：bidStatus を必ず展開して保持（「未読込」表示対策）
    // =======================================================
    setBid: function (bid) {
      state.bid = bid || null;
      state.bidStatus = (bid && bid.status != null) ? String(bid.status) : "";
      safeLog("[state] setBid: status=" + (state.bidStatus || "(empty)"));
    },

    // =======================================================
    // [BID-02-12] items セット
    // =======================================================
    setItems: function (items) {
      state.items = items || [];
      safeLog("[state] setItems: count=" + state.items.length);
    },

    // =======================================================
    // [BID-02-13] offer セット
    // - offer.lines を offerLines に展開（テーブル反映用）
    // =======================================================
    setOffer: function (offer) {
      state.offer = offer || null;
      try {
        state.offerLines = (offer && offer.lines) ? offer.lines : {};
      } catch (e) {
        state.offerLines = {};
      }
      safeLog("[state] setOffer: hasOffer=" + (!!state.offer) + " lines=" + Object.keys(state.offerLines || {}).length);
    },

    // =======================================================
    // [BID-02-14] offerLines セット（テーブル入力から作った lines を保持）
    // =======================================================
    setOfferLines: function (lines) {
      state.offerLines = lines || {};
      safeLog("[state] setOfferLines: keys=" + Object.keys(state.offerLines || {}).length);
    },

    // =======================================================
    // [BID-02-15] 認証状態
    // =======================================================
    setAuthState: function (s) {
      state.authState = s || "LOCKED";
      safeLog("[state] setAuthState: " + state.authState);
    },

    // =======================================================
    // [BID-02-16] プロファイル（入力欄→state）
    // =======================================================
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

    // =======================================================
    // [BID-02-17] profileState
    // =======================================================
    setProfileState: function (s) {
      state.profileState = s || "INCOMPLETE";
      safeLog("[state] setProfileState: " + state.profileState);
    },

    // =======================================================
    // [BID-02-18] viewOnly（closed時にtrue）
    // =======================================================
    setViewOnly: function (yes) {
      state.viewOnly = !!yes;
      safeLog("[state] setViewOnly: " + (state.viewOnly ? "true" : "false"));
    },

    // =======================================================
    // [BID-02-19] inputEnabled（保存可否）
    // =======================================================
    setInputEnabled: function (yes) {
      state.inputEnabled = !!yes;
      safeLog("[state] setInputEnabled: " + (state.inputEnabled ? "true" : "false"));
    },

    // =======================================================
    // [BID-02-20] lastLoadedAt / lastSavedAt
    // =======================================================
    setLastLoadedAt: function (iso) {
      state.lastLoadedAt = iso || "";
      safeLog("[state] setLastLoadedAt: " + (state.lastLoadedAt || "(empty)"));
    },
    setLastSavedAt: function (iso) {
      state.lastSavedAt = iso || "";
      safeLog("[state] setLastSavedAt: " + (state.lastSavedAt || "(empty)"));
    }
  };

})(window);