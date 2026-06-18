// ============ Supabase full-system sync ============
const SUPABASE_TABLE = 'jebar_app_state';
const SUPABASE_IMAGE_BUCKET = 'jebar-images';
const SUPABASE_DEFAULT_URL = 'https://eoinzxqpqbybwcrmsgww.supabase.co';
const SUPABASE_DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvaW56eHFwcWJ5Yndjcm1zZ3d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NTAyMTgsImV4cCI6MjA5NjEyNjIxOH0.NZHZ2BeDVkP4klTLQImkmp-lDSVekHgTf78R8pTNobE';

function supabaseCfg(settings){
  return {
    url: String(settings.supabaseUrl || SUPABASE_DEFAULT_URL).trim().replace(/\/+$/,''),
    key: String(settings.supabaseAnonKey || SUPABASE_DEFAULT_KEY).trim(),
    shop: String(settings.supabaseShopCode || settings.shopCode || 'jebar').trim() || 'jebar'
  };
}
function supabaseReady(settings){
  const c = supabaseCfg(settings);
  return /^https:\/\/.+\.supabase\.co$/.test(c.url) && c.key.length > 80 && !!c.shop;
}
function supabaseHeaders(settings, extra){
  const c = supabaseCfg(settings);
  return Object.assign({
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    'Content-Type': 'application/json'
  }, extra || {});
}
async function supabaseRequest(settings, path, options){
  const c = supabaseCfg(settings);
  const res = await fetch(`${c.url}/rest/v1/${path}`, Object.assign({}, options || {}, {
    headers: supabaseHeaders(settings, options && options.headers)
  }));
  if(!res.ok){
    const txt = await res.text().catch(()=>'');
    throw new Error(supabaseFriendlyError(txt || `HTTP ${res.status}`));
  }
  if(res.status === 204) return null;
  return await res.json().catch(()=>null);
}
function supabaseStoragePath(path){
  return String(path || '').split('/').map(encodeURIComponent).join('/');
}
function safeFileExt(file){
  const byName = (file && file.name && file.name.match(/\.([a-z0-9]+)$/i)) ? RegExp.$1.toLowerCase() : '';
  const byType = String(file && file.type || '').split('/')[1] || '';
  return (byName || byType || 'jpg').replace(/[^a-z0-9]/g,'').slice(0,8) || 'jpg';
}
async function supabaseUploadImage(settings, file, detail){
  if(!file) throw new Error('ยังไม่ได้เลือกรูป');
  if(!supabaseReady(settings)) throw new Error('ยังไม่ได้ตั้งค่า Supabase');
  const c = supabaseCfg(settings);
  const bucket = (detail && detail.bucket) || SUPABASE_IMAGE_BUCKET;
  const entityType = (detail && detail.entityType) || 'general';
  const entityId = (detail && detail.entityId) || 'unassigned';
  const ext = safeFileExt(file);
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const path = `${c.shop}/${entityType}/${entityId}/${stamp}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const res = await fetch(`${c.url}/storage/v1/object/${bucket}/${supabaseStoragePath(path)}`, {
    method:'POST',
    headers: {
      apikey:c.key,
      Authorization:`Bearer ${c.key}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert':'true'
    },
    body:file
  });
  if(!res.ok){
    const txt = await res.text().catch(()=>'');
    throw new Error(supabaseFriendlyError(txt || `Storage HTTP ${res.status}`));
  }
  return {
    bucket,
    path,
    url:`${c.url}/storage/v1/object/public/${bucket}/${supabaseStoragePath(path)}`,
    fileName:file.name || '',
    mime:file.type || '',
    size:file.size || 0,
    entityType,
    entityId,
    role:(detail && detail.role) || 'image'
  };
}
function supabaseFriendlyError(msg){
  if(/relation .* does not exist|Could not find the table|schema cache/i.test(msg)) return 'ยังไม่ได้สร้างตาราง Supabase ให้รันไฟล์ supabase-jebar-full.sql ก่อน';
  if(/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'เชื่อมต่อ Supabase ไม่ได้ ตรวจเน็ตหรือ Project URL';
  if(/bucket|storage/i.test(msg)) return 'Supabase Storage ยังไม่พร้อม ให้รันไฟล์ supabase-jebar-full.sql เวอร์ชันล่าสุดก่อน';
  if(/JWT|invalid api key|apikey|permission|row-level security|401|403/i.test(msg)) return 'Supabase key หรือ policy ยังไม่ถูกต้อง';
  return String(msg).slice(0, 220);
}
function stripSupabaseSecrets(settings){
  const copy = Object.assign({}, settings || {});
  delete copy.supabaseAnonKey;
  delete copy.supabaseUrl;
  delete copy.supabaseEnabled;
  delete copy.supabaseAuto;
  return copy;
}
function mergeRemoteSettings(remote, local){
  return Object.assign({}, local, remote || {}, {
    supabaseUrl: local.supabaseUrl,
    supabaseAnonKey: local.supabaseAnonKey,
    supabaseEnabled: local.supabaseEnabled,
    supabaseAuto: local.supabaseAuto,
    supabaseShopCode: local.supabaseShopCode
  });
}
async function supabasePushState(db, settings){
  const c = supabaseCfg(settings);
  const body = JSON.stringify({
    shop_code: c.shop,
    db,
    settings: stripSupabaseSecrets(settings),
    updated_at: new Date().toISOString()
  });
  await supabaseRequest(settings, `${SUPABASE_TABLE}?on_conflict=shop_code`, {
    method:'POST',
    headers:{ Prefer:'resolution=merge-duplicates,return=minimal' },
    body
  });
  localStorage.setItem('jebar_supabase_sync_at', new Date().toISOString());
  return true;
}
async function supabasePullState(settings){
  const c = supabaseCfg(settings);
  const rows = await supabaseRequest(settings, `${SUPABASE_TABLE}?shop_code=eq.${encodeURIComponent(c.shop)}&select=*&limit=1`, { method:'GET' });
  const row = Array.isArray(rows) ? rows[0] : null;
  localStorage.setItem('jebar_supabase_sync_at', new Date().toISOString());
  return row || null;
}
async function supabaseEnsureSeed(db, settings){
  const row = await supabasePullState(settings);
  if(!row || !row.db || !row.db.menus) await supabasePushState(db, settings);
  return row;
}

function SupabaseSync(){
  const { db, setDb, settings, setSettings, flash } = useData();
  const [status,setStatus]=React.useState('off');
  const [open,setOpen]=React.useState(false);
  const [last,setLast]=React.useState('');
  const applying=React.useRef(false);
  const pulled=React.useRef(false);
  const timer=React.useRef();
  const box=React.useRef();
  const dbRef=React.useRef(db); dbRef.current=db;
  const settingsRef=React.useRef(settings); settingsRef.current=settings;
  const on = !!settings.supabaseEnabled && supabaseReady(settings);

  const pull=React.useCallback(async(manual)=>{
    if(!on) return;
    try{
      setStatus('syncing');
      const row = await supabaseEnsureSeed(dbRef.current, settingsRef.current);
      if(row && row.db && row.db.menus){
        applying.current=true;
        setDb(window.fixYields ? window.fixYields(row.db) : row.db);
        if(row.settings) setSettings(mergeRemoteSettings(row.settings, settingsRef.current));
      }
      pulled.current=true;
      setStatus('ok');
      setLast('ล่าสุด '+new Date().toLocaleTimeString('th-TH'));
      if(manual) flash('ดึงข้อมูลจาก Supabase แล้ว');
    }catch(e){
      setStatus('error'); setLast(e.message);
      if(manual) flash('Supabase ไม่สำเร็จ: '+e.message, 'err');
    }
  },[on]);

  const push=React.useCallback(async(manual)=>{
    if(!on) return;
    try{
      setStatus('syncing');
      await supabasePushState(dbRef.current, settingsRef.current);
      setStatus('ok');
      setLast('บันทึก '+new Date().toLocaleTimeString('th-TH'));
      if(manual) flash('ซิงก์ขึ้น Supabase แล้ว');
    }catch(e){
      setStatus('error'); setLast(e.message);
      if(manual) flash('Supabase ไม่สำเร็จ: '+e.message, 'err');
    }
  },[on]);

  React.useEffect(()=>{ pulled.current=false; if(!on){ setStatus('off'); return; } pull(false); },[on, settings.supabaseUrl, settings.supabaseAnonKey, settings.supabaseShopCode]);
  React.useEffect(()=>{
    if(!on || !settings.supabaseAuto) return;
    if(applying.current){ applying.current=false; return; }
    if(!pulled.current) return;
    clearTimeout(timer.current);
    timer.current=setTimeout(()=>push(false), 1400);
    return ()=>clearTimeout(timer.current);
  },[db, settings.shopName, settings.shopTagline, settings.estGP, settings.target, on, settings.supabaseAuto]);
  React.useEffect(()=>{ const h=e=>{ if(box.current&&!box.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h); },[]);

  if(!on) return null;
  const color = status==='error'?'var(--red)':status==='syncing'?'var(--orange)':'var(--green)';
  return <div ref={box} style={{position:'relative'}} className="no-print">
    <button onClick={()=>setOpen(!open)} title="สถานะ Supabase" style={{width:40,height:40,borderRadius:11,display:'grid',placeItems:'center',
      background:open?'var(--accent-soft)':'var(--chip)',color,position:'relative'}}>
      <Icon name="cloud" size={19}/>
      <span style={{position:'absolute',bottom:7,right:7,width:8,height:8,borderRadius:'50%',background:color,boxShadow:'0 0 0 2px var(--header)'}}/>
    </button>
    {open && <div style={{position:'absolute',right:0,top:48,width:292,background:'var(--surface)',borderRadius:14,
      boxShadow:'var(--shadow-lg)',border:'1px solid var(--line-2)',zIndex:60,padding:16,animation:'pop .2s'}}>
      <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:8}}>
        <span style={{width:9,height:9,borderRadius:'50%',background:color}}/>
        <span style={{fontWeight:600,fontSize:14}}>{status==='ok'?'Supabase ซิงก์แล้ว':status==='syncing'?'กำลังซิงก์...':status==='error'?'Supabase ผิดพลาด':'ปิดอยู่'}</span>
        <Badge tone="gray">{settings.supabaseAuto?'Auto':'Manual'}</Badge>
      </div>
      <div style={{fontSize:12,color:'var(--ink-3)',marginBottom:12,minHeight:16}}>{last||'เชื่อมต่อ Supabase'}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <Button size="sm" icon="download" variant="secondary" onClick={()=>pull(true)}>ดึงลง</Button>
        <Button size="sm" icon="upload" onClick={()=>push(true)}>ซิงก์ขึ้น</Button>
      </div>
    </div>}
  </div>;
}

