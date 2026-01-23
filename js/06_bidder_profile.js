// [JST 2026-01-23 21:15] bidder/js/06_bidder_profile.js v20260123-01
// [BID-06] 入札者情報（必須6項目 + 入札者番号）と Cookie
// 互換方針:
//  - 以前提示した実装（readFromUI/validate/applyToUI）を維持
//  - 新実装側が呼ぶ readFromInputs/validateRequired/applyToInputs も提供

(function (global) {
  var BID = global.BID = global.BID || {};
  BID.Profile = BID.Profile || {};

  // =========================================================
  // [BID-06-01] Cookie key（01_config.js 側で上書きしてもOK）
  // =========================================================
  var CK = {
    bidderId: "BIDDER_bidderId",
    email: "BIDDER_email",
    address: "BIDDER_address",
    companyName: "BIDDER_companyName",
    representativeName: "BIDDER_representativeName",
    contactName: "BIDDER_contactName",
    contactInfo: "BIDDER_contactInfo"
  };

  // =========================================================
  // [BID-06-02] Cookie util（最小）
  // =========================================================
  function setCookie(k, v, days) {
    var d = new Date();
    d.setTime(d.getTime() + (days || 365) * 24 * 60 * 60 * 1000);
    document.cookie = k + "=" + encodeURIComponent(v || "") + "; expires=" + d.toUTCString() + "; path=/";
  }
  function getCookie(k) {
    var name = k + "=";
    var ca = document.cookie.split(";");
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) === " ") c = c.substring(1);
      if (c.indexOf(name) === 0) return decodeURIComponent(c.substring(name.length, c.length));
    }
    return "";
  }
  function delCookie(k) {
    document.cookie = k + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
  }

  // =========================================================
  // [BID-06-03] 画面から取得（idは index.html 側で合わせる）
  // =========================================================
  BID.Profile.readFromUI = function () {
    return {
      bidderId: (document.getElementById("inpBidderId") ? document.getElementById("inpBidderId").value : "").trim(),
      email: (document.getElementById("inpEmail") ? document.getElementById("inpEmail").value : "").trim(),
      address: (document.getElementById("inpAddress") ? document.getElementById("inpAddress").value : "").trim(),
      companyName: (document.getElementById("inpCompanyName") ? document.getElementById("inpCompanyName").value : "").trim(),
      representativeName: (document.getElementById("inpRepresentativeName") ? document.getElementById("inpRepresentativeName").value : "").trim(),
      contactName: (document.getElementById("inpContactName") ? document.getElementById("inpContactName").value : "").trim(),
      contactInfo: (document.getElementById("inpContactInfo") ? document.getElementById("inpContactInfo").value : "").trim()
    };
  };

  // =========================================================
  // [BID-06-04] 必須チェック（旧: 文字列 / 新: 配列）
  // =========================================================
  BID.Profile.validate = function (p) {
    if (!p.bidderId) return "入札者番号が未入力です。";
    if (!p.email) return "メールアドレスが未入力です。";
    if (!p.address) return "住所が未入力です。";
    if (!p.companyName) return "会社名が未入力です。";
    if (!p.representativeName) return "代表者名が未入力です。";
    if (!p.contactName) return "担当者名が未入力です。";
    if (!p.contactInfo) return "担当者連絡先が未入力です。";
    return "";
  };

  // =========================================================
  // [BID-06-05] Cookie 保存／読込／削除
  // =========================================================
  BID.Profile.saveToCookie = function (p) {
    setCookie(CK.bidderId, p.bidderId, 365);
    setCookie(CK.email, p.email, 365);
    setCookie(CK.address, p.address, 365);
    setCookie(CK.companyName, p.companyName, 365);
    setCookie(CK.representativeName, p.representativeName, 365);
    setCookie(CK.contactName, p.contactName, 365);
    setCookie(CK.contactInfo, p.contactInfo, 365);
  };

  BID.Profile.loadFromCookie = function () {
    return {
      bidderId: getCookie(CK.bidderId),
      email: getCookie(CK.email),
      address: getCookie(CK.address),
      companyName: getCookie(CK.companyName),
      representativeName: getCookie(CK.representativeName),
      contactName: getCookie(CK.contactName),
      contactInfo: getCookie(CK.contactInfo)
    };
  };

  BID.Profile.clearCookie = function () {
    delCookie(CK.bidderId);
    delCookie(CK.email);
    delCookie(CK.address);
    delCookie(CK.companyName);
    delCookie(CK.representativeName);
    delCookie(CK.contactName);
    delCookie(CK.contactInfo);
  };

  // =========================================================
  // [BID-06-06] UIへ反映
  // =========================================================
  BID.Profile.applyToUI = function (p) {
    if (document.getElementById("inpBidderId")) document.getElementById("inpBidderId").value = p.bidderId || "";
    if (document.getElementById("inpEmail")) document.getElementById("inpEmail").value = p.email || "";
    if (document.getElementById("inpAddress")) document.getElementById("inpAddress").value = p.address || "";
    if (document.getElementById("inpCompanyName")) document.getElementById("inpCompanyName").value = p.companyName || "";
    if (document.getElementById("inpRepresentativeName")) document.getElementById("inpRepresentativeName").value = p.representativeName || "";
    if (document.getElementById("inpContactName")) document.getElementById("inpContactName").value = p.contactName || "";
    if (document.getElementById("inpContactInfo")) document.getElementById("inpContactInfo").value = p.contactInfo || "";
  };

  // =========================================================
  // [BID-06-90] 互換エイリアス（新コード側が呼ぶ）
  // =========================================================
  BID.Profile.readFromInputs = BID.Profile.readFromUI;
  BID.Profile.applyToInputs = BID.Profile.applyToUI;

  // [BID-06-91] 必須チェック（配列で返す：render側が join できる）
  BID.Profile.validateRequired = function (p) {
    p = p || {};
    var miss = [];
    if (!p.bidderId) miss.push("入札者番号");
    if (!p.email) miss.push("メールアドレス");
    if (!p.address) miss.push("住所");
    if (!p.companyName) miss.push("会社名");
    if (!p.representativeName) miss.push("代表者名");
    if (!p.contactName) miss.push("担当者名");
    if (!p.contactInfo) miss.push("担当者・連絡先");
    return miss;
  };

})(window);