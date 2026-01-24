/* [JST 2026-01-24 21:00]  08_bidder_render.js v20260124-01 */
(function(){
  var FILE = "08_bidder_render.js";
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

  function _setText(id, txt){
    var el = document.getElementById(id);
    if(el){ el.textContent = (txt!=null?txt:""); }
  }

  function _setDisabled(id, disabled){
    var el = document.getElementById(id);
    if(el){ el.disabled = !!disabled; }
  }

  function renderHeader(){
    var st = window.BidderState.get();
    _setText("hdrMeta", "BID_NO=" + (st.bidNo || "(none)"));
    _setText("bidNoView", st.bidNo || "(none)");

    var status = (st.bid && st.bid.status) ? st.bid.status : "(none)";
    var mode = "status=" + status +
      " login=" + st.loginState +
      " bidderId=" + (st.bidderId ? st.bidderId : "(none)") +
      " auth=" + st.authState +
      " profile=" + st.profileState +
      " input=" + (st.inputEnabled ? "true":"false") +
      " viewOnly=" + (st.viewOnly ? "true":"false");
    _setText("hdrMode", "mode: " + mode);
  }

  function renderItems(){
    var st = window.BidderState.get();
    var tb = document.getElementById("tbodyItems");
    if(!tb){ return; }

    var items = st.items || [];
    if(!items.length){
      tb.innerHTML = '<tr><td colspan="5" class="muted">品目なし</td></tr>';
      return;
    }

    var html = "";
    for(var i=0;i<items.length;i++){
      var it = items[i];
      var id = it._id || ("row"+i);
      var no = (it.no!=null)?it.no:(it.seq!=null?it.seq:(i+1));
      var name = it.name || it.itemName || it.title || "(品名なし)";
      var spec = it.spec || it.standard || it.detail || "";
      var qty  = (it.qty!=null)?it.qty:(it.quantity!=null?it.quantity:"");
      var unit = it.unit || "";

      html += '<tr>';
      html += '  <td>' + no + '</td>';
      html += '  <td><div style="font-weight:700;">' + esc(name) + '</div><div class="muted small">' + esc(spec) + '</div></td>';
      html += '  <td class="num">' + esc(qty) + ' ' + esc(unit) + '</td>';
      html += '  <td><input id="up_' + id + '" placeholder="単価" inputmode="decimal" /></td>';
      html += '  <td><input id="nt_' + id + '" placeholder="備考（任意）" /></td>';
      html += '</tr>';
    }
    tb.innerHTML = html;

    // 入力可否
    var disabled = !st.inputEnabled;
    for(var j=0;j<items.length;j++){
      var it2 = items[j];
      var id2 = it2._id || ("row"+j);
      _setDisabled("up_" + id2, disabled);
      _setDisabled("nt_" + id2, disabled);
    }
  }

  function esc(v){
    v = (v==null) ? "" : (""+v);
    return v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function renderButtons(){
    var st = window.BidderState.get();

    // login UI
    _setDisabled("btnLogin", false);
    _setDisabled("btnLogout", (st.loginState !== "SIGNED-IN"));

    // auth
    _setDisabled("btnAuth", (st.loginState !== "SIGNED-IN"));

    // profile cookie
    _setDisabled("btnLoadCookie", false);
    _setDisabled("btnSaveCookie", false);
    _setDisabled("btnDelCookie", false);

    // save offer
    _setDisabled("btnSaveOffer", !st.inputEnabled);

    // profile inputs
    var profileDisabled = !st.inputEnabled; // 認証後に入力可能、という運用にしたい場合はここを調整
    // ただし「入力済データの読み込み」は常にできるようにするなら、読み込み後もdisabledで表示はされる
    _setDisabled("pEmail",   profileDisabled);
    _setDisabled("pAddress", profileDisabled);
    _setDisabled("pCompany", profileDisabled);
    _setDisabled("pRep",     profileDisabled);
    _setDisabled("pPerson",  profileDisabled);
    _setDisabled("pTel",     profileDisabled);
  }

  function renderAll(){
    renderHeader();
    renderButtons();
    renderItems();
  }

  window.BidderRender = {
    renderAll: renderAll
  };
})();
