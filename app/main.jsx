// ============ Shell · routing · import/export · reports ============
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;

// ---------- file helpers ----------
function downloadBlob(content, filename, type){
  const blob = content instanceof Blob ? content : new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function toCSV(rows, headers){
  const esc = v => { v=(v===null||v===undefined)?'':String(v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
  const head = headers.map(h=>esc(h.label)).join(',');
  const body = rows.map(r=>headers.map(h=>esc(typeof h.get==='function'?h.get(r):r[h.key])).join(',')).join('\n');
  return '\uFEFF'+head+'\n'+body;
}
function parseCSV(text){
  text = text.replace(/^\uFEFF/,'');
  const rows=[]; let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){ const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
    else { if(c==='"')q=true; else if(c===','){row.push(cur);cur='';} else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur='';} else if(c==='\r'){} else cur+=c; }
  }
  if(cur!==''||row.length){ row.push(cur); rows.push(row); }
  return rows.filter(r=>r.some(c=>c.trim()!==''));
}
// minimal xlsx → first sheet rows (array of arrays)
async function xlsxRows(file){
  const buf=new Uint8Array(await file.arrayBuffer());
  const dv=new DataView(buf.buffer); const rU16=o=>dv.getUint16(o,true),rU32=o=>dv.getUint32(o,true);
  let eocd=-1; for(let p=buf.length-22;p>=0;p--)if(rU32(p)===0x06054b50){eocd=p;break;}
  const cdCount=rU16(eocd+10); let ptr=rU32(eocd+16); const files={};
  for(let n=0;n<cdCount;n++){ const comp=rU16(ptr+10),compSize=rU32(ptr+20),nameLen=rU16(ptr+28),extraLen=rU16(ptr+30),commentLen=rU16(ptr+32),lo=rU32(ptr+42);
    const name=new TextDecoder().decode(buf.subarray(ptr+46,ptr+46+nameLen)); ptr+=46+nameLen+extraLen+commentLen;
    const lh=lo, nl=rU16(lh+26), el=rU16(lh+28), ds=lh+30+nl+el; const cd=buf.subarray(ds,ds+compSize);
    let out; if(comp===0)out=cd; else out=new Uint8Array(await new Response(new Response(cd).body.pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    files[name]=new TextDecoder().decode(out);
  }
  const shared=[...(files['xl/sharedStrings.xml']||'').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(si=>[...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m=>m[1]).join(''));
  const dec=s=>(s||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"');
  // first worksheet
  const wsName=Object.keys(files).filter(k=>/xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  const xml=files[wsName]||''; const rows=[];
  for(const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)){ const cells=[];
    for(const cm of rm[1].matchAll(/<c r="([A-Z]+)\d+"(?:[^>]*t="([^"]*)")?[^>]*>([\s\S]*?)<\/c>/g)){
      const col=cm[1].replace(/\d+/,''), type=cm[2], inner=cm[3]; let val='';
      if(type==='s'){const vm=inner.match(/<v>(\d+)<\/v>/);if(vm)val=shared[+vm[1]];}
      else{const vm=inner.match(/<v>([\s\S]*?)<\/v>/);if(vm)val=vm[1];}
      const ci=col.split('').reduce((a,ch)=>a*26+(ch.charCodeAt(0)-64),0)-1; cells[ci]=dec(val);
    }
    rows.push(cells);
  }
  return rows;
}

// ---------- Settings ----------
function SettingsModal({ open, onClose }){
  const { settings, setSettings, flash } = useData();
  const [f,setF]=React.useState(settings);
  React.useEffect(()=>{ if(open) setF(settings); },[open]);
  const save=()=>{ setSettings({...f,estGP:+f.estGP,target:+f.target,avgPrice:+f.avgPrice,lineCommission:+f.lineCommission}); flash('บันทึกการตั้งค่าแล้ว'); onClose(); };
  return <Modal open={open} onClose={onClose} title="ตั้งค่าระบบ" width={480}
    footer={<><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button onClick={save} icon="check">บันทึก</Button></>}>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <Field label="GP% เฉลี่ย (ใช้ประมาณกำไร)" hint="สัดส่วนกำไรขั้นต้นเฉลี่ย เช่น 0.65 = 65%">
        <Input type="number" step="0.01" value={f.estGP} onChange={e=>setF({...f,estGP:e.target.value})}/></Field>
      <Field label="เป้ารายได้ต่อเดือน (฿)"><Input type="number" value={f.target} onChange={e=>setF({...f,target:e.target.value})}/></Field>
      <Field label="ราคาขายเฉลี่ย/แก้ว (฿)" hint="ใส่ 0 เพื่อให้คำนวณจากเมนูอัตโนมัติ">
        <Input type="number" value={f.avgPrice} onChange={e=>setF({...f,avgPrice:e.target.value})}/></Field>
      <Field label="ค่าคอมมิชชัน LINE MAN" hint="สัดส่วนค่าธรรมเนียมแพลตฟอร์ม เช่น 0.32 = 32%">
        <Input type="number" step="0.01" value={f.lineCommission} onChange={e=>setF({...f,lineCommission:e.target.value})}/></Field>
    </div>
  </Modal>;
}

// ---------- Import / Export ----------
function IOModal({ open, onClose }){
  const { db, setDb, importDB, saveSale, upsert, setCollection, flash, resetData, settings, setSettings } = useData();
  const fileRef=React.useRef();
  const [pos,setPos]=React.useState(false);

  const pk=()=>settings.askSaveLocation;
  const exportJSON=async()=>{ const r=await saveFileSmart(`jebar-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(db,null,2),'application/json',pk()); if(r!=='cancel'){ setSettings({...settings,lastBackup:Date.now()}); flash('ส่งออก JSON แล้ว'); } };
  const exportMenuCSV=async()=>{
    const rows=db.menus.map(m=>({m,e:menuEconomics(db,m)}));
    const csv=toCSV(rows,[
      {label:'รหัส',get:r=>r.m.id},{label:'ชื่อเมนู',get:r=>r.m.name},{label:'หมวดหมู่',get:r=>r.m.category},{label:'ประเภท',get:r=>r.m.type},
      {label:'ราคาหน้าร้าน',get:r=>r.m.priceStore},{label:'ราคา_LINE_MAN',get:r=>r.m.priceLine},
      {label:'ต้นทุนรวม',get:r=>r.e.hasRecipe?r.e.total.toFixed(2):''},{label:'GP%หน้าร้าน',get:r=>r.e.hasRecipe?(r.e.gpStorePct*100).toFixed(1):''},{label:'สถานะ',get:r=>r.m.status},
    ]);
    if(await saveFileSmart('jebar-menu-cost.csv',csv,'text/csv',pk())!=='cancel') flash('ส่งออกเมนูแล้ว');
  };
  const exportSalesCSV=async()=>{
    const csv=toCSV(db.dailySales,[{label:'วันที่',key:'date'},{label:'หน้าร้าน',get:r=>saleStore(r)},{label:'LINE_MAN',get:r=>saleLine(r)},{label:'อื่นๆ',get:r=>saleOther(r)},{label:'รวม',get:r=>dailyTotal(r)}]);
    if(await saveFileSmart('jebar-daily-sales.csv',csv,'text/csv',pk())!=='cancel') flash('ส่งออกยอดขายแล้ว');
  };
  const exportExcel=async()=>{
    const sheet=(name,headers,rows)=>`<table><tr>${headers.map(h=>`<th>${h.label}</th>`).join('')}</tr>${rows.map(r=>`<tr>${headers.map(h=>`<td>${typeof h.get==='function'?h.get(r):(r[h.key]??'')}</td>`).join('')}</tr>`).join('')}</table>`;
    const menuRows=db.menus.map(m=>({m,e:menuEconomics(db,m)}));
    const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>`+
      `<h3>เมนู & ต้นทุน</h3>`+sheet('menu',[{label:'รหัส',get:r=>r.m.id},{label:'ชื่อเมนู',get:r=>r.m.name},{label:'ราคาหน้าร้าน',get:r=>r.m.priceStore},{label:'ต้นทุน',get:r=>r.e.hasRecipe?r.e.total.toFixed(2):''},{label:'GP%',get:r=>r.e.hasRecipe?(r.e.gpStorePct*100).toFixed(1):''}],menuRows)+
      `<h3>ยอดขายรายวัน</h3>`+sheet('sales',[{label:'วันที่',key:'date'},{label:'หน้าร้าน',get:r=>saleStore(r)},{label:'LINE MAN',get:r=>saleLine(r)},{label:'อื่นๆ',get:r=>saleOther(r)},{label:'รวม',get:dailyTotal}],db.dailySales)+
      `</body></html>`;
    if(await saveFileSmart('jebar-report.xls',html,'application/vnd.ms-excel',pk())!=='cancel') flash('ส่งออก Excel แล้ว');
  };

  const onFile=async(e)=>{
    const file=e.target.files[0]; if(!file) return;
    try{
      if(file.name.endsWith('.json')){
        const obj=JSON.parse(await file.text());
        if(obj.menus&&obj.dailySales){ importDB(obj); onClose(); } else flash('ไฟล์ JSON ไม่ถูกต้อง','err');
      } else {
        let rows;
        if(file.name.endsWith('.xlsx')) rows=await xlsxRows(file);
        else rows=parseCSV(await file.text());
        if(!rows||rows.length<2){ flash('ไม่พบข้อมูล','err'); return; }
        const head=rows[0].map(h=>(h||'').toString().toLowerCase());
        const find=(...keys)=>head.findIndex(h=>keys.some(k=>h.includes(k)));
        const di=find('วันที่','date'), si=find('หน้าร้าน','store'), li=find('line','ไลน์'), oi=find('อื่น','other');
        const mi=find('menu_id','รหัสเมนู'), ni=find('ชื่อเมนู','menu name');
        const ingIdC=find('ingredient_id'), pkgIdC=find('package_id'), qtyC=find('qty','ปริมาณ','จำนวน');
        const isRecipe = (ingIdC>=0 || pkgIdC>=0) && mi>=0 && qtyC>=0;
        if(isRecipe){
          const ingMap=Object.fromEntries(db.ingredients.map(i=>[i.id,i]));
          const pkgMap=Object.fromEntries(db.packages.map(p=>[p.id,p]));
          const baseByMenu={}, pkgByMenu={};
          for(const r of rows.slice(1)){
            const menuId=(r[mi]||'').toString().trim().toUpperCase(); if(!menuId) continue;
            const qty=+r[qtyC]||0;
            if(ingIdC>=0 && r[ingIdC]){ const ingId=(r[ingIdC]||'').toString().trim().toUpperCase(); const ing=ingMap[ingId]; if(!ing)continue;
              (baseByMenu[menuId]=baseByMenu[menuId]||[]).push({menuId,ingId,qty,unit:ing.unit,costPerUnit:ing.costPerUnit,lineCost:qty*ing.costPerUnit}); }
            else if(pkgIdC>=0 && r[pkgIdC]){ const pkgId=(r[pkgIdC]||'').toString().trim().toUpperCase(); const p=pkgMap[pkgId]; if(!p)continue;
              (pkgByMenu[menuId]=pkgByMenu[menuId]||[]).push({menuId,pkgId,qty,unit:p.unit,costPerPiece:p.costPerPiece,lineCost:qty*p.costPerPiece}); }
          }
          const baseMenus=Object.keys(baseByMenu), pkgMenus=Object.keys(pkgByMenu);
          setDb(prev=>{
            let rb=prev.recipeBase, rp=prev.recipePackage;
            if(baseMenus.length){ rb=[...prev.recipeBase.filter(r=>!baseMenus.includes(r.menuId)), ...baseMenus.flatMap(m=>baseByMenu[m])]; }
            if(pkgMenus.length){ rp=[...prev.recipePackage.filter(r=>!pkgMenus.includes(r.menuId)), ...pkgMenus.flatMap(m=>pkgByMenu[m])]; }
            return {...prev, recipeBase:rb, recipePackage:rp};
          });
          const cnt=Math.max(baseMenus.length,pkgMenus.length);
          flash(`นำเข้าสูตร ${cnt} เมนู`+(ingIdC>=0?' (วัตถุดิบ)':'')+(pkgIdC>=0?' (แพคเกจ)':'')); onClose(); return;
        }
        if(di>=0){
          let n=0;
          for(const r of rows.slice(1)){
            let d=r[di]; if(!d)continue;
            if(/^\d+(\.\d+)?$/.test(d)){ d=new Date(Date.UTC(1899,11,30)+Math.round(+d)*86400000).toISOString().slice(0,10); }
            saveSale({date:d,store:+r[si]||0,line:+r[li]||0,other:+r[oi]||0}); n++;
          }
          flash(`นำเข้ายอดขาย ${n} วัน`); onClose();
        } else if(mi>=0 || ni>=0){
          const ci=find('หมวด','category'), ti=find('ประเภท','type'), sti=find('สถานะ','status');
          const psi=find('หน้าร้าน','ราคาหน้า','pricestore','price_store'), pli=find('line_man','line man','ไลน์','priceline');
          const PFX={Beverage:'BEV',Bakery:'BKY',Pastry:'PST',Dessert:'DST',Food:'FOOD'};
          const out=[...db.menus]; const usedName=new Set(out.map(m=>(m.name||'').trim().toLowerCase()));
          let n=0, skip=0;
          for(const r of rows.slice(1)){
            const name=(r[ni]||'').toString().trim(); if(!name) continue;
            if(usedName.has(name.toLowerCase())){ skip++; continue; }
            const cat=(ci>=0&&r[ci]?r[ci]:'').toString().trim()||'Beverage';
            let id=(mi>=0&&r[mi]?r[mi]:'').toString().trim().toUpperCase();
            if(!id || out.some(m=>m.id===id)) id=nextCode(out, PFX[cat]||'MNU');
            out.unshift({id,name,category:cat,type:(ti>=0&&r[ti]?r[ti]:'').toString().trim()||'Other',
              priceStore:+r[psi]||0,priceLine:+r[pli]||0,status:(sti>=0&&r[sti]?r[sti]:'').toString().trim()||'ขาย'});
            usedName.add(name.toLowerCase()); n++;
          }
          setCollection('menus', out);
          flash(`นำเข้าเมนู ${n} รายการ`+(skip?` · ข้ามชื่อซ้ำ ${skip}`:'')); onClose();
        } else flash('ไม่รู้จักรูปแบบไฟล์ (ต้องมีคอลัมน์ วันที่ หรือ ชื่อเมนู)','err');
      }
    }catch(err){ flash('นำเข้าไม่สำเร็จ: '+err.message,'err'); }
    e.target.value='';
  };

  const Row=({icon,title,sub,children})=> <div style={{display:'flex',alignItems:'center',gap:14,padding:'14px 0',borderTop:'1px solid var(--line-2)'}}>
    <div style={{width:40,height:40,borderRadius:11,background:'var(--chip)',display:'grid',placeItems:'center',color:'var(--ink-2)',flexShrink:0}}><Icon name={icon} size={20}/></div>
    <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14.5}}>{title}</div><div style={{fontSize:12.5,color:'var(--ink-3)'}}>{sub}</div></div>
    {children}</div>;

  return <>
  <Modal open={open} onClose={onClose} title="นำเข้า / ส่งออกข้อมูล" width={560}>
    <button onClick={()=>{ onClose(); setTimeout(()=>setPos(true),120); }} style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'15px 16px',
      background:'var(--accent-soft)',borderRadius:14,marginBottom:8,textAlign:'left',transition:'filter .15s'}}
      onMouseEnter={e=>e.currentTarget.style.filter='brightness(.97)'} onMouseLeave={e=>e.currentTarget.style.filter='none'}>
      <div style={{width:40,height:40,borderRadius:11,background:'var(--accent)',color:'#fff',display:'grid',placeItems:'center',flexShrink:0}}><Icon name="upload" size={20}/></div>
      <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14.5,color:'var(--accent)'}}>นำเข้าจาก POS วงใน (Wongnai)</div>
      <div style={{fontSize:12.5,color:'var(--accent)',opacity:.8}}>อัปโหลดไฟล์ Export ยอดขาย — จับวันที่+ช่องทางให้อัตโนมัติ</div></div>
      <Icon name="chevron" size={18} color="var(--accent)"/>
    </button>
    <div style={{marginBottom:8,fontSize:13,fontWeight:600,color:'var(--ink-2)'}}>นำเข้าทั่วไป</div>
    <Row icon="upload" title="นำเข้าไฟล์" sub="รองรับ .json (สำรอง), .csv, .xlsx — ตรวจจับคอลัมน์อัตโนมัติ">
      <div style={{display:'flex',gap:8}}>
        <Button variant="secondary" size="sm" onClick={()=>{
          const csv='\uFEFF'+'Menu_ID,ชื่อเมนู,หมวดหมู่,ประเภท,ราคาหน้าร้าน,ราคา_LINE_MAN,สถานะ\n'+
            ',อเมริกาโน่เย็น,Beverage,Coffee,55,65,ขาย\n'+
            ',ลาเต้ร้อน,Beverage,Coffee,60,70,ขาย\n'+
            ',ครัวซองต์,Bakery,Bread,65,75,ขาย\n';
          saveFileSmart('menu-template.csv',csv,'text/csv',settings.askSaveLocation);
        }}>เทมเพลต</Button>
        <Button variant="soft" size="sm" onClick={()=>fileRef.current.click()}>เลือกไฟล์</Button>
      </div>
      <input ref={fileRef} type="file" accept=".json,.csv,.xlsx" style={{display:'none'}} onChange={onFile}/>
    </Row>
    <div style={{margin:'18px 0 8px',fontSize:13,fontWeight:600,color:'var(--ink-2)'}}>ส่งออก</div>
    <Row icon="download" title="สำรองข้อมูลทั้งหมด" sub="ไฟล์ JSON — นำกลับมาใช้ได้ภายหลัง"><Button variant="secondary" size="sm" onClick={exportJSON}>JSON</Button></Row>
    <Row icon="doc" title="ส่งออก Excel" sub="เมนู+ต้นทุน และยอดขาย เปิดใน Excel ได้ทันที"><Button variant="secondary" size="sm" onClick={exportExcel}>.xls</Button></Row>
    <Row icon="cup" title="เมนู & ต้นทุน (CSV)" sub="พร้อม GP% ที่คำนวณแล้ว"><Button variant="secondary" size="sm" onClick={exportMenuCSV}>CSV</Button></Row>
    <Row icon="sales" title="ยอดขายรายวัน (CSV)" sub="ทุกวันที่บันทึกไว้"><Button variant="secondary" size="sm" onClick={exportSalesCSV}>CSV</Button></Row>
    <div style={{margin:'18px 0 8px',fontSize:13,fontWeight:600,color:'var(--red)'}}>รีเซ็ต</div>
    <Row icon="reset" title="คืนค่าข้อมูลเริ่มต้น" sub="ลบการแก้ไขทั้งหมด กลับไปใช้ข้อมูลต้นฉบับ">
      <Button variant="danger" size="sm" onClick={()=>{if(confirm('คืนค่าข้อมูลเริ่มต้น? การแก้ไขทั้งหมดจะหายไป')){resetData();onClose();}}}>รีเซ็ต</Button></Row>
  </Modal>
  <POSImportModal open={pos} onClose={()=>setPos(false)}/>
  </>;
}

