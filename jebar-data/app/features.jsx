// ============ Extra features: alerts · VAT · backup · PIN lock · branch ============

// ---------- VAT ----------
function vatBreakdown(amount, settings){
  const rate=settings.vatRate??0.07;
  if(settings.vatMode==='exclusive'){ const vat=amount*rate; return {base:amount, vat, total:amount+vat, rate}; }
  const base=amount/(1+rate); return {base, vat:amount-base, total:amount, rate}; // inclusive
}

// ---------- Alerts ----------
function computeAlerts(db, settings){
  const out=[];
  const thr=settings.gpAlertThreshold??0.5;
  const lowGP=db.menus.map(m=>({m,e:menuEconomics(db,m)})).filter(x=>x.e.hasRecipe&&x.m.priceStore>0&&x.e.gpStorePct<thr);
  if(lowGP.length) out.push({tone:'red',icon:'cup',route:'products',
    title:`${lowGP.length} เมนู GP ต่ำกว่า ${fmtPct(thr,0)}`,
    detail:lowGP.slice(0,3).map(x=>`${x.m.name} (${fmtPct(x.e.gpStorePct,0)})`).join(', ')+(lowGP.length>3?' …':'')});
  const months=aggregateByMonth(db);
  if(months.length && settings.target>0){
    const cur=months[months.length-1];
    if(cur.total<settings.target) out.push({tone:'orange',icon:'target',route:'analytics',
      title:'ยอดเดือนล่าสุดต่ำกว่าเป้า', detail:`${fmtB(cur.total)} / เป้า ${fmtB(settings.target)} · ขาดอีก ${fmtB(settings.target-cur.total)}`});
  }
  const comm=settings.lineCommission??0.32;
  const notCov=db.menus.filter(m=>m.priceLine>0 && m.priceLine*(1-comm)<m.priceStore);
  if(notCov.length) out.push({tone:'orange',icon:'wallet',route:'products',
    title:`${notCov.length} เมนูราคาไลน์แมนไม่คุ้มค่าคอม`, detail:`อิงค่าคอม ${fmtPct(comm,0)} — ควรปรับราคาหรือส่วนบวก`});
  const noRecipe=db.menus.filter(m=>m.status==='ขาย'&&m.priceStore>0&&!computeMenuCost(db,m.id).hasRecipe).length;
  if(noRecipe>0) out.push({tone:'gray',icon:'recipe',route:'menu',
    title:`${noRecipe} เมนูยังไม่มีสูตรต้นทุน`, detail:'ใส่สูตรเพื่อให้คำนวณ GP และราคาแนะนำได้'});
  return out;
}

function AlertBell({ go }){
  const { db, settings } = useData();
  const [open,setOpen]=React.useState(false);
  const alerts=settings.alertsEnabled!==false ? computeAlerts(db,settings) : [];
  const keys = alerts.map(a=>a.title);
  const keySig = keys.join('|');
  // จำว่าผู้ใช้ "เห็นแล้ว" รายการไหนบ้าง — กระดิ่งจะขึ้นเลขแดงเฉพาะรายการใหม่ที่ยังไม่เคยเปิดดู
  const [seen,setSeen]=React.useState(()=>{ try{ return JSON.parse(localStorage.getItem('jebar_alerts_seen')||'[]'); }catch(e){ return []; } });
  // ตัดรายการที่หายไปแล้วออกจาก "เห็นแล้ว" เพื่อให้ปัญหาที่กลับมาใหม่เด้งเตือนอีกครั้ง
  React.useEffect(()=>{ const pruned=seen.filter(k=>keys.includes(k));
    if(pruned.length!==seen.length){ setSeen(pruned); try{ localStorage.setItem('jebar_alerts_seen',JSON.stringify(pruned)); }catch(e){} } },[keySig]);
  const unread = keys.filter(k=>!seen.includes(k)).length;
  const markSeen=()=>{ const merged=[...new Set([...seen,...keys])]; setSeen(merged); try{ localStorage.setItem('jebar_alerts_seen',JSON.stringify(merged)); }catch(e){} };
  const ref=React.useRef();
  React.useEffect(()=>{ const h=e=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h); },[]);
  return <div ref={ref} style={{position:'relative'}} className="no-print">
    <button onClick={()=>{ const n=!open; setOpen(n); if(n) markSeen(); }} style={{width:40,height:40,borderRadius:11,display:'grid',placeItems:'center',
      background:open?'var(--accent-soft)':'var(--chip)',color:open?'var(--accent)':'var(--ink-2)',position:'relative'}}>
      <Icon name="bell" size={19}/>
      {unread>0 && <span style={{position:'absolute',top:6,right:6,minWidth:16,height:16,padding:'0 4px',borderRadius:8,
        background:'var(--red)',color:'#fff',fontSize:10,fontWeight:700,display:'grid',placeItems:'center',boxShadow:'0 0 0 2px var(--header)'}}>{unread}</span>}
    </button>
    {open && <div style={{position:'absolute',right:0,top:48,width:340,background:'var(--surface)',borderRadius:16,
      boxShadow:'var(--shadow-lg)',border:'1px solid var(--line-2)',zIndex:60,overflow:'hidden',animation:'pop .2s'}}>
      <div style={{padding:'14px 16px',borderBottom:'1px solid var(--line-2)',fontWeight:600,fontSize:14.5,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        การแจ้งเตือน {alerts.length>0&&<Badge tone="red">{alerts.length}</Badge>}</div>
      <div style={{maxHeight:380,overflowY:'auto'}}>
        {alerts.length? alerts.map((a,i)=>(
          <button key={i} onClick={()=>{setOpen(false);go(a.route);}} style={{width:'100%',display:'flex',gap:12,padding:'13px 16px',
            borderBottom:'1px solid var(--line-2)',textAlign:'left',background:'transparent',transition:'background .15s'}}
            onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <div style={{width:34,height:34,borderRadius:9,flexShrink:0,display:'grid',placeItems:'center',
              background:a.tone==='red'?'var(--red-soft)':a.tone==='orange'?'var(--orange-soft)':'var(--chip)',
              color:a.tone==='red'?'var(--red)':a.tone==='orange'?'var(--orange)':'var(--ink-2)'}}><Icon name={a.icon} size={17}/></div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:13.5,fontWeight:600}}>{a.title}</div>
            <div style={{fontSize:12,color:'var(--ink-3)',marginTop:2}}>{a.detail}</div></div>
          </button>
        )) : <div style={{padding:'34px 20px',textAlign:'center',color:'var(--ink-3)'}}>
          <Icon name="check" size={26}/><div style={{fontSize:13.5,marginTop:8,fontWeight:500}}>ไม่มีการแจ้งเตือน</div></div>}
      </div>
    </div>}
  </div>;
}

