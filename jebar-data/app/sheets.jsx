// ============ Google Sheets sync — CSV (one-way) + Apps Script (two-way) ============
const SHEET_NORM = d => ({date:(window.normDate?window.normDate(d.date):d.date), store:+d.store||0, line:+d.line||0, other:+d.other||0, bills:+d.bills||0, branch:d.branch||''});
const sheetSalesStr = arr => JSON.stringify((arr||[]).map(SHEET_NORM).sort((a,b)=>a.date<b.date?-1:1));

async function sheetGet(url){
  const res = await fetch(url, { method:'GET' });
  if(!res.ok) throw new Error('HTTP '+res.status);
  const j = await res.json();
  if(!j || !Array.isArray(j.sales)) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
  return j.sales.map(SHEET_NORM);
}
async function sheetPost(url, sales){
  const res = await fetch(url, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({ sales: (sales||[]).map(SHEET_NORM) }) });
  if(!res.ok) throw new Error('HTTP '+res.status);
  return await res.json().catch(()=>({ok:true}));
}
// CSV (published-to-web) → sales, via the smart importer
async function csvGet(url){
  const res = await fetch(url, { method:'GET' });
  if(!res.ok) throw new Error('HTTP '+res.status);
  const text = await res.text();
  if(/<html/i.test(text)) throw new Error('ลิงก์ไม่ใช่ CSV (ต้องเป็นลิงก์เผยแพร่แบบ CSV)');
  const rows = await window.__posReadFile(new File([text],'sheet.csv'));
  const an = window.__posAnalyze(rows);
  if(an.error) throw new Error(an.error);
  return an.preview.map(SHEET_NORM);
}
// FULL database sync — Safari-friendly: JSONP for read, no-cors POST for write
function jsonpGet(url){
  return new Promise((resolve,reject)=>{
    const cb='__jebar_cb_'+Date.now()+Math.floor(Math.random()*1000);
    const s=document.createElement('script');
    const timer=setTimeout(()=>{ cleanup(); reject(new Error('หมดเวลาเชื่อมต่อ')); }, 15000);
    function cleanup(){ clearTimeout(timer); try{delete window[cb];}catch(e){} s.remove(); }
    window[cb]=(data)=>{ cleanup(); resolve(data); };
    s.onerror=()=>{ cleanup(); reject(new Error('โหลดไม่สำเร็จ (ตรวจลิงก์/การ Deploy)')); };
    s.src=url+(url.includes('?')?'&':'?')+'callback='+cb+'&t='+Date.now();
    document.body.appendChild(s);
  });
}
async function fullGet(url){
  const j=await jsonpGet(url);
  if(!j||!j.ok) throw new Error('ตอบกลับไม่ถูกต้อง');
  return j.db||null;
}
async function fullPost(url, db){
  // no-cors fire-and-forget — ผ่าน Safari ได้ (ส่งสำเร็จแต่อ่านผลตอบกลับไม่ได้)
  await fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({db})});
  return {ok:true};
}