// ---------- Printable report ----------
function Reports(){
  const { fdb:db, settings, THAI_MONTHS } = useData();
  const months=aggregateByMonth(db); const oh=overheadTotal(db);
  const topGP=db.menus.map(m=>({m,e:menuEconomics(db,m)})).filter(x=>x.e.hasRecipe&&x.m.priceStore>0).sort((a,b)=>b.e.gpStorePct-a.e.gpStorePct).slice(0,10);
  return <div className="view-enter">
    <div className="no-print" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
      <p style={{fontSize:13.5,color:'var(--ink-2)'}}>ดูตัวอย่างรายงาน แล้วสั่งพิมพ์หรือบันทึกเป็น PDF</p>
      <Button icon="print" onClick={()=>window.print()}>พิมพ์ / บันทึก PDF</Button>
    </div>
    <Card className="print-area force-light" pad={40} style={{maxWidth:820,margin:'0 auto',background:'#fff',color:'var(--ink)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:'2px solid var(--ink)',paddingBottom:18,marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <img src={settings.logo} alt="logo" style={{height:54,maxWidth:160,objectFit:'contain'}}/>
          <div style={{borderLeft:'1px solid var(--line)',paddingLeft:14}}>
            <div style={{fontSize:20,fontWeight:700,letterSpacing:'-.3px'}}>{settings.shopName}</div>
            <div style={{fontSize:13,color:'var(--ink-2)'}}>รายงานสรุปผลประกอบการ</div></div>
        </div>
        <div style={{textAlign:'right',fontSize:12.5,color:'var(--ink-2)'}}>ออกรายงาน<br/>{fmtDate(new Date().toISOString().slice(0,10))}</div>
      </div>
      <h4 style={{fontSize:15,fontWeight:700,marginBottom:12}}>สรุปรายเดือน</h4>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,marginBottom:28}}>
        <thead><tr style={{borderBottom:'1px solid var(--line)',color:'var(--ink-2)'}}>
          <th style={{textAlign:'left',padding:'8px 6px'}}>เดือน</th><th style={{textAlign:'right',padding:'8px 6px'}}>หน้าร้าน</th>
          <th style={{textAlign:'right',padding:'8px 6px'}}>LINE MAN</th><th style={{textAlign:'right',padding:'8px 6px'}}>รวมรายได้</th>
          <th style={{textAlign:'right',padding:'8px 6px'}}>กำไรขั้นต้น</th><th style={{textAlign:'right',padding:'8px 6px'}}>กำไรสุทธิ</th></tr></thead>
        <tbody>{months.map(m=>{const gp=m.total*settings.estGP;return <tr key={m.key} style={{borderBottom:'1px solid var(--line-2)'}}>
          <td style={{padding:'8px 6px',fontWeight:600}}>{THAI_MONTHS[m.monthIdx]} {parseInt(m.year)+543}</td>
          <td className="tnum" style={{textAlign:'right',padding:'8px 6px'}}>{fmt(m.store)}</td>
          <td className="tnum" style={{textAlign:'right',padding:'8px 6px'}}>{fmt(m.line)}</td>
          <td className="tnum" style={{textAlign:'right',padding:'8px 6px',fontWeight:700}}>{fmt(m.total)}</td>
          <td className="tnum" style={{textAlign:'right',padding:'8px 6px',color:'var(--green)'}}>{fmt(gp)}</td>
          <td className="tnum" style={{textAlign:'right',padding:'8px 6px',fontWeight:600}}>{fmt(gp-oh)}</td></tr>;})}</tbody>
      </table>
      <h4 style={{fontSize:15,fontWeight:700,marginBottom:12}}>เมนูกำไรดีที่สุด (GP%)</h4>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr style={{borderBottom:'1px solid var(--line)',color:'var(--ink-2)'}}>
          <th style={{textAlign:'left',padding:'8px 6px'}}>เมนู</th><th style={{textAlign:'right',padding:'8px 6px'}}>ราคา</th>
          <th style={{textAlign:'right',padding:'8px 6px'}}>ต้นทุน</th><th style={{textAlign:'right',padding:'8px 6px'}}>GP%</th></tr></thead>
        <tbody>{topGP.map(({m,e})=><tr key={m.id} style={{borderBottom:'1px solid var(--line-2)'}}>
          <td style={{padding:'8px 6px',fontWeight:600}}>{m.name}</td>
          <td className="tnum" style={{textAlign:'right',padding:'8px 6px'}}>{fmt(m.priceStore)}</td>
          <td className="tnum" style={{textAlign:'right',padding:'8px 6px'}}>{fmt(e.total,1)}</td>
          <td className="tnum" style={{textAlign:'right',padding:'8px 6px',fontWeight:700,color:'var(--green)'}}>{fmtPct(e.gpStorePct)}</td></tr>)}</tbody>
      </table>
      {settings.vatEnabled && (()=>{ const gt=months.reduce((s,m)=>s+m.total,0); const v=vatBreakdown(gt,settings); return <div style={{marginTop:24}}>
        <h4 style={{fontSize:15,fontWeight:700,marginBottom:10}}>สรุปภาษีมูลค่าเพิ่ม (VAT {fmtPct(v.rate,0)})</h4>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <tbody>
            <tr style={{borderBottom:'1px solid var(--line-2)'}}><td style={{padding:'8px 6px'}}>ยอดขายก่อน VAT</td><td className="tnum" style={{textAlign:'right',padding:'8px 6px'}}>{fmtB(v.base)}</td></tr>
            <tr style={{borderBottom:'1px solid var(--line-2)'}}><td style={{padding:'8px 6px'}}>ภาษีขาย (VAT)</td><td className="tnum" style={{textAlign:'right',padding:'8px 6px'}}>{fmtB(v.vat)}</td></tr>
            <tr style={{fontWeight:700}}><td style={{padding:'8px 6px'}}>ยอดรวม</td><td className="tnum" style={{textAlign:'right',padding:'8px 6px'}}>{fmtB(v.total)}</td></tr>
          </tbody>
        </table></div>; })()}
      <p style={{fontSize:11,color:'var(--ink-3)',marginTop:24,borderTop:'1px solid var(--line-2)',paddingTop:12}}>
        หมายเหตุ: กำไรขั้นต้น/สุทธิคำนวณจาก GP เฉลี่ย {fmtPct(settings.estGP,0)} และค่าใช้จ่ายคงที่ {fmtB(oh)}/เดือน · ระบบ JEBAR Data System
      </p>
    </Card>
  </div>;
}

