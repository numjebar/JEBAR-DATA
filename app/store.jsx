// ============ JEBAR data store ============
const { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } = React;

const LS_KEY = 'jebar_db_v1';
const SET_KEY = 'jebar_settings_v1';
const JEBAR_DB_SCHEMA_VERSION = 2;

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function clone(o){ return JSON.parse(JSON.stringify(o)); }

// ---------- appearance ----------
const FONT_OPTIONS = ['Noto Sans Thai','IBM Plex Sans Thai','Sarabun','Prompt','Kanit','Mitr'];
const ACCENT_OPTIONS = [
  {name:'Apple Blue', value:'#0071e3'},
  {name:'แบรนด์ JE BAR', value:'#a8773f'},
  {name:'สเลท', value:'#3a3a3c'},
  {name:'เขียว', value:'#1f8a5b'},
  {name:'ม่วง', value:'#7d5bd6'},
  {name:'แดงอิฐ', value:'#c0492f'},
];
function mixWhite(hex, t){
  const c=(hex||'#0071e3').replace('#',''); const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);
  const m=v=>Math.round(v+(255-v)*t);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
function rgbaOf(hex, a){
  const c=(hex||'#0071e3').replace('#',''); const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
function applyAppearance(s){
  const root=document.documentElement;
  const dark = s.theme==='dark';
  root.setAttribute('data-theme', dark?'dark':'light');
  const accent=s.accent||'#0071e3';
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-soft', dark? rgbaOf(accent,0.24) : mixWhite(accent, 0.88));
  const font=s.font||'Noto Sans Thai';
  root.style.setProperty('--font', `"${font}",-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif`);
}

// normalize any date value → 'YYYY-MM-DD' (handles ISO, DD/MM/YYYY, serial, "Fri May 01 2026", Date)
function normDate(v){
  if(v==null) return '';
  const iso = dt => dt.getFullYear()+'-'+('0'+(dt.getMonth()+1)).slice(-2)+'-'+('0'+dt.getDate()).slice(-2);
  if(v instanceof Date && !isNaN(v)) return iso(v);
  v=String(v).trim(); if(!v) return '';
  let m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) return m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2);
  m=v.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/); if(m){ let y=+m[3]; if(y<100)y+=2000; if(y>2500)y-=543; return y+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2); }
  if(/^\d+(\.\d+)?$/.test(v)){ const n=+v; if(n>1000&&n<100000){ const dt=new Date(Date.UTC(1899,11,30)+Math.round(n)*86400000); return dt.getUTCFullYear()+'-'+('0'+(dt.getUTCMonth()+1)).slice(-2)+'-'+('0'+dt.getUTCDate()).slice(-2); } }
  const d=new Date(v); if(!isNaN(d)) return iso(d);
  return '';
}
const saleStore = d => {
  const posTotal = Number(d?.posTotal || 0);
  const line = Number(d?.line || 0);
  if(posTotal > 0) return Math.max(0, posTotal - line);
  return Number(d?.store || 0);
};
const saleLine = d => Number(d?.line || 0);
const saleOther = d => Number(d?.other || 0);
const normalizeSale = s => {
  const d = {...s, date: normDate(s.date)};
  if(Number(d.posTotal || 0) > 0) d.store = saleStore(d);
  return d;
};
const fixSalesDates = arr => (arr||[]).map(normalizeSale).filter(s=>s.date);

// auto-generate next code like PRE001 (editable by user afterwards)
function nextCode(items, prefix){
  let max=0; (items||[]).forEach(it=>{ const m=(it.id||'').match(new RegExp('^'+prefix+'(\\d+)$')); if(m) max=Math.max(max,+m[1]); });
  return prefix+String(max+1).padStart(3,'0');
}
// duplicate-name check (case-insensitive), ignoring the record currently being edited
function dupName(items, name, key, currentId){
  const n=(name||'').trim().toLowerCase(); if(!n) return false;
  return (items||[]).some(it=> (it.name||'').trim().toLowerCase()===n && it[key]!==currentId );
}

