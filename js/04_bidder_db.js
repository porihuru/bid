/* [JST 2026-01-24 21:00]  04_bidder_db.js v20260124-02 */
(function(){
  var FILE = "04_bidder_db.js";
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

  var _app = null;
  var _db  = null;

  function initFirebase(){
    try{
      if(!firebase || !firebase.initializeApp){ throw new Error("firebase sdk not loaded"); }
      if(firebase.apps && firebase.apps.length){
        _app = firebase.apps[0];
      }else{
        _app = firebase.initializeApp(window.BidderConfig.FIREBASE_CONFIG);
      }
      _db = firebase.firestore();
      L("db", "firebase initialized");
    }catch(e){
      L("db", "firebase init FAILED: " + (e && e.message ? e.message : e));
      throw e;
    }
  }

  function db(){ return _db; }

  function loadBid(bidNo){
    L("load", "bids/" + bidNo + " ...");
    return _db.collection(window.BidderConfig.PATHS.bids).doc(bidNo).get()
      .then(function(doc){
        if(!doc.exists){ throw new Error("bids/" + bidNo + " not found"); }
        var data = doc.data();
        data._id = doc.id;
        return data;
      });
  }

  // ★修正★ ルールに合わせて bids/{bidNo}/items を読む
  function loadItems(bidNo){
    L("load", "bids/" + bidNo + "/items ...");
    return _db.collection(window.BidderConfig.PATHS.bids).doc(bidNo).collection("items").get()
      .then(function(qs){
        var arr = [];
        qs.forEach(function(doc){
          var d = doc.data();
          d._id = doc.id;
          arr.push(d);
        });
        arr.sort(function(a,b){
          var na = (a.no!=null)?a.no:(a.seq!=null?a.seq:0);
          var nb = (b.no!=null)?b.no:(b.seq!=null?b.seq:0);
          return na-nb;
        });
        return arr;
      });
  }

  // ★修正★ ルールに合わせて bids/{bidNo}/offers/{bidderId} に保存
  function upsertOffer(bidNo, bidderId, payload){
    if(!bidNo){ throw new Error("bidNo is empty"); }
    if(!bidderId){ throw new Error("bidderId is empty"); }

    var ref = _db.collection(window.BidderConfig.PATHS.bids).doc(bidNo).collection("offers").doc(bidderId);

    L("save", "upsertOffer -> bids/" + bidNo + "/offers/" + bidderId);

    return ref.set(payload, { merge: true }).then(function(){
      return true;
    });
  }

  window.BidderDB = {
    initFirebase: initFirebase,
    db: db,
    loadBid: loadBid,
    loadItems: loadItems,
    upsertOffer: upsertOffer
  };
})();