// ---------- Data activity log ----------
function ActivityLogPage(){
  const { db } = useData();
  const [filter,setFilter]=React.useState('all');
  const logs=(db.activityLogs||[]).slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const types=[...new Set(logs.map(l=>String(l.type||'อื่นๆ')).filter(Boolean))].slice(0,80);
  const rows=logs.filter(l=>filter==='all'||l.type===filter).slice(0,200);
  const fmtTs=(iso)=>{
    if(!iso) return '–';
    const d=new Date(iso);
    if(isNaN(d)) return String(iso);
    return d.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'});
  };
  const toneOf=t=>{
    if(/deleted|reset/i.test(t)) return 'red';
    if(/created|imported|media/i.test(t)) return 'green';
    if(/updated|saved/i.test(t)) return 'blue';
    return 'gray';
  };
  return <div className="view-enter" style={{display:'grid',gap:18}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}} className="r-2col">
      <Stat label="เหตุการณ์ทั้งหมด" value={fmt(logs.length)} icon="doc" sub="เก็บไว้สูงสุดประมาณ 1,200 รายการ"/>
      <Stat label="ประเภทเหตุการณ์" value={fmt(types.length)} icon="layers" sub="ใช้แยกงานให้ AI วิเคราะห์ในอนาคต"/>
      <Stat label="ล่าสุด" value={logs[0]?fmtTs(logs[0].createdAt).split(' ')[0]:'–'} icon="calendar" sub={logs[0]?.type||'ยังไม่มีประวัติ'}/>
    </div>
    <Card>
      <SectionTitle sub="ดูว่าใคร/อะไรเปลี่ยนข้อมูลเมื่อไหร่ เพื่อเตรียมข้อมูลให้ AI วิเคราะห์จากเหตุการณ์จริง">ประวัติข้อมูล</SectionTitle>
      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:14,flexWrap:'wrap'}}>
        <div style={{minWidth:260}}>
          <Select value={filter} onChange={e=>setFilter(e.target.value)}
            options={[{value:'all',label:'ทุกประเภท'}, ...types.map(t=>({value:t,label:t}))]}/>
        </div>
        <Badge tone="gray">แสดง {fmt(rows.length)} รายการล่าสุด</Badge>
      </div>
      {rows.length ? <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13.5,minWidth:720}}>
          <thead><tr style={{color:'var(--ink-3)',borderBottom:'1px solid var(--line)'}}>
            <th style={{textAlign:'left',padding:'10px 12px'}}>เวลา</th>
            <th style={{textAlign:'left',padding:'10px 12px'}}>ประเภท</th>
            <th style={{textAlign:'left',padding:'10px 12px'}}>ข้อมูล</th>
            <th style={{textAlign:'left',padding:'10px 12px'}}>รายละเอียด</th>
          </tr></thead>
          <tbody>{rows.map(l=><tr key={l.id} style={{borderBottom:'1px solid var(--line-2)'}}>
            <td style={{padding:'11px 12px',whiteSpace:'nowrap'}}>{fmtTs(l.createdAt)}</td>
            <td style={{padding:'11px 12px'}}><Badge tone={toneOf(l.type)}>{l.type||'อื่นๆ'}</Badge></td>
            <td style={{padding:'11px 12px',color:'var(--ink-2)'}}>{l.entityType||'system'} {l.entityId?`· ${l.entityId}`:''}</td>
            <td style={{padding:'11px 12px',fontWeight:600}}>{l.note||'–'}</td>
          </tr>)}</tbody>
        </table>
      </div> : <Empty icon="doc" title="ยังไม่มีประวัติข้อมูล" sub="เมื่อเริ่มบันทึกเมนู สูตร วัตถุดิบ หรือยอดขาย ระบบจะเก็บประวัติให้เอง"/>}
    </Card>
  </div>;
}