function SheetSync(){
  const { db, setDb, settings, flash } = useData();
  const [status,setStatus]=React.useState('off');
  const [open,setOpen]=React.useState(false);
  const [last,setLast]=React.useState('');
  const applyingRef=React.useRef(false);
  const dirtyRef=React.useRef(false);
  const pulledRef=React.useRef(false); // กันไม่ให้ "ส่งขึ้นคลาวด์" ก่อนที่จะ "ดึงของจริงลงมา" สำเร็จ (กันข้อมูลเปล่าทับ)
  const salesRef=React.useRef(db.dailySales); salesRef.current=db.dailySales;
  const dbRef=React.useRef(db); dbRef.current=db;
  const pushT=React.useRef();
  const ref=React.useRef();
  const mode=settings.sheetMode||'csv';
  const url = mode==='csv' ? settings.sheetCsvUrl : mode==='full' ? settings.sheetFullUrl : settings.sheetUrl;
  const on = !!(settings.sheetEnabled && url);

  const pull=React.useCallback(async(manual)=>{
    if(!on) return;
    // ห้ามดึงทับขณะมีการแก้ไขในเครื่องที่ยังอัปไม่เสร็จ (กันข้อมูลหาย)
    if(dirtyRef.current && !manual){ return; }
    try{ setStatus('syncing');
      if(mode==='full'){
        const remoteRaw=await fullGet(url);
        const remoteDb = remoteRaw && window.fixYields ? window.fixYields(remoteRaw) : remoteRaw; // แก้ yield ที่ผิดจากคลาวด์ก่อนใช้
        if(dirtyRef.current){ setStatus('ok'); return; }
        // ถ้าคลาวด์มีข้อมูล yield ผิด → อัปตัวที่แก้แล้วกลับขึ้นไปแก้ที่ต้นทาง (ทำครั้งเดียว)
        if(remoteRaw && remoteDb && JSON.stringify(remoteRaw)!==JSON.stringify(remoteDb)){ fullPost(url, remoteDb).catch(()=>{}); }
        if(!remoteDb || !remoteDb.menus){
          await fullPost(url, dbRef.current);
        } else if(JSON.stringify(remoteDb)!==JSON.stringify(dbRef.current)){
          applyingRef.current=true; setDb(remoteDb);
        }
      } else {
        const remote = mode==='csv' ? await csvGet(url) : await sheetGet(url);
        if(dirtyRef.current){ setStatus('ok'); return; }
        if(remote.length===0 && salesRef.current.length>0){
          if(mode==='apps') await sheetPost(url, salesRef.current);
        } else if(sheetSalesStr(remote)!==sheetSalesStr(salesRef.current)){
          applyingRef.current=true; setDb(p=>({...p, dailySales:remote}));
        }
      }
      pulledRef.current=true; // ดึงของจริงลงมาสำเร็จแล้ว → จากนี้อนุญาตให้ส่งขึ้นคลาวด์ได้
      setStatus('ok'); setLast('อัปเดต '+new Date().toLocaleTimeString('th-TH'));
      if(manual) flash('ซิงค์ข้อมูลแล้ว');
    }catch(e){ setStatus('error'); setLast('ไม่สำเร็จ: '+e.message); if(manual) flash('ซิงค์ไม่สำเร็จ: '+e.message,'err'); }
  },[on,url,mode]);

  React.useEffect(()=>{ pulledRef.current=false; dirtyRef.current=false; if(!on){ setStatus('off'); return; } pull(); const iv=setInterval(()=>pull(false), 20000); return ()=>clearInterval(iv); },[on,url,mode]);

  // push (two-way sales OR full database)
  React.useEffect(()=>{ if(!on || mode==='csv') return; if(applyingRef.current){ applyingRef.current=false; return; }
    // ❗ อย่าเพิ่งส่งขึ้นคลาวด์จนกว่าจะดึงของจริงลงมาสำเร็จก่อน — กันข้อมูลเริ่มต้น/เปล่าไปทับของจริง
    if(!pulledRef.current) return;
    dirtyRef.current=true;
    clearTimeout(pushT.current);
    pushT.current=setTimeout(async()=>{ try{ setStatus('syncing');
      if(mode==='full') await fullPost(url, dbRef.current); else await sheetPost(url, salesRef.current);
      dirtyRef.current=false;
      setStatus('ok'); setLast('บันทึกขึ้นคลาวด์ '+new Date().toLocaleTimeString('th-TH')); }
      catch(e){ setStatus('error'); setLast('เขียนไม่สำเร็จ: '+e.message); } }, 1500);
    return ()=>clearTimeout(pushT.current);
  },[mode==='full'?db:db.dailySales,on,mode]);

  React.useEffect(()=>{ const h=e=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h); },[]);

  if(!on) return null;
  const color = status==='error'?'var(--red)':status==='syncing'?'var(--orange)':'var(--green)';
  return <div ref={ref} style={{position:'relative'}} className="no-print">
    <button onClick={()=>setOpen(!open)} title="สถานะซิงค์ Google Sheet" style={{width:40,height:40,borderRadius:11,display:'grid',placeItems:'center',
      background:open?'var(--accent-soft)':'var(--chip)',color,position:'relative'}}>
      <Icon name="cloud" size={19}/>
      <span style={{position:'absolute',bottom:7,right:7,width:8,height:8,borderRadius:'50%',background:color,boxShadow:'0 0 0 2px var(--header)'}}/>
    </button>
    {open && <div style={{position:'absolute',right:0,top:48,width:280,background:'var(--surface)',borderRadius:14,
      boxShadow:'var(--shadow-lg)',border:'1px solid var(--line-2)',zIndex:60,padding:16,animation:'pop .2s'}}>
      <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:8}}>
        <span style={{width:9,height:9,borderRadius:'50%',background:color}}/>
        <span style={{fontWeight:600,fontSize:14}}>{status==='ok'?'ซิงค์แล้ว':status==='syncing'?'กำลังซิงค์…':status==='error'?'ซิงค์ผิดพลาด':'ปิดอยู่'}</span>
        <Badge tone="gray">{mode==='csv'?'ทางเดียว':mode==='full'?'ทั้งระบบ':'สองทาง'}</Badge>
      </div>
      <div style={{fontSize:12,color:'var(--ink-3)',marginBottom:12,minHeight:16}}>{last||'เชื่อมต่อ Google Sheet'}</div>
      <Button size="sm" icon="sync" onClick={()=>pull(true)} style={{width:'100%'}}>ซิงค์เดี๋ยวนี้</Button>
    </div>}
  </div>;
}

