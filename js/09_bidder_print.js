/* ============================================================================
[JST 2026-02-02 19:00]  09_bidder_print.js v20260202-01
入札書PDF出力（デザイン/修正しやすさ最優先の再設計版）
方針:
  - [PRN-01] PDF入力データを “BidData” に一本化（DOM拾い禁止）
  - [PRN-02] Firestoreから「bids/header・items・offers」をPDF生成時に再取得
            →「ログには出るのにPDFは空」を根絶
  - [PRN-03] PDF帳票は “テンプレHTML文字列” を生成（CSSで余白/レイアウト調整）
  - [PRN-04] 生成したHTMLを hidden iframe に流し込み
            → html2canvas でキャンバス化 → jsPDF でPDF化（多ページ対応）
  - [PRN-05] “修正箇所を集約” するため CSS変数を採用（余白/フォント/罫線/行高）
依存:
  - Firebase compat SDK は index.html で読み込み済み前提
  - html2canvas / jsPDF は本ファイルで必要に応じてCDNから動的ロード
公開API:
  - window.BidderPrint.doPdf()
  - window.BidderPrint.doPrint()
============================================================================ */
(function(){
  "use strict";

  // =========================================================
  // [PRN-00] メタ / ロガー
  // =========================================================
  var FILE = "09_bidder_print.js";
  var VER  = "v20260202-01";
  var TS   = new Date().toISOString();

  function nowIso(){ try{ return new Date().toISOString(); }catch(e){ return ""; } }
  function toStr(x){ try{ return (x && x.message) ? x.message : ("" + x); }catch(e){ return "" + x; } }

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
  // [PRN-01] Firebase / Firestoreユーティリティ（PDF側で再取得）
  // =========================================================
  function firebaseReady(){
    return (typeof window.firebase !== "undefined"
      && window.firebase
      && window.firebase.apps
      && window.firebase.auth
      && window.firebase.firestore);
  }

  function ensureFirebaseInit(){
    // index.html / 10_bidder_app.js と同じ思想：確実にログを残す
    if(!firebaseReady()){
      throw new Error("Firebase SDK が読み込まれていません（firebase-*-compat.js を確認）");
    }
    if(!window.BidderConfig || !window.BidderConfig.FIREBASE_CONFIG){
      throw new Error("BidderConfig.FIREBASE_CONFIG が見つかりません（01_bidder_config.js を確認）");
    }

    // 初期化済みならOK
    try{
      if(window.firebase.apps && window.firebase.apps.length){
        return true;
      }
    }catch(e){}

    // 初期化
    try{
      window.firebase.initializeApp(window.BidderConfig.FIREBASE_CONFIG);
      return true;
    }catch(e){
      // ここで落ちても 10 側が初期化済みの可能性があるので、再チェック
      try{
        if(window.firebase.apps && window.firebase.apps.length){
          return true;
        }
      }catch(ex){}
      throw e;
    }
  }

  function db(){
    return window.firebase.firestore();
  }
  function bidDocRef(bidNo){
    return db().collection("bids").doc(bidNo);
  }
  function itemsColRef(bidNo){
    return bidDocRef(bidNo).collection("items");
  }
  function offerDocRef(bidNo, bidderId){
    return bidDocRef(bidNo).collection("offers").doc(bidderId);
  }

  // =========================================================
  // [PRN-02] bidNo / bidderId の決定（“拾い方”も番号化して明確化）
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
    // [PRN-02-01] BidderState（あれば最優先）
    try{
      if(window.BidderState && window.BidderState.get){
        var s = window.BidderState.get();
        if(s && s.bidNo) return ("" + s.bidNo);
      }
    }catch(e){}

    // [PRN-02-02] URL ?bidNo=
    var b = getUrlParam("bidNo");
    if(b) return ("" + b);

    // [PRN-02-03] config既定
    if(window.BidderConfig && window.BidderConfig.BID_NO_DEFAULT){
      return ("" + window.BidderConfig.BID_NO_DEFAULT);
    }
    return "";
  }

  function getBidderId(){
    // [PRN-02-11] BidderState（ログイン後はここが一番確実）
    try{
      if(window.BidderState && window.BidderState.get){
        var s = window.BidderState.get();
        if(s && s.bidderId) return ("" + s.bidderId);
      }
    }catch(e){}

    // [PRN-02-12] 10_bidder_app.js の内部stateが露出していれば拾う（保険）
    try{
      if(window.__BIDDER_ID__) return ("" + window.__BIDDER_ID__);
    }catch(e){}

    // [PRN-02-13] 画面入力欄（ログイン前PDFは bidderId 無し扱い）
    try{
      var el = document.getElementById("txtBidderId");
      if(el && el.value) return el.value.trim();
    }catch(e){}
    return "";
  }

  // =========================================================
  // [PRN-03] PDF用 “BidData” の定義と収集（ここが唯一の入力）
  // =========================================================
  function buildEmptyBidData(bidNo, bidderId){
    return {
      meta: {
        generatedAt: nowIso(),
        source: "firestore",
        bidderId: bidderId || ""
      },
      header: {
        bidNo: bidNo || "",
        status: "",
        bidDate: "",
        to1: "",
        to2: "",
        to3: "",
        deliveryPlace: "",
        dueDate: "",
        note: "",
        note1: "",
        note2: "",
        note3: "",
        note4: "",
        note5: ""
      },
      items: [],  // [{seq,name,spec,qty,unit,note}]
      offer: {
        lines: {} // { "1":"123", "2":"456" ... } seq->unitPriceStr
      }
    };
  }

  function safeJson(obj){
    try{ return JSON.stringify(obj, null, 2); }catch(e){ return "" + obj; }
  }

  function fetchBidDataFromFirestore(bidNo, bidderId){
    // [PRN-03-01] 前提チェック
    if(!bidNo) return Promise.reject(new Error("bidNo が空です（URL ?bidNo=XXXX か既定値を確認）"));

    // [PRN-03-02] 収集器（最終的にBidDataだけ返す）
    var bidData = buildEmptyBidData(bidNo, bidderId);

    // [PRN-03-03] header(bids/{bidNo})
    return bidDocRef(bidNo).get().then(function(snap){
      if(!snap.exists) throw new Error("bids/" + bidNo + " が存在しません");
      var d = snap.data() || {};

      // header へ正規化して格納（PDFもログもこれだけ見る）
      bidData.header.bidNo = bidNo;
      bidData.header.status = d.status || "";
      bidData.header.bidDate = d.bidDate || "";
      bidData.header.to1 = d.to1 || "";
      bidData.header.to2 = d.to2 || "";
      bidData.header.to3 = d.to3 || "";
      bidData.header.deliveryPlace = d.deliveryPlace || "";
      bidData.header.dueDate = d.dueDate || "";
      bidData.header.note = d.note || "";
      bidData.header.note1 = d.note1 || "";
      bidData.header.note2 = d.note2 || "";
      bidData.header.note3 = d.note3 || "";
      bidData.header.note4 = d.note4 || "";
      bidData.header.note5 = d.note5 || "";

      // [PRN-03-04] 重要：PDFに渡すヘッダを必ずログ（ここが真実）
      L("pdfData", "bidNo=" + bidData.header.bidNo);
      L("pdfData", "to1=" + (bidData.header.to1||"") + " / to2=" + (bidData.header.to2||"") + " / to3=" + (bidData.header.to3||""));
      L("pdfData", "bidDate=" + (bidData.header.bidDate||"") + " / deliveryPlace=" + (bidData.header.deliveryPlace||"") + " / dueDate=" + (bidData.header.dueDate||""));
      L("pdfData", "note=" + (bidData.header.note||""));
      L("pdfHdrFull", safeJson(bidData.header));

      // items 取得
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
          qty: (d.qty == null ? "" : d.qty),
          unit: d.unit || "",
          note: d.note || ""
        });
      });
      bidData.items = arr;

      L("pdfData", "items=" + arr.length);
      // 多すぎるとログが重いので先頭だけ覗く
      try{
        var peek = arr.slice(0, 5);
        L("pdfItemsPeek", safeJson(peek));
      }catch(e){}

      // offer 取得（bidderIdが無ければスキップ）
      if(!bidData.meta.bidderId){
        L("pdfData", "offer=skip (bidderId empty)");
        return bidData;
      }
      return offerDocRef(bidNo, bidData.meta.bidderId).get().then(function(snap){
        if(!snap.exists){
          L("pdfData", "offer=none (no document)");
          return bidData;
        }
        var d = snap.data() || {};
        var lines = d.lines || {};
        var out = {};
        try{
          Object.keys(lines).forEach(function(k){
            out["" + k] = "" + lines[k];
          });
        }catch(e){}
        bidData.offer.lines = out;
        L("pdfData", "offerLines=" + Object.keys(out).length);
        return bidData;
      }).catch(function(e){
        // 権限などで落ちても致命にしない（PDFはヘッダ+品目だけでも出せる）
        L("pdfWarn", "offer load failed: " + toStr(e));
        return bidData;
      });
    });
  }

  // =========================================================
  // [PRN-04] PDFテンプレ生成（HTML文字列 + CSS変数）
  // “余白が欲しい” → ここだけ触ればOK、にする
  // =========================================================
  function esc(s){
    return ("" + (s == null ? "" : s))
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function fmtDate(s){
    // 文字列はそのまま（"2026-02-01" 等）
    return (s || "");
  }

  function fmtYmdJst(d){
    // ファイル名用 yyyyMMdd（ローカル=JST運用前提）
    var dt = d || new Date();
    var y = dt.getFullYear();
    var m = dt.getMonth() + 1;
    var da = dt.getDate();
    function p2(n){ return (n<10) ? ("0"+n) : (""+n); }
    return "" + y + p2(m) + p2(da);
  }

  function sumToText(h){
    // 宛先表示（空なら空）
    var a = [];
    if(h.to1) a.push(h.to1);
    if(h.to2) a.push(h.to2);
    if(h.to3) a.push(h.to3);
    return a.join("　");
  }

  function getUnitPrice(lines, seq){
    if(!lines) return "";
    var k = (seq == null ? "" : ("" + seq));
    if(lines[k] == null) return "";
    return ("" + lines[k]);
  }

  function renderPdfHtml(bidData){
    // [PRN-04-01] CSS変数（ここを触ると一括で見た目が変わる）
    //   例: 余白が欲しい → --pagePad を増やす
    //   例: 行間 → --lh を変える
    var css = `
      :root{
        --pageBg:#ffffff;
        --ink:#111827;
        --muted:#6b7280;
        --line:#d1d5db;

        /* ★最重要：余白（ここを調整） */
        --pagePad: 14mm;

        /* 文字/行 */
        --fsBase: 12.5px;
        --fsSmall: 11px;
        --lh: 1.45;

        /* 表 */
        --thBg:#f3f4f6;
        --rowPadY: 6px;
        --rowPadX: 6px;
      }

      html, body{
        margin:0;
        padding:0;
        background:#fff;
        color:var(--ink);
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans JP", sans-serif;
        font-size: var(--fsBase);
        line-height: var(--lh);
      }

      /* A4相当のキャンバス（mm指定で “余白” 調整が直感的） */
      .page{
        width: 210mm;
        min-height: 297mm;
        background: var(--pageBg);
        box-sizing: border-box;
        padding: var(--pagePad);
      }

      .h1{
        font-size: 20px;
        font-weight: 800;
        letter-spacing: 0.5px;
        text-align:center;
        margin: 0 0 10px 0;
      }

      .metaRow{
        display:flex;
        justify-content: space-between;
        gap: 12px;
        margin: 4px 0 10px 0;
      }
      .metaBox{
        flex:1;
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 10px 10px;
      }
      .metaItem{ margin: 2px 0; }
      .k{ color: var(--muted); }
      .v{ font-weight: 650; }

      .toLine{
        margin: 10px 0 8px 0;
        font-size: 14px;
      }
      .toLine .to{
        font-weight: 750;
      }

      .hr{
        height:1px;
        background: var(--line);
        margin: 10px 0;
      }

      table{
        width:100%;
        border-collapse: collapse;
        table-layout: fixed;
        border: 1px solid var(--line);
      }
      thead th{
        background: var(--thBg);
        border-bottom: 1px solid var(--line);
        padding: var(--rowPadY) var(--rowPadX);
        font-weight: 750;
        font-size: var(--fsSmall);
      }
      tbody td{
        border-top: 1px solid var(--line);
        padding: var(--rowPadY) var(--rowPadX);
        vertical-align: top;
        word-break: break-word;
      }

      .colNo{ width: 10mm; text-align:center; }
      .colName{ width: 68mm; }
      .colQty{ width: 28mm; text-align:right; }
      .colUnit{ width: 12mm; text-align:center; }
      .colPrice{ width: 30mm; text-align:right; }
      .colNote{ width: 32mm; }

      .nameMain{ font-weight: 700; }
      .nameSub{ color: var(--muted); font-size: var(--fsSmall); margin-top: 2px; }

      .foot{
        margin-top: 10mm;
        font-size: var(--fsSmall);
        color: var(--muted);
      }
      .stampRow{
        display:flex;
        justify-content: flex-end;
        gap: 8mm;
        margin-top: 12mm;
      }
      .stampBox{
        width: 28mm;
        height: 18mm;
        border: 1px solid var(--line);
        border-radius: 8px;
      }
    `;

    var h = bidData.header || {};
    var items = bidData.items || [];
    var lines = (bidData.offer && bidData.offer.lines) ? bidData.offer.lines : {};

    // [PRN-04-02] 本文HTML（ここをいじるとデザインが変わる）
    var rows = "";
    for(var i=0;i<items.length;i++){
      var it = items[i] || {};
      var seq = (it.seq == null ? "" : ("" + it.seq));
      var price = getUnitPrice(lines, seq);

      rows += ""
        + "<tr>"
        +   "<td class='colNo'>" + esc(seq) + "</td>"
        +   "<td class='colName'>"
        +     "<div class='nameMain'>" + esc(it.name||"") + "</div>"
        +     "<div class='nameSub'>" + esc(it.spec||"") + "</div>"
        +   "</td>"
        +   "<td class='colQty'>" + esc(it.qty==null?"":it.qty) + "</td>"
        +   "<td class='colUnit'>" + esc(it.unit||"") + "</td>"
        +   "<td class='colPrice'>" + esc(price||"") + "</td>"
        +   "<td class='colNote'>" + esc(it.note||"") + "</td>"
        + "</tr>";
    }
    if(!rows){
      rows = "<tr><td colspan='6' style='color:#6b7280;padding:10px;'>品目なし</td></tr>";
    }

    var toText = sumToText(h);

    // [PRN-04-03] 完全なHTML（iframe srcdocに入れる）
    var html = ""
      + "<!doctype html><html lang='ja'><head><meta charset='utf-8'/>"
      + "<meta name='viewport' content='width=device-width,initial-scale=1'/>"
      + "<title>入札書</title>"
      + "<style>" + css + "</style>"
      + "</head><body>"
      +   "<div class='page' id='pdfPage'>"
      +     "<div class='h1'>入札書</div>"

      +     "<div class='metaRow'>"
      +       "<div class='metaBox'>"
      +         "<div class='metaItem'><span class='k'>入札番号：</span><span class='v'>" + esc(h.bidNo||"") + "</span></div>"
      +         "<div class='metaItem'><span class='k'>入札日：</span><span class='v'>" + esc(fmtDate(h.bidDate)||"") + "</span></div>"
      +         "<div class='metaItem'><span class='k'>納入場所：</span><span class='v'>" + esc(h.deliveryPlace||"") + "</span></div>"
      +       "</div>"
      +       "<div class='metaBox'>"
      +         "<div class='metaItem'><span class='k'>納期：</span><span class='v'>" + esc(fmtDate(h.dueDate)||"") + "</span></div>"
      +         "<div class='metaItem'><span class='k'>状態：</span><span class='v'>" + esc(h.status||"") + "</span></div>"
      +         "<div class='metaItem'><span class='k'>備考：</span><span class='v'>" + esc(h.note||"") + "</span></div>"
      +       "</div>"
      +     "</div>"

      +     "<div class='toLine'><span class='k'>宛先：</span><span class='to'>" + esc(toText || "（宛先未設定）") + "</span></div>"
      +     "<div class='hr'></div>"

      +     "<table>"
      +       "<thead><tr>"
      +         "<th class='colNo'>No</th>"
      +         "<th class='colName'>品名／規格</th>"
      +         "<th class='colQty'>予定数量</th>"
      +         "<th class='colUnit'>単位</th>"
      +         "<th class='colPrice'>入札単価</th>"
      +         "<th class='colNote'>備考</th>"
      +       "</tr></thead>"
      +       "<tbody>" + rows + "</tbody>"
      +     "</table>"

      +     "<div class='stampRow'>"
      +       "<div class='stampBox'></div>"
      +       "<div class='stampBox'></div>"
      +     "</div>"

      +     "<div class='foot'>"
      +       "generatedAt: " + esc(bidData.meta && bidData.meta.generatedAt ? bidData.meta.generatedAt : "") + "<br>"
      +       "bidderId: " + esc(bidData.meta && bidData.meta.bidderId ? bidData.meta.bidderId : "") 
      +     "</div>"
      +   "</div>"
      + "</body></html>";

    return html;
  }

  // =========================================================
  // [PRN-05] 外部ライブラリ動的ロード（Edge95縛りなし想定）
  // =========================================================
  function loadScriptOnce(url, globalName){
    return new Promise(function(resolve, reject){
      try{
        if(globalName && window[globalName]){
          return resolve(true);
        }
        // 既に同URLがあれば待つ
        var exists = document.querySelector("script[data-src='" + url + "']");
        if(exists){
          exists.addEventListener("load", function(){ resolve(true); });
          exists.addEventListener("error", function(){ reject(new Error("load failed: " + url)); });
          return;
        }

        var s = document.createElement("script");
        s.src = url;
        s.async = true;
        s.setAttribute("data-src", url);
        s.onload = function(){ resolve(true); };
        s.onerror = function(){ reject(new Error("load failed: " + url)); };
        document.head.appendChild(s);
      }catch(e){
        reject(e);
      }
    });
  }

  function ensurePdfLibs(){
    // html2canvas + jsPDF を用意
    // ※バージョン固定（再現性のため）
    var p1 = loadScriptOnce("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js", "html2canvas");
    // jsPDF は window.jspdf.jsPDF 形式（v2系）
    var p2 = loadScriptOnce("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js", "jspdf");
    return Promise.all([p1, p2]).then(function(){
      if(!window.html2canvas) throw new Error("html2canvas not available");
      if(!window.jspdf || !window.jspdf.jsPDF) throw new Error("jsPDF not available");
      return true;
    });
  }

  // =========================================================
  // [PRN-06] HTML → canvas → PDF（多ページ対応）
  // =========================================================
  function createHiddenIframe(html){
    return new Promise(function(resolve, reject){
      try{
        var ifr = document.createElement("iframe");
        ifr.style.position = "fixed";
        ifr.style.left = "-9999px";
        ifr.style.top = "0";
        ifr.style.width = "210mm";
        ifr.style.height = "297mm";
        ifr.style.border = "0";
        ifr.setAttribute("aria-hidden", "true");
        document.body.appendChild(ifr);

        // srcdoc で流し込み（同一オリジン扱いでcanvas取得可能）
        ifr.srcdoc = html;

        ifr.onload = function(){
          try{
            // フォント読み込み待ち（対応ブラウザなら）
            var doc = ifr.contentDocument;
            if(doc && doc.fonts && doc.fonts.ready){
              doc.fonts.ready.then(function(){ resolve(ifr); }).catch(function(){ resolve(ifr); });
            }else{
              resolve(ifr);
            }
          }catch(e){
            resolve(ifr);
          }
        };
      }catch(e){
        reject(e);
      }
    });
  }

  function removeIframe(ifr){
    try{
      if(ifr && ifr.parentNode) ifr.parentNode.removeChild(ifr);
    }catch(e){}
  }

  function canvasToPdfAndDownload(canvas, filename){
    // [PRN-06-01] A4サイズ（mm）
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

    // [PRN-06-02] canvas → 画像データ
    var imgData = canvas.toDataURL("image/png");

    // [PRN-06-03] canvasのpxをmmへ比率変換
    var pageW = 210; // mm
    var pageH = 297; // mm
    var canvasW = canvas.width;
    var canvasH = canvas.height;

    // 画像をページ幅に合わせる（高さは比率）
    var imgW = pageW;
    var imgH = (canvasH * imgW) / canvasW;

    // [PRN-06-04] 1ページに収まるならそのまま
    if(imgH <= pageH){
      pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH);
      pdf.save(filename);
      return true;
    }

    // [PRN-06-05] 複数ページ：高さをページごとに分割して貼る
    // 方式: 同一画像を Y をずらして貼る（簡易で崩れにくい）
    var y = 0;
    var page = 0;
    while(y < imgH){
      if(page > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, -y, imgW, imgH);
      y += pageH;
      page++;
      // 安全弁（無限ループ防止）
      if(page > 200) break;
    }

    pdf.save(filename);
    return true;
  }

  function htmlToPdfDownload(html, filename){
    return ensurePdfLibs().then(function(){
      return createHiddenIframe(html);
    }).then(function(ifr){
      var doc = ifr.contentDocument;
      var pageEl = doc.getElementById("pdfPage");
      if(!pageEl) throw new Error("pdfPage element not found in iframe");

      // html2canvas でキャプチャ
      return window.html2canvas(pageEl, {
        backgroundColor: "#ffffff",
        scale: 2,              // 解像度（必要なら 3）
        useCORS: true
      }).then(function(canvas){
        try{
          canvasToPdfAndDownload(canvas, filename);
          return true;
        }finally{
          removeIframe(ifr);
        }
      }).catch(function(e){
        removeIframe(ifr);
        throw e;
      });
    });
  }

  // =========================================================
  // [PRN-07] 印刷（PDFはユーザーが保存する方式）
  // “デザイン確認を最速” にしたいときに便利
  // =========================================================
  function openPrintWindow(html){
    var w = window.open("", "_blank");
    if(!w) throw new Error("ポップアップがブロックされました（許可してください）");
    w.document.open();
    w.document.write(html);
    w.document.close();
    try{
      w.focus();
      // 少し待ってから印刷（レンダリング待ち）
      setTimeout(function(){
        try{ w.print(); }catch(e){}
      }, 300);
    }catch(e){}
    return true;
  }

  // =========================================================
  // [PRN-08] 公開API：doPdf / doPrint
  // =========================================================
  function doPdf(){
    // [PRN-08-01] ログ開始
    L("pdf", "PDF生成開始（BidData→テンプレHTML→canvas→PDF）");

    // [PRN-08-02] Firebase初期化（必要なら）
    try{
      ensureFirebaseInit();
    }catch(e){
      L("pdfErr", "Firebase init failed: " + toStr(e));
      return Promise.reject(e);
    }

    // [PRN-08-03] bidNo/bidderId 確定
    var bidNo = getBidNo();
    var bidderId = getBidderId();

    // [PRN-08-04] FirestoreからBidDataを再取得（ここが唯一の入力）
    return fetchBidDataFromFirestore(bidNo, bidderId).then(function(bidData){
      // [PRN-08-05] HTML生成（見た目はここだけ直せばOK）
      var html = renderPdfHtml(bidData);

      // [PRN-08-06] ファイル名（JST想定）
      var ymd = fmtYmdJst(new Date());
      var fname = "入札書_" + (bidData.header.bidNo || "unknown") + "_" + ymd + ".pdf";

      // [PRN-08-07] PDF化して保存
      return htmlToPdfDownload(html, fname).then(function(){
        L("pdf", "PDF保存完了: " + fname);
        return true;
      });
    }).catch(function(e){
      L("pdfErr", "FAILED: " + toStr(e));
      throw e;
    });
  }

  function doPrint(){
    L("print", "印刷開始（BidData→テンプレHTML→window.print）");

    try{
      ensureFirebaseInit();
    }catch(e){
      L("printErr", "Firebase init failed: " + toStr(e));
      return Promise.reject(e);
    }

    var bidNo = getBidNo();
    var bidderId = getBidderId();

    return fetchBidDataFromFirestore(bidNo, bidderId).then(function(bidData){
      var html = renderPdfHtml(bidData);
      openPrintWindow(html);
      L("print", "OK");
      return true;
    }).catch(function(e){
      L("printErr", "FAILED: " + toStr(e));
      throw e;
    });
  }

  // =========================================================
  // [PRN-09] 公開（既存呼び出し互換）
  // =========================================================
  window.BidderPrint = {
    doPdf: doPdf,
    doPrint: doPrint
  };

})();