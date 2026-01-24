/* [JST 2026-01-24 21:00]  03_bidder_log.js v20260124-01 */
(function(){
  var FILE = "03_bidder_log.js";
  var VER  = "v20260124-01";
  var TS   = new Date().toISOString();

  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });

  var _el = null;

  function _pad(n){ return (n<10) ? ("0"+n) : (""+n); }

  function _nowJst(){
    // JST = UTC+9 表示（ログ先頭の [YYYY-MM-DD HH:mm:ss.mmm] 形式）
    var d = new Date();
    var utc = d.getTime() + (d.getTimezoneOffset()*60000);
    var jst = new Date(utc + 9*60*60000);
    return (
      jst.getFullYear() + "-" + _pad(jst.getMonth()+1) + "-" + _pad(jst.getDate()) + " " +
      _pad(jst.getHours()) + ":" + _pad(jst.getMinutes()) + ":" + _pad(jst.getSeconds()) + "." +
      ("00"+jst.getMilliseconds()).slice(-3)
    );
  }

  function bindTextArea(el){
    _el = el;
  }

  function write(tag, msg){
    var line = "[" + _nowJst() + "] [" + tag + "] " + msg;
    try{
      if(_el){
        _el.value = _el.value + line + "\n";
        _el.scrollTop = _el.scrollHeight;
      }else{
        console.log(line);
      }
    }catch(e){
      try{ console.log(line); }catch(ex){}
    }
  }

  function clear(){
    try{
      if(_el){ _el.value = ""; }
    }catch(e){}
    write("log", "ログクリア");
  }

  // 互換: window.log(tag,msg)
  window.log = function(tag, msg){
    write(tag, msg);
  };

  window.BidderLog = {
    bindTextArea: bindTextArea,
    write: write,
    clear: clear
  };

  // 冒頭ver
  write("ver", TS + " " + FILE + " " + VER);
})();
