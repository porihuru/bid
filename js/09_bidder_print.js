/* [JST 2026-02-02 19:00]  09_bidder_print.js v20260202-01
   入札フォーム（入札者） PDF出力（B案：PDFを直接組む）

   要件:
   - 「入札者情報」「入札概要」「納入条件」「入札単価」を必ず入れる
   - PDFは必ず左右上下に余白を入れる
   - 修正しやすいように番号と注釈で整理

   依存:
   - 10_bidder_app.js から window.BidderPrint.doPdf() が呼ばれる想定
   - Firebase は既に初期化済み（10側）でも、09側でも読めるように防御
*/

(function(){
  "use strict";

  var FILE = "09_bidder_print.js";
  var VER  = "v20260202-01";
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

    // [PDF-01-06] テーブル列幅（pt）※合計が本文幅内に収まるように
    // 本文幅 = PAGE_W - (MARGIN_L + MARGIN_R)
    // 例: 595.28 - 84 = 511.28
    TBL_W_NO:   34,
    TBL_W_NAME: 210,
    TBL_W_QTY:  78,
    TBL_W_PRICE:76,
    TBL_W_NOTE: 113.28  // 余り
  };

  // =========================================================
  // [PDF-02] 外部ライブラリを 09 側で自動ロード（HTMLをいじらずに済む）
  //   - pdf-lib
  //   - fontkit（日本語フォント埋め込み用）
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
    // pdf-lib v1.17.1（安定版）
    var urlPdfLib = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
    // fontkit（pdf-lib と一緒に使う）
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
  // [PDF-03] データ取得（Firestore + 画面入力を統合して “1つのモデル” にする）
  // =========================================================

  // [PDF-03-01] URLパラメータ取得（bidNo）
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

  // [PDF-03-02] DOM値（入札者情報：入力欄）
  function getInputValue(id){
    var el = document.getElementById(id);
    if(!el) return "";
    return (el.value || "").trim();
  }

  // [PDF-03-03] DOM値（単価：品目テーブルの input[data-seq] ）
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

  // [PDF-03-04] Firebase / Firestore（09でも読めるように防御）
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

  // [PDF-03-05] 画面の state 取得（あれば）※無くても動く
  function getBidderStateSafe(){
    try{
      if(window.BidderState && window.BidderState.get){
        var s = window.BidderState.get();
        if(s && typeof s === "object") return s;
      }
    }catch(e){}
    return {};
  }

  // [PDF-03-06] PDFに必要な “単一モデル” を組み立てる
  //  - 可能な限り Firestore を真としつつ、単価は画面入力を優先
  function buildPdfModel(){
    var st = getBidderStateSafe();
    var bidNo = (st.bidNo || "") || (getUrlParam("bidNo") || "");
    if(!bidNo) throw new Error("bidNo が取得できません（URL ?bidNo=XXXX を確認）");

    // 入札者IDは state or 入力欄
    var bidderId = (st.bidderId || "") || getInputValue("txtBidderId");

    // 入札者情報（入力欄）
    var bidderProfile = {
      bidderId: bidderId || "",
      email: getInputValue("txtEmail"),
      address: getInputValue("txtAddress"),
      companyName: getInputValue("txtCompanyName"),
      representativeName: getInputValue("txtRepresentativeName"),
      contactName: getInputValue("txtContactName"),
      contactInfo: getInputValue("txtContactInfo")
    };

    // 画面入力の単価（最優先）
    var unitPricesDom = getUnitPricesFromDom();

    return {
      bidNo: bidNo,
      bidderId: bidderId || "",
      bidderProfile: bidderProfile,
      unitPricesDom: unitPricesDom,

      // Firestoreで埋める
      header: null,
      items: [],
      offerLines: null
    };
  }

  // [PDF-03-07] Firestoreからヘッダ/品目/（あれば）offer を読む
  function fillModelFromFirestore(model){
    if(!firebaseReady()) throw new Error("Firebase SDK が未ロードです（index.html の firebase-*-compat.js を確認）");

    var bidNo = model.bidNo;
    var bidderId = model.bidderId;

    L("pdfData", "bidNo=" + bidNo);

    // bids/{bidNo}
    return bidDocRef(bidNo).get().then(function(snap){
      if(!snap.exists) throw new Error("bids/" + bidNo + " が存在しません");
      model.header = snap.data() || {};
      // items
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

      // offers（bidderIdが分かる場合のみ）
      if(!bidderId) return null;
      return offerDocRef(bidNo, bidderId).get().then(function(os){
        if(!os.exists) return null;
        var od = os.data() || {};
        model.offerLines = od.lines || null;
        return true;
      }).catch(function(e){
        // 権限などで落ちても致命にしない
        L("pdfData", "offer read skipped: " + toStr(e));
        return null;
      });

    }).then(function(){
      // ログ（ヘッダの確認）
      var h = model.header || {};
      L("pdfData", "to1=" + (h.to1||"") + " / to2=" + (h.to2||"") + " / to3=" + (h.to3||""));
      L("pdfData", "bidDate=" + (h.bidDate||"") + " / deliveryPlace=" + (h.deliveryPlace||"") + " / dueDate=" + (h.dueDate||""));
      L("pdfData", "note=" + (h.note||""));
      L("pdfData", "items=" + (model.items ? model.items.length : 0));
      return model;
    });
  }

  // [PDF-03-08] 単価決定：画面入力 → offerLines → 空
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
  // [PDF-04] フォント（日本語のため NotoSansJP を埋め込む）
  //   - 成功: 日本語OK
  //   - 失敗: Helveticaへフォールバックし、ログで警告
  // =========================================================
  function fetchArrayBuffer(url){
    return fetch(url).then(function(r){
      if(!r.ok) throw new Error("fetch failed: " + url);
      return r.arrayBuffer();
    });
  }

  function ensureFonts(pdfDoc){
    // [PDF-04-01] fontkit登録（日本語フォントのため）
    try{
      pdfDoc.registerFontkit(window.fontkit);
    }catch(e){
      L("warn", "registerFontkit failed: " + toStr(e));
    }

    // [PDF-04-02] NotoSansJP（CDN）※必要なら差し替え可
    // ここは “あなたの運用URL” に変えるのが最終的に安定（例: /assets/fonts/...）
    var URL_REG = "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.20/files/noto-sans-jp-japanese-400-normal.woff";
    var URL_BOLD= "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.20/files/noto-sans-jp-japanese-700-normal.woff";

    // pdf-lib は TrueType/OTF が扱いやすいが、woff でも環境により動く/動かないがあるため
    // まず試し、失敗したら内蔵フォントへフォールバックする
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
      return Promise.resolve().then(function(){
        return Promise.all([
          pdfDoc.embedFont(window.PDFLib.StandardFonts.Helvetica),
          pdfDoc.embedFont(window.PDFLib.StandardFonts.HelveticaBold)
        ]).then(function(arr){
          return { reg: arr[0], bold: arr[1], ok: false };
        });
      });
    });
  }

  // =========================================================
  // [PDF-05] レイアウト小物（改ページ・文字折返し・罫線など）
  // =========================================================
  function pad2(n){ return (n<10) ? ("0"+n) : String(n); }
  function yyyymmdd(){
    var d = new Date();
    return d.getFullYear() + pad2(d.getMonth()+1) + pad2(d.getDate());
  }
  function nowJstLabel(){
    // 端末がJST運用前提（あなたの運用）
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate())
      + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function wrapTextByChar(text, maxWidth, font, size){
    // 日本語（スペース無し）でも崩れないよう “1文字単位” で折返し
    text = (text == null) ? "" : String(text);
    var lines = [];
    var cur = "";

    // 改行は尊重
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
  // [PDF-06] PDF描画本体（4セクション必須）
  // =========================================================
  function renderPdf(model){
    var PDFLib = window.PDFLib;
    var docPromise = PDFLib.PDFDocument.create();

    return docPromise.then(function(pdfDoc){
      return ensureFonts(pdfDoc).then(function(fonts){
        var fontReg = fonts.reg;
        var fontBold= fonts.bold;

        // [PDF-06-01] ページ状態
        var page = pdfDoc.addPage([CFG.PAGE_W, CFG.PAGE_H]);
        var ctx = {
          pdfDoc: pdfDoc,
          page: page,
          fontReg: fontReg,
          fontBold: fontBold,
          cursorY: CFG.PAGE_H - CFG.MARGIN_T
        };

        // 便利
        var contentW = CFG.PAGE_W - (CFG.MARGIN_L + CFG.MARGIN_R);

        function newPage(){
          ctx.page = pdfDoc.addPage([CFG.PAGE_W, CFG.PAGE_H]);
          ctx.cursorY = CFG.PAGE_H - CFG.MARGIN_T;
        }

        function need(height){
          // 下余白まで含めて足りないなら改ページ
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
          // 四角枠
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

          // 見出し
          need(titleSize + 10);
          drawText(title, CFG.MARGIN_L, ctx.cursorY - titleSize, titleSize, true);
          ctx.cursorY -= (titleSize + 6);

          // 罫線
          hLine(ctx.cursorY);
          ctx.cursorY -= 10;

          // 本文
          for(var i=0;i<lines.length;i++){
            var row = lines[i];
            // row: {k,v} or string
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

            // 値は折返し
            var vLines = wrapTextByChar(v, vW, ctx.fontReg, bodySize);
            var rowH = Math.max(1, vLines.length) * gap;

            need(rowH);

            // key
            drawText(k, CFG.MARGIN_L, ctx.cursorY - bodySize, bodySize, true);

            // value
            for(var t=0;t<vLines.length;t++){
              drawText(vLines[t], CFG.MARGIN_L + kW + 10, (ctx.cursorY - bodySize) - (gap * t), bodySize, false);
            }

            ctx.cursorY -= rowH;
          }

          ctx.cursorY -= 6;
        }

        // =====================================================
        // [PDF-06-02] タイトル（上部）
        // =====================================================
        (function(){
          var h = model.header || {};
          var title = "入札書";
          var sub = "入札番号: " + (model.bidNo || "");
          need(40);
          drawText(title, CFG.MARGIN_L, ctx.cursorY - CFG.FONT_H1, CFG.FONT_H1, true);
          drawText(sub,  CFG.MARGIN_L, ctx.cursorY - CFG.FONT_H1 - 18, CFG.FONT_BODY, false);
          ctx.cursorY -= 40;

          // 区切り線
          hLine(ctx.cursorY);
          ctx.cursorY -= 18;
        })();

        // =====================================================
        // [PDF-06-03] セクション1: 入札者情報（必須）
        // =====================================================
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

        // =====================================================
        // [PDF-06-04] セクション2: 入札概要（必須）
        // =====================================================
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

        // =====================================================
        // [PDF-06-05] セクション3: 納入条件（必須）
        // =====================================================
        (function(){
          var h = model.header || {};
          var notes = [];
          // note, note1..note4 を並べる（note5=認証コード は帳票に出さない）
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

        // =====================================================
        // [PDF-06-06] セクション4: 入札単価（必須：表）
        // =====================================================
        (function(){
          var h2 = CFG.FONT_H2;
          var body = CFG.FONT_BODY;
          var gap = body * CFG.LINE_GAP;

          // 見出し
          need(h2 + 24);
          drawText("入札単価", CFG.MARGIN_L, ctx.cursorY - h2, h2, true);
          ctx.cursorY -= (h2 + 6);
          hLine(ctx.cursorY);
          ctx.cursorY -= 12;

          // テーブル領域
          var x0 = CFG.MARGIN_L;
          var y0 = ctx.cursorY;

          var wNo    = CFG.TBL_W_NO;
          var wName  = CFG.TBL_W_NAME;
          var wQty   = CFG.TBL_W_QTY;
          var wPrice = CFG.TBL_W_PRICE;
          var wNote  = CFG.TBL_W_NOTE;

          var tableW = wNo + wName + wQty + wPrice + wNote;

          // ヘッダ行
          var headerH = 18;

          function drawTableHeader(){
            need(headerH + 6);
            y0 = ctx.cursorY;

            // 枠
            drawBox(x0, y0, tableW, headerH);

            // 縦線
            drawLine(x0 + wNo, y0, x0 + wNo, y0 - headerH);
            drawLine(x0 + wNo + wName, y0, x0 + wNo + wName, y0 - headerH);
            drawLine(x0 + wNo + wName + wQty, y0, x0 + wNo + wName + wQty, y0 - headerH);
            drawLine(x0 + wNo + wName + wQty + wPrice, y0, x0 + wNo + wName + wQty + wPrice, y0 - headerH);

            // 文言
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

            // 品名/規格を2段に（折返し対応）
            var nameLines = wrapTextByChar(it.name || "", wName - 8, ctx.fontReg, body);
            var specLines = wrapTextByChar(it.spec || "", wName - 8, ctx.fontReg, CFG.FONT_SMALL);

            // 備考折返し
            var noteLines = wrapTextByChar(it.note || "", wNote - 8, ctx.fontReg, CFG.FONT_SMALL);

            var linesCount = Math.max(
              1,
              nameLines.length + specLines.length,
              noteLines.length
            );

            var rowH = Math.max(22, linesCount * gap);

            need(rowH + 4);

            var y = ctx.cursorY;

            // 枠
            drawBox(x0, y, tableW, rowH);

            // 縦線
            drawLine(x0 + wNo, y, x0 + wNo, y - rowH);
            drawLine(x0 + wNo + wName, y, x0 + wNo + wName, y - rowH);
            drawLine(x0 + wNo + wName + wQty, y, x0 + wNo + wName + wQty, y - rowH);
            drawLine(x0 + wNo + wName + wQty + wPrice, y, x0 + wNo + wName + wQty + wPrice, y - rowH);

            // セル文字
            drawText(seq, x0 + 4, y - 13, body, false);

            // 品名(通常) → 規格(小さめ)
            var ty = y - 13;
            for(var i=0;i<nameLines.length;i++){
              drawText(nameLines[i], x0 + wNo + 4, ty, body, false);
              ty -= gap;
            }
            for(var j=0;j<specLines.length;j++){
              drawText(specLines[j], x0 + wNo + 4, ty, CFG.FONT_SMALL, false);
              ty -= (CFG.FONT_SMALL * CFG.LINE_GAP);
            }

            // 数量
            var qtyStr = (it.qty == null ? "" : String(it.qty)) + (it.unit ? (" " + it.unit) : "");
            var qtyLines = wrapTextByChar(qtyStr, wQty - 8, ctx.fontReg, body);
            drawText(qtyLines[0] || "", x0 + wNo + wName + 4, y - 13, body, false);

            // 単価
            var priceLines = wrapTextByChar(price, wPrice - 8, ctx.fontReg, body);
            drawText(priceLines[0] || "", x0 + wNo + wName + wQty + 4, y - 13, body, false);

            // 備考
            var ny = y - 13;
            for(var k=0;k<noteLines.length;k++){
              drawText(noteLines[k], x0 + wNo + wName + wQty + wPrice + 4, ny, CFG.FONT_SMALL, false);
              ny -= (CFG.FONT_SMALL * CFG.LINE_GAP);
            }

            ctx.cursorY -= rowH;
          }

          // ヘッダ描画
          drawTableHeader();

          // 行描画（途中で改ページしたらヘッダを描き直す）
          var items = model.items || [];
          if(!items.length){
            need(22);
            drawText("品目がありません。", CFG.MARGIN_L, ctx.cursorY - body, body, false);
            ctx.cursorY -= 24;
          }else{
            for(var i=0;i<items.length;i++){
              // 改ページが発生しうるので、drawRow前に “次ページならヘッダ再描画” を見る
              var beforeY = ctx.cursorY;
              drawRow(items[i]);

              // drawRowのneed()で改ページした場合、cursorYがトップ側に戻るので判別してヘッダ描画
              if(ctx.cursorY > beforeY){
                // 新ページになっている
                ctx.cursorY -= 12;
                drawTableHeader();
                drawRow(items[i]); // 描き直し
              }
            }
          }

          ctx.cursorY -= 10;
        })();

        // =====================================================
        // [PDF-06-07] フッタ（生成日時など）
        // =====================================================
        (function(){
          // 下余白内に入らないように、必要なら改ページ
          need(30);
          hLine(CFG.MARGIN_B + 18);
          drawText("生成: " + nowJstLabel(), CFG.MARGIN_L, CFG.MARGIN_B + 6, CFG.FONT_SMALL, false);
        })();

        // 完了
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
  // [PDF-08] 公開API（10から呼ぶ）
  // =========================================================
  function doPdf(){
    L("pdf", "PDF生成開始（B案: 直接PDF組み）");

    return ensurePdfLib().then(function(){
      // モデル作成 → Firestore埋め → PDF描画 → 保存
      var model = buildPdfModel();
      return fillModelFromFirestore(model).then(function(m2){
        // 重要：PDFに出す前に最終ログ（原因追跡しやすい）
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
      // 10側のmsgBoxに出すための例外として投げる（10がcatchして表示）
      throw e;
    });
  }

  function doPrint(){
    // 今回はPDF出力に統一（必要なら別途 “印刷用” を作る）
    return doPdf();
  }

  window.BidderPrint = {
    doPdf: doPdf,
    doPrint: doPrint
  };

})();