// ---------- Branch picker ----------
function BranchPicker(){
  const { db, settings, setSettings } = useData();
  const branches=['ทั้งหมด', ...(db.branches||[])];
  if((db.branches||[]).length<=1) return null;
  return <div className="no-print" style={{minWidth:140}}>
    <Select value={settings.activeBranch||'ทั้งหมด'} options={branches} onChange={e=>setSettings({...settings,activeBranch:e.target.value})}/>
  </div>;
}

// ---------- Backup reminder ----------
function backupDownload(db, pick){
  return saveFileSmart(`jebar-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(db,null,2), 'application/json', pick);
}
function BackupBanner(){
  const { db, settings, setSettings } = useData();
  const [dismissed,setDismissed]=React.useState(()=>sessionStorage.getItem('jebar_backup_dismiss')==='1');
  const days=(Date.now()-(settings.lastBackup||0))/86400000;
  if(dismissed || days<7) return null;
  const never=!settings.lastBackup;
  return <div className="no-print" style={{display:'flex',alignItems:'center',gap:12,padding:'11px 20px',background:'var(--orange-soft)',
    borderBottom:'1px solid var(--line-2)'}}>
    <Icon name="download" size={17} color="var(--orange)"/>
    <span style={{flex:1,fontSize:13.5,color:'var(--ink)'}}>
      {never?'ยังไม่เคยสำรองข้อมูล — แนะนำให้ดาวน์โหลดไฟล์สำรองไว้':`สำรองข้อมูลล่าสุด ${Math.floor(days)} วันที่แล้ว — แนะนำให้สำรองใหม่`}</span>
    <Button size="sm" variant="soft" icon="download" onClick={async()=>{ const r=await backupDownload(db, settings.askSaveLocation); if(r!=='cancel') setSettings({...settings,lastBackup:Date.now()}); }}>สำรองตอนนี้</Button>
    <IconBtn name="close" size={15} onClick={()=>{ sessionStorage.setItem('jebar_backup_dismiss','1'); setDismissed(true); }}/>
  </div>;
}

// ---------- PIN lock ----------
function LockScreen({ onUnlock }){
  const { settings } = useData();
  const [entry,setEntry]=React.useState('');
  const [err,setErr]=React.useState(false);
  const press=(d)=>{ setErr(false); const v=(entry+d).slice(0,6); setEntry(v);
    if(v.length>=String(settings.pin).length && v===String(settings.pin)){ onUnlock(); }
    else if(v.length>=6 && v!==String(settings.pin)){ setErr(true); setTimeout(()=>setEntry(''),300); } };
  const submit=()=>{ if(entry===String(settings.pin)) onUnlock(); else { setErr(true); setTimeout(()=>setEntry(''),300);} };
  return <div style={{position:'fixed',inset:0,background:'var(--bg)',zIndex:300,display:'grid',placeItems:'center'}}>
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:24,animation:'pop .3s'}}>
      <img src={settings.logo} alt="logo" style={{height:64,objectFit:'contain',background:settings.theme==='dark'?'#fff':'transparent',borderRadius:12,padding:settings.theme==='dark'?'8px 12px':0}}/>
      <div style={{textAlign:'center'}}><div style={{fontSize:18,fontWeight:600}}>ใส่รหัส PIN</div>
      <div style={{fontSize:13,color:'var(--ink-3)',marginTop:3}}>เพื่อเข้าใช้งานระบบ {settings.shopName}</div></div>
      <div style={{display:'flex',gap:12,height:18}}>
        {Array.from({length:Math.max(4,String(settings.pin).length)}).map((_,i)=>
          <span key={i} style={{width:14,height:14,borderRadius:'50%',transition:'all .15s',
            background:err?'var(--red)':i<entry.length?'var(--accent)':'transparent',
            border:`2px solid ${err?'var(--red)':i<entry.length?'var(--accent)':'var(--line)'}`}}/>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,72px)',gap:14}}>
        {[1,2,3,4,5,6,7,8,9].map(n=><button key={n} onClick={()=>press(String(n))} style={keyStyle}>{n}</button>)}
        <span/>
        <button onClick={()=>press('0')} style={keyStyle}>0</button>
        <button onClick={()=>setEntry(entry.slice(0,-1))} style={{...keyStyle,fontSize:18}}>⌫</button>
      </div>
    </div>
  </div>;
}
const keyStyle={width:72,height:72,borderRadius:'50%',background:'var(--surface)',border:'1px solid var(--line)',
  fontSize:26,fontWeight:500,color:'var(--ink)',boxShadow:'var(--shadow-sm)',transition:'transform .1s'};

Object.assign(window, { vatBreakdown, computeAlerts, AlertBell, BranchPicker, BackupBanner, LockScreen });
