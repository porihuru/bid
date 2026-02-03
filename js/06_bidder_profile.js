/* [JST 2026-01-24 21:00]  06_bidder_profile.js v20260124-01 */
(function(){
  var FILE = "06_bidder_profile.js";
  var VER  = "v20260203-01";
  var TS   = new Date().toISOString();

  function L(tag, msg){
    if(window.BidderLog && window.BidderLog.write) window.BidderLog.write(tag, msg);
    else if(window.log) window.log(tag, msg);
    else try{ console.log("[" + tag + "] " + msg); }catch(e){}
  }
  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });
  L("ver", TS + " " + FILE + " " + VER);

  function _getCookie(name){
    var m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
  }

  function _setCookie(name, value, days){
    var d = new Date();
    d.setTime(d.getTime() + (days*24*60*60*1000));
    document.cookie = name + "=" + encodeURIComponent(value) + ";expires=" + d.toUTCString() + ";path=/";
  }

  function _delCookie(name){
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  }

  function readProfileFromUI(){
    // [PF-01] UI -> state.profile
    function v(id){ var el=document.getElementById(id); return el? (el.value||"") : ""; }
    return {
      email:   v("pEmail"),
      address: v("pAddress"),
      company: v("pCompany"),
      rep:     v("pRep"),
      person:  v("pPerson"),
      tel:     v("pTel")
    };
  }

  function writeProfileToUI(p){
    // [PF-02] state.profile -> UI
    p = p || {};
    function s(id, val){ var el=document.getElementById(id); if(el){ el.value = val || ""; } }
    s("pEmail",   p.email);
    s("pAddress", p.address);
    s("pCompany", p.company);
    s("pRep",     p.rep);
    s("pPerson",  p.person);
    s("pTel",     p.tel);
  }

  function saveCookie(){
    // [PF-03] Cookie保存
    var p = readProfileFromUI();
    window.BidderState.setProfile(p);
    var ok = window.BidderState.computeProfileState();
    _setCookie(window.BidderConfig.COOKIE_KEYS.profile, JSON.stringify(p), 365);
    L("cookie", "save OK");
    return ok;
  }
  
  
  

  function loadCookie(){
    // [PF-04] Cookie読込
    var raw = _getCookie(window.BidderConfig.COOKIE_KEYS.profile);
    if(!raw){
      L("cookie", "autofill none");
      return null;
    }
    try{
      var p = JSON.parse(raw);
      writeProfileToUI(p);
      window.BidderState.setProfile(p);
      window.BidderState.computeProfileState();
      L("cookie", "autofill OK");
      return p;
    }catch(e){
      L("cookie", "autofill FAILED");
      return null;
    }
  }

  function deleteCookie(){
    _delCookie(window.BidderConfig.COOKIE_KEYS.profile);
    L("cookie", "deleted");
  }

  window.BidderProfile = {
    readProfileFromUI: readProfileFromUI,
    writeProfileToUI: writeProfileToUI,
    saveCookie: saveCookie,
    
    // ★ここを追加★ [PF-06-01] 互換alias（呼び出し側が saveToCookie を使うため）
    saveToCookie: saveCookie,
    loadFromCookie: loadCookie,
    // ★ここまで追加★
    
    loadCookie: loadCookie,
    deleteCookie: deleteCookie
  };
  
    // ★ここを追加★ [PF-05-01] 起動時にCookieから自動復元（DOM生成後に実行）
  try{
    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", function(){
        try{ loadCookie(); }catch(e){ L("cookie", "autoload FAILED"); }
      });
    }else{
      // 既にDOMができている場合
      try{ loadCookie(); }catch(e2){ L("cookie", "autoload FAILED"); }
    }
  }catch(ex){
    L("cookie", "autoload FAILED");
  }
  // ★ここまで追加★
  
  
})();