function ActivityLogPageV2(){
  const { db, settings } = useData();
  const lang=settings.uiLang==='en'?'en':'th';
  const isTh=lang==='th';
  const [filter,setFilter]=React.useState('all');
  const rawLogs=(db.activityLogs||[]).slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const translateType=(type)=>{
    const key=String(type||'other');
    const map={
      'media.added': isTh?'เพิ่มรูปภาพ':'Media added',
      'media.updated': isTh?'อัปเดตรูปภาพ':'Media updated',
      'media.deleted': isTh?'ลบรูปภาพ':'Media deleted',
      'menu.created': isTh?'สร้างเมนู':'Menu created',
      'menu.updated': isTh?'แก้ไขเมนู':'Menu updated',
      'menu.deleted': isTh?'ลบเมนู':'Menu deleted',
      'ingredient.created': isTh?'เพิ่มวัตถุดิบ':'Ingredient created',
      'ingredient.updated': isTh?'แก้ไขวัตถุดิบ':'Ingredient updated',
      'ingredient.deleted': isTh?'ลบวัตถุดิบ':'Ingredient deleted',
      'package.created': isTh?'เพิ่มแพ็กเกจ':'Package created',
      'package.updated': isTh?'แก้ไขแพ็กเกจ':'Package updated',
      'package.deleted': isTh?'ลบแพ็กเกจ':'Package deleted',
      'batch.created': isTh?'สร้างสูตรฐาน':'Batch created',
      'batch.updated': isTh?'แก้ไขสูตรฐาน':'Batch updated',
      'batch.deleted': isTh?'ลบสูตรฐาน':'Batch deleted',
      'sales.imported': isTh?'นำเข้ายอดขาย':'Sales imported',
      'data.imported': isTh?'นำเข้าข้อมูล':'Data imported',
      'data.exported': isTh?'ส่งออกข้อมูล':'Data exported',
      'settings.updated': isTh?'แก้ไขตั้งค่า':'Settings updated',
      'other': isTh?'อื่นๆ':'Other'
    };
    return map[key] || key;
  };
  const logs=rawLogs.map(l=>({...l,_typeLabel:translateType(l.type)}));
  const types=[...new Set(logs.map(l=>String(l.type||'other')).filter(Boolean))].slice(0,80);
  const rows=logs.filter(l=>filter==='all'||l.type===filter).slice(0,200);
  const fmtTs=(iso)=>{
    if(!iso) return '–';
    const d=new Date(iso);
    if(isNaN(d)) return String(iso);
    return d.toLocaleString(isTh?'th-TH':'en-GB',{dateStyle:'medium',timeStyle:'short'});
  };
  const toneOf=t=>{
    if(/deleted|reset/i.test(t)) return 'red';
    if(/created|imported|media/i.test(t)) return 'green';
    if(/updated|saved/i.test(t)) return 'blue';
    return 'gray';
  };
  return <div className="view-enter" style={{display:'grid',gap:18}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}} className="r-2col">
      <Stat label={isTh?'เหตุการณ์ทั้งหมด':'Total events'} value={fmt(logs.length)} icon="doc" sub={isTh?'เก็บข้อมูลสูงสุดประมาณ 1,200 รายการ':'Keeps about 1,200 recent events'}/>
      <Stat label={isTh?'ประเภทเหตุการณ์':'Event types'} value={fmt(types.length)} icon="layers" sub={isTh?'ใช้แยกงานให้ AI วิเคราะห์ย้อนหลัง':'Used to group AI analysis later'}/>
      <Stat label={isTh?'ล่าสุด':'Latest'} value={logs[0]?fmtTs(logs[0].createdAt).split(',')[0]:'–'} icon="calendar" sub={logs[0]?logs[0]._typeLabel:(isTh?'ยังไม่มีประวัติ':'No activity yet')}/>
    </div>
    <Card>
      <SectionTitle sub={isTh?'ดูว่าใคร/อะไรเปลี่ยนข้อมูลเมื่อไร เพื่อเตรียมข้อมูลให้ AI วิเคราะห์จากเหตุการณ์จริง':'See what changed and when, so AI can analyze real operational events'}>{isTh?'ประวัติข้อมูล':'Activity history'}</SectionTitle>
      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:14,flexWrap:'wrap'}}>
        <div style={{minWidth:260}}>
          <Select value={filter} onChange={e=>setFilter(e.target.value)} options={[{value:'all',label:isTh?'ทุกประเภท':'All types'}, ...types.map(t=>({value:t,label:translateType(t)}))]}/>
        </div>
        <Badge tone="gray">{isTh?'แสดง ':'Showing '}{fmt(rows.length)} {isTh?'รายการล่าสุด':'latest items'}</Badge>
      </div>
      {rows.length ? <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13.5,minWidth:720}}>
          <thead><tr style={{color:'var(--ink-3)',borderBottom:'1px solid var(--line)'}}>
            <th style={{textAlign:'left',padding:'10px 12px'}}>{isTh?'เวลา':'Time'}</th>
            <th style={{textAlign:'left',padding:'10px 12px'}}>{isTh?'ประเภท':'Type'}</th>
            <th style={{textAlign:'left',padding:'10px 12px'}}>{isTh?'ข้อมูล':'Data'}</th>
            <th style={{textAlign:'left',padding:'10px 12px'}}>{isTh?'รายละเอียด':'Details'}</th>
          </tr></thead>
          <tbody>{rows.map(l=><tr key={l.id} style={{borderBottom:'1px solid var(--line-2)'}}>
            <td style={{padding:'11px 12px',whiteSpace:'nowrap'}}>{fmtTs(l.createdAt)}</td>
            <td style={{padding:'11px 12px'}}><Badge tone={toneOf(l.type)}>{l._typeLabel}</Badge></td>
            <td style={{padding:'11px 12px',color:'var(--ink-2)'}}>{l.entityType||'system'} {l.entityId?`• ${l.entityId}`:''}</td>
            <td style={{padding:'11px 12px',fontWeight:600}}>{l.note||'–'}</td>
          </tr>)}</tbody>
        </table>
      </div> : <Empty icon="doc" title={isTh?'ยังไม่มีประวัติข้อมูล':'No activity history yet'} sub={isTh?'เมื่อเริ่มบันทึกเมนู สูตร วัตถุดิบ หรือยอดขาย ระบบจะเก็บประวัติให้อัตโนมัติ':'Once menus, recipes, ingredients, or sales are updated, the app will log the activity automatically'}/>}
    </Card>
  </div>;
}