const SHEET_APPS_SCRIPT = `// ====== JEBAR <-> Google Sheet (วางใน Apps Script) ======
const SHEET_NAME = 'Sales';
function doGet() {
  const sh = getSheet(); const v = sh.getDataRange().getValues(); const sales = [];
  for (let i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    sales.push({ date: fmt(v[i][0]), store: Number(v[i][1])||0, line: Number(v[i][2])||0,
      other: Number(v[i][3])||0, bills: Number(v[i][4])||0, branch: v[i][5]||'' });
  }
  return json({ ok: true, sales: sales });
}
function doPost(e) {
  const data = JSON.parse(e.postData.contents); const sh = getSheet();
  sh.clearContents();
  sh.getRange(1,1,1,6).setValues([['DATE','STORE','LINE','OTHER','BILLS','BRANCH']]);
  const rows = (data.sales||[]).slice().sort(function(a,b){return (a.date<b.date)?-1:(a.date>b.date)?1:0;}).map(function(s){ return [String(s.date),s.store||0,s.line||0,s.other||0,s.bills||0,s.branch||'']; });
  if (rows.length){ sh.getRange(2,1,rows.length,1).setNumberFormat('@'); sh.getRange(2,1,rows.length,6).setValues(rows); }
  return json({ ok: true, count: rows.length });
}
function getSheet(){ const ss=SpreadsheetApp.getActiveSpreadsheet(); return ss.getSheetByName(SHEET_NAME)||ss.insertSheet(SHEET_NAME); }
function fmt(v){ if(v instanceof Date){ return v.getFullYear()+'-'+('0'+(v.getMonth()+1)).slice(-2)+'-'+('0'+v.getDate()).slice(-2);} return String(v); }
function json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }`;

