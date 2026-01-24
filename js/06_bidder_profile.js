// [JST 2026-01-24 21:00] bidder/js/06_bidder_profile.js v20260124-01
// [BID-06] 入札者情報（必須6項目）+ Cookie
(function (global) {
  var BID = global.BID = global.BID || {};
  if (BID.Build && BID.Build.register) BID.Build.register("06_bidder_profile.js", "v20260124-01");

  BID.Profile = BID.Profile || {};

  // [06-01] Cookie key
  var CK = {
    email: "BIDDER_email",
    address: "BIDDER_address",
    companyName: "BIDDER_companyName",
    representativeName: "BIDDER_representativeName",
    contactName: "BIDDER_contactName",
    contactInfo: "BIDDER_contactInfo"
  };

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

  function el(id) { return document.getElementById(id); }
  function trim(s) { return (s == null) ? "" : String(s).replace(/^\s+|\s+$/g, ""); }

  // [06-02] UIから取得
  BID.Profile.readFromInputs = function () {
    return {
      email: trim(el("inpEmail") ? el("inpEmail").value : ""),
      address: trim(el("inpAddress") ? el("inpAddress").value : ""),
      companyName: trim(el("inpCompanyName") ? el("inpCompanyName").value : ""),
      representativeName: trim(el("inpRepresentativeName") ? el("inpRepresentativeName").value : ""),
      contactName: trim(el("inpContactName") ? el("inpContactName").value : ""),
      contactInfo: trim(el("inpContactInfo") ? el("inpContactInfo").value : "")
    };
  };

  // [06-03] 必須チェック（未入力項目名配列）
  BID.Profile.validateRequired = function (p) {
    var miss = [];
    if (!p.email) miss.push("メール");
    if (!p.address) miss.push("住所");
    if (!p.companyName) miss.push("会社名");
    if (!p.representativeName) miss.push("代表者名");
    if (!p.contactName) miss.push("担当者名");
    if (!p.contactInfo) miss.push("連絡先");
    return miss;
  };

  // [06-04] Cookie
  BID.Profile.saveToCookie = function (p) {
    p = p || {};
    setCookie(CK.email, p.email, 365);
    setCookie(CK.address, p.address, 365);
    setCookie(CK.companyName, p.companyName, 365);
    setCookie(CK.representativeName, p.representativeName, 365);
    setCookie(CK.contactName, p.contactName, 365);
    setCookie(CK.contactInfo, p.contactInfo, 365);
  };

  BID.Profile.loadFromCookie = function () {
    return {
      email: getCookie(CK.email),
      address: getCookie(CK.address),
      companyName: getCookie(CK.companyName),
      representativeName: getCookie(CK.representativeName),
      contactName: getCookie(CK.contactName),
      contactInfo: getCookie(CK.contactInfo)
    };
  };

  BID.Profile.clearCookie = function () {
    delCookie(CK.email);
    delCookie(CK.address);
    delCookie(CK.companyName);
    delCookie(CK.representativeName);
    delCookie(CK.contactName);
    delCookie(CK.contactInfo);
  };

  // [06-05] UIへ反映
  BID.Profile.applyToInputs = function (p) {
    p = p || {};
    if (el("inpEmail")) el("inpEmail").value = p.email || "";
    if (el("inpAddress")) el("inpAddress").value = p.address || "";
    if (el("inpCompanyName")) el("inpCompanyName").value = p.companyName || "";
    if (el("inpRepresentativeName")) el("inpRepresentativeName").value = p.representativeName || "";
    if (el("inpContactName")) el("inpContactName").value = p.contactName || "";
    if (el("inpContactInfo")) el("inpContactInfo").value = p.contactInfo || "";
  };

})(window);
