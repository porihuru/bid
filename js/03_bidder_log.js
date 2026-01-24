/* [JST 2026-01-24 21:20]  03_bidder_log.js v20260124-02
   変更点:
   - ログ表示は append-only（追記）に統一（再描画しない）
   - ログ欄をタップ(フォーカス)したら自動でログ停止（コピー/選択を邪魔しない）
   - [ログ停止/再開] ボタン用 API 追加
   - [ログコピー] ボタン用 API 追加（iOS/Edge95 fallback 対応）
   - window.onerror / unhandledrejection をログに出す
*/
(function(){
  var FILE = "03_bidder_log.js";
  var VER  = "v20260124-02";
  var TS   = new Date().toISOString();

  var _ta = null;           // textarea element
  var _lines = [];          // 全ログ（内部保持）
  var _paused = false;      // 表示更新停止フラグ
  var _maxLines = 5000;     // 無限増殖防止（必要なら増やせます）
  var _lastLine = "";       // 直近行（同一連打の抑制に使う場合あり）

  function _pad2(n){ return (n<10) ? ("0"+n) : (""+n); }

  function _nowJstStamp(){
    // 表示用：JST固定（iPhoneでも見やすい）
    var d = new Date();
    // 端末のタイムゾーンをそのまま使う（JST運用前提）
    return d.getFullYear() + "-" + _pad2(d.getMonth()+1) + "-" + _pad2(d.getDate())
      + " " + _pad2(d.getHours()) + ":" + _pad2(d.getMinutes()) + ":" + _pad2(d.getSeconds())
      + "." + ("00"+d.getMilliseconds()).slice(-3);
  }

  function _appendToTextarea(line){
    if(!_ta) return;
    // 追記のみ（全置換しない＝選択を邪魔しにくい）
    // ただし停止中は表示更新しない
    if(_paused) return;

    try{
      if(_ta.value){
        _ta.value += "\n" + line;
      }else{
        _ta.value = line;
      }
      // 自動スクロール（停止中は動かさない）
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
      // textarea も再構築が必要だが、頻繁にやると本末転倒なので最低限にする
      // ここでは「捨てた」ことだけ記録し、表示は追記のままにする（必要なら後で改善）
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
  }

  function bindTextArea(textareaEl){
    _ta = textareaEl;

    // ログ欄をタップしたら自動停止（選択/コピーを邪魔しない）
    if(_ta){
      _ta.addEventListener("focus", function(){
        _paused = true;
        // 停止を明示ログ（ただし停止中はtextareaに出ないので内部保持のみ）
        _pushLine("[" + _nowJstStamp() + "] [log] auto-paused (textarea focused)");
      });
      _ta.addEventListener("blur", function(){
        // blurしても自動再開はしない（ユーザーが意図せず動くのを防ぐ）
        _pushLine("[" + _nowJstStamp() + "] [log] textarea blurred (still paused until resumed)");
      });
    }
  }

  function setPaused(flag){
    _paused = !!flag;
    write("log", _paused ? "paused" : "resumed");
  }

  function togglePaused(){
    _paused = !_paused;
    write("log", _paused ? "paused" : "resumed");
    return _paused;
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
    setPaused: setPaused,
    togglePaused: togglePaused,
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