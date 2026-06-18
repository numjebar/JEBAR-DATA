// ============ Wongnai POS / LINE MAN smart importer ============
const pad2 = n => String(n).padStart(2, '0');
const pnum = v => {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[,\s฿]/g, ''));
  return isNaN(n) ? 0 : n;
};

function posDecodeXml(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
function posNormalizeHeader(v) {
  return posDecodeXml(v).toString().trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[._-]+/g, ' ');
}
function posFindHeader(headers, names) {
  const keys = names.map(posNormalizeHeader);
  return headers.findIndex(h => keys.some(k => h === k || h.includes(k)));
}
function posThaiMonth(s) {
  const M = window.THAI_MONTHS || [];
  const MS = window.THAI_MONTHS_SHORT || [];
  s = String(s || '').replace(/\./g, '').trim();
  for (let i = 0; i < 12; i++) {
    if (s.includes(String(MS[i] || '').replace(/\./g, '')) || s.includes(M[i])) return i;
  }
  return -1;
}
function posParseDate(v) {
  if (v == null) return null;
  v = String(v).trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = +v;
    if (n > 1000 && n < 100000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    }
  }
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    let y = +m[1];
    if (y > 2500) y -= 543;
    return `${y}-${pad2(m[2])}-${pad2(m[3])}`;
  }
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    if (y > 2500) y -= 543;
    return `${y}-${pad2(m[2])}-${pad2(m[1])}`;
  }
  m = v.match(/(\d{1,2})\s*([ก-๙]+\.?[ก-๙]*)\.?\s*(\d{2,4})/);
  if (m) {
    const mi = posThaiMonth(m[2]);
    if (mi >= 0) {
      let y = +m[3];
      if (y < 100) y += 2500;
      if (y > 2500) y -= 543;
      return `${y}-${pad2(mi + 1)}-${pad2(m[1])}`;
    }
  }
  const d = new Date(v);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return null;
}
function posMatchChannel(text) {
  const t = String(text || '').toLowerCase();
  if (/line\s*man|lineman|line_man|ไลน์แมน|line\b/.test(t)) return 'line';
  if (/หน้าร้าน|ที่ร้าน|dine|counter|walk|take\s*away|takeaway|cash|เงินสด|qr|พร้อมเพย์|โอน|pos|store/.test(t)) return 'store';
  if (/grab|foodpanda|panda|robinhood|shopee|true\s*food|delivery|เดลิเวอ|อื่น|other/.test(t)) return 'other';
  return null;
}
const posClassify = t => posMatchChannel(t) || 'other';

function posParseCSV(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (q) {
      if (c === '"') {
        if (next === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur.trim()); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && next === '\n') i++;
      row.push(cur.trim());
      rows.push(row);
      row = [];
      cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) {
    row.push(cur.trim());
    rows.push(row);
  }
  return rows.filter(r => r.some(c => String(c || '').trim() !== ''));
}

function posColumnIndex(column) {
  return String(column || '').split('').reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}
