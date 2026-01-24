// [JST 2026-01-24 21:00] bidder/js/03_bidder_log.js v20260124-01
// [BID-03] ログ（画面下に必ず残す）
(function (global) {
  var BID = global.BID = global.BID || {};
  if (BID.Build && BID.Build.register) BID.Build.register("03_bidder_log.js", "v20260124-01");

  function el(id) { return document.getElementById(id); }

  function fmt(ts, s) {
    // 画面表示はJSTっぽく見えるように（厳密TZは追わない）
    return "[" + ts.replace("T", " ").replace("Z", "") + "] " + s;
  }

  BID.Log = {
    write: function (msg) {
      var box = el("logBox");
      if (!box) return;
      var ts = new Date().toISOString();
      var line = fmt(ts, String(msg || ""));
      box.textContent = (box.textContent ? (box.textContent + "\n") : "") + line;
      box.scrollTop = box.scrollHeight;
    },
    clear: function () {
      var box = el("logBox");
      if (box) box.textContent = "";
    }
  };

  // [BID-03-99] ここで build バッファを一括吐き出し
  try {
    if (BID.Build && BID.Build.flush) BID.Build.flush();
  } catch (e) {}

})(window);
