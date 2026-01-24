/* [JST 2026-01-24 21:00]  07_bidder_offer.js v20260124-01 */
(function(){
  var FILE = "07_bidder_offer.js";
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

  function buildOfferLinesFromItems(items){
    // [OF-01] items -> offerLines（入力欄の枠）
    var lines = [];
    for(var i=0;i<items.length;i++){
      var it = items[i];
      lines.push({
        itemId: it._id || ("row" + i),
        no: (it.no!=null)?it.no:(it.seq!=null?it.seq:(i+1)),
        unitPrice: "",   // 入札単価
        note: ""         // 追記備考（任意）
      });
    }
    return lines;
  }

  function readOfferLinesFromUI(){
    // [OF-02] UI -> offerLines
    var st = window.BidderState.get();
    var items = st.items || [];
    var lines = [];
    for(var i=0;i<items.length;i++){
      var it = items[i];
      var id = (it._id || ("row"+i));
      var upEl = document.getElementById("up_" + id);
      var ntEl = document.getElementById("nt_" + id);
      lines.push({
        itemId: id,
        no: (it.no!=null)?it.no:(it.seq!=null?it.seq:(i+1)),
        unitPrice: upEl ? (upEl.value||"") : "",
        note: ntEl ? (ntEl.value||"") : ""
      });
    }
    window.BidderState.setOfferLines(lines);
    return lines;
  }

  function buildOfferPayload(){
    // [OF-03] 保存payload作成（profile + lines）
    var st = window.BidderState.get();
    var p = st.profile || {};
    var lines = readOfferLinesFromUI();

    return {
      profile: {
        email: p.email, address: p.address, company: p.company, rep: p.rep, person: p.person, tel: p.tel
      },
      lines: lines,
      bidStatus: (st.bid && st.bid.status) ? st.bid.status : null
    };
  }

  window.BidderOffer = {
    buildOfferLinesFromItems: buildOfferLinesFromItems,
    readOfferLinesFromUI: readOfferLinesFromUI,
    buildOfferPayload: buildOfferPayload
  };
})();
