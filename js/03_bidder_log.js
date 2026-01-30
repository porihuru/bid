/* [JST 2026-01-30 21:00]  03_bidder_log.js v20260130-01
   変更点:
   - ログは常に継続記録（停止/再開機能を無効化）
   - ログ欄 focus/blur しても停止しない（記録のみ）
   - setPaused/togglePaused は互換のため残すが、常に pause=false 固定
   - window.onerror / unhandledrejection をログに出す（従来どおり）
*/
(function(){
  var FILE = "03_bidder_log.js";
  var VER  = "v20260130-01";
  var TS   = new Date().toISOString();

  var _ta = null;           // textarea element
  var _lines = [];          // 全ログ（内部保持）
  var _paused = false;      // ★常に false 運用（互換のため変数は残す）
  var _maxLines = 5000;     // 無限増殖防止（必要なら増やせます）
  var _lastLine = "";       // 直近行（同一連打の抑制に使う場合あり）

  function _pad2(n){ return (n<10) ? ("0"+n) : (""+n); }

  function _nowJstStamp(){
    // 表示用：JST固定（端末TZそのまま。JST運用前提）
    var d = new Date();
    return d.getFullYear() + "-" + _pad2(d.getMonth()+1) + "-" + _pad2(d.getDate())
      + " " + _pad2(d.getHours()) + ":" + _pad2(d.getMinutes()) + ":" + _pad2(d.getSeconds())
      + "." + ("00"+d.getMilliseconds()).slice(-3);
  }

  function _appendToTextarea(line){
    if(!_ta) return;

    // ★修正★ 停止しない（常に追記）
    // 追記のみ（全置換しない＝選択を邪魔しにくい）
    try{
      if(_ta.value){
        _ta.value += "\n" + line;
      }else{
        _ta.value = line;
      }
      // 自動スクロール（常に追従）
      _ta.scrollTop = _ta.scrollHeight;
    }catch(e){
      // 最悪 console へ
      try{ console.log(line); }catch(ex){}
    }
  }

  function _pushLine(line){
    _lines.push(line);
    if(_lines.length > _maxLines){
      _lines.shift(); // 先頭を捨てる
      // textarea 側も理想は再構築だが、重くなるのでここではしない
    }
  }

  function write(tag, msg){
    var line = "[" + _nowJstStamp() + "] [" + tag + "] " + msg;

    // 同一行が高速で連打される場合に備えて、完全一致は抑制（必要最低限）
    if(line === _lastLine){
      return;
    }
    _lastLine = line;

    _pushLine(line);
    _appendToTextarea(line);

    // コンソールにも出しておく（デバッグ用）
    try{ console.log(line); }catch(e){}
  }

  function clear(){
    _lines = [];
    _lastLine = "";
    if(_ta){
      try{ _ta.value = ""; }catch(e){}
    }
    // ★停止状態も無効（常にfalse）
    _paused = false;
  }

  function bindTextArea(textareaEl){
    _ta = textareaEl;

    // ★修正★ ログ欄をタップ(フォーカス)しても停止しない
    // （選択/コピーの邪魔をしない目的なら、停止ではなく UI 側で対応する）
    if(_ta){
      _ta.addEventListener("focus", function(){
        _pushLine("[" + _nowJstStamp() + "] [log] textarea focused");
      });
      _ta.addEventListener("blur", function(){
        _pushLine("[" + _nowJstStamp() + "] [log] textarea blurred");
      });
    }
  }

  function setPaused(flag){
    // ★修正★ 互換のためAPIは残すが、停止は無効
    _paused = false;
    write("log", "setPaused requested but disabled (always running)");
  }

  function togglePaused(){
    // ★修正★ 互換のためAPIは残すが、停止は無効
    _paused = false;
    write("log", "togglePaused requested but disabled (always running)");
    return _paused; // 常に false
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

    // iOS/Safari: navigator.clipboard はユーザー操作（ボタン）内なら成功しやすい
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(text).then(function(){
        write("copy", "OK (clipboard)");
        return true;
      }).catch(function(e){
        // fallbackへ
        return _fallbackCopy(text, e);
      });
    }
    return _fallbackCopy(text, null);
  }

  function _fallbackCopy(text, err){
    // Edge95/IEモード等も考慮：textarea選択→execCommand('copy')
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
      try{
        ok = document.execCommand("copy");
      }catch(ex){
        ok = false;
      }
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
    // JSエラーがログイン不可の原因になることが多いので、必ずログに出す
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

  // バージョン表示（既存と互換）
  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });

  // 公開API
  window.BidderLog = {
    write: write,
    clear: clear,
    bindTextArea: bindTextArea,
    setPaused: setPaused,         // ★互換用（停止は無効）
    togglePaused: togglePaused,   // ★互換用（停止は無効）
    copyAll: copyAll,
    getAllText: getAllText,
    installGlobalErrorHook: installGlobalErrorHook
  };

  // 起動時
  try{
    write("ver", TS + " " + FILE + " " + VER);
    installGlobalErrorHook();
  }catch(e){}
})();