// [JST 2026-01-20 19:00]  bidder/js/03_bidder_log.js  v20260120-01
(function (global) {
  var BID = global.BID = global.BID || {};

  // =========================================================
  // [03-01] ユーティリティ（Edge95想定）
  // =========================================================
  function pad2(n) { n = String(n); return n.length >= 2 ? n : ("0" + n); }
  function nowStamp() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
      " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
  }

  function el(id) { return document.getElementById(id); }

  // =========================================================
  // [03-02] ログAPI
  // =========================================================
  BID.Log = {
    clear: function () {
      var box = el("logBox");
      if (box) box.textContent = "";
      var ft = el("logFooter");
      if (ft) ft.textContent = "";
    },

    write: function (msg) {
      var box = el("logBox");
      if (!box) return;

      var line = "[" + nowStamp() + "] " + msg;
      box.textContent = (box.textContent ? (box.textContent + "\n") : "") + line;

      // 末尾へスクロール
      try { box.scrollTop = box.scrollHeight; } catch (e) {}

      // フッター（行数表示）
      var ft = el("logFooter");
      if (ft) {
        var count = box.textContent ? box.textContent.split("\n").length : 0;
        ft.textContent = "行数: " + count;
      }
    }
  };
})(window);