// [JST 2026-01-23 22:20] bidder/js/00_bidder_build.js v20260123-01
// [BID-00] ビルド/バージョン管理（JSロード時のログ出力）
// 目的:
//  - 各JSが「読み込まれた時点」でバージョンを登録
//  - BID.Log が未初期化でもキューに溜め、後から flush してログに出す
//  - 画面表示（任意）にも出せるようにする

(function (global) {
  var BID = global.BID = global.BID || {};

  var _queue = [];  // {ts, name, ver}
  var _seen = {};   // 重複防止

  function nowIso() { return new Date().toISOString(); }
  function safeWrite(line) {
    try {
      if (BID.Log && BID.Log.write) {
        BID.Log.write(line);
        return true;
      }
    } catch (e) {}
    return false;
  }

  BID.Build = {
    // 各JS先頭で呼ぶ：BID.Build.report("08_bidder_render.js", "v20260123-01")
    report: function (name, ver) {
      name = String(name || "");
      ver = String(ver || "");
      var key = name + "@" + ver;

      // 同一ファイル同一バージョンの二重登録は抑止（script重複読込対策）
      if (_seen[key]) return;
      _seen[key] = true;

      var rec = { ts: nowIso(), name: name, ver: ver };
      _queue.push(rec);

      // Log がすでに使えるなら即出力、まだならキューに残す
      var line = "[ver] " + rec.ts + " " + rec.name + " " + rec.ver;
      safeWrite(line);
    },

    // 起動後に呼ぶ：溜まっている分をログに必ず出す
    flush: function () {
      if (!_queue.length) return;

      // Logが無いなら何もしない（後でまた呼べる）
      if (!(BID.Log && BID.Log.write)) return;

      // すでに即時出力済みの分も含むが、見た目上は問題ない。
      // 二重が嫌なら safeWrite の成否で分岐して出し分けることも可能。
      for (var i = 0; i < _queue.length; i++) {
        var r = _queue[i];
        BID.Log.write("[ver] " + r.ts + " " + r.name + " " + r.ver);
      }

      // 画面表示（任意：id="verList" があれば追記）
      try {
        var box = document.getElementById("verList");
        if (box) {
          var s = "";
          for (var j = 0; j < _queue.length; j++) {
            s += _queue[j].name + " " + _queue[j].ver + "\n";
          }
          box.textContent = s;
        }
      } catch (e2) {}
    }
  };

})(window);
