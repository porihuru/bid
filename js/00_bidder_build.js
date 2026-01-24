// [JST 2026-01-24 21:00] bidder/js/00_bidder_build.js v20260124-01
// [BID-00] ビルド情報・バージョン登録/出力（最初に読む）
// 目的:
//  - 各JSの先頭で register(file, ver) できるようにする
//  - 03_bidder_log.js が読み込まれる前でも登録できる（バッファ）
//  - ログが使えるようになったら一括で [ver] を出す

(function (global) {
  var BID = global.BID = global.BID || {};
  BID.Build = BID.Build || {};

  // [BID-00-01] build情報
  BID.Build.BUILD = {
    builtAtJst: "2026-01-24 21:00",
    buildVer: "v20260124-01"
  };

  // [BID-00-02] バージョン登録バッファ
  var buf = [];   // {file, ver, at}

  function nowIso() { return new Date().toISOString(); }

  // [BID-00-03] register
  BID.Build.register = function (file, ver) {
    buf.push({ file: String(file || ""), ver: String(ver || ""), at: nowIso() });

    // 既にログがあるなら即出力
    try {
      if (BID.Log && BID.Log.write) {
        BID.Log.write("[ver] " + nowIso() + " " + file + " " + ver);
      }
    } catch (e) {}
  };

  // [BID-00-04] flush（ログが使えるようになったらまとめて出す）
  BID.Build.flush = function () {
    try {
      if (!(BID.Log && BID.Log.write)) return;
      for (var i = 0; i < buf.length; i++) {
        var r = buf[i];
        BID.Log.write("[ver] " + r.at + " " + r.file + " " + r.ver);
      }
    } catch (e) {}
  };

})(window);
