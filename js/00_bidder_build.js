/*
[JST 2026-01-24 21:00] bidder/css/bidder.css v20260124-01
[BID-CSS] 入札者フォーム共通スタイル（Edge95想定）
*/

:root{
  --bg:#0f1324;
  --panel:rgba(255,255,255,0.06);
  --line:rgba(255,255,255,0.14);
  --text:#e8ecff;
  --muted:rgba(232,236,255,0.72);
  --ok:rgba(120,255,170,0.22);
  --err:rgba(255,120,120,0.22);
  --info:rgba(120,200,255,0.18);
}

html, body{
  margin:0;
  padding:0;
  background:var(--bg);
  color:var(--text);
  font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
}

.wrap{
  max-width: 980px;
  margin: 0 auto;
  padding: 12px;
}

.card{
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px;
  margin-top: 10px;
}

.row{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  align-items:flex-end;
}

.k{
  font-weight:700;
}

.muted{
  color:var(--muted);
}

.field{
  display:flex;
  flex-direction:column;
  gap:6px;
}

input{
  background: rgba(0,0,0,0.22);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px;
  outline:none;
  min-width: 180px;
}

input:disabled{
  opacity: 0.55;
}

.btn{
  background: rgba(255,255,255,0.10);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  cursor:pointer;
  min-height: 40px;
}

.btn:disabled{
  opacity: 0.45;
  cursor:not-allowed;
}

.msg{
  border-radius: 10px;
  padding: 10px;
  border: 1px solid var(--line);
  margin: 6px 0;
}

.msg.err{
  background: var(--err);
}

.msg.ok{
  background: var(--ok);
}

.msg.info{
  background: var(--info);
}

table{
  width:100%;
  border-collapse: collapse;
  font-size: 14px;
}

th, td{
  border-bottom: 1px solid var(--line);
  padding: 8px 6px;
  vertical-align: top;
}

thead th{
  color: var(--muted);
  font-weight: 700;
}

#itemsTableWrap{
  overflow-x:auto;
}

.itemName{
  font-weight: 700;
}

.itemSpec{
  color: var(--muted);
  margin-top: 3px;
  font-size: 0.92em;
}

.priceInput{
  width: 110px;
  min-width: 110px;
}

#logBox{
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.35;
  max-height: 240px;
  overflow:auto;
  background: rgba(0,0,0,0.18);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px;
  margin-top: 8px;
}

/* 印刷（まずは最小） */
@media print{
  body{ background:#fff; color:#000; }
  .wrap{ max-width:none; }
  .card{ background:#fff; border: 0; }
  #statusBar, #toolbar, #msgArea, #loginSection, #authSection, #profileSection, #bidInfoSection, #itemsSection, #submitSection, #logSection{
    display:none !important;
  }
  #printArea{
    display:block !important;
  }
}