function SupabaseSettings(){
  const { db, setDb, settings, setSettings, flash } = useData();
  const [testing,setTesting]=React.useState(false);
  const set=(p)=>setSettings(Object.assign({}, settings, p));
  const test=async()=>{
    setTesting(true);
    try{
      if(!supabaseReady(settings)) throw new Error('กรอก Project URL และ anon key ก่อน');
      const row = await supabaseEnsureSeed(db, settings);
      flash(row && row.db ? 'เชื่อม Supabase สำเร็จ พบข้อมูลบนคลาวด์แล้ว' : 'เชื่อม Supabase สำเร็จ และเตรียมข้อมูลเริ่มต้นแล้ว');
    }catch(e){ flash('Supabase ไม่สำเร็จ: '+e.message,'err'); }
    setTesting(false);
  };
  const pull=async()=>{
    try{
      const row=await supabasePullState(settings);
      if(!row || !row.db) throw new Error('ยังไม่มีข้อมูลบน Supabase');
      setDb(window.fixYields ? window.fixYields(row.db) : row.db);
      if(row.settings) setSettings(mergeRemoteSettings(row.settings, settings));
      flash('ดึงข้อมูลจาก Supabase แล้ว');
    }catch(e){ flash('ดึงไม่สำเร็จ: '+e.message,'err'); }
  };
  const push=async()=>{
    try{ await supabasePushState(db, settings); flash('ซิงก์ข้อมูลทั้งระบบขึ้น Supabase แล้ว'); }
    catch(e){ flash('ซิงก์ไม่สำเร็จ: '+e.message,'err'); }
  };
  return <SettingsSection icon="cloud" title="เชื่อม Supabase (ออนไลน์)" sub="เก็บข้อมูลทั้งระบบของแอปเก่า: เมนู สูตร ข้อมูลหลัก ยอดขาย และตั้งค่า">
    <div style={{display:'flex',alignItems:'center',gap:14}}>
      <Toggle on={!!settings.supabaseEnabled} onChange={v=>{ if(v&&!supabaseReady(settings)){ flash('กรอก Project URL และ anon key ก่อน','err'); return; } set({supabaseEnabled:v}); }}/>
      <span style={{fontSize:14}}>{settings.supabaseEnabled?'เปิด Supabase sync':'ปิดอยู่'}</span>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
      <Field label="Project URL"><Input value={settings.supabaseUrl||SUPABASE_DEFAULT_URL} onChange={e=>set({supabaseUrl:e.target.value.trim()})}/></Field>
      <Field label="รหัสร้าน / ชุดข้อมูล"><Input value={settings.supabaseShopCode||'jebar'} onChange={e=>set({supabaseShopCode:e.target.value.trim()||'jebar'})}/></Field>
    </div>
    <Field label="Anon public key" hint="ใช้ key แบบ anon/public เท่านั้น ไม่ใส่ service_role">
      <Input value={settings.supabaseAnonKey||SUPABASE_DEFAULT_KEY} onChange={e=>set({supabaseAnonKey:e.target.value.trim()})}/>
    </Field>
    <div style={{display:'flex',alignItems:'center',gap:14}}>
      <Toggle on={settings.supabaseAuto!==false} onChange={v=>set({supabaseAuto:v})}/>
      <span style={{fontSize:14}}>{settings.supabaseAuto!==false?'Auto-sync หลังบันทึกข้อมูล':'ซิงก์มือเองเท่านั้น'}</span>
    </div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
      <Button variant="secondary" onClick={test} disabled={testing}>{testing?'กำลังทดสอบ...':'ทดสอบ/สร้างข้อมูลเริ่มต้น'}</Button>
      <Button variant="secondary" icon="download" onClick={pull}>โหลดจาก Supabase</Button>
      <Button icon="upload" onClick={push}>ซิงก์ขึ้น Supabase</Button>
    </div>
    <p style={{fontSize:11.5,color:'var(--ink-3)',lineHeight:1.7}}>
      ครั้งแรกให้รันไฟล์ <b>supabase-jebar-full.sql</b> ใน Supabase SQL Editor ก่อน แล้วกลับมากดทดสอบ ระบบนี้ใช้ตารางเดียวชื่อ <b>jebar_app_state</b> จึงไม่กระทบตาราง HR หรือฐานข้อมูลอื่น
    </p>
  </SettingsSection>;
}

Object.assign(window, {
  SupabaseSync, SupabaseSettings,
  supabasePushState, supabasePullState, supabaseEnsureSeed, supabaseReady, supabaseUploadImage, SUPABASE_IMAGE_BUCKET
});