function posCellValue(cellXml, shared) {
  const type = (cellXml.match(/\st="([^"]+)"/) || [])[1];
  let raw = '';
  const inline = cellXml.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
  const value = cellXml.match(/<v>([\s\S]*?)<\/v>/);
  if (type === 'inlineStr' && inline) raw = inline[1];
  else if (value) raw = value[1];
  if (type === 's') return shared[Number(raw)] || '';
  return posDecodeXml(raw);
}
async function posInflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function posZipEntries(buffer) {
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 66000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ไม่พบโครงสร้าง ZIP ในไฟล์ Excel');
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder('utf-8');
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength)).replace(/\\/g, '/');
    entries.set(name, { buffer, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
async function posZipBytes(entries, name) {
  const entry = entries.get(name);
  if (!entry) throw new Error(`ไม่พบ ${name} ในไฟล์ Excel`);
  const view = new DataView(entry.buffer);
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const bytes = entry.buffer.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return new Uint8Array(bytes);
  if (entry.method !== 8) throw new Error(`Excel compression method ${entry.method} ยังไม่รองรับ`);
  return posInflate(bytes);
}
async function posZipText(entries, name) {
  return new TextDecoder('utf-8').decode(await posZipBytes(entries, name));
}
function posWorkbookSheets(workbookXml, relsXml) {
  const rels = new Map();
  for (const rel of String(relsXml || '').matchAll(/<Relationship\b[^>]*>/g)) {
    const tag = rel[0];
    const id = (tag.match(/\bId="([^"]+)"/) || [])[1];
    let target = (tag.match(/\bTarget="([^"]+)"/) || [])[1] || '';
    target = target.replace(/^\/+/, '');
    if (id) rels.set(id, target.startsWith('xl/') ? target : `xl/${target}`);
  }
  return [...String(workbookXml || '').matchAll(/<sheet\b[^>]*>/g)].map((m, i) => {
    const tag = m[0];
    const id = (tag.match(/\br:id="([^"]+)"/) || [])[1];
    const name = posDecodeXml((tag.match(/\bname="([^"]+)"/) || [])[1] || `Sheet${i + 1}`);
    return { name, path: rels.get(id) || `xl/worksheets/sheet${i + 1}.xml` };
  });
}
function posSharedStrings(xml) {
  return [...String(xml || '').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(si => [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => posDecodeXml(t[1])).join(''));
}
function posSheetRows(xml, shared) {
  const rows = [];
  for (const rm of String(xml || '').matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cm[1], cellXml = cm[0];
      const ref = (attrs.match(/\br="([A-Z]+)\d+"/) || [])[1];
      if (!ref) continue;
      cells[posColumnIndex(ref)] = posCellValue(cellXml, shared);
    }
    rows.push(cells.map(v => v ?? ''));
  }
  return rows.filter(r => r.some(c => String(c || '').trim() !== ''));
}
async function posXlsxSheets(file) {
  const entries = await posZipEntries(await file.arrayBuffer());
  const workbookXml = await posZipText(entries, 'xl/workbook.xml');
  const relsXml = entries.has('xl/_rels/workbook.xml.rels') ? await posZipText(entries, 'xl/_rels/workbook.xml.rels') : '';
  const shared = entries.has('xl/sharedStrings.xml') ? posSharedStrings(await posZipText(entries, 'xl/sharedStrings.xml')) : [];
  const defs = posWorkbookSheets(workbookXml, relsXml);
  const sheets = [];
  for (const sheet of defs) {
    if (entries.has(sheet.path)) sheets.push({ name: sheet.name, rows: posSheetRows(await posZipText(entries, sheet.path), shared) });
  }
  if (!sheets.length && entries.has('xl/worksheets/sheet1.xml')) {
    sheets.push({ name: 'Sheet1', rows: posSheetRows(await posZipText(entries, 'xl/worksheets/sheet1.xml'), shared) });
  }
  return sheets;
}
async function posXlsxRows(file) {
  const sheets = await posXlsxSheets(file);
  return sheets[0]?.rows || [];
}
async function posReadFile(file) {
  if (file.name.toLowerCase().endsWith('.xlsx')) return posXlsxRows(file);
  return posParseCSV(await file.text());
}
window.__posReadFile = posReadFile;

function posAnalyze(rows, options = {}) {
  if (!rows || rows.length < 2) return { error: 'ไฟล์ว่างหรืออ่านไม่ได้' };
  let hi = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if ((rows[i] || []).filter(c => String(c || '').trim() !== '').length >= 2) { hi = i; break; }
  }
  const header = (rows[hi] || []).map(h => String(h || '').trim());
  const hl = header.map(posNormalizeHeader);
  const data = rows.slice(hi + 1).filter(r => r.some(c => String(c || '').trim() !== ''));
  if (!data.length) return { error: 'ไม่พบแถวข้อมูล' };

  let dateIdx = posFindHeader(hl, ['วันที่', 'วัน', 'date', 'time', 'day', 'order date', 'วันที่สั่งซื้อ']);
  if (dateIdx < 0) {
    let best = -1, bn = 0;
    for (let c = 0; c < header.length; c++) {
      let n = 0;
      for (const r of data.slice(0, 25)) if (posParseDate(r[c])) n++;
      if (n > bn) { bn = n; best = c; }
    }
    if (bn >= Math.min(3, data.length)) dateIdx = best;
  }
  if (dateIdx < 0) return { error: 'หาคอลัมน์วันที่ไม่เจอ' };

  const channelCols = [];
  header.forEach((h, i) => {
    if (i === dateIdx) return;
    const bucket = posMatchChannel(h);
    if (bucket) channelCols.push({ idx: i, bucket, name: h });
  });
  const chIdx = hl.findIndex(h => ['ช่องทาง', 'channel', 'platform', 'source', 'ประเภทการขาย', 'แหล่งขาย'].some(k => h.includes(k)));
  const billsIdx = hl.findIndex((h, i) => i !== dateIdx && ['bills', 'bill', 'orders', 'จำนวนบิล', 'บิล', 'ออเดอร์', 'receipt', 'transactions'].some(k => h.includes(k)));
  const avgIdx = hl.findIndex(h => ['avg basket', 'avg_basket_size', 'avgbasketsize', 'เฉลี่ยต่อบิล'].some(k => h.includes(k)));

  function pickAmount(exclude) {
    const prefs = ['ยอดขายสุทธิ', 'ยอดสุทธิ', 'สุทธิ', 'net sales', 'net amount', 'ยอดขายรวม', 'ยอดรวม', 'ยอดขาย', 'total sales', 'grand total', 'total', 'รวมเงิน', 'รวม', 'sales', 'amount', 'จำนวนเงิน', 'ยอด'];
    for (const p of prefs) {
      const i = hl.findIndex((h, idx) => !exclude.includes(idx) && h.includes(posNormalizeHeader(p)));
      if (i >= 0) return i;
    }
    for (let c = header.length - 1; c >= 0; c--) {
      if (exclude.includes(c)) continue;
      let n = 0;
      for (const r of data.slice(0, 12)) {
        const s = String(r[c] || '').trim();
        if (s && /^[\d,.\s฿]+$/.test(s) && pnum(s) > 0) n++;
      }
      if (n >= 2) return c;
    }
    return -1;
  }

  const buckets = {};
  const B = d => buckets[d] || (buckets[d] = { store: 0, line: 0, other: 0, bills: 0, lineBills: 0, avgBasket: 0 });
  let unparsed = 0, format = 'total', amtName = '', mode = options.mode || 'mixed';

  if (channelCols.length > 0 && chIdx < 0 && !options.singleAmountChannel) {
    format = 'by-channel';
    amtName = channelCols.map(c => c.name).join(', ');
    for (const r of data) {
      const d = posParseDate(r[dateIdx]);
      if (!d) { unparsed++; continue; }
      const b = B(d);
      for (const c of channelCols) b[c.bucket] += pnum(r[c.idx]);
      if (billsIdx >= 0) b.bills += pnum(r[billsIdx]);
    }
  } else if (chIdx >= 0 && !options.singleAmountChannel) {
    format = 'channel-rows';
    const ai = pickAmount([chIdx, dateIdx]);
    amtName = ai >= 0 ? header[ai] : '';
    if (ai < 0) return { error: 'หาคอลัมน์ยอดเงินไม่เจอ' };
    for (const r of data) {
      const d = posParseDate(r[dateIdx]);
      if (!d) { unparsed++; continue; }
      const b = B(d);
      const bucket = posClassify(r[chIdx]);
      b[bucket] += pnum(r[ai]);
      if (billsIdx >= 0) {
        const bills = pnum(r[billsIdx]);
        b.bills += bills;
        if (bucket === 'line') b.lineBills += bills;
      }
    }
  } else {
    format = options.singleAmountChannel === 'line' ? 'line-only' : 'total';
    mode = options.singleAmountChannel === 'line' ? 'line-only' : 'store-only';
    const ai = pickAmount([dateIdx, billsIdx].filter(x => x >= 0));
    amtName = ai >= 0 ? header[ai] : '';
    if (ai < 0) return { error: 'หาคอลัมน์ยอดเงินไม่เจอ' };
    for (const r of data) {
      const d = posParseDate(r[dateIdx]);
      if (!d) { unparsed++; continue; }
      const b = B(d);
      const amount = pnum(r[ai]);
      if (options.singleAmountChannel === 'line') b.line += amount;
      else b.store += amount;
      if (billsIdx >= 0) {
        const bills = pnum(r[billsIdx]);
        b.bills += bills;
        if (options.singleAmountChannel === 'line') b.lineBills += bills;
      }
      if (avgIdx >= 0) b.avgBasket = pnum(r[avgIdx]);
    }
  }

  const preview = Object.keys(buckets).sort().map(d => ({ date: d, ...buckets[d], total: buckets[d].store + buckets[d].line + buckets[d].other }));
  if (!preview.length) return { error: 'อ่านข้อมูลได้ แต่แปลงวันที่ไม่สำเร็จ' };
  return {
    preview, format, mode, unparsed,
    dateCol: header[dateIdx],
    amtName,
    channels: channelCols.map(c => c.name),
    grand: preview.reduce((s, p) => s + p.total, 0),
    hasBills: billsIdx >= 0 && preview.some(p => p.bills > 0),
    billsCol: billsIdx >= 0 ? header[billsIdx] : null,
  };
}
window.__posAnalyze = posAnalyze;

async function posAnalyzeFile(file) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx')) {
    const sheets = await posXlsxSheets(file);
    const lineman = sheets.find(s => posNormalizeHeader(s.name) === 'lineman');
    const total = sheets.find(s => posNormalizeHeader(s.name) === 'total');
    if (lineman && total && lineman.rows.length > 1) {
      const res = posAnalyze(lineman.rows, { singleAmountChannel: 'line', mode: 'line-only' });
      if (!res.error) {
        return {
          file: file.name,
          type: 'Excel LINE MAN รายวัน (ชีต LINEMAN)',
          note: 'อัปเดตเฉพาะยอด LINE MAN ไม่แตะยอดหน้าร้าน/POS และไม่เอา TOTAL มาหักลบ',
          ...res,
        };
      }
    }
    const first = sheets[0] || { name: 'Sheet1', rows: [] };
    return { file: file.name, type: `Excel POS รายวัน (${first.name})`, ...(posAnalyze(first.rows)) };
  }
  const forceLine = /line\s*man|lineman|ไลน์แมน/i.test(file.name);
  return {
    file: file.name,
    type: forceLine ? 'CSV LINE MAN รายวัน' : 'CSV POS รายวัน',
    ...(posAnalyze(posParseCSV(await file.text()), forceLine ? { singleAmountChannel: 'line', mode: 'line-only' } : {})),
    ...(forceLine ? { note: 'อัปเดตเฉพาะยอด LINE MAN ไม่แตะยอดหน้าร้าน/POS' } : {}),
  };
}

