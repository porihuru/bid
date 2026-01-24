// [JST 2026-01-23 22:30] js/03_bidder_log.js v20260123-01
// [BID-03] ログ（必ずユーザーに見える）
(function (global) {
  var BID = global.BID = global.BID || {};
  var boxId = "logBox";

  function pad(n){ return (n<10?"0":"")+n; }
  function nowJst() {
    // 表示は端末ローカル時刻でOK
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  function el() { return document.getElementById(boxId); }

  BID.Log = {
    write: function (msg) {
      var e = el();
      if (!e) return;
      var line = "[" + nowJst() + "] " + String(msg || "");
      e.textContent = e.textContent ? (e.textContent + "\n" + line) : line;
      e.scrollTop = e.scrollHeight;
    },
    clear: function () {
      var e = el();
      if (e) e.textContent = "";
    },
    ver: function (file, ver) {
      // 各JSの先頭で呼ぶ想定：読み込まれたことが分かる
      BID.Log.write("[ver] " + file + " " + ver);
    }
  };

  BID.Log.ver("03_bidder_log.js", "v20260123-01");
})(window);