// แปลง yield ที่ผิด (เช่น 100 หรือ 90 ที่หมายถึง %) ให้เป็นสัดส่วน 0–1 + คำนวณต้นทุน/หน่วยใหม่
function fixYields(db){
  if(db && Array.isArray(db.dailySales)) db.dailySales = fixSalesDates(db.dailySales);
  if(!db || !Array.isArray(db.ingredients)) return db;
  db.ingredients = db.ingredients.map(i=>{
    let y = +i.yield; if(!y || isNaN(y)) y = 1;
    if(y > 1.5) y = y/100;            // 100 → 1, 90 → 0.9 (กรอกมาเป็น %)
    y = Math.max(0.01, Math.min(1, y)); // ไม่เกิน 100% และไม่ต่ำเกินไป
    if(y !== i.yield){
      const q = (+i.buyQty||0)*y;
      const cpu = q ? (+i.buyPrice||0)/q : (i.costPerUnit||0);
      return { ...i, yield:y, costPerUnit:cpu };
    }
    return i;
  });
  return db;
}
function ensureStockSchema(db){
  db = db || {};
  if(!Array.isArray(db.stockItems)) db.stockItems = [];
  if(!Array.isArray(db.stockLots)) db.stockLots = [];
  if(!Array.isArray(db.stockBalances)) db.stockBalances = [];
  if(!Array.isArray(db.stockCountSessions)) db.stockCountSessions = [];
  if(!Array.isArray(db.integrationInbox)) db.integrationInbox = [];
  if(!Array.isArray(db.integrationOutbox)) db.integrationOutbox = [];
  return db;
}
function ensureDB(db){
  db=db||{};
  const lists=[
    'branches','categories','types','ingCategories','pkgTypes','optionGroups',
    'menus','ingredients','packages','options','overhead',
    'recipeBase','recipeOption','recipePackage','recipeBatch','batchRecipes','batchRecipeLines',
    'dailySales','menuReports','hourlyReports',
    'mediaAssets','activityLogs','stockMovements','purchaseEvents','productionEvents','wasteEvents','priceChanges'
  ];
  lists.forEach(k=>{ if(!Array.isArray(db[k])) db[k]=[]; });
  ensureStockSchema(db);
  db.meta = Object.assign({
    schemaVersion:JEBAR_DB_SCHEMA_VERSION,
    migratedAt:new Date().toISOString(),
    imageStorage:'supabase-storage',
    dataShape:'browser-json-with-event-log',
    stockShapeVersion:1
  }, db.meta || {});
  db.meta.schemaVersion = Math.max(Number(db.meta.schemaVersion || 1), JEBAR_DB_SCHEMA_VERSION);
  return db;
}
function newDataEvent(type, detail){
  return Object.assign({
    id:'EVT'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    type,
    createdAt:new Date().toISOString(),
    source:'app',
    entityType:'',
    entityId:'',
    note:''
  }, detail || {});
}
function newMediaAsset(file, detail){
  return Object.assign({
    id:'MED'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    bucket:'jebar-images',
    path:'',
    url:'',
    fileName:file && file.name ? file.name : '',
    mime:file && file.type ? file.type : '',
    size:file && file.size ? file.size : 0,
    entityType:'',
    entityId:'',
    role:'image',
    createdAt:new Date().toISOString()
  }, detail || {});
}
async function saveJebarImageAsset(settings, addMediaAsset, file, detail){
  if(!file || typeof window.supabaseUploadImage !== 'function' || typeof window.supabaseReady !== 'function') return null;
  if(!settings || !settings.supabaseEnabled || !window.supabaseReady(settings)) return null;
  const uploaded = await window.supabaseUploadImage(settings, file, detail || {});
  return typeof addMediaAsset === 'function' ? addMediaAsset(uploaded) : uploaded;
}
function loadDB(){
  try{ const s = localStorage.getItem(LS_KEY); if(s){ let d=ensureDB(JSON.parse(s)); if(!d.branches.length) d.branches=['JE BAR']; d.dailySales=fixSalesDates(d.dailySales); d=fixYields(d); return d; } }catch(e){}
  const seed = clone(window.JEBAR_SEED);
  ensureDB(seed);
  if(!seed.branches.length) seed.branches=['JE BAR'];
  seed.dailySales=fixSalesDates(seed.dailySales);
  return fixYields(seed);
}
// filter daily sales by active branch ('ทั้งหมด' = all; records without branch always count)
function salesForBranch(sales, branch){
  if(!branch || branch==='ทั้งหมด') return sales;
  return sales.filter(s=> (s.branch||'')===branch );
}
// save with optional native "Save As" folder picker (falls back to normal download)
async function saveFileSmart(filename, content, type, pick){
  const blob = content instanceof Blob ? content : new Blob([content], {type: type||'application/octet-stream'});
  if(pick && window.showSaveFilePicker){
    try{
      const ext=(filename.split('.').pop()||'dat').toLowerCase();
      const accept={}; accept[type||'application/octet-stream']=['.'+ext];
      const handle=await window.showSaveFilePicker({suggestedName:filename, types:[{description:'ไฟล์ส่งออก', accept}]});
      const w=await handle.createWritable(); await w.write(blob); await w.close();
      return 'saved';
    }catch(e){ if(e&&e.name==='AbortError') return 'cancel'; }
  }
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  return 'download';
}
function loadSettings(){
  const def = { estGP: 0.65, target: 300000, avgPrice: 0, accent:'#0071e3', lineCommission: 0.32,
    lineMarkup: 0.45, priceTargetGP: 0.65,
    shopName:'JE BAR', shopTagline:'Coffee & Pastry', logo:(window.JEBAR_LOGO||'assets/logo.png'),
    font:'Noto Sans Thai', displaySize:1, salesChart:'bar',
    theme:'light', uiLang:'th', pinEnabled:false, pin:'', lastBackup:0,
    vatEnabled:false, vatRate:0.07, vatMode:'inclusive',
    gpAlertThreshold:0.5, alertsEnabled:true, activeBranch:'ทั้งหมด', askSaveLocation:false,
    cloudEnabled:false, cloudUrl:'', cloudKey:'', shopCode:'jebar',
    supabaseEnabled:false, supabaseAuto:true, supabaseUrl:(window.SUPABASE_DEFAULT_URL||'https://eoinzxqpqbybwcrmsgww.supabase.co'),
    supabaseAnonKey:(window.SUPABASE_DEFAULT_KEY||''),
    supabaseShopCode:'jebar',
    sheetEnabled:false, sheetUrl:'', sheetMode:'csv', sheetCsvUrl:'', sheetFullUrl:'' };
  try{ const s = localStorage.getItem(SET_KEY); if(s){ const o=Object.assign(def, JSON.parse(s));
    if(!o.logo || /^assets\//.test(o.logo)) o.logo = window.JEBAR_LOGO || o.logo;
    return o; } }catch(e){}
  return def;
}

// ---------- formatting ----------
const fmt = (n, d=0) => {
  if(n===null||n===undefined||isNaN(n)) return '–';
  return Number(n).toLocaleString('th-TH',{minimumFractionDigits:d, maximumFractionDigits:d});
};
const fmtB = (n, d=0) => '฿' + fmt(n, d);
const fmtPct = (n, d=1) => (n===null||isNaN(n))?'–':(n*100).toLocaleString('th-TH',{minimumFractionDigits:d,maximumFractionDigits:d})+'%';
const monthKey = iso => iso ? iso.slice(0,7) : '';
const THAI_WEEKDAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const weekdayOf = iso => iso ? new Date(iso+'T00:00:00Z').getUTCDay() : 0;
const monthIdx = iso => iso ? parseInt(iso.slice(5,7),10)-1 : 0;
const yearOf = iso => iso ? iso.slice(0,4) : '';
const fmtDate = iso => {
  if(!iso) return '–';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return String(iso);
  return `${+m[3]} ${THAI_MONTHS_SHORT[+m[2]-1]} ${+m[1]+543}`;
};

// ---------- cost engine (live) ----------
// recompute a menu's cost from CURRENT ingredient/package costs so editing prices flows through
function batchRecipeCost(db, batchId){
  const batch=(db.batchRecipes||[]).find(b=>b.id===batchId)||{};
  const ingMap = Object.fromEntries((db.ingredients||[]).map(i=>[i.id,i]));
  let total=0, lines=[];
  for(const r of (db.batchRecipeLines||[]).filter(r=>r.batchId===batchId)){
    const ing = ingMap[r.ingId];
    const cpu = ing ? ing.costPerUnit : r.costPerUnit;
    const lc = (+r.qty||0) * (+cpu||0);
    total += lc;
    lines.push({...r, name: ing?ing.name:r.ingId, costPerUnit:cpu, lineCost:lc});
  }
  const outputQty=+batch.outputQty||0;
  const costPerUnit=outputQty ? total/outputQty : 0;
  return { batch, total, lines, outputQty, outputUnit:batch.outputUnit||'g', costPerUnit, hasRecipe:lines.length>0 };
}
function computeMenuCost(db, menuId){
  const ingMap = Object.fromEntries((db.ingredients||[]).map(i=>[i.id,i]));
  const pkgMap = Object.fromEntries((db.packages||[]).map(p=>[p.id,p]));
  let base=0, baseLines=[];
  for(const r of (db.recipeBase||[]).filter(r=>r.menuId===menuId)){
    const ing = ingMap[r.ingId];
    const cpu = ing ? ing.costPerUnit : r.costPerUnit;
    const lc = r.qty * cpu;
    base += lc;
    baseLines.push({...r, name: ing?ing.name:r.ingId, costPerUnit:cpu, lineCost:lc});
  }
  let pkg=0, pkgLines=[];
  for(const r of (db.recipePackage||[]).filter(r=>r.menuId===menuId)){
    const p = pkgMap[r.pkgId];
    const cpp = p ? p.costPerPiece : r.costPerPiece;
    const lc = r.qty * cpp;
    pkg += lc;
    pkgLines.push({...r, name:p?p.name:r.pkgId, costPerPiece:cpp, lineCost:lc});
  }
  let batch=0, batchLines=[];
  for(const r of (db.recipeBatch||[]).filter(r=>r.menuId===menuId)){
    const b = batchRecipeCost(db, r.batchId);
    const cpu = b.costPerUnit || r.costPerUnit || 0;
    const lc = (+r.qty||0) * (+cpu||0);
    batch += lc;
    batchLines.push({...r, name:b.batch.name||r.batchId, outputUnit:b.outputUnit, costPerUnit:cpu, lineCost:lc});
  }
  let opt=0, optLines=[], optByOption={};
  for(const r of (db.recipeOption||[]).filter(r=>r.menuId===menuId)){
    const ing = ingMap[r.ingId];
    const cpu = ing ? ing.costPerUnit : r.costPerUnit;
    const lc = r.qty * cpu;
    optLines.push({...r, ingName: ing?ing.name:r.ingId, costPerUnit:cpu, lineCost:lc});
    optByOption[r.optionId] = (optByOption[r.optionId]||0) + lc; // รวมต้นทุนวัตถุดิบของแต่ละตัวเลือก
  }
  // ลูกค้าเลือกออปชัน 1 ตัวต่อแก้ว → ใช้ "ค่าเฉลี่ยต่อตัวเลือก" เป็นตัวแทนต้นทุน (ไม่บวกรวมทุกตัว)
  const optionCosts = Object.values(optByOption);
  const optAvg = optionCosts.length ? optionCosts.reduce((s,x)=>s+x,0)/optionCosts.length : 0;
  const total = base + batch + pkg + optAvg;
  const hasRecipe = baseLines.length>0 || batchLines.length>0 || pkgLines.length>0 || optLines.length>0;
  return { base, batch, pkg, opt:optAvg, optAvg, optByOption, optionCosts, total, baseLines, batchLines, pkgLines, optLines, hasRecipe };
}

function menuEconomics(db, menu){
  const c = computeMenuCost(db, menu.id);
  const gpStore = menu.priceStore - c.total;
  const gpLine = menu.priceLine - c.total;
  return {
    ...c,
    gpStore, gpLine,
    gpStorePct: menu.priceStore? gpStore/menu.priceStore : 0,
    gpLinePct: menu.priceLine? gpLine/menu.priceLine : 0,
  };
}

// ---------- sales aggregation ----------
function dailyTotal(d){ return saleStore(d)+saleLine(d)+saleOther(d); }

function aggregateByMonth(db){
  const map = {};
  for(const d of db.dailySales){
    const k = monthKey(d.date);
    if(!map[k]) map[k] = { key:k, monthIdx:monthIdx(d.date), year:yearOf(d.date), store:0, line:0, other:0, days:0 };
    map[k].store += saleStore(d); map[k].line += saleLine(d); map[k].other += saleOther(d); map[k].days++;
  }
  return Object.values(map).map(m=>({...m, total:m.store+m.line+m.other})).sort((a,b)=>a.key<b.key?-1:1);
}

function overheadTotal(db){ return db.overhead.reduce((s,o)=>s+(o.amount||0),0); }

function avgSellingPrice(db){
  const sold = db.menus.filter(m=>m.status==='ขาย' && m.priceStore>0);
  if(!sold.length) return 0;
  return sold.reduce((s,m)=>s+m.priceStore,0)/sold.length;
}

// blended GP% across menus that actually have a recipe
function recipeGPStats(db){
  const withR = db.menus.map(m=>({m, e:menuEconomics(db,m)})).filter(x=>x.e.hasRecipe && x.m.priceStore>0);
  if(!withR.length) return { count:0, avgGPpct:0, avgCost:0 };
  const avgGPpct = withR.reduce((s,x)=>s+x.e.gpStorePct,0)/withR.length;
  const avgCost = withR.reduce((s,x)=>s+x.e.total,0)/withR.length;
  return { count:withR.length, avgGPpct, avgCost };
}

// ---------- context ----------
const DataCtx = createContext(null);
function useData(){ return useContext(DataCtx); }

function DataProvider({children}){
  const [db, setDb] = useState(loadDB);
  const [settings, setSettings] = useState(loadSettings);
  const [toast, setToast] = useState(null);

  useEffect(()=>{ try{ localStorage.setItem(LS_KEY, JSON.stringify(db)); }catch(e){} }, [db]);
  useEffect(()=>{ try{ localStorage.setItem(SET_KEY, JSON.stringify(settings)); }catch(e){} applyAppearance(settings); }, [settings]);

  const flash = useCallback((msg, kind='ok', action=null)=>{ setToast({msg,kind,action,id:Date.now()}); }, []);
  useEffect(()=>{ if(toast){ const t=setTimeout(()=>setToast(null), toast.action?5000:2600); return ()=>clearTimeout(t); } }, [toast]);

  // generic collection ops
  const upsert = useCallback((coll, item, key='id')=>{
    setDb(prev=>{
      const next = {...prev, [coll]:[...prev[coll]]};
      const i = next[coll].findIndex(x=>x[key]===item[key]);
      if(i>=0) next[coll][i] = item; else next[coll] = [item, ...next[coll]];
      const entityId = item && item[key] ? String(item[key]) : '';
      const label = item && (item.name || item.date || item.id) ? String(item.name || item.date || item.id) : coll;
      next.activityLogs = [newDataEvent(i>=0 ? `${coll}.updated` : `${coll}.created`, {
        entityType:coll,
        entityId,
        note:label
      }), ...(prev.activityLogs||[])].slice(0, 1200);
      return next;
    });
  },[]);
  const remove = useCallback((coll, id, key='id')=>{
    setDb(prev=>({
      ...prev,
      [coll]: prev[coll].filter(x=>x[key]!==id),
      activityLogs:[newDataEvent(`${coll}.deleted`, {entityType:coll, entityId:String(id||''), note:String(id||'') }), ...(prev.activityLogs||[])].slice(0, 1200)
    }));
  },[]);
  const setCollection = useCallback((coll, arr)=>{ setDb(prev=>({...prev,[coll]:arr})); },[]);
  const logActivity = useCallback((type, detail)=>{
    setDb(prev=>ensureDB({
      ...prev,
      activityLogs:[newDataEvent(type, detail), ...(prev.activityLogs||[])].slice(0, 1200)
    }));
  },[]);
  const addMediaAsset = useCallback((asset)=>{
    const media = newMediaAsset(null, asset);
    setDb(prev=>ensureDB({
      ...prev,
      mediaAssets:[media, ...(prev.mediaAssets||[])].slice(0, 1000),
      activityLogs:[newDataEvent('media.added', {entityType:media.entityType, entityId:media.entityId, note:media.fileName||media.path}), ...(prev.activityLogs||[])].slice(0, 1200)
    }));
    return media;
  },[]);
  // rename an id and cascade to linked recipe references
  const renameId = useCallback((coll, oldId, newId)=>{
    setDb(prev=>{
      const next={...prev};
      next[coll]=prev[coll].map(x=>x.id===oldId?{...x,id:newId}:x);
      if(coll==='menus'){
        next.recipeBase=prev.recipeBase.map(r=>r.menuId===oldId?{...r,menuId:newId}:r);
        next.recipeOption=prev.recipeOption.map(r=>r.menuId===oldId?{...r,menuId:newId}:r);
        next.recipePackage=prev.recipePackage.map(r=>r.menuId===oldId?{...r,menuId:newId}:r);
        next.recipeBatch=(prev.recipeBatch||[]).map(r=>r.menuId===oldId?{...r,menuId:newId}:r);
      } else if(coll==='ingredients'){
        next.recipeBase=prev.recipeBase.map(r=>r.ingId===oldId?{...r,ingId:newId}:r);
        next.recipeOption=prev.recipeOption.map(r=>r.ingId===oldId?{...r,ingId:newId}:r);
        next.batchRecipeLines=(prev.batchRecipeLines||[]).map(r=>r.ingId===oldId?{...r,ingId:newId}:r);
      } else if(coll==='packages'){
        next.recipePackage=prev.recipePackage.map(r=>r.pkgId===oldId?{...r,pkgId:newId}:r);
      } else if(coll==='options'){
        next.recipeOption=prev.recipeOption.map(r=>r.optionId===oldId?{...r,optionId:newId}:r);
      } else if(coll==='batchRecipes'){
        next.batchRecipeLines=(prev.batchRecipeLines||[]).map(r=>r.batchId===oldId?{...r,batchId:newId}:r);
        next.recipeBatch=(prev.recipeBatch||[]).map(r=>r.batchId===oldId?{...r,batchId:newId}:r);
      }
      return next;
    });
  },[]);

  // sales specific (key by date)
  const saveSale = useCallback((sale)=>{
    setDb(prev=>{
      const s=normalizeSale(sale);
      if(!s.date) return prev;
      const arr=[...prev.dailySales];
      const i=arr.findIndex(x=>x.date===s.date);
      if(i>=0) arr[i]=s; else arr.push(s);
      arr.sort((a,b)=>a.date<b.date?-1:1);
      return {
        ...prev,
        dailySales:arr,
        activityLogs:[newDataEvent(i>=0?'sales.updated':'sales.created', {entityType:'dailySales', entityId:s.date, note:`ยอดขาย ${s.date}`}), ...(prev.activityLogs||[])].slice(0, 1200)
      };
    });
  },[]);
  const removeSale = useCallback((date)=>{ setDb(prev=>({
    ...prev,
    dailySales:prev.dailySales.filter(s=>s.date!==date),
    activityLogs:[newDataEvent('sales.deleted', {entityType:'dailySales', entityId:String(date||''), note:`ลบยอดขาย ${date}`}), ...(prev.activityLogs||[])].slice(0, 1200)
  })); },[]);

  const resetData = useCallback(()=>{ setDb(ensureDB({...clone(window.JEBAR_SEED), activityLogs:[newDataEvent('system.reset', {entityType:'system', note:'คืนค่าข้อมูลเริ่มต้น'})]})); flash('คืนค่าข้อมูลเริ่มต้นแล้ว'); },[flash]);
  const importDB = useCallback((obj)=>{ const next=fixYields(ensureDB(obj)); next.activityLogs=[newDataEvent('system.imported', {entityType:'system', note:'นำเข้าข้อมูลจากไฟล์'}), ...(next.activityLogs||[])].slice(0,1200); setDb(next); flash('นำเข้าข้อมูลสำเร็จ'); },[flash]);

  const value = {
    db, setDb, settings, setSettings,
    fdb: { ...db, dailySales: salesForBranch(db.dailySales, settings.activeBranch) },
    upsert, remove, setCollection, renameId, saveSale, removeSale, resetData, importDB, logActivity, addMediaAsset,
    flash, toast, setToast,
    THAI_MONTHS, THAI_MONTHS_SHORT, THAI_WEEKDAYS,
  };
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

Object.assign(window, {
  DataProvider, useData,
  fmt, fmtB, fmtPct, fmtDate, monthKey, monthIdx, yearOf,
  computeMenuCost, batchRecipeCost, menuEconomics, aggregateByMonth, overheadTotal, avgSellingPrice, recipeGPStats, dailyTotal, saleStore, saleLine, saleOther, normalizeSale,
  THAI_MONTHS, THAI_MONTHS_SHORT, clone, THAI_WEEKDAYS, weekdayOf,
  FONT_OPTIONS, ACCENT_OPTIONS, mixWhite, rgbaOf, applyAppearance, salesForBranch, saveFileSmart, normDate, nextCode, dupName, fixYields, ensureDB,
  JEBAR_DB_SCHEMA_VERSION, newDataEvent, newMediaAsset, saveJebarImageAsset,
});
