/* [JST 2026-01-24 21:00]  10_bidder_app.js v20260124-02 */
(function(){
  var FILE = "10_bidder_app.js";
  var VER  = "v20260124-02";
  var TS   = new Date().toISOString();

  function L(tag, msg){
    if(window.BidderLog && window.BidderLog.write) window.BidderLog.write(tag, msg);
    else if(window.log) window.log(tag, msg);
    else try{ console.log("[" + tag + "] " + msg); }catch(e){}
  }
  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });
  L("ver", TS + " " + FILE + " " + VER);

  function getQueryParam(name){
    var s = location.search || "";
    if(s.indexOf("?") === 0) s = s.substring(1);
    var parts = s.split("&");
    for(var i=0;i<parts.length;i++){
      var kv = parts[i].split("=");
      if(decodeURIComponent(kv[0]) === name){
        return decodeURIComponent(kv[1] || "");
      }
    }
    return null;
  }

  function boot(){
    var logEl = document.getElementById("txtLog");
    if(window.BidderLog && window.BidderLog.bindTextArea){
      window.BidderLog.bindTextArea(logEl);
    }

    var bidNo = getQueryParam("bidNo") || window.BidderConfig.BID_NO_DEFAULT;
    window.BidderState.setBidNo(bidNo);
    L("config", "BID_NO=" + bidNo);

    window.BidderState.setViewOnly(false);
    window.BidderState.setInputEnabled(false);
    window.BidderState.computeMode();
    window.BidderRender.renderAll();

    window.BidderProfile.loadCookie();

    window.BidderDB.initFirebase();
    window.BidderAuth.watchAuthState();

    window.BidderState.onChange(function(){
      window.BidderState.computeMode();
      window.BidderRender.renderAll();
    });

    bindHandlers();
    loadAll();
  }

  function bindHandlers(){
    var btnLogClear = document.getElementById("btnLogClear");
    if(btnLogClear){
      btnLogClear.onclick = function(){
        if(window.BidderLog) window.BidderLog.clear();
      };
    }

    var btnReload = document.getElementById("btnReload");
    if(btnReload){
      btnReload.onclick = function(){ loadAll(); };
    }

    var btnPrint = document.getElementById("btnPrint");
    if(btnPrint){
      btnPrint.onclick = function(){ window.BidderPrint.printPage(); };
    }

    var btnLogin = document.getElementById("btnLogin");
    if(btnLogin){
      btnLogin.onclick = function(){
        var bidderId = (document.getElementById("inpBidderId").value || "").trim();
        var pw = (document.getElementById("inpPassword").value || "").trim();
        L("login", "clicked bidderId=" + bidderId);

        if(!bidderId){ L("login", "FAILED bidderId empty"); return; }
        if(!pw){ L("login", "FAILED password empty"); return; }

        window.BidderState.setBidderId(bidderId, window.BidderAuth.bidderIdToEmail(bidderId));

        window.BidderAuth.signIn(bidderId, pw)
          .then(function(u){
            L("login", "OK uid=" + u.uid);
            return loadAll();
          })
          .catch(function(e){
            L("login", "FAILED " + (e && e.message ? e.message : e));
          });
      };
    }

    var btnLogout = document.getElementById("btnLogout");
    if(btnLogout){
      btnLogout.onclick = function(){
        window.BidderAuth.signOut()
          .then(function(){
            window.BidderState.setOffer(null);
            window.BidderState.setOfferLines([]);
            window.BidderState.setBid(null);
            window.BidderState.setItems([]);
            window.BidderState.setProfile({});
            window.BidderState.setProfileState("INCOMPLETE");
            window.BidderState.computeMode();
            window.BidderRender.renderAll();
            L("logout", "renderAll OK");
          })
          .catch(function(e){
            L("logout", "FAILED " + (e && e.message ? e.message : e));
          });
      };
    }

    var btnAuth = document.getElementById("btnAuth");
    if(btnAuth){
      btnAuth.onclick = function(){
        L("auth", "clicked");
        try{
          var code = (document.getElementById("inpAuthCode").value || "").trim();
          window.BidderAuth.bidAuth(code);
          L("auth", "OK");
        }catch(e){
          L("auth", "FAILED " + (e && e.message ? e.message : e));
        }
      };
    }

    var btnLoadCookie = document.getElementById("btnLoadCookie");
    if(btnLoadCookie){ btnLoadCookie.onclick = function(){ window.BidderProfile.loadCookie(); }; }

    var btnSaveCookie = document.getElementById("btnSaveCookie");
    if(btnSaveCookie){ btnSaveCookie.onclick = function(){ window.BidderProfile.saveCookie(); }; }

    var btnDelCookie = document.getElementById("btnDelCookie");
    if(btnDelCookie){ btnDelCookie.onclick = function(){ window.BidderProfile.deleteCookie(); }; }

    // ★ここが重要：保存処理（ルール準拠payload + サブコレ書込）
    var btnSaveOffer = document.getElementById("btnSaveOffer");
    if(btnSaveOffer){
      btnSaveOffer.onclick = function(){
        L("save", "clicked");

        // profile -> state 更新
        window.BidderState.setProfile(window.BidderProfile.readProfileFromUI());
        window.BidderState.computeProfileState();
        window.BidderState.computeMode();

        // cookie保存（任意）
        try{ window.BidderProfile.saveCookie(); }catch(e){}

        var st = window.BidderState.get();

        // 状況ログ（失敗理由を明確化）
        L("save", "status=" + ((st.bid && st.bid.status) ? st.bid.status : "(none)")
          + " login=" + st.loginState
          + " bidderId=" + (st.bidderId || "(none)")
          + " uid=" + ((st.user && st.user.uid) ? st.user.uid : "(none)")
          + " auth=" + st.authState
          + " profile=" + st.profileState
          + " inputEnabled=" + (st.inputEnabled ? "true":"false")
        );

        if(!st.bidderId){ L("save", "FAILED bidderId empty"); return; }
        if(!st.user || !st.user.uid){ L("save", "FAILED not logged in"); return; }
        if(st.profileState !== "COMPLETE"){ L("save", "FAILED profile incomplete"); return; }
        if(!st.inputEnabled){ L("save", "FAILED input disabled"); return; }

        // ルール準拠 payload
        var payload = window.BidderOffer.buildOfferPayload();

        // 書込（bids/{bidNo}/offers/{bidderId}）
        window.BidderDB.upsertOffer(st.bidNo, st.bidderId, payload)
          .then(function(){
            L("save", "OK");
            var warn = document.getElementById("saveWarn");
            if(warn){ warn.textContent = ""; }
          })
          .catch(function(e){
            var msg = (e && e.message) ? e.message : (""+e);
            L("save", "FAILED " + msg);
            var warn2 = document.getElementById("saveWarn");
            if(warn2){ warn2.textContent = "保存失敗: " + msg; }
          });
      };
    }

    attachProfileLiveUpdate();
  }

  function attachProfileLiveUpdate(){
    function onInput(){
      window.BidderState.setProfile(window.BidderProfile.readProfileFromUI());
      window.BidderState.computeProfileState();
    }
    var ids = ["pEmail","pAddress","pCompany","pRep","pPerson","pTel"];
    for(var i=0;i<ids.length;i++){
      var el = document.getElementById(ids[i]);
      if(el){
        el.oninput = onInput;
        el.onchange = onInput;
      }
    }
  }

  function loadAll(){
    var st = window.BidderState.get();
    var bidNo = st.bidNo;

    window.BidderDB.loadBid(bidNo)
      .then(function(bid){
        window.BidderState.setBid(bid);
        return window.BidderDB.loadItems(bidNo);
      })
      .then(function(items){
        window.BidderState.setItems(items);
        window.BidderState.setLastLoadedAt(new Date().toISOString());
        L("load", "OK: status=" + ((window.BidderState.get().bid && window.BidderState.get().bid.status) ? window.BidderState.get().bid.status : "(none)")
          + " items=" + items.length);
        window.BidderRender.renderAll();
      })
      .catch(function(e){
        var msg = (e && e.message) ? e.message : (""+e);
        L("load", "FAILED " + msg);
        window.BidderRender.renderAll();
      });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})();
