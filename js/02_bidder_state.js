/* [JST 2026-01-24 21:00]  02_bidder_state.js v20260124-01 */
(function(){
  var FILE = "02_bidder_state.js";
  var VER  = "v20260124-02";
  var TS   = new Date().toISOString();

  function safeLog(tag, msg){
    try{
      if(window.BidderLog && window.BidderLog.write){ window.BidderLog.write(tag, msg); }
      else if(window.log){ window.log(tag, msg); }
      else { console.log("[" + tag + "] " + msg); }
    }catch(e){ try{ console.log("[" + tag + "] " + msg); }catch(ex){} }
  }

  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });
  safeLog("ver", TS + " " + FILE + " " + VER);

  // =========================
  // [ST-01] 状態管理（レンダリング過多を防ぐため notify をまとめる）
  // =========================
  var _listeners = [];
  var _notifyTimer = null;

  var state = {
    bidNo: null,

    // 認証・モード
    loginState: "SIGNED-OUT",     // SIGNED-OUT / SIGNED-IN
    authState:  "LOCKED",         // LOCKED / UNLOCKED
    viewOnly:   false,
    inputEnabled:false,

    // Firebase
    user: null,                   // firebase.User or null
    bidderId: null,               // 入札者ID（=入札者番号）
    bidderEmail:null,

    // 読込データ
    bid: null,                    // bids/{bidNo}
    items: [],                    // 品目行
    offer: null,                  // 保存済み（読み込みは必要に応じて）
    offerLines: [],               // 入札単価の入力状態

    // プロファイル
    profile: {
      email:"",
      address:"",
      company:"",
      rep:"",
      person:"",
      tel:""
    },
    profileState: "INCOMPLETE",   // INCOMPLETE / COMPLETE

    lastLoadedAt: null
  };

  function _scheduleNotify(){
    if(_notifyTimer){ return; }
    _notifyTimer = setTimeout(function(){
      _notifyTimer = null;
      for(var i=0;i<_listeners.length;i++){
        try{ _listeners[i](state); }catch(e){}
      }
    }, 0);
  }

  function onChange(fn){
    _listeners.push(fn);
  }

  function setBidNo(v){
    state.bidNo = v;
    _scheduleNotify();
  }

  function setUser(u){
    state.user = u;
    state.loginState = u ? "SIGNED-IN" : "SIGNED-OUT";
    safeLog("state", "setUser: " + (u ? ("uid=" + u.uid) : "null"));
    _scheduleNotify();
  }

  function setBidderId(bidderId, bidderEmail){
    state.bidderId = bidderId || null;
    state.bidderEmail = bidderEmail || null;
    safeLog("state", "setBidderId: " + (bidderId ? bidderId : "(empty)"));
    _scheduleNotify();
  }

  function setBid(bid){
    state.bid = bid;
    var st = (bid && bid.status) ? bid.status : "(none)";
    safeLog("state", "setBid: status=" + st);
    _scheduleNotify();
  }

  function setItems(items){
    state.items = items || [];
    safeLog("state", "setItems: " + state.items.length);
    _scheduleNotify();
  }

  function setOffer(offer){
    state.offer = offer || null;
    _scheduleNotify();
  }

  function setOfferLines(lines){
    state.offerLines = lines || [];
    _scheduleNotify();
  }

  function setAuthState(v){
    state.authState = v;
    safeLog("state", "setAuthState: " + v);
    _scheduleNotify();
  }

  function setViewOnly(v){
    state.viewOnly = !!v;
    safeLog("state", "setViewOnly: " + (state.viewOnly ? "true":"false"));
    _scheduleNotify();
  }

  function setInputEnabled(v){
    state.inputEnabled = !!v;
    safeLog("state", "setInputEnabled: " + (state.inputEnabled ? "true":"false"));
    _scheduleNotify();
  }

  function setProfile(p){
    // [ST-02] 参照を維持しつつ更新
    p = p || {};
    state.profile.email   = p.email   || "";
    state.profile.address = p.address || "";
    state.profile.company = p.company || "";
    state.profile.rep     = p.rep     || "";
    state.profile.person  = p.person  || "";
    state.profile.tel     = p.tel     || "";
    safeLog("state", "setProfile");
    _scheduleNotify();
  }

  function setProfileState(v){
    state.profileState = v;
    safeLog("state", "setProfileState: " + v);
    _scheduleNotify();
  }

  function setLastLoadedAt(iso){
    state.lastLoadedAt = iso || null;
    safeLog("state", "lastLoadedAt=" + (state.lastLoadedAt || "(none)"));
    _scheduleNotify();
  }

  function computeProfileState(){
    // [ST-03] 必須チェック
    var p = state.profile;
    var ok = !!(p.email && p.address && p.company && p.rep && p.person && p.tel);

// ★ここを追加★ [ST-03-CP-01] 必須判定の中身をログに出す（state.profile を直接）
  try{
    L("profileChk", JSON.stringify({
      email: p.email, address: p.address, company: p.company,
      rep: p.rep, person: p.person, tel: p.tel
    }));
  }catch(e){}
  // ★ここまで追加★

    
    
// ★ここを修正★ [ST-02-CP-01]
//try{
  //var p2 = (window.BidderState && window.BidderState.get)
    //? (window.BidderState.get().profile || {})
    //: {};
  //L("profileChk", JSON.stringify({
    //email: p2.email, address: p2.address, company: p2.company,
    //rep: p2.rep, person: p2.person, tel: p2.tel
  //}));
//}catch(e){}
// ★ここまで修正★  
    
    
    setProfileState(ok ? "COMPLETE" : "INCOMPLETE");
    return ok;
  }

  function computeMode(){
    var status = (state.bid && state.bid.status) ? state.bid.status : "(none)";
    // viewOnly: closed は閲覧固定、open は通常
    var viewOnly = (status === "closed");
    setViewOnly(viewOnly);

    // inputEnabled: login + auth + profileComplete + open
    var profileOk = (state.profileState === "COMPLETE");
    var enabled = (state.loginState === "SIGNED-IN" &&
                   state.authState === "UNLOCKED" &&
                   profileOk &&
                   status === "open" &&
                   !viewOnly);
    setInputEnabled(enabled);

    safeLog("mode",
      "status=" + status +
      " login=" + state.loginState +
      " bidderId=" + (state.bidderId ? state.bidderId : "(none)") +
      " auth=" + state.authState +
      " profile=" + state.profileState +
      " input=" + (state.inputEnabled ? "true":"false") +
      " viewOnly=" + (state.viewOnly ? "true":"false")
    );
  }

  window.BidderState = {
    get: function(){ return state; },
    onChange: onChange,

    setBidNo: setBidNo,
    setUser: setUser,
    setBidderId: setBidderId,
    setBid: setBid,
    setItems: setItems,
    setOffer: setOffer,
    setOfferLines: setOfferLines,
    setAuthState: setAuthState,
    setViewOnly: setViewOnly,
    setInputEnabled: setInputEnabled,
    setProfile: setProfile,
    setProfileState: setProfileState,
    setLastLoadedAt: setLastLoadedAt,

    computeProfileState: computeProfileState,
    computeMode: computeMode
  };
})();
