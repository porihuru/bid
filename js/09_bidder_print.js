/* [JST 2026-02-02 19:25]  09_bidder_print.js v20260202-02
   入札フォーム（入札者） PDF出力（B案：PDFを直接組む）

   修正点(v20260202-02):
   - bidNo取得経路を強化：
     1) BidderState.get().bidNo
     2) 画面表示 lblBidNo
     3) BidderConfig.BID_NO_DEFAULT
     4) URL ?bidNo=
   → 「URLにbidNoが無い」運用でも落ちない

   要件:
   - 「入札者情報」「入札概要」「納入条件」「入札単価」を必ず入れる
   - PDFは必ず左右上下に余白を入れる
   - 修正しやすいように番号と注釈で整理
*/

(function(){
  "use strict";

  var FILE = "09_bidder_print.js";
  var VER  = "v20260202-02";
  var TS   = new Date().toISOString();

  // =========================================================
  // [PDF-00] ロガー（03があれば03へ、無ければBOOTLOG/console）
  // =========================================================
  function toStr(e){
    try{ return (e && e.message) ? e.message : String(e); }catch(ex){ return "" + e; }
  }
  function L(tag, msg){
    try{
      if(window.BidderLog && window.BidderLog.write) return window.BidderLog.write(tag, msg);
      if(window.BOOTLOG && window.BOOTLOG.write) return window.BOOTLOG.write(tag, msg);
      console.log("[" + tag + "] " + msg);
    }catch(e){
      try{ console.log("[" + tag + "] " + msg); }catch(ex){}
    }
  }

  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });
  L("ver", TS + " " + FILE + " " + VER);

  // =========================================================
  // [PDF-01] 設計パラメータ（ここだけ触ればデザイン調整が楽）
  // =========================================================
  var CFG = {
    // [PDF-01-01] 用紙（A4 portrait, pt）
    PAGE_W: 595.28,
    PAGE_H: 841.89,

    // [PDF-01-02] 余白（必ず適用）
    MARGIN_L: 42,
    MARGIN_R: 42,
    MARGIN_T: 42,
    MARGIN_B: 42,

    // [PDF-01-03] 文字サイズ
    FONT_BODY: 10.5,
    FONT_SMALL: 9.0,
    FONT_H1: 15,
    FONT_H2: 12,

    // [PDF-01-04] 行高（倍率）
    LINE_GAP: 1.35,

    // [PDF-01-05] 罫線
    LINE_W: 0.7,

    // [PDF-01-06] テーブル列幅（pt）
    TBL_W_NO:   34,
    TBL_W_NAME: 210,
    TBL_W_QTY:  78,
    TBL_W_PRICE:76,
    TBL_W_NOTE: 113.28
  };

  // =========================================================
  // [PDF-02] 外部ライブラリを 09 側で自動ロード
  // =========================================================
  function loadScriptOnce(url, checkFn){
    return new Promise(function(resolve, reject){
      try{
        if(checkFn && checkFn()) return resolve(true);
        var s = document.createElement("script");
        s.src = url;
        s.async = true;
        s.onload = function(){
          try{
            if(checkFn && !checkFn()) return reject(new Error("script loaded but global not found"));
            resolve(true);
          }catch(e){ reject(e); }
        };
        s.onerror = function(){ reject(new Error("failed to load: " + url)); };
        document.head.appendChild(s);
      }catch(e){ reject(e); }
    });
  }

  function ensurePdfLib(){
    var urlPdfLib = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
    var urlFontKit = "https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js";

    return loadScriptOnce(urlPdfLib, function(){
      return !!window.PDFLib && !!window.PDFLib.PDFDocument;
    }).then(function(){
      return loadScriptOnce(urlFontKit, function(){
        return !!window.fontkit;
      });
    }).then(function(){
      return true;
    });
  }

  // =========================================================
  // [PDF-03] データ取得
  // =========================================================
  function getUrlParam(name){
    try{
      var u = new URL(location.href);
      return u.searchParams.get(name);
    }catch(e){
      try{
        var q = location.search || "";
        q = q.replace(/^\?/,"");
        var parts = q.split("&");
        for(var i=0;i<parts.length;i++){
          var kv = parts[i].split("=");
          if(decodeURIComponent(kv[0]||"") === name){
            return decodeURIComponent(kv[1]||"");
          }
        }
      }catch(ex){}
      return null;
    }
  }

  function getInputValue(id){
    var el = document.getElementById(id);
    if(!el) return "";
    return (el.value || "").trim();
  }

  function getTextContent(id){
    var el = document.getElementById(id);
    if(!el) return "";
    return (el.textContent || "").trim();
  }

  function getUnitPricesFromDom(){
    var map = {};
    try{
      var tb = document.getElementById("tbodyItems");
      if(!tb) return map;
      var inputs = tb.querySelectorAll("input[data-seq]");
      for(var i=0;i<inputs.length;i++){
        var seq = inputs[i].getAttribute("data-seq");
        var val = (inputs[i].value || "").trim();
        if(seq != null) map[String(seq)] = val;
      }
    }catch(e){}
    return map;
  }

  function firebaseReady(){
    return (typeof window.firebase !== "undefined"
      && window.firebase
      && window.firebase.apps
      && window.firebase.auth
      && window.firebase.firestore);
  }
  function db(){ return window.firebase.firestore(); }
  function bidDocRef(bidNo){ return db().collection("bids").doc(bidNo); }
  function itemsColRef(bidNo){ return bidDocRef(bidNo).collection("items"); }
  function offerDocRef(bidNo, bidderId){ return bidDocRef(bidNo).collection("offers").doc(bidderId); }

  function getBidderStateSafe(){
    try{
      if(window.BidderState && window.BidderState.get){
        var s = window.BidderState.get();
        if(s && typeof s === "object") return s;
      }
    }catch(e){}
    return {};
  }

  // [PDF-03-06] ★bidNo解決を強化（今回の不具合の原因箇所）
  function resolveBidNo(){
    var st = getBidderStateSafe();

    // 1) BidderState
    var b1 = (st && (st.bidNo || st.bidno || st.BidNo)) ? String(st.bidNo || st.bidno || st.BidNo).trim() : "";
    if(b1 && b1 !== "-") return b1;

    // 2) 画面表示（あなたのログで lblBidNo は正しく表示されている）
    var b2 = getTextContent("lblBidNo");
    if(b2 && b2 !== "-" && b2 !== "—") return b2;

    // 3) Config default
    var b3 = (window.BidderConfig && window.BidderConfig.BID_NO_DEFAULT) ? String(window.BidderConfig.BID_NO_DEFAULT).trim() : "";
    if(b3 && b3 !== "-") return b3;

    // 4) URL
    var b4 = (getUrlParam("bidNo") || "").trim();
    if(b4 && b4 !== "-") return b4;

    return "";
  }

  function buildPdfModel(){
    var st = getBidderStateSafe();

    var bidNo = resolveBidNo();
    if(!bidNo){
      // ここで、原因が追えるように “候補値” をログに出す
      L("pdfData", "bidNo resolve FAILED");
      L("pdfData", "  state.bidNo=" + (st.bidNo || "") + " state.bidno=" + (st.bidno || "") );
      L("pdfData", "  lblBidNo=" + getTextContent("lblBidNo"));
      L("pdfData", "  cfg.BID_NO_DEFAULT=" + ((window.BidderConfig && window.BidderConfig.BID_NO_DEFAULT) || ""));
      L("pdfData", "  url.bidNo=" + (getUrlParam("bidNo") || ""));
      throw new Error("bidNo が取得できません（画面の入札番号表示 / BidderConfig / URL を確認）");
    }

    var bidderId = (st.bidderId || "") || getInputValue("txtBidderId");

    var bidderProfile = {
      bidderId: bidderId || "",
      email: getInputValue("txtEmail"),
      address: getInputValue("txtAddress"),
      companyName: getInputValue("txtCompanyName"),
      representativeName: getInputValue("txtRepresentativeName"),
      contactName: getInputValue("txtContactName"),
      contactInfo: getInputValue("txtContactInfo")
    };

    var unitPricesDom = getUnitPricesFromDom();

    return {
      bidNo: bidNo,
      bidderId: bidderId || "",
      bidderProfile: bidderProfile,
      unitPricesDom: unitPricesDom,
      header: null,
      items: [],
      offerLines: null
    };
  }

  function fillModelFromFirestore(model){
    if(!firebaseReady()) throw new Error("Firebase SDK が未ロードです（index.html の firebase-*-compat.js を確認）");

    var bidNo = model.bidNo;
    var bidderId = model.bidderId;

    L("pdfData", "bidNo=" + bidNo);

    return bidDocRef(bidNo).get().then(function(snap){
      if(!snap.exists) throw new Error("bids/" + bidNo + " が存在しません");
      model.header = snap.data() || {};
      return itemsColRef(bidNo).orderBy("seq").get();
    }).then(function(qs){
      var arr = [];
      qs.forEach(function(doc){
        var d = doc.data() || {};
        arr.push({
          id: doc.id,
          seq: d.seq,
          name: d.name || "",
          spec: d.spec || "",
          qty:  d.qty,
          unit: d.unit || "",
          note: d.note || ""
        });
      });
      model.items = arr;

      if(!bidderId) return null;
      return offerDocRef(bidNo, bidderId).get().then(function(os){
        if(!os.exists) return null;
        var od = os.data() || {};
        model.offerLines = od.lines || null;
        return true;
      }).catch(function(e){
        L("pdfData", "offer read skipped: " + toStr(e));
        return null;
      });

    }).then(function(){
      var h = model.header || {};
      L("pdfData", "to1=" + (h.to1||"") + " / to2=" + (h.to2||"") + " / to3=" + (h.to3||""));
      L("pdfData", "bidDate=" + (h.bidDate||"") + " / deliveryPlace=" + (h.deliveryPlace||"") + " / dueDate=" + (h.dueDate||""));
      L("pdfData", "note=" + (h.note||""));
      L("pdfData", "items=" + (model.items ? model.items.length : 0));
      return model;
    });
  }

  function getUnitPriceForSeq(model, seq){
    var k = String(seq == null ? "" : seq);
    if(model.unitPricesDom && model.unitPricesDom[k] != null && model.unitPricesDom[k] !== ""){
      return String(model.unitPricesDom[k]);
    }
    if(model.offerLines && model.offerLines[k] != null && model.offerLines[k] !== ""){
      return String(model.offerLines[k]);
    }
    return "";
  }

  // =========================================================
  // [PDF-04] フォント
  // =========================================================
  function fetchArrayBuffer(url){
    return fetch(url).then(function(r){
      if(!r.ok) throw new Error("fetch failed: " + url);
      return r.arrayBuffer();
    });
  }

  function ensureFonts(pdfDoc){
    try{ pdfDoc.registerFontkit(window.fontkit); }catch(e){ L("warn", "registerFontkit failed: " + toStr(e)); }

    var URL_REG = "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.20/files/noto-sans-jp-japanese-400-normal.woff";
    var URL_BOLD= "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.20/files/noto-sans-jp-japanese-700-normal.woff";

    return Promise.resolve().then(function(){
      return fetchArrayBuffer(URL_REG).then(function(ab){
        return pdfDoc.embedFont(ab, { subset: true });
      });
    }).then(function(fontReg){
      return fetchArrayBuffer(URL_BOLD).then(function(ab){
        return pdfDoc.embedFont(ab, { subset: true });
      }).then(function(fontBold){
        return { reg: fontReg, bold: fontBold, ok: true };
      });
    }).catch(function(e){
      L("warn", "NotoSansJP embed failed -> fallback fonts. " + toStr(e));
      return Promise.all([
        pdfDoc.embedFont(window.PDFLib.StandardFonts.Helvetica),
        pdfDoc.embedFont(window.PDFLib.StandardFonts.HelveticaBold)
      ]).then(function(arr){
        return { reg: arr[0], bold: arr[1], ok: false };
      });
    });
  }

  // =========================================================
  // [PDF-05] レイアウト小物
  // =========================================================
  function pad2(n){ return (n<10) ? ("0"+n) : String(n); }
  function yyyymmdd(){
    var d = new Date();
    return d.getFullYear() + pad2(d.getMonth()+1) + pad2(d.getDate());
  }
  function nowJstLabel(){
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate())
      + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function wrapTextByChar(text, maxWidth, font, size){
    text = (text == null) ? "" : String(text);
    var lines = [];
    var cur = "";
    var parts = text.split(/\r?\n/);
    for(var p=0;p<parts.length;p++){
      var s = parts[p];
      if(s === ""){
        lines.push("");
        continue;
      }
      cur = "";
      for(var i=0;i<s.length;i++){
        var ch = s.charAt(i);
        var t = cur + ch;
        var w = font.widthOfTextAtSize(t, size);
        if(w <= maxWidth){
          cur = t;
        }else{
          if(cur) lines.push(cur);
          cur = ch;
        }
      }
      if(cur) lines.push(cur);
    }
    return lines;
  }

  // =========================================================
  // [PDF-06] PDF描画本体
  // =========================================================
  function renderPdf(model){
    var PDFLib = window.PDFLib;

    return PDFLib.PDFDocument.create().then(function(pdfDoc){
      return ensureFonts(pdfDoc).then(function(fonts){
        var fontReg = fonts.reg;
        var fontBold= fonts.bold;

        var page = pdfDoc.addPage([CFG.PAGE_W, CFG.PAGE_H]);
        var ctx = {
          pdfDoc: pdfDoc,
          page: page,
          fontReg: fontReg,
          fontBold: fontBold,
          cursorY: CFG.PAGE_H - CFG.MARGIN_T
        };

        var contentW = CFG.PAGE_W - (CFG.MARGIN_L + CFG.MARGIN_R);

        function newPage(){
          ctx.page = pdfDoc.addPage([CFG.PAGE_W, CFG.PAGE_H]);
          ctx.cursorY = CFG.PAGE_H - CFG.MARGIN_T;
        }
        function need(height){
          if(ctx.cursorY - height < CFG.MARGIN_B){
            newPage();
          }
        }
        function drawText(text, x, y, size, bold){
          ctx.page.drawText(String(text == null ? "" : text), {
            x: x, y: y,
            size: size,
            font: bold ? ctx.fontBold : ctx.fontReg
          });
        }
        function drawLine(x1,y1,x2,y2){
          ctx.page.drawLine({
            start: {x:x1, y:y1},
            end: {x:x2, y:y2},
            thickness: CFG.LINE_W
          });
        }
        function drawBox(x,y,w,h){
          drawLine(x, y, x+w, y);
          drawLine(x, y-h, x+w, y-h);
          drawLine(x, y, x, y-h);
          drawLine(x+w, y, x+w, y-h);
        }
        function hLine(y){
          drawLine(CFG.MARGIN_L, y, CFG.MARGIN_L + contentW, y);
        }

        function writeBlock(title, lines, opt){
          opt = opt || {};
          var titleSize = opt.titleSize || CFG.FONT_H2;
          var bodySize  = opt.bodySize || CFG.FONT_BODY;
          var gap = bodySize * CFG.LINE_GAP;

          need(titleSize + 10);
          drawText(title, CFG.MARGIN_L, ctx.cursorY - titleSize, titleSize, true);
          ctx.cursorY -= (titleSize + 6);

          hLine(ctx.cursorY);
          ctx.cursorY -= 10;

          for(var i=0;i<lines.length;i++){
            var row = lines[i];
            if(typeof row === "string"){
              var wlines = wrapTextByChar(row, contentW, ctx.fontReg, bodySize);
              for(var j=0;j<wlines.length;j++){
                need(gap);
                drawText(wlines[j], CFG.MARGIN_L, ctx.cursorY - bodySize, bodySize, false);
                ctx.cursorY -= gap;
              }
              continue;
            }

            var k = row.k || "";
            var v = row.v || "";
            var kW = 92;
            var vW = contentW - kW - 10;

            var vLines = wrapTextByChar(v, vW, ctx.fontReg, bodySize);
            var rowH = Math.max(1, vLines.length) * gap;

            need(rowH);

            drawText(k, CFG.MARGIN_L, ctx.cursorY - bodySize, bodySize, true);

            for(var t=0;t<vLines.length;t++){
              drawText(vLines[t], CFG.MARGIN_L + kW + 10, (ctx.cursorY - bodySize) - (gap * t), bodySize, false);
            }

            ctx.cursorY -= rowH;
          }

          ctx.cursorY -= 6;
        }

        // [PDF-06-02] タイトル
        (function(){
          var title = "入札書";
          var sub = "入札番号: " + (model.bidNo || "");
          need(40);
          drawText(title, CFG.MARGIN_L, ctx.cursorY - CFG.FONT_H1, CFG.FONT_H1, true);
          drawText(sub,  CFG.MARGIN_L, ctx.cursorY - CFG.FONT_H1 - 18, CFG.FONT_BODY, false);
          ctx.cursorY -= 40;
          hLine(ctx.cursorY);
          ctx.cursorY -= 18;
        })();

        // [PDF-06-03] 入札者情報（必須）
        (function(){
          var p = model.bidderProfile || {};
          writeBlock("入札者情報", [
            { k:"会社名", v: p.companyName || "" },
            { k:"住所",   v: p.address || "" },
            { k:"代表者名", v: p.representativeName || "" },
            { k:"担当者名", v: p.contactName || "" },
            { k:"担当者連絡先", v: p.contactInfo || "" },
            { k:"メール", v: p.email || "" }
          ]);
        })();

        // [PDF-06-04] 入札概要（必須）
        (function(){
          var h = model.header || {};
          var to = [h.to1, h.to2, h.to3].filter(Boolean).join(" / ");
          writeBlock("入札概要", [
            { k:"入札番号", v: model.bidNo || "" },
            { k:"宛先", v: to || "" },
            { k:"入札日", v: h.bidDate || "" },
            { k:"状態", v: h.status || "" }
          ]);
        })();

        // [PDF-06-05] 納入条件（必須）
        (function(){
          var h = model.header || {};
          var notes = [];
          if(h.note) notes.push(h.note);
          if(h.note1) notes.push(h.note1);
          if(h.note2) notes.push(h.note2);
          if(h.note3) notes.push(h.note3);
          if(h.note4) notes.push(h.note4);

          writeBlock("納入条件", [
            { k:"納入場所", v: h.deliveryPlace || "" },
            { k:"納期", v: h.dueDate || "" },
            { k:"備考", v: notes.join("\n") }
          ]);
        })();

        // [PDF-06-06] 入札単価（必須：表）
        (function(){
          var h2 = CFG.FONT_H2;
          var body = CFG.FONT_BODY;
          var gap = body * CFG.LINE_GAP;

          need(h2 + 24);
          drawText("入札単価", CFG.MARGIN_L, ctx.cursorY - h2, h2, true);
          ctx.cursorY -= (h2 + 6);
          hLine(ctx.cursorY);
          ctx.cursorY -= 12;

          var x0 = CFG.MARGIN_L;

          var wNo    = CFG.TBL_W_NO;
          var wName  = CFG.TBL_W_NAME;
          var wQty   = CFG.TBL_W_QTY;
          var wPrice = CFG.TBL_W_PRICE;
          var wNote  = CFG.TBL_W_NOTE;

          var tableW = wNo + wName + wQty + wPrice + wNote;

          var headerH = 18;

          function drawTableHeader(){
            need(headerH + 6);
            var y0 = ctx.cursorY;

            drawBox(x0, y0, tableW, headerH);

            drawLine(x0 + wNo, y0, x0 + wNo, y0 - headerH);
            drawLine(x0 + wNo + wName, y0, x0 + wNo + wName, y0 - headerH);
            drawLine(x0 + wNo + wName + wQty, y0, x0 + wNo + wName + wQty, y0 - headerH);
            drawLine(x0 + wNo + wName + wQty + wPrice, y0, x0 + wNo + wName + wQty + wPrice, y0 - headerH);

            drawText("番号", x0 + 4, y0 - 12, 9.5, true);
            drawText("品名／規格", x0 + wNo + 4, y0 - 12, 9.5, true);
            drawText("予定数量", x0 + wNo + wName + 4, y0 - 12, 9.5, true);
            drawText("入札単価", x0 + wNo + wName + wQty + 4, y0 - 12, 9.5, true);
            drawText("備考", x0 + wNo + wName + wQty + wPrice + 4, y0 - 12, 9.5, true);

            ctx.cursorY -= headerH;
          }

          function drawRow(it){
            var seq = (it.seq == null) ? "" : String(it.seq);
            var price = getUnitPriceForSeq(model, seq);

            var nameLines = wrapTextByChar(it.name || "", wName - 8, ctx.fontReg, body);
            var specLines = wrapTextByChar(it.spec || "", wName - 8, ctx.fontReg, CFG.FONT_SMALL);
            var noteLines = wrapTextByChar(it.note || "", wNote - 8, ctx.fontReg, CFG.FONT_SMALL);

            var linesCount = Math.max(
              1,
              nameLines.length + specLines.length,
              noteLines.length
            );

            var rowH = Math.max(22, linesCount * gap);

            need(rowH + 4);

            var y = ctx.cursorY;

            drawBox(x0, y, tableW, rowH);

            drawLine(x0 + wNo, y, x0 + wNo, y - rowH);
            drawLine(x0 + wNo + wName, y, x0 + wNo + wName, y - rowH);
            drawLine(x0 + wNo + wName + wQty, y, x0 + wNo + wName + wQty, y - rowH);
            drawLine(x0 + wNo + wName + wQty + wPrice, y, x0 + wNo + wName + wQty + wPrice, y - rowH);

            drawText(seq, x0 + 4, y - 13, body, false);

            var ty = y - 13;
            for(var i=0;i<nameLines.length;i++){
              drawText(nameLines[i], x0 + wNo + 4, ty, body, false);
              ty -= gap;
            }
            for(var j=0;j<specLines.length;j++){
              drawText(specLines[j], x0 + wNo + 4, ty, CFG.FONT_SMALL, false);
              ty -= (CFG.FONT_SMALL * CFG.LINE_GAP);
            }

            var qtyStr = (it.qty == null ? "" : String(it.qty)) + (it.unit ? (" " + it.unit) : "");
            var qtyLines = wrapTextByChar(qtyStr, wQty - 8, ctx.fontReg, body);
            drawText(qtyLines[0] || "", x0 + wNo + wName + 4, y - 13, body, false);

            var priceLines = wrapTextByChar(price, wPrice - 8, ctx.fontReg, body);
            drawText(priceLines[0] || "", x0 + wNo + wName + wQty + 4, y - 13, body, false);

            var ny = y - 13;
            for(var k=0;k<noteLines.length;k++){
              drawText(noteLines[k], x0 + wNo + wName + wQty + wPrice + 4, ny, CFG.FONT_SMALL, false);
              ny -= (CFG.FONT_SMALL * CFG.LINE_GAP);
            }

            ctx.cursorY -= rowH;
          }

          drawTableHeader();

          var items = model.items || [];
          if(!items.length){
            need(22);
            drawText("品目がありません。", CFG.MARGIN_L, ctx.cursorY - body, body, false);
            ctx.cursorY -= 24;
          }else{
            for(var i=0;i<items.length;i++){
              // need() が改ページしたら、ヘッダ描き直し
              var beforeY = ctx.cursorY;
              drawRow(items[i]);
              if(ctx.cursorY > beforeY){
                ctx.cursorY -= 12;
                drawTableHeader();
                drawRow(items[i]);
              }
            }
          }

          ctx.cursorY -= 10;
        })();

        // [PDF-06-07] フッタ
        (function(){
          need(30);
          hLine(CFG.MARGIN_B + 18);
          drawText("生成: " + nowJstLabel(), CFG.MARGIN_L, CFG.MARGIN_B + 6, CFG.FONT_SMALL, false);
        })();

        return pdfDoc.save().then(function(bytes){
          return { bytes: bytes, fontsOk: fonts.ok };
        });
      });
    });
  }

  // =========================================================
  // [PDF-07] 保存（ダウンロード）
  // =========================================================
  function downloadPdf(bytes, filename){
    var blob = new Blob([bytes], { type: "application/pdf" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){
      try{ URL.revokeObjectURL(url); }catch(e){}
      try{ document.body.removeChild(a); }catch(ex){}
    }, 0);
  }

  // =========================================================
  // [PDF-08] 公開API
  // =========================================================
  function doPdf(){
    L("pdf", "PDF生成開始（B案: 直接PDF組み）");

    return ensurePdfLib().then(function(){
      var model = buildPdfModel();

      return fillModelFromFirestore(model).then(function(m2){
        try{
          L("pdfData", "to=" + [m2.header && m2.header.to1, m2.header && m2.header.to2, m2.header && m2.header.to3].filter(Boolean).join(" / "));
          L("pdfData", "bidDate=" + ((m2.header && m2.header.bidDate) || "") + " deliveryPlace=" + ((m2.header && m2.header.deliveryPlace) || "") + " dueDate=" + ((m2.header && m2.header.dueDate) || ""));
          L("pdfData", "note=" + ((m2.header && m2.header.note) || ""));
          L("pdfData", "items=" + (m2.items ? m2.items.length : 0));
        }catch(e){}

        return renderPdf(m2).then(function(res){
          var fn = "入札書_" + (m2.bidNo || "unknown") + "_" + yyyymmdd() + ".pdf";
          downloadPdf(res.bytes, fn);
          L("pdf", "PDF保存完了: " + fn + (res.fontsOk ? "" : "（警告: 日本語フォント埋込失敗→代替フォント）"));
          return true;
        });
      });
    }).catch(function(e){
      L("pdf", "FAILED: " + toStr(e));
      throw e;
    });
  }

  function doPrint(){
    return doPdf();
  }

  window.BidderPrint = {
    doPdf: doPdf,
    doPrint: doPrint
  };

})();