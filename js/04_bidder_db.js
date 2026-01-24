/* [JST 2026-01-24 21:00]  04_bidder_db.js v20260124-01 */
(function(){
  var FILE = "04_bidder_db.js";
  var VER  = "v20260124-01";
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
    // [DB-01] Firebase初期化
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
    // [DB-02] bids/{bidNo} 読み込み
    L("load", "bids/" + bidNo + " ...");
    return _db.collection(window.BidderConfig.PATHS.bids).doc(bidNo).get()
      .then(function(doc){
        if(!doc.exists){ throw new Error("bids/" + bidNo + " not found"); }
        var data = doc.data();
        data._id = doc.id;
        return data;
      });
  }

  function loadItems(bidNo){
    // [DB-03] items 読み込み（環境差がある場合はここを合わせる）
    // 例: items/{bidNo}/lines のサブコレクション運用想定
    L("load", "items ...");
    return _db.collection(window.BidderConfig.PATHS.items).doc(bidNo).collection("lines").get()
      .then(function(qs){
        var arr = [];
        qs.forEach(function(doc){
          var d = doc.data();
          d._id = doc.id;
          arr.push(d);
        });
        // 表示順を安定（番号/一連番号があればそれで）
        arr.sort(function(a,b){
          var na = (a.no!=null)?a.no:(a.seq!=null?a.seq:0);
          var nb = (b.no!=null)?b.no:(b.seq!=null?b.seq:0);
          return na-nb;
        });
        return arr;
      });
  }

  function offerDocId(bidNo, bidderId){
    // [DB-04] offers ドキュメントID（環境に合わせて統一）
    return bidNo + "_" + bidderId;
  }

  function upsertOffer(bidNo, bidderId, payload){
    // [DB-05] 入札保存（Missing permissions は rules 側の許可が必要）
    var id = offerDocId(bidNo, bidderId);
    var ref = _db.collection(window.BidderConfig.PATHS.offers).doc(id);

    payload = payload || {};
    payload.bidNo = bidNo;
    payload.bidderId = bidderId;
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

    L("save", "upsertOffer ... bidderId=" + bidderId);

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
