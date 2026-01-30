/* [JST 2026-01-30 21:45]  03_bidder_log.js v20260130-01
   変更点:
   - ログは常に継続（停止/再開機能を無効化）
   - txtLog をタップ(フォーカス)しても止まらない
   - API互換のため setPaused/togglePaused は残すが no-op（止まらない）
   - ログ表示は append-only（追記）を維持
   - window.onerror / unhandledrejection をログに出す
*/
(function(){
  var FILE = "03_bidder_log.js";
  var VER  = "v20260130-01";
  var TS   = new Date().toISOString();

  var _ta = null;           // textarea element
  var _lines = [];          // 全ログ（内部保持）
  var _maxLines = 5000;     // 無限増殖防止
  var _lastLine = "";       // 直近行（同一連打抑制）

  function _pad2(n){ return (n<10) ? ("0"+n) : (""+n); }

  function _nowJstStamp(){
    var d = new Date();
    return d.getFullYear() + "-" + _pad2(d.getMonth()+1) + "-" + _pad2(d.getDate())
      + " " + _pad2(d.getHours()) + ":" + _pad2(d.getMinutes()) + ":" + _pad2(d.getSeconds())
      + "." + ("00"+d.getMilliseconds()).slice(-3);
  }

  function _appendToTextarea(line){
    if(!_ta) return;

    // ★停止しない：常に追記する
    try{
      if(_ta.value){
        _ta.value += "\n" + line;
      }else{
        _ta.value = line;
      }
      _ta.scrollTop = _ta.scrollHeight;
    }catch(e){
      try{ console.log(line); }catch(ex){}
    }
  }

  function _pushLine(line){
    _lines.push(line);
    if(_lines.length > _maxLines){
      _lines.shift();
      // 表示側は追記のまま（必要なら後で再構築対応）
    }
  }

  function write(tag, msg){
    var line = "[" + _nowJstStamp() + "] [" + tag + "] " + msg;

    // 同一行連打の最小抑制
    if(line === _lastLine) return;
    _lastLine = line;

    _pushLine(line);
    _appendToTextarea(line);

    try{ console.log(line); }catch(e){}
  }

  function clear(){
    _lines = [];
    _lastLine = "";
    if(_ta){
      try{ _ta.value = ""; }catch(e){}
    }
  }

  function bindTextArea(textareaEl){
    _ta = textareaEl;

    // ★停止機能を削除：focus/blurで止めない
    // 何もしない（ログは常に流れる）
  }

  // =========================================================
  // 停止/再開 API（互換のため残すが無効化）
  // どこかが呼んでも止まらない
  // =========================================================
  function setPaused(flag){
    // no-op
    write("log", "setPaused(" + (!!flag) + ") ignored (logging is always-on)");
  }

  function togglePaused(){
    // no-op（常に false を返す＝pausedではない）
    write("log", "togglePaused() ignored (logging is always-on)");
    return false;
  }

  function getAllText(){
    return _lines.join("\n");
  }

  function copyAll(){
    var text = getAllText();
    if(!text){
      write("copy", "no log to copy");
      return Promise.resolve(false);
    }

    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(text).then(function(){
        write("copy", "OK (clipboard)");
        return true;
      }).catch(function(e){
        return _fallbackCopy(text, e);
      });
    }
    return _fallbackCopy(text, null);
  }

  function _fallbackCopy(text, err){
    try{
      var tmp = document.createElement("textarea");
      tmp.value = text;
      tmp.setAttribute("readonly", "readonly");
      tmp.style.position = "fixed";
      tmp.style.left = "-9999px";
      tmp.style.top = "0";
      document.body.appendChild(tmp);
      tmp.select();
      tmp.setSelectionRange(0, tmp.value.length);
      var ok = false;
      try{ ok = document.execCommand("copy"); }catch(ex){ ok = false; }
      document.body.removeChild(tmp);

      write("copy", ok ? "OK (execCommand)" : "FAILED (execCommand)");
      if(!ok && err){
        write("copy", "reason=" + (err && err.message ? err.message : err));
      }
      return Promise.resolve(ok);
    }catch(e){
      write("copy", "FAILED (fallback) " + (e && e.message ? e.message : e));
      return Promise.resolve(false);
    }
  }

  function installGlobalErrorHook(){
    window.addEventListener("error", function(ev){
      try{
        var msg = ev && ev.message ? ev.message : "script error";
        var src = ev && ev.filename ? ev.filename : "";
        var ln  = ev && ev.lineno ? ev.lineno : "";
        var cn  = ev && ev.colno ? ev.colno : "";
        write("error", msg + " @" + src + ":" + ln + ":" + cn);
      }catch(e){}
    });

    window.addEventListener("unhandledrejection", function(ev){
      try{
        var r = ev && ev.reason ? ev.reason : "";
        var msg = (r && r.message) ? r.message : (""+r);
        write("reject", msg);
      }catch(e){}
    });
  }

  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });

  window.BidderLog = {
    write: write,
    clear: clear,
    bindTextArea: bindTextArea,
    setPaused: setPaused,         // 互換（無効化）
    togglePaused: togglePaused,   // 互換（無効化）
    copyAll: copyAll,
    getAllText: getAllText,
    installGlobalErrorHook: installGlobalErrorHook
  };

  try{
    write("ver", TS + " " + FILE + " " + VER);
    installGlobalErrorHook();
  }catch(e){}
})();