const SHEET_FULL_SCRIPT = `// ====== JEBAR ซิงค์ทั้งระบบ (วางใน Apps Script) ======
// เก็บข้อมูลทั้งหมด (เมนู สูตร ข้อมูลหลัก ยอดขาย) เป็นไฟล์ jebar_db.json ใน Drive
function doGet(e){
  const txt = getFile().getBlob().getDataAsString() || '{}';
  const out = JSON.stringify({ ok:true, db: JSON.parse(txt) });
  const cb = e && e.parameter && e.parameter.callback;
  if (cb) return ContentService.createTextOutput(cb + '(' + out + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e){
  const data = JSON.parse(e.postData.contents);
  getFile().setContent(JSON.stringify(data.db || {}));
  return json({ ok:true });
}
function getFile(){
  const name = 'jebar_db.json';
  const it = DriveApp.getFilesByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFile(name, '{}', 'application/json');
}
function json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }`;

function SheetSettings(){
  const { settings, setSettings, flash } = useData();
  const set=(p)=>setSettings({...settings,...p});
  const mode=settings.sheetMode||'csv';
  const curUrl = mode==='csv'?settings.sheetCsvUrl : mode==='full'?settings.sheetFullUrl : settings.sheetUrl;
  const [testing,setTesting]=React.useState(false);
  const [copied,setCopied]=React.useState(false);
  const test=async()=>{ if(!curUrl){flash('ใส่ลิงก์ก่อน','err');return;}
    setTesting(true);
    try{
      if(mode==='full'){ const d=await fullGet(curUrl); flash(d&&d.menus?`เชื่อมต่อสำเร็จ — พบ ${d.menus.length} เมนูบนคลาวด์`:'เชื่อมต่อสำเร็จ — คลาวด์ยังว่าง (จะอัปข้อมูลเครื่องนี้ขึ้นไป)'); }
      else { const r= mode==='csv'? await csvGet(curUrl): await sheetGet(curUrl); flash(`เชื่อมต่อสำเร็จ — พบ ${r.length} วัน`); }
    }catch(e){ flash('ไม่สำเร็จ: '+e.message,'err'); } setTesting(false);
  };
  const copy=()=>{ navigator.clipboard&&navigator.clipboard.writeText(mode==='full'?SHEET_FULL_SCRIPT:SHEET_APPS_SCRIPT); setCopied(true); setTimeout(()=>setCopied(false),1800); };
  return <SettingsSection icon="cloud" title="เชื่อม Google Sheet (ออนไลน์)" sub="ซิงค์ข้อมูลข้ามเครื่องอัตโนมัติ — เลือกรูปแบบที่ต้องการ">
    <Field label="รูปแบบการเชื่อม">
      <Segmented value={mode} onChange={v=>set({sheetMode:v})}
        options={[{value:'csv',label:'ยอดขาย · ทางเดียว'},{value:'apps',label:'ยอดขาย · สองทาง'},{value:'full',label:'ทั้งระบบ ⭐'}]}/>
    </Field>
    <div style={{display:'flex',alignItems:'center',gap:14}}>
      <Toggle on={!!settings.sheetEnabled} onChange={v=>{ if(v&&!curUrl){flash('ใส่ลิงก์ก่อน','err');return;} set({sheetEnabled:v}); }}/>
      <span style={{fontSize:14}}>{settings.sheetEnabled?'เปิดซิงค์อยู่':'ปิดอยู่'}</span>
    </div>

    {mode==='csv' ? <>
      <Field label="ลิงก์เผยแพร่ CSV" hint="ได้จาก ไฟล์ → แชร์ → เผยแพร่ไปยังเว็บ → CSV">
        <div style={{display:'flex',gap:10}}>
          <Input value={settings.sheetCsvUrl} placeholder="https://docs.google.com/.../pub?output=csv" onChange={e=>set({sheetCsvUrl:e.target.value.trim()})}/>
          <Button variant="secondary" onClick={test} disabled={testing}>{testing?'…':'ทดสอบ'}</Button>
        </div>
      </Field>
      <details style={{borderTop:'1px solid var(--line-2)',paddingTop:14}}>
        <summary style={{fontSize:13.5,fontWeight:600,cursor:'pointer',color:'var(--accent)'}}>📋 วิธีเอาลิงก์ CSV (กดดู)</summary>
        <ol style={{fontSize:13,color:'var(--ink-2)',lineHeight:1.9,paddingLeft:20,marginTop:10}}>
          <li>เปิด Google Sheet → เมนู <b>ไฟล์ (File) → แชร์ (Share) → เผยแพร่ไปยังเว็บ (Publish to web)</b></li>
          <li>ช่องซ้ายเลือก <b>แท็บที่มียอดขาย</b> · ช่องขวาเลือก <b>ค่าที่คั่นด้วยจุลภาค (.csv)</b></li>
          <li>กด <b>เผยแพร่ (Publish)</b> → คัดลอกลิงก์ที่ได้ มาวางด้านบน → กดทดสอบ → เปิดสวิตช์</li>
        </ol>
        <p style={{fontSize:12,color:'var(--ink-3)',marginTop:8}}>คอลัมน์ในชีตเป็นแบบไหนก็ได้ ระบบจับ “วันที่ / ยอดขาย / ช่องทาง / บิล” ให้อัตโนมัติ · โหมดนี้ <b>อ่านอย่างเดียว</b> (ชีตเป็นตัวหลัก)</p>
      </details>
    </> : mode==='apps' ? <>
      <Field label="ลิงก์ Web App (ลงท้าย /exec)" hint="ได้จากการ Deploy Apps Script เป็น Web App">
        <div style={{display:'flex',gap:10}}>
          <Input value={settings.sheetUrl} placeholder="https://script.google.com/macros/s/..../exec" onChange={e=>set({sheetUrl:e.target.value.trim()})}/>
          <Button variant="secondary" onClick={test} disabled={testing}>{testing?'…':'ทดสอบ'}</Button>
        </div>
      </Field>
      <details style={{borderTop:'1px solid var(--line-2)',paddingTop:14}}>
        <summary style={{fontSize:13.5,fontWeight:600,cursor:'pointer',color:'var(--accent)'}}>📋 วิธีติดตั้ง Apps Script (กดดู + โค้ด)</summary>
        <ol style={{fontSize:13,color:'var(--ink-2)',lineHeight:1.9,paddingLeft:20,marginTop:10}}>
          <li>เปิด Google Sheet → <b>Extensions → Apps Script</b></li>
          <li>ลบโค้ดเดิม วางโค้ดด้านล่าง (กดคัดลอก)</li>
          <li><b>Deploy → New deployment → Web app</b></li>
          <li><b>Execute as: Me</b>, <b>Who has access: Anyone</b> → Deploy → อนุญาตสิทธิ์</li>
          <li>ก๊อปลิงก์ <b>/exec</b> มาวางด้านบน → ทดสอบ → เปิดสวิตช์</li>
        </ol>
        <div style={{position:'relative',marginTop:10}}>
          <button onClick={copy} style={{position:'absolute',top:8,right:8,padding:'5px 11px',borderRadius:8,fontSize:12,fontWeight:600,
            background:copied?'var(--green)':'var(--accent)',color:'#fff',zIndex:1}}>{copied?'คัดลอกแล้ว ✓':'คัดลอกโค้ด'}</button>
          <pre style={{background:'var(--surface-2)',border:'1px solid var(--line-2)',borderRadius:12,padding:'14px 16px',fontSize:11,
            lineHeight:1.6,overflow:'auto',maxHeight:260,fontFamily:'ui-monospace,Menlo,Consolas,monospace',color:'var(--ink)'}}>{SHEET_APPS_SCRIPT}</pre>
        </div>
        <p style={{fontSize:12,color:'var(--ink-3)',marginTop:8}}>โหมดนี้ใช้แท็บชื่อ <b>Sales</b> และเขียนทับคอลัมน์ DATE/STORE/LINE/OTHER/BILLS/BRANCH</p>
      </details>
    </> : <>
      <Field label="ลิงก์ Web App (ลงท้าย /exec)" hint="ได้จากการ Deploy Apps Script (ซิงค์ทั้งระบบ)">
        <div style={{display:'flex',gap:10}}>
          <Input value={settings.sheetFullUrl} placeholder="https://script.google.com/macros/s/..../exec" onChange={e=>set({sheetFullUrl:e.target.value.trim()})}/>
          <Button variant="secondary" onClick={test} disabled={testing}>{testing?'…':'ทดสอบ'}</Button>
        </div>
      </Field>
      <details style={{borderTop:'1px solid var(--line-2)',paddingTop:14}}>
        <summary style={{fontSize:13.5,fontWeight:600,cursor:'pointer',color:'var(--accent)'}}>📋 วิธีติดตั้ง (ซิงค์ทั้งระบบ + โค้ด)</summary>
        <ol style={{fontSize:13,color:'var(--ink-2)',lineHeight:1.9,paddingLeft:20,marginTop:10}}>
          <li>สร้าง Google Sheet เปล่าๆ 1 ไฟล์ (หรือใช้ไฟล์เดิม) → <b>Extensions → Apps Script</b></li>
          <li>ลบโค้ดเดิม วางโค้ดด้านล่าง (กดคัดลอก)</li>
          <li><b>Deploy → New deployment → Web app</b></li>
          <li><b>Execute as: Me</b>, <b>Who has access: Anyone</b> → Deploy</li>
          <li>หน้าขอสิทธิ์จะขอเข้าถึง <b>Google Drive</b> (ใช้เก็บไฟล์ข้อมูล) → อนุญาต</li>
          <li>ก๊อปลิงก์ <b>/exec</b> มาวางด้านบน → ทดสอบ → เปิดสวิตช์ <b>บนทุกเครื่อง</b> (ใช้ลิงก์เดียวกัน)</li>
        </ol>
        <div style={{position:'relative',marginTop:10}}>
          <button onClick={copy} style={{position:'absolute',top:8,right:8,padding:'5px 11px',borderRadius:8,fontSize:12,fontWeight:600,
            background:copied?'var(--green)':'var(--accent)',color:'#fff',zIndex:1}}>{copied?'คัดลอกแล้ว ✓':'คัดลอกโค้ด'}</button>
          <pre style={{background:'var(--surface-2)',border:'1px solid var(--line-2)',borderRadius:12,padding:'14px 16px',fontSize:11,
            lineHeight:1.6,overflow:'auto',maxHeight:260,fontFamily:'ui-monospace,Menlo,Consolas,monospace',color:'var(--ink)'}}>{SHEET_FULL_SCRIPT}</pre>
        </div>
        <p style={{fontSize:12,color:'var(--ink-3)',marginTop:8}}>เก็บข้อมูลทั้งหมดเป็นไฟล์ <b>jebar_db.json</b> ใน Google Drive ของคุณ — ทุกเครื่องที่ใส่ลิงก์เดียวกันจะเห็นข้อมูลตรงกัน (เมนู สูตร ข้อมูลหลัก ยอดขาย)</p>
      </details>
    </>}
    <p style={{fontSize:11.5,color:'var(--ink-3)',lineHeight:1.7}}>
      ⚠️ โหมด "ยอดขาย" ซิงค์เฉพาะยอดขายรายวัน · โหมด <b>"ทั้งระบบ ⭐"</b> ซิงค์ทุกอย่าง (เมนู/สูตร/ข้อมูลหลัก/ยอดขาย) เหมาะกับใช้หลายเครื่อง · ข้อมูลล่าสุดทับของเก่า — ใช้คนเดียวสลับเครื่องปลอดภัย · แนะนำโฮสต์แอปออนไลน์เพื่อเลี่ยง CORS
    </p>
  </SettingsSection>;
}

Object.assign(window, { SheetSync, SheetSettings });
