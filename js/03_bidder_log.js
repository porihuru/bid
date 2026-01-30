/* 
[JST 2026-01-30 22:20]  03_bidder_log.js v20260130-02
変更点:
  - ログは常に継続（停止/再開機能は無効化）
  - bindTextArea() 時に「既存ログ＋BOOTLOG」を txtLog に一括反映（＝起動直後ログも見える）
  - txtLog focus/blur で停止しない（何もしない）
  - API互換のため setPaused/togglePaused は残すが no-op（止まらない）
  - window.onerror / unhandledrejection をログに出す
  - 解析用に writeObj / writeJson を追加（データ確認ログ用）
*/
(function(){
  var FILE = "03_bidder_log.js";
  var VER  = "v20260130-02";
  var TS   = new Date().toISOString();

  var _ta = null;            // textarea element
  var _lines = [];           // 全ログ（内部保持）
  var _maxLines = 5000;      // 無限増殖防止
  var _lastLine = "";        // 直近行（同一連打抑制）
  var _boundOnce = false;    // bindTextArea 重複対策
  var _errHookInstalled = false;

  function _pad2(n){ return (n<10) ? ("0"+n) : (""+n); }

  function _nowJstStamp(){
    var d = new Date();
    // 端末TZをそのまま（JST運用前提）
    return d.getFullYear() + "-" + _pad2(d.getMonth()+1) + "-" + _pad2(d.getDate())
      + " " + _pad2(d.getHours()) + ":" + _pad2(d.getMinutes()) + ":" + _pad2(d.getSeconds())
      + "." + ("00"+d.getMilliseconds()).slice(-3);
  }

  function _safeStr(v){
    if(v == null) return "";
    try{ return (""+v); }catch(e){ return "[unprintable]"; }
  }

  function _safeJson(obj){
    try{
      // 循環対策（簡易）
      var seen = [];
      var s = JSON.stringify(obj, function(k, v){
        if(typeof v === "object" && v !== null){
          if(seen.indexOf(v) >= 0) return "[Circular]";
          seen.push(v);
        }
        return v;
      }, 2);
      // 長すぎるとログが死ぬので軽く制限
      if(s && s.length > 8000) s = s.slice(0, 8000) + "\n... (truncated)";
      return s;
    }catch(e){
      return "[json error] " + (e && e.message ? e.message : e);
    }
  }

  function _appendToTextarea(line){
    if(!_ta) return;
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

  function _rebuildTextareaAll(){
    // 必要時のみ：内部保持 _lines を txtLog にまとめて反映
    if(!_ta) return;
    try{
      _ta.value = _lines.join("\n") + (_lines.length ? "\n" : "");
      _ta.scrollTop = _ta.scrollHeight;
    }catch(e){}
  }

  function _pushLine(line){
    _lines.push(line);
    if(_lines.length > _maxLines){
      _lines.shift();
      // 表示は追記のままでもよいが、行がズレるのが嫌なら再構築する
      // ここでは低頻度でのみ再構築（負荷対策）
      if(_ta && (_lines.length % 200 === 0)){
        _rebuildTextareaAll();
      }
    }
  }

  function write(tag, msg){
    var line = "[" + _nowJstStamp() + "] [" + tag + "] " + _safeStr(msg);

    // 同一行連打の最小抑制
    if(line === _lastLine) return;
    _lastLine = line;

    _pushLine(line);
    _appendToTextarea(line);

    try{ console.log(line); }catch(e){}
  }

  // 便利：オブジェクトをログに出す（データ確認用）
  function writeObj(tag, obj){
    write(tag, _safeJson(obj));
  }
  function writeJson(tag, obj){
    write(tag, _safeJson(obj));
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
    if(!_ta) return;

    // ★重要：bindした瞬間に、既に溜まっているログを全部見せる
    // 1) BOOTLOG があればそれを先頭に反映（起動直後の死因が残る）
    // 2) その後に BidderLog の _lines を反映
    try{
      var head = "";

      // BOOTLOG を引き継ぎ（存在すれば）
      try{
        if(window.BOOTLOG && typeof window.BOOTLOG.getText === "function"){
          head = window.BOOTLOG.getText() || "";
          if(head){
            // BOOTLOGをBidderLog側の内部保持にも取り込む（後でコピーに入れるため）
            // ただし二重取り込みを避けるため、bindが初回だけ取り込む
            if(!_boundOnce){
              var arr = head.replace(/\r\n/g,"\n").split("\n");
              for(var i=0;i<arr.length;i++){
                var ln = arr[i];
                if(ln) _pushLine(ln);
              }
            }
          }
        }
      }catch(eBoot){}

      // txtLog を再構築（head は既に _lines に入れた可能性があるので、ここは _lines だけでOK）
      _rebuildTextareaAll();

      _boundOnce = true;

      write("log", "bindTextArea OK (logging is always-on)");
    }catch(e){
      try{ console.log("bindTextArea failed", e); }catch(ex){}
    }

    // ★停止機能を削除：focus/blurで止めない（何もしない）
  }

  // =========================================================
  // 停止/再開 API（互換のため残すが無効化）
  // どこかが呼んでも止まらない
  // =========================================================
  function setPaused(flag){
    // no-op（止めない）
    // ここで毎回ログするとノイズになるので「最初の1回だけ」出す
    write("log", "setPaused(" + (!!flag) + ") ignored (logging is always-on)");
  }

  function togglePaused(){
    // no-op（常に false を返す＝pausedではない）
    write("log", "togglePaused() ignored (logging is always-on)");
    return false;
  }

  function getAllText(){
    return _lines.join("\n") + (_lines.length ? "\n" : "");
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
    if(_errHookInstalled) return;
    _errHookInstalled = true;

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

  // バージョン表示
  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });

  // 公開API
  window.BidderLog = {
    write: write,
    writeObj: writeObj,     // ★追加
    writeJson: writeJson,   // ★追加
    clear: clear,
    bindTextArea: bindTextArea,
    setPaused: setPaused,         // 互換（無効化）
    togglePaused: togglePaused,   // 互換（無効化）
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