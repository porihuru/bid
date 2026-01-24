/* [JST 2026-01-24 21:00]  07_bidder_offer.js v20260124-02 */
(function(){
  var FILE = "07_bidder_offer.js";
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

  function _isoNow(){
    return new Date().toISOString();
  }

  // items の各行に対応する入力を UI から読む
  function readOfferLinesFromUI(){
    var st = window.BidderState.get();
    var items = st.items || [];

    // ★重要★ ルールは lines を map として要求（array不可）
    // ここでは key=seq(no) の文字列、valueは {unitPrice, note} の map にする
    // （ルールは lines の中身までは型検証していないため、将来拡張可能）
    var linesMap = {};

    for(var i=0;i<items.length;i++){
      var it = items[i];
      var id = it._id || ("row"+i);

      var seq = (it.seq!=null)?it.seq:((it.no!=null)?it.no:(i+1));
      var key = "" + seq;

      var upEl = document.getElementById("up_" + id);
      var ntEl = document.getElementById("nt_" + id);

      var unitPrice = upEl ? (upEl.value || "") : "";
      var note      = ntEl ? (ntEl.value || "") : "";

      linesMap[key] = { unitPrice: unitPrice, note: note };
    }

    return linesMap;
  }

  // ★重要★ validOffer(bidNo, bidderId) が要求する keys/型に合わせた payload を返す
  function buildOfferPayload(){
    var st = window.BidderState.get();

    var bidNo    = st.bidNo;
    var bidderId = st.bidderId;
    var uid      = (st.user && st.user.uid) ? st.user.uid : "";

    var p = st.profile || {};
    var now = _isoNow();

    // ルールの profile.keys().hasOnly([...]) に一致させる
    var profile = {
      bidderId: bidderId,
      email: p.email || "",
      address: p.address || "",
      companyName: p.company || "",
      representativeName: p.rep || "",
      contactName: p.person || "",
      contactInfo: p.tel || ""
    };

    var payload = {
      bidNo: bidNo,
      bidderId: bidderId,
      profile: profile,
      lines: readOfferLinesFromUI(),  // map
      createdAt: now,                // string
      updatedAt: now,                // string
      updatedByUid: uid              // string
    };

    return payload;
  }

  window.BidderOffer = {
    buildOfferPayload: buildOfferPayload
  };
})();