function posCalcStore(sale) {
  const posTotal = Number(sale?.posTotal || 0);
  const line = Number(sale?.line || 0);
  if (posTotal > 0) return Math.max(0, posTotal - line);
  return Number(sale?.store || 0);
}
function posFinalizeSale(sale) {
  const next = { ...sale };
  if (Number(next.posTotal || 0) > 0) next.store = posCalcStore(next);
  return next;
}
function posSameSale(a, b) {
  const keys = ['store', 'line', 'other', 'bills', 'posTotal'];
  return keys.every(k => Number(a?.[k] || 0) === Number(b?.[k] || 0));
}
function posStageImports(db, results) {
  const byDate = new Map((db.dailySales || []).map(s => [s.date, posFinalizeSale(s)]));
  const before = new Map((db.dailySales || []).map(s => [s.date, posFinalizeSale(s)]));
  for (const result of results) {
    if (result.error || !Array.isArray(result.preview)) continue;
    for (const p of result.preview) {
      const current = byDate.get(p.date) || { date: p.date, store: 0, line: 0, other: 0, bills: 0 };
      if (result.mode === 'line-only') {
        byDate.set(p.date, posFinalizeSale({
          ...current,
          line: p.line || 0,
          bills: current.bills || p.lineBills || p.bills || 0,
        }));
      } else if (result.mode === 'store-only') {
        byDate.set(p.date, posFinalizeSale({
          ...current,
          posTotal: p.store || 0,
          store: Math.max(0, (p.store || 0) - Number(current.line || 0)),
          bills: p.bills || current.bills || 0,
        }));
      } else {
        byDate.set(p.date, posFinalizeSale({
          ...current,
          posTotal: 0,
          store: p.store || 0,
          line: p.line || 0,
          other: p.other || 0,
          bills: p.bills || current.bills || 0,
        }));
      }
    }
  }
  const sales = [...byDate.values()].sort((a, b) => a.date < b.date ? -1 : 1);
  const changed = sales.filter(s => !posSameSale(before.get(s.date), s));
  return {
    sales,
    changed,
    totalStore: changed.reduce((sum, s) => sum + posCalcStore(s), 0),
    totalLine: changed.reduce((sum, s) => sum + Number(s.line || 0), 0),
    totalOther: changed.reduce((sum, s) => sum + Number(s.other || 0), 0),
  };
}

