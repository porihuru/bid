// [JST 2026-01-20 19:00]  bidder/js/06_bidder_profile.js  v20260120-01
(function (global) {
  var BID = global.BID = global.BID || {};

  // =========================================================
  // [06-01] Cookie（Edge95向けの素朴実装）
  // =========================================================
  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value || "") + ";" + expires + ";path=/";
  }

  function getCookie(name) {
    var prefix = name + "=";
    var parts = document.cookie.split(";");
    for (var i = 0; i < parts.length; i++) {
      var c = parts[i].replace(/^\s+/, "");
      if (c.indexOf(prefix) === 0) return decodeURIComponent(c.substring(prefix.length));
    }
    return "";
  }

  function deleteCookie(name) {
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  }

  function el(id) { return document.getElementById(id); }
  function trim(s) { return (s == null) ? "" : String(s).replace(/^\s+|\s+$/g, ""); }

  // =========================================================
  // [06-02] Profile API
  // =========================================================
  BID.Profile = {
    // [06-03] 画面 → state
    readFromInputs: function () {
      var p = {
        email: trim(el("inpEmail") ? el("inpEmail").value : ""),
        address: trim(el("inpAddress") ? el("inpAddress").value : ""),
        companyName: trim(el("inpCompanyName") ? el("inpCompanyName").value : ""),
        representativeName: trim(el("inpRepresentativeName") ? el("inpRepresentativeName").value : ""),
        contactName: trim(el("inpContactName") ? el("inpContactName").value : ""),
        contactInfo: trim(el("inpContactInfo") ? el("inpContactInfo").value : "")
      };
      BID.State.setProfile(p);
      return p;
    },

    // [06-04] state → 画面
    applyToInputs: function (p) {
      p = p || {};
      if (el("inpEmail")) el("inpEmail").value = p.email || "";
      if (el("inpAddress")) el("inpAddress").value = p.address || "";
      if (el("inpCompanyName")) el("inpCompanyName").value = p.companyName || "";
      if (el("inpRepresentativeName")) el("inpRepresentativeName").value = p.representativeName || "";
      if (el("inpContactName")) el("inpContactName").value = p.contactName || "";
      if (el("inpContactInfo")) el("inpContactInfo").value = p.contactInfo || "";
    },

    // [06-05] 必須チェック（未入力の項目名を返す）
    validateRequired: function (p) {
      p = p || BID.State.get().profile;
      var miss = [];
      if (!trim(p.email)) miss.push("メールアドレス");
      if (!trim(p.address)) miss.push("住所");
      if (!trim(p.companyName)) miss.push("会社名");
      if (!trim(p.representativeName)) miss.push("代表者名");
      if (!trim(p.contactName)) miss.push("担当者名");
      if (!trim(p.contactInfo)) miss.push("担当者・連絡先");

      if (miss.length) {
        BID.State.setProfileState("INCOMPLETE");
        return miss;
      }
      BID.State.setProfileState("COMPLETE");
      return [];
    },

    // [06-06] Cookie 保存
    saveToCookie: function (p) {
      p = p || BID.State.get().profile;
      var days = (BID.CONFIG && BID.CONFIG.COOKIE_DAYS) ? BID.CONFIG.COOKIE_DAYS : 180;
      var pre = (BID.CONFIG && BID.CONFIG.COOKIE_PREFIX) ? BID.CONFIG.COOKIE_PREFIX : "BIDDER_FORM_";

      setCookie(pre + "email", p.email, days);
      setCookie(pre + "address", p.address, days);
      setCookie(pre + "companyName", p.companyName, days);
      setCookie(pre + "representativeName", p.representativeName, days);
      setCookie(pre + "contactName", p.contactName, days);
      setCookie(pre + "contactInfo", p.contactInfo, days);

      BID.Log.write("[cookie] saved");
      BID.Render.setProfileAutoFillNote("Cookieに保存しました。");
    },

    // [06-07] Cookie 読込（初回起動時）
    loadFromCookie: function () {
      var pre = (BID.CONFIG && BID.CONFIG.COOKIE_PREFIX) ? BID.CONFIG.COOKIE_PREFIX : "BIDDER_FORM_";
      var p = {
        email: getCookie(pre + "email"),
        address: getCookie(pre + "address"),
        companyName: getCookie(pre + "companyName"),
        representativeName: getCookie(pre + "representativeName"),
        contactName: getCookie(pre + "contactName"),
        contactInfo: getCookie(pre + "contactInfo")
      };
      BID.State.setProfile(p);
      BID.Profile.applyToInputs(p);

      var hasAny = !!(p.email || p.address || p.companyName || p.representativeName || p.contactName || p.contactInfo);
      if (hasAny) {
        BID.Log.write("[cookie] loaded");
        BID.Render.setProfileAutoFillNote("Cookieから自動入力しました。");
      } else {
        BID.Render.setProfileAutoFillNote("");
      }

      // チェック
      var miss = BID.Profile.validateRequired(p);
      BID.Render.setProfileStatus(miss);

      return p;
    },

    // [06-08] Cookie 削除
    clearCookie: function () {
      var pre = (BID.CONFIG && BID.CONFIG.COOKIE_PREFIX) ? BID.CONFIG.COOKIE_PREFIX : "BIDDER_FORM_";
      deleteCookie(pre + "email");
      deleteCookie(pre + "address");
      deleteCookie(pre + "companyName");
      deleteCookie(pre + "representativeName");
      deleteCookie(pre + "contactName");
      deleteCookie(pre + "contactInfo");

      BID.Log.write("[cookie] cleared");
      BID.Render.setOk("Cookieを削除しました。");
      BID.Render.setProfileAutoFillNote("Cookieを削除しました。");
    }
  };
})(window);