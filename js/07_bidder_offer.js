// [JST 2026-01-23 22:30] js/07_bidder_offer.js v20260123-01
// [BID-07] offers：単価のUI反映／payload生成
(function (global) {
  var BID = global.BID = global.BID || {};

  function el(id){ return document.getElementById(id); }
  function trim(s){ return (s==null) ? "" : String(s).replace(/^\s+|\s+$/g,""); }

  function toNumberOrNaN(s){
    s = trim(s);
    if (!s) return NaN;
    // カンマ除去
    s = s.replace(/,/g,"");
    // 数値のみ許可（整数/小数）
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }

  // Cookieは profile（会社情報等）だけ持つ（単価はFirestore側）
  var CK = {
    bidderId: "BIDDER_bidderId",
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

  BID.Offer = {
    // 既存単価をテーブルへ反映
    applyLinesToTable: function (lines) {
      lines = lines || {};
      var st = BID.State.get();
      var items = st.items || [];
      for (var i = 0; i < items.length; i++) {
        var seq = String(items[i].seq);
        var v = (lines[seq] != null) ? String(lines[seq]) : "";
        var inp = el("unitPrice_" + seq);
        if (inp) inp.value = v;
      }
      BID.Log.write("[offer] applyLinesToTable OK");
    },

    // テーブルから単価を読む
    readLinesFromTable: function () {
      var st = BID.State.get();
      var items = st.items || [];
      var lines = {};
      for (var i = 0; i < items.length; i++) {
        var seq = String(items[i].seq);
        var inp = el("unitPrice_" + seq);
        var raw = inp ? String(inp.value || "") : "";
        lines[seq] = raw;
      }
      return lines;
    },

    // profile 読み取り（必須6+入札者番号）
    readProfileFromInputs: function () {
      return {
        bidderId: trim(el("inpBidderId") ? el("inpBidderId").value : ""),
        email: trim(el("inpEmail") ? el("inpEmail").value : ""),
        address: trim(el("inpAddress") ? el("inpAddress").value : ""),
        companyName: trim(el("inpCompanyName") ? el("inpCompanyName").value : ""),
        representativeName: trim(el("inpRepresentativeName") ? el("inpRepresentativeName").value : ""),
        contactName: trim(el("inpContactName") ? el("inpContactName").value : ""),
        contactInfo: trim(el("inpContactInfo") ? el("inpContactInfo").value : "")
      };
    },

    // 必須チェック（戻り値：未入力項目名配列）
    validateRequired: function (p) {
      var miss = [];
      if (!p.bidderId) miss.push("入札者番号");
      if (!p.email) miss.push("メールアドレス");
      if (!p.address) miss.push("住所");
      if (!p.companyName) miss.push("会社名");
      if (!p.representativeName) miss.push("代表者名");
      if (!p.contactName) miss.push("担当者名");
      if (!p.contactInfo) miss.push("担当者・連絡先");
      return miss;
    },

    // Cookie（profileのみ）
    saveProfileToCookie: function (p) {
      setCookie(CK.bidderId, p.bidderId, 365);
      setCookie(CK.email, p.email, 365);
      setCookie(CK.address, p.address, 365);
      setCookie(CK.companyName, p.companyName, 365);
      setCookie(CK.representativeName, p.representativeName, 365);
      setCookie(CK.contactName, p.contactName, 365);
      setCookie(CK.contactInfo, p.contactInfo, 365);
      BID.Log.write("[cookie] save OK");
    },

    loadProfileFromCookie: function () {
      return {
        bidderId: getCookie(CK.bidderId),
        email: getCookie(CK.email),
        address: getCookie(CK.address),
        companyName: getCookie(CK.companyName),
        representativeName: getCookie(CK.representativeName),
        contactName: getCookie(CK.contactName),
        contactInfo: getCookie(CK.contactInfo)
      };
    },

    clearProfileCookie: function () {
      delCookie(CK.bidderId);
      delCookie(CK.email);
      delCookie(CK.address);
      delCookie(CK.companyName);
      delCookie(CK.representativeName);
      delCookie(CK.contactName);
      delCookie(CK.contactInfo);
      BID.Log.write("[cookie] clear OK");
    },

    applyProfileToInputs: function (p) {
      if (el("inpBidderId")) el("inpBidderId").value = p.bidderId || "";
      if (el("inpEmail")) el("inpEmail").value = p.email || "";
      if (el("inpAddress")) el("inpAddress").value = p.address || "";
      if (el("inpCompanyName")) el("inpCompanyName").value = p.companyName || "";
      if (el("inpRepresentativeName")) el("inpRepresentativeName").value = p.representativeName || "";
      if (el("inpContactName")) el("inpContactName").value = p.contactName || "";
      if (el("inpContactInfo")) el("inpContactInfo").value = p.contactInfo || "";
    },

    // 保存payload生成（失敗理由は必ず画面に出す）
    buildOfferPayload: function () {
      var st = BID.State.get();
      var p = BID.Offer.readProfileFromInputs();

      // bidderId はログインIDと一致させる（事故防止）
      if (!st.bidderId) {
        BID.Render.setError("保存できません：ログイン状態を確認してください（入札者IDが未設定）。");
        BID.Log.write("[payload] NG: st.bidderId empty");
        return null;
      }
      p.bidderId = st.bidderId;
      if (el("inpBidderId")) el("inpBidderId").value = st.bidderId;

      var miss = BID.Offer.validateRequired(p);
      if (miss.length) {
        BID.Render.setError("保存できません：必須未入力（" + miss.join(" / ") + "）");
        BID.Log.write("[payload] NG: missing " + miss.join(","));
        return null;
      }

      // 単価チェック：全品目必須（運用上確実）
      var rawLines = BID.Offer.readLinesFromTable();
      var items = st.items || [];
      var lines = {};
      for (var i = 0; i < items.length; i++) {
        var seq = String(items[i].seq);
        var n = toNumberOrNaN(rawLines[seq]);
        if (isNaN(n)) {
          BID.Render.setError("保存できません：単価が未入力または不正です（seq=" + seq + "）");
          BID.Log.write("[payload] NG: price invalid seq=" + seq + " raw=" + (rawLines[seq]||""));
          return null;
        }
        lines[seq] = String(n);
      }

      // 返却payload
      var doc = {
        bidderId: st.bidderId,
        profile: {
          bidderId: p.bidderId,
          email: p.email,
          address: p.address,
          companyName: p.companyName,
          representativeName: p.representativeName,
          contactName: p.contactName,
          contactInfo: p.contactInfo
        },
        lines: lines
      };

      BID.Log.write("[payload] OK");
      return doc;
    }
  };

  try { if (BID.Log && BID.Log.ver) BID.Log.ver("07_bidder_offer.js", "v20260123-01"); } catch (e) {}
})(window);