// ---------- Integration / external data mapping ----------
function IntegrationPage(){
  const { db, settings } = useData();
  const lang=settings.uiLang==='en'?'en':'th';
  const isTh=lang==='th';
  const shopCode=(settings.supabaseShopCode||settings.shopCode||'jebar').trim()||'jebar';
  const supabaseUrl=(settings.supabaseUrl||window.SUPABASE_DEFAULT_URL||'').trim();
  const docs=[
    {label:isTh?'คู่มือเชื่อม OPS':'OPS Alignment', file:'JEBAR_DATA_OPS_ALIGNMENT.md', note:isTh?'เจ้าของข้อมูล ทิศทางการซิงก์ และกติกา master data':'Owner, sync direction, and master-data rules'},
    {label:isTh?'สัญญา API สำหรับแอปร้านเค้ก':'OPS API Contract', file:'OPS_API_CONTRACT_JEBAR.md', note:isTh?'สิ่งที่อีกแอปต้องอ่าน เขียน และห้ามทับใน JEBAR DATA':'What the cake/OPS app must read, write, and never overwrite in JEBAR DATA'},
    {label:isTh?'คู่มือ Direct Supabase API':'Direct Supabase API', file:'JEBAR_DIRECT_SUPABASE_API.md', note:isTh?'วิธีให้อีกแอปอ่าน jebar_app_state ตรง':'How another app should read jebar_app_state directly'},
    {label:isTh?'ข้อความส่งทีม OPS':'OPS Handoff Message', file:'OPS_TEAM_HANDOFF_MESSAGE.txt', note:isTh?'ข้อความสั้นพร้อมส่งให้ทีมแอป OPS':'Short message ready to send to the OPS app team'},
    {label:isTh?'เช็กลิสต์ Deploy HR vs DATA':'HR vs DATA Deploy', file:'DEPLOY_CHECKLIST_HR_DATA.md', note:isTh?'กันอัป HR ผิดไป DATA หรืออัป DATA ผิดไป HR':'Checklist to avoid uploading HR and DATA to the wrong project'},
    {label:isTh?'แผนผังที่เก็บข้อมูล':'Data Storage Map', file:'DATA_STORAGE_MAP.md', note:isTh?'local key, ตารางออนไลน์, image bucket และ stock zones':'Local keys, online table, image bucket, and stock zones'}
  ];
  const t={
    statsMenus:isTh?'รหัสเมนู':'Menu IDs',
    statsIngredients:isTh?'รหัสวัตถุดิบ':'Ingredient IDs',
    statsTable:isTh?'ตารางออนไลน์':'Online table',
    statsBucket:isTh?'ถังเก็บรูป':'Image bucket',
    statsMenusSub:isTh?'ใช้ db.menus[].id':'Use db.menus[].id',
    statsIngredientsSub:isTh?'ใช้ db.ingredients[].id':'Use db.ingredients[].id',
    statsTableSub:isTh?'Supabase table jebar_app_state':'Supabase table jebar_app_state',
    statsBucketSub:isTh?'เก็บรูปเมนู สูตร และโลโก้':'Stores menu, recipe, and logo images',
    pageTitle:isTh?'การเชื่อมต่อข้อมูล':'Integration',
    pageSub:isTh?'หน้ากลางสำหรับโปรแกรมอื่นที่ต้องใช้รหัสเมนู รหัสวัตถุดิบ สูตร และตำแหน่งรูปภาพ':'Reference page for external programs that need menu IDs, ingredient IDs, recipe links, and image locations',
    localTitle:isTh?'ข้อมูลในเบราว์เซอร์':'Local in browser',
    localDb:isTh?'ฐานข้อมูลหลัก JSON':'main database JSON',
    localSettings:isTh?'ค่าตั้งค่าแอป':'app settings',
    onlineTitle:isTh?'แหล่งข้อมูลกลางออนไลน์':'Online shared source',
    downloadFeed:isTh?'ดาวน์โหลด Master Feed':'Download Master Feed',
    copyJson:isTh?'คัดลอก JSON':'Copy JSON',
    sourceHint:isTh?'แอปภายนอกควรอ่าน 1 แถวจาก <code>jebar_app_state</code> ด้วย <code>shop_code</code> แล้วใช้ field <code>db</code> เป็นข้อมูลหลัก ส่วนรูปให้ใช้ <code>db.mediaAssets</code> คู่กับ bucket <code>jebar-images</code>.':'External programs should read one row from <code>jebar_app_state</code> by <code>shop_code</code>, then use field <code>db</code> as the main source. Images should use <code>db.mediaAssets</code> with bucket <code>jebar-images</code>.',
    docsTitle:isTh?'เอกสารโปรเจกต์':'Project Docs',
    docsSub:isTh?'เปิด ดาวน์โหลด หรือคัดลอกเอกสารกลางของโปรเจกต์จากหน้านี้ได้เลย':'Open, download, or copy the shared project documents directly from this app',
    download:isTh?'ดาวน์โหลด':'Download',
    copy:isTh?'คัดลอก':'Copy',
    dataMapTitle:isTh?'ผังข้อมูล':'Data Map',
    dataMapSub:isTh?'ดูว่าแต่ละชุดข้อมูลเก็บไว้ path ไหน และมี field อะไรบ้าง':'Map each dataset to its path and key fields',
    dataset:isTh?'ชุดข้อมูล':'Dataset',
    path:isTh?'Path':'Path',
    count:isTh?'จำนวน':'Count',
    fields:isTh?'ฟิลด์หลัก':'Main fields',
    guideTitle:isTh?'แนวทางเขียนข้อมูลกลับ':'Write-back Guide',
    guideSub:isTh?'ลำดับแนะนำเวลามีแอปสต๊อกหรือเครื่องมือภายนอกเขียนข้อมูลกลับเข้า JEBAR':'Recommended write-back flow for stock or external tools'
  };
  const masterFeed={
    exportedAt:new Date().toISOString(),
    source:{
      localStorageDbKey:'jebar_db_v1',
      localStorageSettingsKey:'jebar_settings_v1',
      supabaseTable:'jebar_app_state',
      supabaseShopCode:shopCode,
      imageBucket:'jebar-images',
      supabaseUrl:supabaseUrl||null
    },
    menus:(db.menus||[]).map(m=>({id:m.id,name:m.name,category:m.category,type:m.type,status:m.status,priceStore:m.priceStore,priceLine:m.priceLine})),
    ingredients:(db.ingredients||[]).map(i=>({id:i.id,name:i.name,category:i.category,unit:i.unit,costPerUnit:i.costPerUnit,buyPrice:i.buyPrice,buyQty:i.buyQty,yield:i.yield,status:i.status||'active'})),
    packages:(db.packages||[]).map(p=>({id:p.id,name:p.name,type:p.type,unit:p.unit,costPerPiece:p.costPerPiece,buyPrice:p.buyPrice,buyQty:p.buyQty,status:p.status||'active'})),
    batchRecipes:(db.batchRecipes||[]).map(b=>({id:b.id,name:b.name,category:b.category,outputQty:b.outputQty,outputUnit:b.outputUnit,note:b.note||''})),
    recipeBase:(db.recipeBase||[]).map(r=>({menuId:r.menuId,ingId:r.ingId,qty:r.qty,unit:r.unit})),
    recipeBatch:(db.recipeBatch||[]).map(r=>({menuId:r.menuId,batchId:r.batchId,qty:r.qty,unit:r.unit})),
    batchRecipeLines:(db.batchRecipeLines||[]).map(r=>({batchId:r.batchId,ingId:r.ingId,qty:r.qty,unit:r.unit})),
    mediaAssets:(db.mediaAssets||[]).map(a=>({id:a.id,bucket:a.bucket,path:a.path,url:a.url,entityType:a.entityType,entityId:a.entityId,role:a.role,fileName:a.fileName})),
    stockItems:(db.stockItems||[]).map(s=>({id:s.id,refType:s.refType,refId:s.refId,name:s.name,unit:s.unit,status:s.status||'active'})),
    stockLots:(db.stockLots||[]).map(s=>({id:s.id,stockItemId:s.stockItemId,lotCode:s.lotCode,receivedAt:s.receivedAt,qtyIn:s.qtyIn,qtyRemaining:s.qtyRemaining,unitCost:s.unitCost})),
    stockBalances:(db.stockBalances||[]).map(s=>({stockItemId:s.stockItemId,onHand:s.onHand,reserved:s.reserved,available:s.available,lastUpdatedAt:s.lastUpdatedAt})),
    stockMovements:(db.stockMovements||[]).map(s=>({id:s.id,stockItemId:s.stockItemId,movementType:s.movementType,qty:s.qty,unit:s.unit,refType:s.refType,refId:s.refId,createdAt:s.createdAt})),
    purchaseEvents:(db.purchaseEvents||[]).map(s=>({id:s.id,stockItemId:s.stockItemId,qty:s.qty,unitCost:s.unitCost,supplier:s.supplier,receivedAt:s.receivedAt})),
    productionEvents:(db.productionEvents||[]).map(s=>({id:s.id,stockItemId:s.stockItemId,qtyProduced:s.qtyProduced,producedAt:s.producedAt,note:s.note||''})),
    wasteEvents:(db.wasteEvents||[]).map(s=>({id:s.id,stockItemId:s.stockItemId,qty:s.qty,reason:s.reason,createdAt:s.createdAt})),
    integrationInbox:(db.integrationInbox||[]).map(s=>({id:s.id,source:s.source,eventType:s.eventType,status:s.status,createdAt:s.createdAt})),
    integrationOutbox:(db.integrationOutbox||[]).map(s=>({id:s.id,target:s.target,eventType:s.eventType,status:s.status,createdAt:s.createdAt}))
  };
  const copyJson=async()=>{ try{ await navigator.clipboard.writeText(JSON.stringify(masterFeed,null,2)); }catch(e){} };
  const downloadJson=()=>downloadBlob(JSON.stringify(masterFeed,null,2),`jebar-master-feed-${shopCode}.json`,'application/json');
  const downloadDoc=async(file)=>{
    try{
      const res=await fetch(file);
      const text=await res.text();
      downloadBlob(text,file,'text/plain;charset=utf-8');
    }catch(e){}
  };
  const copyDoc=async(file)=>{
    try{
      const res=await fetch(file);
      const text=await res.text();
      await navigator.clipboard.writeText(text);
    }catch(e){}
  };
  const rows=[
    [isTh?'เมนู':'Menus','db.menus',fmt(db.menus.length),'id, name, category, type, priceStore, priceLine'],
    [isTh?'วัตถุดิบ':'Ingredients','db.ingredients',fmt(db.ingredients.length),'id, name, category, unit, costPerUnit'],
    [isTh?'แพ็กเกจ':'Packages','db.packages',fmt(db.packages.length),'id, name, type, unit, costPerPiece'],
    [isTh?'สูตรตรง':'Direct recipes','db.recipeBase',fmt(db.recipeBase.length),'menuId, ingId, qty, unit'],
    [isTh?'สูตรฐานเบเกอรี่':'Batch recipes','db.batchRecipes',fmt(db.batchRecipes.length),'id, name, category, outputQty, outputUnit'],
    [isTh?'ลิงก์เมนูไปสูตรฐาน':'Menu batch links','db.recipeBatch',fmt(db.recipeBatch.length),'menuId, batchId, qty, unit'],
    [isTh?'รูปภาพ':'Images','db.mediaAssets',fmt(db.mediaAssets.length),'bucket, path, url, entityType, entityId'],
    [isTh?'รายการสต๊อก':'Stock items','db.stockItems',fmt((db.stockItems||[]).length),'id, refType, refId, name, unit, status'],
    [isTh?'ล็อตสต๊อก':'Stock lots','db.stockLots',fmt((db.stockLots||[]).length),'id, stockItemId, lotCode, qtyIn, qtyRemaining, unitCost'],
    [isTh?'ยอดคงเหลือสต๊อก':'Stock balances','db.stockBalances',fmt((db.stockBalances||[]).length),'stockItemId, onHand, reserved, available, lastUpdatedAt'],
    [isTh?'ความเคลื่อนไหวสต๊อก':'Stock movements','db.stockMovements',fmt((db.stockMovements||[]).length),'id, stockItemId, movementType, qty, refType, refId'],
    [isTh?'Integration inbox':'Integration inbox','db.integrationInbox',fmt((db.integrationInbox||[]).length),'id, source, eventType, status, createdAt'],
    [isTh?'Integration outbox':'Integration outbox','db.integrationOutbox',fmt((db.integrationOutbox||[]).length),'id, target, eventType, status, createdAt']
  ];
  return <div className="view-enter" style={{display:'grid',gap:18}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}} className="r-2col">
      <Stat label={t.statsMenus} value={fmt(db.menus.length)} icon="cup" sub={t.statsMenusSub}/>
      <Stat label={t.statsIngredients} value={fmt(db.ingredients.length)} icon="leaf" sub={t.statsIngredientsSub}/>
      <Stat label={t.statsTable} value="1" icon="cloud" sub={t.statsTableSub}/>
      <Stat label={t.statsBucket} value="jebar-images" icon="box" sub={t.statsBucketSub}/>
    </div>
    <Card>
      <SectionTitle sub={t.pageSub}>{t.pageTitle}</SectionTitle>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}} className="r-stack">
        <div style={{display:'grid',gap:12}}>
          <div style={{background:'var(--surface-2)',borderRadius:12,padding:'14px 16px'}}>
            <div style={{fontSize:12,color:'var(--ink-3)',marginBottom:6}}>{t.localTitle}</div>
            <div style={{fontSize:14.5,fontWeight:700}}>localStorage</div>
            <div style={{fontSize:12.5,color:'var(--ink-2)',marginTop:6,lineHeight:1.7}}>
              <div><code>jebar_db_v1</code> = {t.localDb}</div>
              <div><code>jebar_settings_v1</code> = {t.localSettings}</div>
            </div>
          </div>
          <div style={{background:'var(--surface-2)',borderRadius:12,padding:'14px 16px'}}>
            <div style={{fontSize:12,color:'var(--ink-3)',marginBottom:6}}>{t.onlineTitle}</div>
            <div style={{fontSize:14.5,fontWeight:700}}>Supabase</div>
            <div style={{fontSize:12.5,color:'var(--ink-2)',marginTop:6,lineHeight:1.7}}>
              <div>Table: <code>jebar_app_state</code></div>
              <div>shop_code: <code>{shopCode}</code></div>
              <div>Bucket: <code>jebar-images</code></div>
              {supabaseUrl&&<div>URL: <code>{supabaseUrl}</code></div>}
            </div>
          </div>
        </div>
        <div style={{display:'grid',gap:10}}>
          <Button icon="download" onClick={downloadJson}>{t.downloadFeed}</Button>
          <Button variant="secondary" icon="doc" onClick={copyJson}>{t.copyJson}</Button>
          <div style={{fontSize:12.5,color:'var(--ink-3)',lineHeight:1.7,background:'var(--chip)',borderRadius:12,padding:'12px 14px'}} dangerouslySetInnerHTML={{__html:t.sourceHint}} />
        </div>
      </div>
    </Card>
    <Card>
      <SectionTitle sub={t.docsSub}>{t.docsTitle}</SectionTitle>
      <div style={{display:'grid',gap:12}}>
        {docs.map(doc=><div key={doc.file} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:10,alignItems:'center',background:'var(--surface-2)',borderRadius:12,padding:'14px 16px'}} className="r-stack">
          <div>
            <div style={{fontSize:14.5,fontWeight:700}}>{doc.label}</div>
            <div style={{fontSize:12.5,color:'var(--ink-2)',marginTop:4}}>{doc.note}</div>
            <div style={{fontSize:12,color:'var(--ink-3)',marginTop:6}}><code>{doc.file}</code></div>
          </div>
          <Button variant="secondary" icon="download" onClick={()=>downloadDoc(doc.file)}>{t.download}</Button>
          <Button variant="soft" icon="doc" onClick={()=>copyDoc(doc.file)}>{t.copy}</Button>
        </div>)}
      </div>
    </Card>
    <Card>
      <SectionTitle sub={t.dataMapSub}>{t.dataMapTitle}</SectionTitle>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13.5,minWidth:760}}>
          <thead><tr style={{color:'var(--ink-3)',borderBottom:'1px solid var(--line)'}}>
            <th style={{textAlign:'left',padding:'10px 12px'}}>{t.dataset}</th>
            <th style={{textAlign:'left',padding:'10px 12px'}}>{t.path}</th>
            <th style={{textAlign:'left',padding:'10px 12px'}}>{t.count}</th>
            <th style={{textAlign:'left',padding:'10px 12px'}}>{t.fields}</th>
          </tr></thead>
          <tbody>{rows.map(r=><tr key={r[1]} style={{borderBottom:'1px solid var(--line-2)'}}>
            <td style={{padding:'11px 12px',fontWeight:700}}>{r[0]}</td>
            <td style={{padding:'11px 12px'}}><code>{r[1]}</code></td>
            <td style={{padding:'11px 12px'}}>{r[2]}</td>
            <td style={{padding:'11px 12px',color:'var(--ink-2)'}}>{r[3]}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </Card>
    <Card>
      <SectionTitle sub={t.guideSub}>{t.guideTitle}</SectionTitle>
      <div style={{display:'grid',gap:10,fontSize:13.5,color:'var(--ink-2)'}}>
        <div>{isTh?'1. อ่าน 1 แถวจาก ':'1. Read one row from '}<code>jebar_app_state</code>{isTh?' ด้วย ':' by '}<code>shop_code</code></div>
        <div>{isTh?'2. ใช้ ':'2. Use '}<code>db.menus</code>, <code>db.ingredients</code>, <code>db.batchRecipes</code>, and <code>db.mediaAssets</code>{isTh?' เป็น reference map':' as reference maps'}</div>
        <div>{isTh?'3. สร้าง master link ของสต๊อกใน ':'3. Create stock master links in '}<code>db.stockItems</code>{isTh?' โดยใช้ ':' using '}<code>refType</code> and <code>refId</code>{isTh?' เพื่อชี้กลับไปยัง menu, ingredient, package หรือ batch recipe':' to point at menu, ingredient, package, or batch recipe records'}</div>
        <div>{isTh?'4. บันทึกยอดคงเหลือรวมไว้ใน ':'4. Save current stock summary in '}<code>db.stockBalances</code>{isTh?' และระดับล็อตไว้ใน ':' and lot-level stock in '}<code>db.stockLots</code></div>
        <div>{isTh?'5. เก็บรายการเคลื่อนไหวต่อท้ายใน ':'5. Append transactions to '}<code>db.stockMovements</code>, <code>db.purchaseEvents</code>, <code>db.productionEvents</code>, and <code>db.wasteEvents</code></div>
        <div>{isTh?'6. ถ้ามีอีกแอปส่งงานเข้าออกกับ JEBAR ให้ใช้ ':'6. If another program exchanges jobs with JEBAR, use '}<code>db.integrationInbox</code> and <code>db.integrationOutbox</code></div>
        <div>{isTh?'7. เซฟ object ล่าสุดทั้งก้อนไปกลับเข้า field ':'7. Save the full updated object back into field '}<code>db</code>{isTh?' ของ ':' on '}<code>jebar_app_state</code></div>
      </div>
    </Card>
  </div>;
}

// ---------- Toast ----------
function Toast(){
  const { toast, setToast } = useData();
  if(!toast) return null;
  const ok=toast.kind!=='err';
  return <div style={{position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',zIndex:200,
    background:ok?'rgba(30,32,34,.95)':'var(--red)',color:'#fff',padding:'12px 20px',borderRadius:13,
    fontSize:14,fontWeight:500,boxShadow:'var(--shadow-lg)',backdropFilter:'blur(10px)',display:'flex',alignItems:'center',gap:9,
    animation:'fadeUp .3s'}}>
    <Icon name={ok?'check':'close'} size={17}/>{toast.msg}
    {toast.action && <button onClick={()=>{ toast.action.fn(); setToast&&setToast(null); }}
      style={{marginLeft:6,padding:'5px 12px',borderRadius:9,background:'rgba(255,255,255,.18)',color:'#fff',fontWeight:700,fontSize:13}}>{toast.action.label}</button>}
  </div>;
}

// ---------- Shell ----------
function getRuntimeMode(){
  try{
    const qs = new URLSearchParams(window.location.search);
    const qMode = (qs.get('mode') || qs.get('role') || '').toLowerCase();
    if(['employee','staff','emp'].includes(qMode)) return 'employee';
    if(['owner','admin'].includes(qMode)) return 'owner';
    const saved = (localStorage.getItem('jebar_runtime_mode') || '').toLowerCase();
    if(saved === 'employee' || saved === 'owner') return saved;
  }catch(e){}
  return 'owner';
}
function ownerOnlyRoute(id){
  return ['ai','master','integration','settings','logs'].includes(id);
}
function getNav(lang, mode='owner'){
  const th=lang==='th';
  const nav = [
    {group:th?'ภาพรวม':'Overview',items:[{id:'dashboard',label:th?'แดชบอร์ด':'Dashboard',icon:'dashboard'}]},
    {group:'AI',items:[{id:'ai',label:th?'AI ผู้ช่วยบริหาร':'AI Advisor',icon:'chart'}]},
    {group:th?'ยอดขาย':'Sales',items:[
      {id:'sales',label:th?'ยอดขายรายวัน':'Daily Sales',icon:'sales'},
      {id:'analytics',label:th?'วิเคราะห์ยอดขาย':'Sales Analytics',icon:'chart'},
      {id:'products',label:th?'วิเคราะห์สินค้า':'Product Analysis',icon:'target'},
      {id:'insights',label:th?'วิเคราะห์เชิงลึก':'Deep Insights',icon:'trend'}
    ]},
    {group:th?'เมนู & ต้นทุน':'Menu & Cost',items:[
      {id:'menu',label:th?'เมนู & สูตร':'Menu & Recipes',icon:'cup'},
      {id:'batch',label:th?'สูตรฐานเบเกอรี่':'Bakery Base',icon:'layers'},
      {id:'master',label:th?'ข้อมูลหลัก':'Master Data',icon:'layers'}
    ]},
    {group:th?'รายงาน':'Reports',items:[
      {id:'reports',label:th?'รายงาน / พิมพ์':'Reports / Print',icon:'doc'},
      {id:'logs',label:th?'ประวัติข้อมูล':'Activity Log',icon:'doc'},
      {id:'integration',label:th?'การเชื่อมต่อ':'Integration',icon:'cloud'}
    ]},
  ];
  if(mode !== 'employee') return nav;
  return nav.map(group=>({...group,items:group.items.filter(item=>!ownerOnlyRoute(item.id))})).filter(group=>group.items.length);
}
function getTitles(lang){
  const th=lang==='th';
  return {
    dashboard:[th?'แดชบอร์ด':'Dashboard',th?'ภาพรวมผลประกอบการแบบเรียลไทม์':'Real-time business overview'],
    sales:[th?'ยอดขายรายวัน':'Daily Sales',th?'ติดตามรายได้และจำนวนบิลรายวัน':'Track revenue and bills by day'],
    ai:[th?'AI ผู้ช่วยบริหาร':'AI Advisor',th?'วิเคราะห์ข้อมูลร้าน แนะนำแผน และหาช่องโหว่ของข้อมูล':'Analyze store data, suggest plans, and spot gaps'],
    analytics:[th?'วิเคราะห์ยอดขาย':'Sales Analytics',th?'สรุปยอดขายและกำไรรายวัน รายเดือน รายปี':'Daily, monthly, yearly sales and profit summary'],
    products:[th?'วิเคราะห์สินค้า':'Product Analysis',th?'ดู GP, margin และผลงานของแต่ละเมนู':'See GP, margin, and menu performance'],
    insights:[th?'วิเคราะห์เชิงลึก':'Deep Insights',th?'เมนูขายดี ช่วงเวลาพีค และรูปแบบเชิงลึก':'Top products, peak hours, and detailed patterns'],
    menu:[th?'เมนู & สูตร':'Menu & Recipes',th?'จัดการเมนู สูตร และคำนวณ GP อัตโนมัติ':'Manage menu, formulas, and automatic GP'],
    batch:[th?'สูตรฐานเบเกอรี่':'Bakery Base',th?'จัดการสูตรเนื้อเค้ก ขนมปัง ครีม และไส้':'Manage cake, bread, cream, and filling batch formulas'],
    master:[th?'ข้อมูลหลัก':'Master Data',th?'วัตถุดิบ แพ็กเกจ ออปชัน และค่าใช้จ่าย':'Ingredients, packages, options, and expenses'],
    reports:[th?'รายงาน':'Reports',th?'พิมพ์หรือส่งออกรายงานเป็น PDF':'Print or export reports as PDF'],
    logs:[th?'ประวัติข้อมูล':'Activity Log',th?'ติดตามการเปลี่ยนแปลงสำคัญและกิจกรรม AI':'Track important changes and AI activity'],
    integration:[th?'การเชื่อมต่อ':'Integration',th?'ตำแหน่งข้อมูล ตารางออนไลน์ image bucket และ master feed สำหรับโปรแกรมภายนอก':'Data paths, online table, image bucket, and master feed for external programs'],
    settings:[th?'ตั้งค่า':'Settings',th?'แบรนด์ การแสดงผล และค่าการเงิน':'Brand, display, and financial settings']
  };
}
const APP_BUILD_VERSION = '2026.06.12-data14';
const APP_BUILD_LABEL = 'Build ' + APP_BUILD_VERSION;

function Shell(){
  const { settings:cfg, setSettings } = useData();
  const runtimeMode = React.useMemo(()=>getRuntimeMode(),[]);
  const [route,setRoute]=React.useState('dashboard');
  const [io,setIo]=React.useState(false);
  const [navOpen,setNavOpen]=React.useState(false);
  const [isMobile,setIsMobile]=React.useState(()=>typeof window!=='undefined'&&window.innerWidth<860);
  React.useEffect(()=>{ const h=()=>setIsMobile(window.innerWidth<860); window.addEventListener('resize',h); return ()=>window.removeEventListener('resize',h); },[]);
  React.useEffect(()=>{ try{ localStorage.setItem('jebar_runtime_mode', runtimeMode); }catch(e){} },[runtimeMode]);
  const go=(r)=>{ setRoute(r); setNavOpen(false); };
  const lang=cfg.uiLang==='en'?'en':'th';
  const nav=getNav(lang, runtimeMode);
  const titles=getTitles(lang);
  const routeMap={dashboard:Dashboard,ai:AIAdvisor,sales:Sales,analytics:SalesAnalytics,products:ProductAnalysis,insights:DeepAnalytics,menu:MenuView,batch:BakeryBatchView,master:Master,reports:Reports,logs:ActivityLogPageV2,integration:IntegrationPage,settings:SettingsPage};
  const allowedRoutes = nav.flatMap(g=>g.items.map(it=>it.id));
  const safeRoute = allowedRoutes.includes(route) ? route : (allowedRoutes[0] || 'dashboard');
  React.useEffect(()=>{ if(route!==safeRoute) setRoute(safeRoute); },[route,safeRoute]);
  const [title,sub]=titles[safeRoute];

  const View=routeMap[safeRoute];
  const zoom=cfg.displaySize||1;
  const showNav = !isMobile || navOpen;

  return <div style={{display:'flex',height:'100vh',overflow:'hidden'}}>
    {/* mobile backdrop */}
    {isMobile && navOpen && <div className="no-print" onClick={()=>setNavOpen(false)}
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,.35)',backdropFilter:'blur(2px)',zIndex:40,animation:'fadeIn .2s'}}/>}
    {/* Sidebar */}
    {showNav && <aside className="no-print" style={{width:248,flexShrink:0,background:'var(--sidebar)',backdropFilter:'blur(20px)',
      borderRight:'1px solid var(--line)',display:'flex',flexDirection:'column',padding:'18px 14px',
      ...(isMobile?{position:'fixed',top:0,bottom:0,left:0,zIndex:50,boxShadow:'var(--shadow-lg)',animation:'slideInLeft .25s cubic-bezier(.22,.61,.36,1)'}:{})}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'4px 4px 18px'}}>
        <button onClick={()=>go('dashboard')} style={{display:'flex',alignItems:'center',gap:10,background:'none',textAlign:'left',flex:1,minWidth:0}}>
          <img src={cfg.logo} alt="logo" style={{height:46,maxWidth:150,objectFit:'contain',...(cfg.theme==='dark'?{background:'#fff',borderRadius:9,padding:'5px 9px'}:{})}}/>
          {cfg.shopTagline && <div style={{borderLeft:'1px solid var(--line)',paddingLeft:10}}>
            <div style={{fontSize:10.5,color:'var(--ink-3)',lineHeight:1.3}}>ระบบข้อมูลร้าน</div></div>}
        </button>
        {isMobile && <IconBtn name="close" onClick={()=>setNavOpen(false)}/>}
      </div>
      <nav style={{flex:1,overflowY:'auto'}}>
        {nav.map(g=><div key={g.group} style={{marginBottom:18}}>
          <div style={{fontSize:11,fontWeight:600,color:'var(--ink-3)',padding:'0 10px 7px',textTransform:'uppercase',letterSpacing:'.4px'}}>{g.group}</div>
          {g.items.map(it=>{ const active=safeRoute===it.id;
            return <button key={it.id} onClick={()=>go(it.id)} style={{width:'100%',display:'flex',alignItems:'center',gap:11,
              padding:'9px 10px',borderRadius:10,marginBottom:2,fontSize:14.5,fontWeight:active?600:500,
              color:active?'var(--accent)':'var(--ink)',background:active?'var(--accent-soft)':'transparent',transition:'background .15s'}}
              onMouseEnter={e=>{if(!active)e.currentTarget.style.background='var(--hover)';}}
              onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent';}}>
              <Icon name={it.icon} size={19} color={active?'var(--accent)':'var(--ink-2)'}/>{it.label}</button>;
          })}
        </div>)}
      </nav>
      <div style={{display:'flex',flexDirection:'column',gap:2,borderTop:'1px solid var(--line)',paddingTop:10}}>
        <button onClick={()=>{setIo(true);setNavOpen(false);}} style={{display:'flex',alignItems:'center',gap:11,padding:'9px 10px',borderRadius:10,fontSize:14,color:'var(--ink-2)',fontWeight:500}}
          onMouseEnter={e=>e.currentTarget.style.background='var(--hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <Icon name="upload" size={18}/>นำเข้า / ส่งออก</button>
        {runtimeMode!=='employee' && <button onClick={()=>go('settings')} style={{display:'flex',alignItems:'center',gap:11,padding:'9px 10px',borderRadius:10,fontSize:14,
          fontWeight:safeRoute==='settings'?600:500,color:safeRoute==='settings'?'var(--accent)':'var(--ink-2)',background:safeRoute==='settings'?'var(--accent-soft)':'transparent'}}
          onMouseEnter={e=>{if(safeRoute!=='settings')e.currentTarget.style.background='var(--hover)';}} onMouseLeave={e=>{if(safeRoute!=='settings')e.currentTarget.style.background='transparent';}}>
          <Icon name="settings" size={18} color={safeRoute==='settings'?'var(--accent)':'var(--ink-2)'}/>ตั้งค่า</button>}
      </div>
    </aside>}

    {/* Main */}
    <main style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',minWidth:0}}>
      <header className="no-print" style={{position:'sticky',top:0,zIndex:10,background:'var(--header)',backdropFilter:'blur(20px)',
        borderBottom:'1px solid var(--line-2)',padding:isMobile?'14px 18px':'16px 36px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>
          {isMobile && <button onClick={()=>setNavOpen(true)} style={{width:40,height:40,borderRadius:11,display:'grid',placeItems:'center',background:'var(--chip)',color:'var(--ink)',flexShrink:0}}>
            <Icon name="menu" size={20}/></button>}
          <div style={{minWidth:0}}><h1 style={{fontSize:isMobile?19:24,fontWeight:700,letterSpacing:'-.5px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{title}</h1>
          {!isMobile && <p style={{fontSize:13.5,color:'var(--ink-2)',marginTop:2}}>{sub}</p>}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:isMobile?8:12,flexShrink:0,flexWrap:'wrap'}}>
          <Segmented
            size="sm"
            value={lang}
            onChange={v=>setSettings({...cfg,uiLang:v})}
            options={[{value:'th',label:'TH'},{value:'en',label:'EN'}]}
          />
          <Badge tone={runtimeMode==='employee'?'orange':'blue'}>{runtimeMode==='employee'?(lang==='th'?'โหมดพนักงาน':'Employee mode'):(lang==='th'?'โหมดเจ้าของร้าน':'Owner mode')}</Badge>
          <BranchPicker/>
          <SheetSync/>
          {runtimeMode!=='employee' && window.SupabaseSync && <SupabaseSync/>}
          <AlertBell go={go}/>
          {!isMobile && <div style={{textAlign:'right'}}><div style={{fontSize:15,fontWeight:700,color:'var(--ink)',letterSpacing:'-.2px'}}>{cfg.shopName}</div>
          <div style={{fontSize:11.5,color:'var(--ink-3)'}}>{cfg.shopTagline}</div></div>}
        </div>
      </header>
      <BackupBanner/>
      <div style={{padding:isMobile?'18px 16px 60px':'28px 36px 60px',maxWidth:1180,width:'100%',margin:'0 auto',flex:1,zoom}} key={safeRoute}>
        <ErrorBoundary routeKey={safeRoute}><View go={go}/></ErrorBoundary>
      </div>
    </main>

    <IOModal open={io} onClose={()=>setIo(false)}/>
    <Toast/>
    <div className="no-print" style={{
      position:'fixed',
      right:12,
      bottom:10,
      zIndex:30,
      padding:'6px 10px',
      borderRadius:999,
      background:'rgba(255,255,255,.82)',
      border:'1px solid var(--line)',
      boxShadow:'var(--shadow-sm)',
      fontSize:11.5,
      color:'var(--ink-3)',
      backdropFilter:'blur(10px)'
    }}>
      {APP_BUILD_LABEL}
    </div>
  </div>;
}

class ErrorBoundary extends React.Component{
  constructor(p){ super(p); this.state={err:null}; }
  static getDerivedStateFromError(err){ return {err}; }
  componentDidUpdate(pp){ if(pp.routeKey!==this.props.routeKey && this.state.err) this.setState({err:null}); }
  render(){
    if(this.state.err) return <div style={{padding:'40px 0'}}><Empty icon="close" title="เกิดข้อผิดพลาดในหน้านี้"
      sub={String(this.state.err.message||this.state.err)} action={<Button onClick={()=>this.setState({err:null})}>ลองใหม่</Button>}/></div>;
    return this.props.children;
  }
}

function Gate(){
  const { settings } = useData();
  const [unlocked,setUnlocked]=React.useState(()=>sessionStorage.getItem('jebar_unlocked')==='1');
  const locked = settings.pinEnabled && String(settings.pin||'').length>=4 && !unlocked;
  if(locked) return <LockScreen onUnlock={()=>{ sessionStorage.setItem('jebar_unlocked','1'); setUnlocked(true); }}/>;
  return <Shell/>;
}

function App(){ return <DataProvider><Gate/></DataProvider>; }
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