const POS_FORMAT_LABEL = {
  'by-channel': 'แยกตามช่องทาง (คอลัมน์)',
  'channel-rows': 'แยกตามช่องทาง (แถว)',
  total: 'ยอดรวมต่อวัน',
  'line-only': 'LINE MAN เท่านั้น',
};

function POSImportModal({ open, onClose }) {
  const { setDb, db, flash } = useData();
  const fileRef = React.useRef();
  const [state, setState] = React.useState({ stage: 'pick' });
  React.useEffect(() => { if (open) setState({ stage: 'pick' }); }, [open]);

  const onFiles = async e => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setState({ stage: 'reading', count: files.length });
    const results = [];
    for (const file of files) {
      try { results.push(await posAnalyzeFile(file)); }
      catch (err) { results.push({ file: file.name, type: 'อ่านไฟล์ไม่สำเร็จ', error: err.message || 'อ่านไฟล์ไม่ได้' }); }
    }
    const ok = results.filter(r => !r.error);
    const staged = posStageImports(db, ok);
    setState({ stage: ok.length ? 'preview' : 'error', results, staged, msg: ok.length ? '' : 'ยังไม่มีไฟล์ที่ระบบอ่านได้' });
    e.target.value = '';
  };

  const confirm = () => {
    if (!state.staged) return;
    setDb(prev => ({ ...prev, dailySales: state.staged.sales }));
    flash(`นำเข้ายอดขายสำเร็จ ${state.staged.changed.length} วัน`);
    onClose();
  };

  return <Modal open={open} onClose={onClose} title="นำเข้าจาก POS วงใน / LINE MAN" width={760}
    footer={state.stage === 'preview' ? <>
      <Button variant="secondary" onClick={() => setState({ stage: 'pick' })}>เลือกไฟล์ใหม่</Button>
      <Button icon="check" onClick={confirm}>ยืนยันนำเข้า {state.staged.changed.length} วัน</Button>
    </> : null}>
    {state.stage === 'pick' && <div>
      <div onClick={() => fileRef.current.click()} style={{ border: '2px dashed var(--line)', borderRadius: 16, padding: '34px 24px', textAlign: 'center', cursor: 'pointer' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-soft)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'transparent'; }}>
        <div style={{ width: 54, height: 54, borderRadius: 15, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
          <Icon name="upload" size={26} />
        </div>
        <div style={{ fontWeight: 600, fontSize: 15.5 }}>เลือกไฟล์ POS วงใน และ/หรือ LINE MAN</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 5 }}>เลือกหลายไฟล์พร้อมกันได้ ระบบจะแยกยอดหน้าร้านกับ LINE MAN ให้เอง</div>
      </div>
      <input ref={fileRef} type="file" multiple accept=".xlsx,.csv" style={{ display: 'none' }} onChange={onFiles} />
      <div style={{ marginTop: 18, background: 'var(--surface-2)', borderRadius: 13, padding: '15px 17px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="doc" size={16} color="var(--ink-2)" />รูปแบบที่รองรับ
        </div>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.8 }}>
          <li>ไฟล์ยอดขายรายวันจาก POS วงใน: จะอัปเดตยอดหน้าร้าน/POS</li>
          <li>ไฟล์ภาพรวม LINE MAN ที่มีชีต LINEMAN/TOTAL: จะใช้เฉพาะชีต LINEMAN และไม่แตะยอดหน้าร้านเดิม</li>
          <li>ก่อนบันทึกจริง ระบบจะแสดง preview ให้ตรวจยอดก่อนยืนยัน</li>
        </ul>
      </div>
    </div>}

    {state.stage === 'reading' && <div style={{ textAlign: 'center', padding: '34px 0' }}>
      <div style={{ width: 50, height: 50, borderRadius: 15, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
        <Icon name="sync" size={24} />
      </div>
      <div style={{ fontWeight: 600 }}>กำลังอ่านไฟล์ {state.count} ไฟล์...</div>
    </div>}

    {state.stage === 'error' && <div style={{ textAlign: 'center', padding: '10px 0' }}>
      <div style={{ width: 50, height: 50, borderRadius: 14, background: 'var(--red-soft)', color: 'var(--red)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
        <Icon name="close" size={24} />
      </div>
      <p style={{ fontWeight: 600, fontSize: 15 }}>นำเข้าไม่สำเร็จ</p>
      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 6 }}>{state.msg}</p>
      <div style={{ marginTop: 18 }}><Button variant="soft" onClick={() => setState({ stage: 'pick' })}>ลองไฟล์อื่น</Button></div>
    </div>}

    {state.stage === 'preview' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
        <Card pad={14}><div style={{ fontSize: 12, color: 'var(--ink-2)' }}>วันที่เปลี่ยน</div><div className="tnum" style={{ fontSize: 24, fontWeight: 700 }}>{fmt(state.staged.changed.length)}</div></Card>
        <Card pad={14}><div style={{ fontSize: 12, color: 'var(--ink-2)' }}>หน้าร้าน/POS</div><div className="tnum" style={{ fontSize: 24, fontWeight: 700 }}>{fmtB(state.staged.totalStore)}</div></Card>
        <Card pad={14}><div style={{ fontSize: 12, color: 'var(--ink-2)' }}>LINE MAN</div><div className="tnum" style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{fmtB(state.staged.totalLine)}</div></Card>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {state.results.map((r, i) => <div key={i} style={{ border: '1px solid var(--line-2)', borderRadius: 12, padding: '11px 13px', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.file}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>{r.error || r.note || `${r.preview?.length || 0} วัน • ${POS_FORMAT_LABEL[r.format] || r.format}`}</div>
          </div>
          <Badge tone={r.error ? 'red' : (r.mode === 'line-only' ? 'blue' : 'green')}>{r.error ? 'ไม่สำเร็จ' : r.type}</Badge>
        </div>)}
      </div>
      <div style={{ maxHeight: 255, overflowY: 'auto', border: '1px solid var(--line-2)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)' }}><tr style={{ color: 'var(--ink-2)', fontSize: 11.5 }}>
            <th style={{ textAlign: 'left', padding: '9px 14px', fontWeight: 600 }}>วันที่</th>
            <th style={{ textAlign: 'right', padding: '9px 8px', fontWeight: 600 }}>หน้าร้าน/POS</th>
            <th style={{ textAlign: 'right', padding: '9px 8px', fontWeight: 600 }}>LINE MAN</th>
            <th style={{ textAlign: 'right', padding: '9px 8px', fontWeight: 600 }}>อื่นๆ</th>
            <th style={{ textAlign: 'right', padding: '9px 8px', fontWeight: 600 }}>บิล</th>
            <th style={{ textAlign: 'right', padding: '9px 14px', fontWeight: 600 }}>รวม</th>
          </tr></thead>
          <tbody>{state.staged.changed.map(p => (
            <tr key={p.date} style={{ borderTop: '1px solid var(--line-2)' }}>
              <td style={{ padding: '8px 14px', fontWeight: 500 }}>{fmtDate(p.date)}</td>
              <td className="tnum" style={{ textAlign: 'right', padding: '8px 8px' }}>{fmt(p.store)}</td>
              <td className="tnum" style={{ textAlign: 'right', padding: '8px 8px', color: 'var(--accent)', fontWeight: 650 }}>{fmt(p.line)}</td>
              <td className="tnum" style={{ textAlign: 'right', padding: '8px 8px', color: 'var(--ink-2)' }}>{fmt(p.other)}</td>
              <td className="tnum" style={{ textAlign: 'right', padding: '8px 8px', color: 'var(--ink-2)' }}>{fmt(p.bills)}</td>
              <td className="tnum" style={{ textAlign: 'right', padding: '8px 14px', fontWeight: 700 }}>{fmt((p.store || 0) + (p.line || 0) + (p.other || 0))}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>
        ยืนยันแล้วข้อมูลจะบันทึกลงเครื่องและ Auto-sync ขึ้น Supabase ตามการตั้งค่าปัจจุบัน
      </p>
    </div>}
  </Modal>;
}
Object.assign(window, { POSImportModal, posAnalyze, posAnalyzeFile, posReadFile, posXlsxSheets });
