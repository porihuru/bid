/* [JST 2026-02-02 19:20]  09_bidder_print.js v20260202-MIN02
   目的:
   - まず「必ずPDFが作れる」を最優先（外部ライブラリ不要）
   - 日本語を確実に出すため、canvasに帳票を描画し、PDFは1ページ画像として埋め込む
   - Firestoreから必要データを09側で直接取得（10_bidder_app.js の内部状態に依存しない）
   - 必ず左右上下に余白（mm指定）
   - 後で拡張しやすいよう、番号コメント＋責務分離

   依存:
   - firebase compat が index.html で読み込まれていること（firebase-app-compat / firestore-compat）
*/

(function(){
  "use strict";

  // =========================================================
  // [P00] メタ/ロガー
  // =========================================================
  var FILE = "09_bidder_print.js";
  var VER  = "v20260202-MIN02";
  var TS   = new Date().toISOString();

  function _toStr(x){
    try{ return (x && x.message) ? x.message : ("" + x); }catch(e){ return "" + x; }
  }
  function L(tag, msg){
    try{
      if(window.BidderLog && window.BidderLog.write) return window.BidderLog.write(tag, msg);
      if(window.BOOTLOG && window.BOOTLOG.write) return window.BOOTLOG.write(tag, msg);
      console.log("[" + tag + "] " + msg);
    }catch(e){}
  }

  if(!window.__APP_VER__){ window.__APP_VER__ = []; }
  window.__APP_VER__.push({ ts: TS, file: FILE, ver: VER });
  L("ver", TS + " " + FILE + " " + VER);

  // =========================================================
  // [P01] 定数（A4 / 余白mm / 描画解像度）
  // =========================================================
  // A4: 210mm x 297mm
  var PAGE_MM_W = 210;
  var PAGE_MM_H = 297;

  // ★必須要件：必ず余白を入れる（左右上下）
  var MARGIN_MM = 12;     // ←ここを変えると余白が変わる（例: 15）
  var DPI = 144;          // 144dpi（そこそこ綺麗。重ければ 120）

  // mm → px
  function mm2px(mm){ return Math.round((mm / 25.4) * DPI); }

  // ページpx
  function pagePxW(){ return mm2px(PAGE_MM_W); }
  function pagePxH(){ return mm2px(PAGE_MM_H); }

  // =========================================================
  // [P10] bidNo の決定（URL優先 → state → config）
  // =========================================================
  function getUrlParam(name){
    try{
      var u = new URL(location.href);
      return u.searchParams.get(name);
    }catch(e){
      // 古い環境フォールバック
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

  function getBidNo(){
    // [P10-01] URL
    var b = getUrlParam("bidNo");
    if(b) return ("" + b).trim();

    // [P10-02] BidderState（02）
    try{
      if(window.BidderState && window.BidderState.get){
        var s = window.BidderState.get();
        if(s && s.bidNo) return ("" + s.bidNo).trim();
      }
    }catch(e){}

    // [P10-03] config既定
    try{
      if(window.BidderConfig && window.BidderConfig.BID_NO_DEFAULT){
        return ("" + window.BidderConfig.BID_NO_DEFAULT).trim();
      }
    }catch(e){}

    return "";
  }

  // =========================================================
  // [P11] Firebase/Firestore 準備（初期化済み前提だが保険）
  // =========================================================
  function firebaseReady(){
    return (typeof window.firebase !== "undefined"
      && window.firebase
      && window.firebase.apps
      && window.firebase.firestore);
  }

  function ensureFirestore(){
    if(!firebaseReady()){
      throw new Error("Firebase SDK が読み込まれていません（firebase-*-compat.js を確認）");
    }
    // 初期化は10側がやっている想定だが、念のため
    try{
      if(window.firebase.apps && window.firebase.apps.length){
        return window.firebase.firestore();
      }
    }catch(e){}

    // 未初期化なら config から初期化
    if(!window.BidderConfig || !window.BidderConfig.FIREBASE_CONFIG){
      throw new Error("BidderConfig.FIREBASE_CONFIG が見つかりません（01_bidder_config.js）");
    }
    window.firebase.initializeApp(window.BidderConfig.FIREBASE_CONFIG);
    return window.firebase.firestore();
  }

  // =========================================================
  // [P20] Firestoreから「入札ヘッダ」「品目」「（可能なら）自分の単価」を取得
  // =========================================================
  function loadBidData(bidNo){
    var db = ensureFirestore();

    // [P20-01] bidderId（単価取得の鍵）
    var bidderId = "";
    try{
      if(window.BidderState && window.BidderState.get){
        var s = window.BidderState.get();
        bidderId = (s && s.bidderId) ? ("" + s.bidderId) : "";
      }
    }catch(e){}

    L("pdfData", "bidNo=" + bidNo);

    var bidRef = db.collection("bids").doc(bidNo);

    // bids/{bidNo}
    return bidRef.get().then(function(snap){
      if(!snap.exists) throw new Error("bids/" + bidNo + " が存在しません");
      var hdr = snap.data() || {};
      // 取りあえず必要そうなものだけ整形（足りなければ後で追加）
      var header = {
        bidNo: bidNo,
        status: hdr.status || "",
        to1: hdr.to1 || "",
        to2: hdr.to2 || "",
        to3: hdr.to3 || "",
        bidDate: hdr.bidDate || "",
        deliveryPlace: hdr.deliveryPlace || "",
        dueDate: hdr.dueDate || "",
        note: hdr.note || "",
        note1: hdr.note1 || "",
        note2: hdr.note2 || "",
        note3: hdr.note3 || "",
        note4: hdr.note4 || "",
        note5: hdr.note5 || ""
      };

      // items
      return bidRef.collection("items").orderBy("seq").get().then(function(qs){
        var items = [];
        qs.forEach(function(d){
          var x = d.data() || {};
          items.push({
            seq: x.seq,
            name: x.name || "",
            spec: x.spec || "",
            qty:  x.qty,
            unit: x.unit || "",
            note: x.note || ""
          });
        });

        // offer lines（可能なら）
        if(!bidderId){
          return { header: header, items: items, bidderId: "", lines: {}, profile: null };
        }
//
        // [P20-xx] offer lines（可能なら）←このブロックを置き換え
return bidRef.collection("offers").doc(bidderId).get()
  .then(function(os){
    if(!os.exists){
      return { header: header, items: items, bidderId: bidderId, lines: {}, profile: null };
    }
    var od = os.data() || {};
    var lines = od.lines || {};
    var profile = od.profile || null; // ★追加
    return { header: header, items: items, bidderId: bidderId, lines: lines, profile: profile };
  })
  .catch(function(e){
    L("pdfData", "offer read skipped/failed: " + _toStr(e));
    return { header: header, items: items, bidderId: bidderId, lines: {}, profile: null };
  });
//          
          
      });
    });
  }

  // =========================================================
  // [P30] Canvas帳票レンダラ（ここをいじるのが“デザイン修正”）
  // =========================================================
  function renderToCanvas(data){
    // [P30-01] canvas作成
    var cw = pagePxW();
    var ch = pagePxH();

    var canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;

    var ctx = canvas.getContext("2d");
    // 背景（白）
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);

    // [P30-02] 余白枠
    var mx = mm2px(MARGIN_MM);
    var my = mm2px(MARGIN_MM);
    var innerW = cw - mx*2;
    var innerH = ch - my*2;

    // ガイド枠（薄い線）…不要なら消してOK
    ctx.strokeStyle = "#dddddd";
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, innerW, innerH);

    // [P30-03] タイポ
    // ※ 日本語は “OSにあるフォント” が使われます（埋め込み不要）
    var FONT_SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans JP",sans-serif';

    function text(x,y,str,fs,bold,align){
      ctx.font = (bold ? "700 " : "400 ") + fs + "px " + FONT_SANS;
      ctx.fillStyle = "#111827";
      ctx.textAlign = align || "left";
      ctx.textBaseline = "top";
      ctx.fillText(str, x, y);
    }
    function hline(x,y,w){
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x+w, y);
      ctx.stroke();
    }
    function box(x,y,w,h){
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 1;
      ctx.strokeRect(x,y,w,h);
    }

    // [P30-04] レイアウト座標（このブロックが設計の中心）
    var x = mx;
    var y = my;

    // タイトル
    text(x + innerW/2, y, "入札書", 22, true, "center");
    y += 30;
    hline(x, y, innerW);
    y += 12;

    // 右上：入札番号
    var bidNo = (data && data.header && data.header.bidNo) ? data.header.bidNo : "";
    text(x + innerW, my, "入札番号: " + bidNo, 12, false, "right");

    // =====================================================
    // [P30-10] セクション1：入札概要
    // =====================================================
    var secGap = 10;
    var secH = 92; // 仮（足りなければ増やす）

    text(x, y, "【入札概要】", 14, true, "left");
    y += 18;

    var hdr = data.header || {};
    // 重要項目（ログに出ているもの）
    text(x, y, "宛先: " + [hdr.to1, hdr.to2, hdr.to3].filter(Boolean).join(" / "), 12, false, "left");
    y += 16;
    text(x, y, "入札日: " + (hdr.bidDate || "-") + "    納入地: " + (hdr.deliveryPlace || "-"), 12, false, "left");
    y += 16;
    text(x, y, "納期: " + (hdr.dueDate || "-"), 12, false, "left");
    y += 16;
    text(x, y, "備考: " + (hdr.note || "-"), 12, false, "left");
    y += (secH - 18 - 16*4);
    if(y < my + 30) y = my + 30; // 念のため

    y += secGap;

    // =====================================================
    // [P30-20] セクション2：入札者情報（枠だけ先に）
    // =====================================================
  // [P30-20] セクション2：入札者情報（Cookieなし → offer.profile or 画面入力）
text(x, y, "【入札者情報】", 14, true, "left");
y += 18;

box(x, y, innerW, 84);

// ★(1) Firestore offers の profile
var p = (data && data.profile) ? data.profile : null;

// ★(2) 無ければ画面入力欄から取得（存在する場合だけ）
function gv(id){
  try{
    var el = document.getElementById(id);
    return el && el.value ? ("" + el.value).trim() : "";
  }catch(e){ return ""; }
}
if(!p){
  p = {
    companyName: gv("txtCompanyName"),
    address: gv("txtAddress"),
    representativeName: gv("txtRepresentativeName"),
    contactName: gv("txtContactName"),
    contactInfo: gv("txtContactInfo"),
    email: gv("txtEmail")
  };
}

// ★表示（無ければ空欄のまま）
ctx.fillStyle = "#111827";
ctx.font = "12px " + FONT_SANS;
ctx.textAlign = "left";
ctx.textBaseline = "top";

ctx.fillText("会社名: " + (p.companyName || ""),        x+8, y+8);
ctx.fillText("住所: "   + (p.address || ""),           x+8, y+24);
ctx.fillText("代表者: " + (p.representativeName || ""),x+8, y+40);
ctx.fillText("担当者: " + (p.contactName || "") + "  連絡先: " + (p.contactInfo || ""), x+8, y+56);
ctx.fillText("メール: " + (p.email || ""),             x+8, y+72);

y += 84 + secGap;

    // =====================================================
    // [P30-30] セクション3：納入条件（note1〜note4 を入れる予定）
    // =====================================================
    text(x, y, "【納入条件】", 14, true, "left");
    y += 18;

    box(x, y, innerW, 64);
    ctx.fillStyle = "#111827";
    ctx.font = "12px " + FONT_SANS;
    ctx.fillText("条件1: " + (hdr.note1 || ""), x+8, y+8);
    ctx.fillText("条件2: " + (hdr.note2 || ""), x+8, y+24);
    ctx.fillText("条件3: " + (hdr.note3 || ""), x+8, y+40);
    // note4 は長い可能性があるので今回は省略表示（次回折返し実装）
    y += 64 + secGap;

    // =====================================================
    // [P30-40] セクション4：入札単価（品目テーブル）
    // =====================================================
    text(x, y, "【入札単価】", 14, true, "left");
    y += 18;

    // テーブル設計
    var tableX = x;
    var tableY = y;
    var rowH = 22;

    // 列幅（px）
    var cNo   = 38;
    var cName = 260;
    var cQty  = 90;
    var cUnit = 44;
    var cPrice= 110;
    var cNote = innerW - (cNo + cName + cQty + cUnit + cPrice);

    // 見出し
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 1;
    box(tableX, tableY, innerW, rowH);
    text(tableX + 6,                 tableY + 4, "No", 12, true, "left");
    text(tableX + cNo + 6,           tableY + 4, "品名/規格", 12, true, "left");
    text(tableX + cNo + cName + 6,   tableY + 4, "数量", 12, true, "left");
    text(tableX + cNo + cName + cQty + 6, tableY + 4, "単位", 12, true, "left");
    text(tableX + cNo + cName + cQty + cUnit + 6, tableY + 4, "単価", 12, true, "left");
    text(tableX + cNo + cName + cQty + cUnit + cPrice + 6, tableY + 4, "備考", 12, true, "left");

    // 縦線
    function vline(px){
      ctx.beginPath();
      ctx.moveTo(px, tableY);
      ctx.lineTo(px, tableY + rowH);
      ctx.stroke();
    }
    vline(tableX + cNo);
    vline(tableX + cNo + cName);
    vline(tableX + cNo + cName + cQty);
    vline(tableX + cNo + cName + cQty + cUnit);
    vline(tableX + cNo + cName + cQty + cUnit + cPrice);

    // 行
    var items = (data && data.items) ? data.items : [];
    var lines = (data && data.lines) ? data.lines : {};

    var maxRows = Math.floor((my + innerH - (tableY + rowH + 10)) / rowH);
    if(maxRows < 1) maxRows = 1;
    var showRows = Math.min(items.length, maxRows);

    for(var i=0;i<showRows;i++){
      var it = items[i] || {};
      var ry = tableY + rowH*(i+1);

      // 罫線枠
      box(tableX, ry, innerW, rowH);

      // 縦線（行）
      ctx.beginPath();
      ctx.moveTo(tableX + cNo, ry);
      ctx.lineTo(tableX + cNo, ry + rowH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tableX + cNo + cName, ry);
      ctx.lineTo(tableX + cNo + cName, ry + rowH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tableX + cNo + cName + cQty, ry);
      ctx.lineTo(tableX + cNo + cName + cQty, ry + rowH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tableX + cNo + cName + cQty + cUnit, ry);
      ctx.lineTo(tableX + cNo + cName + cQty + cUnit, ry + rowH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tableX + cNo + cName + cQty + cUnit + cPrice, ry);
      ctx.lineTo(tableX + cNo + cName + cQty + cUnit + cPrice, ry + rowH);
      ctx.stroke();

      var seq = (it.seq == null) ? "" : ("" + it.seq);
      var name = (it.name || "") + (it.spec ? (" / " + it.spec) : "");
      var qty  = (it.qty == null) ? "" : ("" + it.qty);
      var unit = it.unit || "";
      var price= (seq && lines && lines[seq] != null) ? ("" + lines[seq]) : ""; // 単価（あれば）
      var note = it.note || "";

      text(tableX + 6, ry + 4, seq, 12, false, "left");
      text(tableX + cNo + 6, ry + 4, name, 12, false, "left");
      text(tableX + cNo + cName + 6, ry + 4, qty, 12, false, "left");
      text(tableX + cNo + cName + cQty + 6, ry + 4, unit, 12, false, "left");
      text(tableX + cNo + cName + cQty + cUnit + 6, ry + 4, price, 12, false, "left");
      text(tableX + cNo + cName + cQty + cUnit + cPrice + 6, ry + 4, note, 12, false, "left");
    }

    // 行数が多いときの注記
    if(items.length > showRows){
      ctx.fillStyle = "#b91c1c";
      ctx.font = "12px " + FONT_SANS;
      ctx.textAlign = "left";
      ctx.fillText("※品目が多いため1ページに収まる分のみ表示（次回：複数ページ対応）", x, my + innerH - 16);
    }

    // フッタ（生成日時）
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px " + FONT_SANS;
    ctx.textAlign = "right";
    ctx.fillText("generated: " + new Date().toISOString(), x + innerW, my + innerH - 12);

    return canvas;
  }

  // =========================================================
  // [P40] PDF最小生成（JPEG 1枚を1ページに貼る）
  //  - 外部ライブラリ不要
  //  - PDFは画像なので日本語OK（canvas側で描画済み）
  // =========================================================
  function b64ToU8(b64){
    var bin = atob(b64);
    var len = bin.length;
    var u8 = new Uint8Array(len);
    for(var i=0;i<len;i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  function u8ToStr(u8){
    var s = "";
    for(var i=0;i<u8.length;i++) s += String.fromCharCode(u8[i]);
    return s;
  }

  function buildPdfWithJpeg(jpegBytes, imgW, imgH){
    // PDF座標系は pt（1/72 inch）
    // ここでは「A4をptで固定」し、画像をページ全面に貼る（canvas側に余白がある）
    var pageWpt = (PAGE_MM_W / 25.4) * 72;
    var pageHpt = (PAGE_MM_H / 25.4) * 72;

    function obj(n, body){ return { n:n, body: body }; }

    // [P40-01] 画像XObject
    // JPEG(DCTDecode) をそのままstreamに格納
    var imgObjNum = 4;
    var imgStream =
      "<< /Type /XObject /Subtype /Image" +
      " /Width " + imgW +
      " /Height " + imgH +
      " /ColorSpace /DeviceRGB" +
      " /BitsPerComponent 8" +
      " /Filter /DCTDecode" +
      " /Length " + jpegBytes.length +
      " >>\nstream\n" +
      u8ToStr(jpegBytes) +
      "\nendstream";

    // [P40-02] ページ内容（画像を貼る）
    // q ... cm ... Do ... Q
    var content =
      "q\n" +
      pageWpt.toFixed(2) + " 0 0 " + pageHpt.toFixed(2) + " 0 0 cm\n" +
      "/Im0 Do\n" +
      "Q\n";
    var contentObjNum = 5;
    var contentStream =
      "<< /Length " + content.length + " >>\nstream\n" +
      content +
      "endstream";

    // [P40-03] PDFオブジェクト列
    var objects = [];
    // 1: Catalog
    objects.push(obj(1, "<< /Type /Catalog /Pages 2 0 R >>"));
    // 2: Pages
    objects.push(obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
    // 3: Page
    objects.push(obj(3,
      "<< /Type /Page /Parent 2 0 R" +
      " /MediaBox [0 0 " + pageWpt.toFixed(2) + " " + pageHpt.toFixed(2) + "]" +
      " /Resources << /XObject << /Im0 " + imgObjNum + " 0 R >> >>" +
      " /Contents " + contentObjNum + " 0 R" +
      " >>"
    ));
    // 4: Image
    objects.push(obj(imgObjNum, imgStream));
    // 5: Content
    objects.push(obj(contentObjNum, contentStream));

    // [P40-04] PDF組み立て（xref含む）
    var header = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n"; // バイナリマーカー
    var bodyParts = [];
    var offsets = [0]; // 0番はダミー

    var cur = header.length;

    for(var i=0;i<objects.length;i++){
      var o = objects[i];
      offsets[o.n] = cur;
      var chunk = o.n + " 0 obj\n" + o.body + "\nendobj\n";
      bodyParts.push(chunk);
      cur += chunk.length;
    }

    // xref
    var maxObj = 0;
    for(var k=0;k<offsets.length;k++) if(offsets[k] != null) maxObj = k;

    var xref = "xref\n0 " + (maxObj + 1) + "\n";
    // 0番
    xref += "0000000000 65535 f \n";
    for(var n=1;n<=maxObj;n++){
      var off = offsets[n] || 0;
      var s = ("0000000000" + off).slice(-10);
      xref += s + " 00000 n \n";
    }

    var trailer =
      "trailer\n<< /Size " + (maxObj + 1) + " /Root 1 0 R >>\n" +
      "startxref\n" + cur + "\n%%EOF\n";

    var pdfStr = header + bodyParts.join("") + xref + trailer;

    // 文字列→Uint8Array（バイナリ含むため）
    var u8 = new Uint8Array(pdfStr.length);
    for(var j=0;j<pdfStr.length;j++){
      u8[j] = pdfStr.charCodeAt(j) & 0xff;
    }
    return u8;
  }

  // =========================================================
  // [P50] 保存（download）
  // =========================================================
  function saveU8AsFile(u8, filename){
    var blob = new Blob([u8], { type: "application/pdf" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){
      try{ URL.revokeObjectURL(url); }catch(e){}
      try{ document.body.removeChild(a); }catch(ex){}
    }, 500);
  }

  // =========================================================
  // [P60] 公開API：PDF出力
  // =========================================================
  function doPdf(){
    return Promise.resolve().then(function(){
      L("pdf", "PDF生成開始（MIN02: canvas→JPEG→PDF / 外部ライブラリ不要）");

      var bidNo = getBidNo();
      if(!bidNo){
        throw new Error("bidNo が取得できません（URL ?bidNo=XXXX を確認）");
      }

      // データ取得
      return loadBidData(bidNo).then(function(data){
   
  // ★ここに追加★
  L("pdfData", "profile=" + JSON.stringify((data && data.profile) ? data.profile : null));
        
              
      // 追加ログ（必要最低限）
        try{
          var h = data.header || {};
          L("pdfData", "to=" + [h.to1,h.to2,h.to3].filter(Boolean).join(" / "));
          L("pdfData", "bidDate=" + (h.bidDate||"") + " deliveryPlace=" + (h.deliveryPlace||"") + " dueDate=" + (h.dueDate||""));
          L("pdfData", "note=" + (h.note||""));
          L("pdfData", "items=" + (data.items ? data.items.length : 0));
        }catch(e){}

        // canvas描画
        var canvas = renderToCanvas(data);

        // JPEG化（品質0.92：重ければ 0.85 など）
        var jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
        var b64 = jpegDataUrl.split(",")[1] || "";
        var jpegBytes = b64ToU8(b64);

        // PDF生成（画像を1ページ貼り）
        var pdfU8 = buildPdfWithJpeg(jpegBytes, canvas.width, canvas.height);

        var fname = "入札書_" + bidNo + "_" + new Date().toISOString().slice(0,10).replace(/-/g,"") + ".pdf";
        saveU8AsFile(pdfU8, fname);

        L("pdf", "PDF保存完了: " + fname);
        return true;
      });
    }).then(function(){
      L("pdf", "OK");
      return true;
    }).catch(function(e){
      L("pdf", "FAILED: " + _toStr(e));
      throw e;
    });
  }

  // 互換（印刷は今回は使わないが残す）
  function doPrint(){
    try{
      window.print();
      L("print", "window.print()");
    }catch(e){
      L("print", "FAILED: " + _toStr(e));
    }
  }

  // =========================================================
  // [P70] Export
  // =========================================================
  window.BidderPrint = {
    doPdf: doPdf,
    doPrint: doPrint
  };

})();