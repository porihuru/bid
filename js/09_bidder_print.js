/* [JST 2026-02-02 18:30]  09_bidder_print.js v20260202-B02
   B案（直接PDF組み）:
   - 余白を必ず入れる（上下左右）
   - セクションを必ず入れる：
     1) 入札者情報  2) 入札概要  3) 納入条件  4) 入札単価
   - 修正しやすいように「番号付きコメント + 役割ごとの関数分割」
*/

(function(){
  "use strict";

  // =========================================================
  // [P-00] メタ情報
  // =========================================================
  var FILE = "09_bidder_print.js";
  var VER  = "v20260202-B02";
  var TS   = new Date().toISOString();

  // =========================================================
  // [P-01] ロガー（03があればそれ、無ければBOOTLOG/console）
  // =========================================================
  function toStr(x){
    try{ return (x && x.message) ? x.message : ("" + x); }catch(e){ return "" + x; }
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
  // [P-02] ユーティリティ
  // =========================================================
  function $(id){ return document.getElementById(id); }

  // [P-02-01] URL param（bidNo拾い用）
  function getUrlParam(name){
    try{
      var u = new URL(location.href);
      return u.searchParams.get(name);
    }catch(e){
      // フォールバック
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

  // [P-02-02] 日付：YYYYMMDD
  function yyyymmdd(d){
    var dt = d || new Date();
    function p2(n){ return (n<10) ? ("0"+n) : (""+n); }
    return dt.getFullYear() + p2(dt.getMonth()+1) + p2(dt.getDate());
  }

  // [P-02-03] 文字列安全化
  function s(x){
    return (x == null) ? "" : ("" + x);
  }

  // =========================================================
  // [P-03] “PDFにするためのデータ”を一箇所で集約（重要）
  //   - ここがPDF反映の“唯一の入口”
  //   - まずログに必ず出す（pdfData）
  // =========================================================
  function collectPdfData(){
    // ----------------------------
    // [P-03-01] state取得（最優先）
    // ----------------------------
    var st = {};
    try{
      if(window.BidderState && window.BidderState.get){
        st = window.BidderState.get() || {};
      }
    }catch(e){ st = {}; }

    // ----------------------------
    // [P-03-02] bidNo の決定（優先順位）
    //   1) state.bidNo
    //   2) DOM lblBidNo
    //   3) URL ?bidNo=
    //   4) config default
    // ----------------------------
    var bidNo = s(st.bidNo);
    if(!bidNo){
      var el = $("lblBidNo");
      if(el && el.textContent && el.textContent !== "-") bidNo = (el.textContent || "").trim();
    }
    if(!bidNo){
      bidNo = (getUrlParam("bidNo") || "").trim();
    }
    if(!bidNo && window.BidderConfig && window.BidderConfig.BID_NO_DEFAULT){
      bidNo = s(window.BidderConfig.BID_NO_DEFAULT).trim();
    }

    // ----------------------------
    // [P-03-03] ヘッダー（宛先・日付・納入条件・備考）
    //   ※あなたのログでは hdrFull が出ているので、
    //     どこかで state に載せている想定だが “無くても落ちない” 作りにする
    // ----------------------------
    // よくある載せ方を複数候補で拾う
    var hdr = st.hdr || st.header || st.bidHeader || st.bid || {};
    // state直下にいる場合も拾う
    function pick(k){
      if(hdr && hdr[k] != null) return hdr[k];
      if(st && st[k] != null) return st[k];
      return "";
    }

    var to1 = s(pick("to1"));
    var to2 = s(pick("to2"));
    var to3 = s(pick("to3"));
    var bidDate = s(pick("bidDate"));
    var deliveryPlace = s(pick("deliveryPlace"));
    var dueDate = s(pick("dueDate"));
    var note = s(pick("note"));
    var note1 = s(pick("note1"));
    var note2 = s(pick("note2"));
    var note3 = s(pick("note3"));
    var note4 = s(pick("note4"));
    var note5 = s(pick("note5"));

    // ----------------------------
    // [P-03-04] 品目（items）
    // ----------------------------
    var items = [];
    if(st.items && st.items.length) items = st.items;
    // 08/07側で別キーの場合も救う
    if(!items.length && st.itemList && st.itemList.length) items = st.itemList;

    // ----------------------------
    // [P-03-05] 入札単価 lines（seq->price）
    // ----------------------------
    var prices = st.prices || st.lines || st.offerLines || {};
    if(!prices || typeof prices !== "object") prices = {};

    // ----------------------------
    // [P-03-06] 入札者情報（画面入力から取得：常に最新）
    //   ※06_bidder_profile.js に依存しない
    // ----------------------------
    function v(id){
      var el2 = $(id);
      return (el2 && el2.value) ? ("" + el2.value).trim() : "";
    }
    var bidder = {
      bidderId: s(st.bidderId),
      email: v("txtEmail"),
      address: v("txtAddress"),
      companyName: v("txtCompanyName"),
      representativeName: v("txtRepresentativeName"),
      contactName: v("txtContactName"),
      contactInfo: v("txtContactInfo")
    };

    // ----------------------------
    // [P-03-07] まとめて返す
    // ----------------------------
    return {
      bidNo: bidNo,
      header: {
        to1: to1, to2: to2, to3: to3,
        bidDate: bidDate,
        deliveryPlace: deliveryPlace,
        dueDate: dueDate,
        note: note,
        note1: note1, note2: note2, note3: note3, note4: note4, note5: note5
      },
      bidder: bidder,
      items: items || [],
      prices: prices || {}
    };
  }

  // [P-03-99] ログ出力（最重要：PDF反映の前に必ず確認できる）
  function logPdfData(d){
    try{
      L("pdfData", "bidNo=" + (d.bidNo || "(empty)"));
      L("pdfData", "to1=" + s(d.header.to1) + " / to2=" + s(d.header.to2) + " / to3=" + s(d.header.to3));
      L("pdfData", "bidDate=" + s(d.header.bidDate) + " / deliveryPlace=" + s(d.header.deliveryPlace) + " / dueDate=" + s(d.header.dueDate));
      L("pdfData", "note=" + s(d.header.note));
      L("pdfData", "items=" + (d.items ? d.items.length : 0));
    }catch(e){}
  }

  // =========================================================
  // [P-04] PDF描画エンジン（pdf-lib）
  // =========================================================
  function requirePdfLib(){
    if(!window.PDFLib){
      throw new Error("PDFLib not found（pdf-lib が読み込まれていません）");
    }
    return window.PDFLib;
  }

  // [P-04-01] A4(pt)
  var A4_W = 595.28;
  var A4_H = 841.89;

  // [P-04-02] 余白（必ず入れる）
  //   ※修正しやすいように “mm相当” の値にしておく
  var MARGIN = 44;         // 約15.5mm
  var GUTTER = 10;         // セクション内余白

  // [P-04-03] フォントサイズ（ここだけいじれば全体の雰囲気が変わる）
  var FS_TITLE = 16;
  var FS_H1    = 12;
  var FS_BASE  = 10;
  var FS_SMALL = 9;

  // [P-04-04] 行高（ここも調整点）
  var LH_BASE  = 14;
  var LH_SMALL = 12;

  // [P-04-05] 文字折り返し（ざっくり幅計算）
  //   日本語は等幅前提の近似（pdf-libで厳密計測はフォント次第）
  function wrapText(text, maxChars){
    var t = s(text);
    if(!t) return [""];
    var out = [];
    var line = "";
    for(var i=0;i<t.length;i++){
      var ch = t.charAt(i);
      line += ch;
      if(line.length >= maxChars){
        out.push(line);
        line = "";
      }
    }
    if(line) out.push(line);
    return out;
  }

  // =========================================================
  // [P-05] ページ管理（ページ追加・ヘッダ/フッタ）
  // =========================================================
  function PdfCursor(pdfDoc, font, boldFont){
    this.pdfDoc = pdfDoc;
    this.font = font;
    this.bold = boldFont || font;
    this.page = null;
    this.y = 0;
    this.pageNo = 0;
    this.pages = [];
  }

  PdfCursor.prototype.newPage = function(){
    this.page = this.pdfDoc.addPage([A4_W, A4_H]);
    this.pages.push(this.page);
    this.pageNo = this.pages.length;
    this.y = A4_H - MARGIN;

    // [P-05-01] ページ枠（余白確認用：必要ならコメントアウト）
    // this.page.drawRectangle({ x:MARGIN, y:MARGIN, width:A4_W-2*MARGIN, height:A4_H-2*MARGIN, borderWidth:0.5, borderColor:PDFLib.rgb(0.85,0.85,0.85) });

    return this.page;
  };

  PdfCursor.prototype.drawFooter = function(PDFLib){
    try{
      var txt = "Page " + this.pageNo + " / " + this.pages.length;
      this.page.drawText(txt, {
        x: MARGIN,
        y: MARGIN - 18,
        size: FS_SMALL,
        font: this.font,
        color: PDFLib.rgb(0.45,0.45,0.45)
      });
      var ts = "generated: " + yyyymmdd(new Date());
      this.page.drawText(ts, {
        x: A4_W - MARGIN - 160,
        y: MARGIN - 18,
        size: FS_SMALL,
        font: this.font,
        color: PDFLib.rgb(0.45,0.45,0.45)
      });
    }catch(e){}
  };

  // [P-05-02] 改ページ判定
  PdfCursor.prototype.ensureSpace = function(PDFLib, needH){
    if(this.y - needH < MARGIN){
      // 現ページのフッタ
      this.drawFooter(PDFLib);
      // 新ページ
      this.newPage();
    }
  };

  // =========================================================
  // [P-06] 描画部品（タイトル・見出し・キー値・罫線）
  // =========================================================
  function drawTitle(PDFLib, cur, bidNo){
    cur.ensureSpace(PDFLib, 40);

    var title = "入札書";
    cur.page.drawText(title, {
      x: MARGIN,
      y: cur.y,
      size: FS_TITLE,
      font: cur.bold,
      color: PDFLib.rgb(0,0,0)
    });

    // 右上：入札番号
    var right = "入札番号: " + s(bidNo);
    cur.page.drawText(right, {
      x: A4_W - MARGIN - 220,
      y: cur.y + 2,
      size: FS_BASE,
      font: cur.font,
      color: PDFLib.rgb(0,0,0)
    });

    cur.y -= 22;

    // 下線
    cur.page.drawLine({
      start: { x: MARGIN, y: cur.y },
      end:   { x: A4_W - MARGIN, y: cur.y },
      thickness: 1,
      color: PDFLib.rgb(0.75,0.75,0.75)
    });

    cur.y -= 18;
  }

  function drawH1(PDFLib, cur, text){
    cur.ensureSpace(PDFLib, 26);
    cur.page.drawText(text, {
      x: MARGIN,
      y: cur.y,
      size: FS_H1,
      font: cur.bold,
      color: PDFLib.rgb(0,0,0)
    });
    cur.y -= 14;

    // 薄い区切り線
    cur.page.drawLine({
      start: { x: MARGIN, y: cur.y },
      end:   { x: A4_W - MARGIN, y: cur.y },
      thickness: 0.8,
      color: PDFLib.rgb(0.85,0.85,0.85)
    });
    cur.y -= 10;
  }

  // [P-06-01] キー値（2列対応）
  function drawKV2(PDFLib, cur, k1, v1, k2, v2){
    cur.ensureSpace(PDFLib, LH_BASE);

    var x1 = MARGIN;
    var x2 = MARGIN + 260; // ここで2列の開始位置調整

    cur.page.drawText(s(k1), { x:x1, y:cur.y, size:FS_SMALL, font:cur.font, color:PDFLib.rgb(0.4,0.4,0.4) });
    cur.page.drawText(s(v1), { x:x1+70, y:cur.y, size:FS_BASE, font:cur.font, color:PDFLib.rgb(0,0,0) });

    if(k2){
      cur.page.drawText(s(k2), { x:x2, y:cur.y, size:FS_SMALL, font:cur.font, color:PDFLib.rgb(0.4,0.4,0.4) });
      cur.page.drawText(s(v2), { x:x2+70, y:cur.y, size:FS_BASE, font:cur.font, color:PDFLib.rgb(0,0,0) });
    }

    cur.y -= LH_BASE;
  }

  // [P-06-02] 複数行テキスト（備考など）
  function drawMulti(PDFLib, cur, label, text, maxChars){
    var lines = wrapText(text, maxChars || 44);
    cur.ensureSpace(PDFLib, LH_BASE + lines.length*LH_BASE);

    cur.page.drawText(s(label), {
      x: MARGIN, y: cur.y,
      size: FS_SMALL, font: cur.font, color: PDFLib.rgb(0.4,0.4,0.4)
    });
    cur.y -= LH_BASE;

    for(var i=0;i<lines.length;i++){
      cur.ensureSpace(PDFLib, LH_BASE);
      cur.page.drawText(lines[i], {
        x: MARGIN + 10, y: cur.y,
        size: FS_BASE, font: cur.font, color: PDFLib.rgb(0,0,0)
      });
      cur.y -= LH_BASE;
    }
    cur.y -= 4;
  }

  // =========================================================
  // [P-07] 表（入札単価）
  // =========================================================
  function drawTableHeader(PDFLib, cur, cols){
    cur.ensureSpace(PDFLib, 20);

    var x = MARGIN;
    var y = cur.y;

    // 背景
    cur.page.drawRectangle({
      x: MARGIN,
      y: y - 2,
      width: A4_W - 2*MARGIN,
      height: 18,
      color: PDFLib.rgb(0.96,0.96,0.96),
      borderColor: PDFLib.rgb(0.85,0.85,0.85),
      borderWidth: 1
    });

    for(var i=0;i<cols.length;i++){
      var c = cols[i];
      cur.page.drawText(c.t, {
        x: x,
        y: y + 3,
        size: FS_SMALL,
        font: cur.bold,
        color: PDFLib.rgb(0.2,0.2,0.2)
      });
      x += c.w;
    }

    cur.y -= 22;
  }

  function drawTableRow(PDFLib, cur, cols, row, rowH){
    cur.ensureSpace(PDFLib, rowH);

    var x = MARGIN;
    var yTop = cur.y;

    // 罫線（下線）
    cur.page.drawLine({
      start: { x: MARGIN, y: yTop - rowH + 6 },
      end:   { x: A4_W - MARGIN, y: yTop - rowH + 6 },
      thickness: 0.8,
      color: PDFLib.rgb(0.9,0.9,0.9)
    });

    // 各セル
    for(var i=0;i<cols.length;i++){
      var c = cols[i];
      var txt = s(row[i]);

      // 数字っぽい列は右寄せにしたい場合はここで分岐（今回は簡易）
      cur.page.drawText(txt, {
        x: x,
        y: yTop,
        size: FS_BASE,
        font: cur.font,
        color: PDFLib.rgb(0,0,0)
      });

      x += c.w;
    }

    cur.y -= rowH;
  }

  // =========================================================
  // [P-08] 本体：PDF生成（B案：直接PDF組み）
  // =========================================================
  function buildPdfBytes(){
    L("pdf", "PDF生成開始（B案: 直接PDF組み）");

    var PDFLib = requirePdfLib();
    var d = collectPdfData();

    // [P-08-01] bidNo必須
    if(!d.bidNo){
      throw new Error("bidNo が取得できません（URL ?bidNo=XXXX / state / lblBidNo を確認）");
    }

    // [P-08-02] 先にログ（最重要）
    logPdfData(d);

    // [P-08-03] PDF作成
    return PDFLib.PDFDocument.create().then(function(pdfDoc){

      // [P-08-04] フォント（まず標準フォントで動かす）
      // 既に日本語が出ている環境なら、ここを差し替えてもOK（NotoSansJPなど）
      return Promise.all([
        pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica),
        pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold)
      ]).then(function(fonts){
        var font = fonts[0];
        var bold = fonts[1];

        var cur = new PdfCursor(pdfDoc, font, bold);
        cur.newPage();

        // ----------------------------
        // [P-08-10] タイトル
        // ----------------------------
        drawTitle(PDFLib, cur, d.bidNo);

        // ----------------------------
        // [P-08-20] 1) 入札者情報（必須）
        // ----------------------------
        drawH1(PDFLib, cur, "入札者情報");
        drawKV2(PDFLib, cur, "会社名", d.bidder.companyName, "代表者名", d.bidder.representativeName);
        drawKV2(PDFLib, cur, "住所", d.bidder.address, "担当者名", d.bidder.contactName);
        drawKV2(PDFLib, cur, "連絡先", d.bidder.contactInfo, "メール", d.bidder.email);

        cur.y -= 6;

        // ----------------------------
        // [P-08-30] 2) 入札概要（必須）
        // ----------------------------
        drawH1(PDFLib, cur, "入札概要");
        drawKV2(PDFLib, cur, "宛先1", d.header.to1, "宛先2", d.header.to2);
        drawKV2(PDFLib, cur, "宛先3", d.header.to3, "入札日", d.header.bidDate);
        drawMulti(PDFLib, cur, "備考（note）", d.header.note, 60);

        // note1-5（空は出さない）
        var n = [];
        if(d.header.note1) n.push("note1: " + d.header.note1);
        if(d.header.note2) n.push("note2: " + d.header.note2);
        if(d.header.note3) n.push("note3: " + d.header.note3);
        if(d.header.note4) n.push("note4: " + d.header.note4);
        if(d.header.note5) n.push("note5: " + d.header.note5);
        if(n.length){
          drawMulti(PDFLib, cur, "備考（note1-5）", n.join(" / "), 60);
        }

        cur.y -= 6;

        // ----------------------------
        // [P-08-40] 3) 納入条件（必須）
        // ----------------------------
        drawH1(PDFLib, cur, "納入条件");
        drawKV2(PDFLib, cur, "納入場所", d.header.deliveryPlace, "納期", d.header.dueDate);

        cur.y -= 6;

        // ----------------------------
        // [P-08-50] 4) 入札単価（必須）
        // ----------------------------
        drawH1(PDFLib, cur, "入札単価");

        // テーブル列（調整はここだけ）
        var cols = [
          { t:"No",     w: 28 },
          { t:"品名",   w: 150 },
          { t:"規格",   w: 150 },
          { t:"予定数量", w: 70 },
          { t:"単位",   w: 40 },
          { t:"入札単価", w: 90 }
        ];

        drawTableHeader(PDFLib, cur, cols);

        // 行
        var list = d.items || [];
        for(var i=0;i<list.length;i++){
          var it = list[i] || {};
          var seq = (it.seq == null) ? "" : ("" + it.seq);
          var price = "";
          try{
            // pricesは seq をキーにしている想定（あなたの実装もそう）
            price = (d.prices && d.prices[seq] != null) ? ("" + d.prices[seq]) : "";
          }catch(e){ price = ""; }

          // 行高（固定）
          var rowH = 16;

          // ページ残量が足りないならヘッダを再描画
          if(cur.y - rowH < MARGIN){
            cur.drawFooter(PDFLib);
            cur.newPage();
            drawTableHeader(PDFLib, cur, cols);
          }

          drawTableRow(PDFLib, cur, cols, [
            seq,
            s(it.name),
            s(it.spec),
            s(it.qty),
            s(it.unit),
            s(price)
          ], rowH);

          // 品目備考があれば小さく追記（任意：邪魔なら消してOK）
          if(it.note){
            var noteLines = wrapText(it.note, 70);
            for(var k=0;k<noteLines.length;k++){
              cur.ensureSpace(PDFLib, LH_SMALL);
              cur.page.drawText("※ " + noteLines[k], {
                x: MARGIN + 28, y: cur.y + 2,
                size: FS_SMALL,
                font: cur.font,
                color: PDFLib.rgb(0.35,0.35,0.35)
              });
              cur.y -= LH_SMALL;
            }
          }
        }

        // 最終ページフッタ
        cur.drawFooter(PDFLib);

        // [P-08-99] bytes化
        return pdfDoc.save();
      });
    });
  }

  // =========================================================
  // [P-09] 保存（download）
  // =========================================================
  function savePdfBytes(bytes, filename){
    try{
      var blob = new Blob([bytes], { type: "application/pdf" });
      var url = URL.createObjectURL(blob);

      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(function(){
        try{ URL.revokeObjectURL(url); }catch(e){}
      }, 5000);

      return true;
    }catch(e){
      L("pdf", "savePdfBytes FAILED: " + toStr(e));
      return false;
    }
  }

  // =========================================================
  // [P-10] 公開API（10から呼ばれる）
  // =========================================================
  function doPdf(){
    return Promise.resolve().then(function(){
      return buildPdfBytes();
    }).then(function(bytes){
      var d = collectPdfData();
      var name = "入札書_" + d.bidNo + "_" + yyyymmdd(new Date()) + ".pdf";
      var ok = savePdfBytes(bytes, name);
      if(ok){
        L("pdf", "PDF保存完了: " + name);
        return true;
      }
      throw new Error("PDF保存に失敗しました");
    }).catch(function(e){
      L("pdf", "FAILED: " + toStr(e));
      return Promise.reject(e);
    });
  }

  // 印刷は “保存→ユーザーがPDFを開いて印刷” に寄せる（安定）
  function doPrint(){
    L("print", "印刷はPDF保存後にPDFビューアで実行してください（doPdfを使用）");
    return doPdf();
  }

  if(!window.BidderPrint){ window.BidderPrint = {}; }
  window.BidderPrint.doPdf = doPdf;
  window.BidderPrint.doPrint = doPrint;

})();