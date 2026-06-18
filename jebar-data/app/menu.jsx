// ============ Menu + Recipe / Cost ============
const MENU_PREFIX={Beverage:'BEV',Food:'FOOD',Bakery:'BKY',Pastry:'PST',Dessert:'DST'};
function genMenuId(db,cat){
  const p=MENU_PREFIX[cat]||'MNU';
  let max=0; (db.menus||[]).forEach(m=>{ const mm=(m.id||'').match(new RegExp('^'+p+'(\\d+)$')); if(mm) max=Math.max(max,+mm[1]); });
  return p+String(max+1).padStart(3,'0');
}
function stableRecipeRows(rows, keys){
  return (rows||[]).map(row=>{
    const out={};
    keys.forEach(k=>{ out[k]=row[k]??''; });
    return out;
  });
}
function confirmUnsaved(message){
  return window.confirm(message || 'ยังไม่ได้บันทึก ต้องการออกโดยไม่บันทึกหรือไม่?');
}

function MenuModal({ open, onClose, initial }){
  const { db, upsert, renameId, flash, settings } = useData();
  const markup=settings.lineMarkup??0.45;
  const [f,setF]=React.useState({});
  const [idTouched,setIdTouched]=React.useState(false);
  const [lineTouched,setLineTouched]=React.useState(false);
  React.useEffect(()=>{ if(open){
    if(initial){ setF({...initial}); setIdTouched(true); setLineTouched(true); }
    else { const c=db.categories[0]||'Beverage'; setF({id:genMenuId(db,c),name:'',category:c,type:db.types[0]||'Coffee',priceStore:'',priceLine:'',status:'ขาย'}); setIdTouched(false); setLineTouched(false); }
  } },[open,initial]);
  const setCat=v=>setF(p=>({...p,category:v, id: idTouched?p.id:genMenuId(db,v)}));
  const setStore=v=>setF(p=>({...p,priceStore:v, priceLine: lineTouched?p.priceLine:(v?String(Math.round(+v*(1+markup))):'')}));
  const submit=()=>{
    if(!f.name){ flash('กรอกชื่อเมนู','err'); return; }
    if(dupName(db.menus, f.name, 'id', initial?initial.id:null)){ flash('มีเมนูชื่อนี้แล้ว','err'); return; }
    const id=(f.id||'').trim()||genMenuId(db,f.category);
    if(initial){
      if(id!==initial.id){
        if(db.menus.some(m=>m.id===id)){ flash('รหัสนี้มีอยู่แล้ว ลองรหัสอื่น','err'); return; }
        renameId('menus', initial.id, id);
      }
    } else if(db.menus.some(m=>m.id===id)){ flash('รหัสนี้มีอยู่แล้ว ลองแก้รหัส','err'); return; }
    upsert('menus',{...f,id,priceStore:+f.priceStore||0,priceLine:+f.priceLine||0});
    flash('บันทึกเมนูแล้ว'); onClose();
  };
  return <Modal open={open} onClose={onClose} title={initial?'แก้ไขเมนู':'เพิ่มเมนูใหม่'} width={520}
    footer={<><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button onClick={submit} icon="check">บันทึก</Button></>}>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <Field label="ชื่อเมนู"><Input autoFocus value={f.name||''} placeholder="เช่น อเมริกาโน่เย็น" onChange={e=>setF({...f,name:e.target.value})}/></Field>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Field label="ราคาหน้าร้าน (฿)"><Input type="number" inputMode="decimal" value={f.priceStore||''} placeholder="0" onChange={e=>setStore(e.target.value)}/></Field>
        <Field label="ราคา LINE MAN (฿)" hint={!lineTouched&&f.priceStore?`แนะนำอัตโนมัติ +${fmtPct(markup,0)}`:undefined}>
          <Input type="number" inputMode="decimal" value={f.priceLine||''} placeholder="0" onChange={e=>{setLineTouched(true);setF({...f,priceLine:e.target.value});}}/></Field>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        <Field label="หมวดหมู่"><TypeSelect value={f.category} options={db.categories} coll="categories" onChange={setCat}/></Field>
        <Field label="ประเภท"><TypeSelect value={f.type} options={db.types} coll="types" onChange={v=>setF({...f,type:v})}/></Field>
        <Field label="สถานะ"><Select value={f.status} options={['ขาย','หยุดขาย']} onChange={e=>setF({...f,status:e.target.value})}/></Field>
      </div>
      <Field label="รหัสเมนู" hint={initial?'แก้ได้ — ระบบจะอัปเดตสูตรที่เชื่อมอยู่ให้อัตโนมัติ':'สร้างให้อัตโนมัติ — แก้เองได้ถ้าต้องการ'}>
        <Input value={f.id||''} placeholder="อัตโนมัติ" onChange={e=>{setIdTouched(true);setF({...f,id:e.target.value.toUpperCase()});}}/></Field>
    </div>
  </Modal>;
}

function RecipeEditor({ open, onClose, menu }){
  const { db, setDb, settings, addMediaAsset, logActivity, flash } = useData();
  const [base,setBase]=React.useState([]);
  const [batch,setBatch]=React.useState([]);
  const [pkg,setPkg]=React.useState([]);
  const [opt,setOpt]=React.useState([]);
  const [photoPreview,setPhotoPreview]=React.useState('');
  const [photoOpen,setPhotoOpen]=React.useState(false);
  const [photoName,setPhotoName]=React.useState('');
  const [photoBusy,setPhotoBusy]=React.useState(false);
  const [photoErr,setPhotoErr]=React.useState('');
  const [photoDraft,setPhotoDraft]=React.useState(null);
  const [aiEndpoint,setAiEndpoint]=React.useState(()=>localStorage.getItem('jebar_ai_recipe_endpoint')||'');
  const initialSnap=React.useRef('');
  const snapRecipe=(baseRows,batchRows,pkgRows,optRows)=>JSON.stringify({
    base:stableRecipeRows(baseRows,['ingId','qty','unit']),
    batch:stableRecipeRows(batchRows,['batchId','qty','unit']),
    pkg:stableRecipeRows(pkgRows,['pkgId','qty','unit']),
    opt:stableRecipeRows(optRows,['optionId','ingId','qty','unit'])
  });
  React.useEffect(()=>{ if(open&&menu){
    const nextBase=db.recipeBase.filter(r=>r.menuId===menu.id).map(r=>({...r,_uid:Math.random()}));
    const nextBatch=(db.recipeBatch||[]).filter(r=>r.menuId===menu.id).map(r=>({...r,_uid:Math.random()}));
    const nextPkg=db.recipePackage.filter(r=>r.menuId===menu.id).map(r=>({...r,_uid:Math.random()}));
    const nextOpt=db.recipeOption.filter(r=>r.menuId===menu.id).map(r=>({...r,_uid:Math.random()}));
    setBase(nextBase);
    setBatch(nextBatch);
    setPkg(nextPkg);
    setOpt(nextOpt);
    initialSnap.current=snapRecipe(nextBase,nextBatch,nextPkg,nextOpt);
    setPhotoPreview(''); setPhotoName(''); setPhotoErr(''); setPhotoDraft(null);
  } },[open,menu]);
  if(!menu) return null;

  const ingMap=Object.fromEntries(db.ingredients.map(i=>[i.id,i]));
  const pkgMap=Object.fromEntries(db.packages.map(p=>[p.id,p]));
  const batchMap=Object.fromEntries((db.batchRecipes||[]).map(b=>[b.id,b]));
  const baseCost=base.reduce((s,l)=>{ const ing=ingMap[l.ingId]; return s+(l.qty*(ing?ing.costPerUnit:0)); },0);
  const batchCost=batch.reduce((s,l)=>{ const b=batchRecipeCost(db,l.batchId); return s+((+l.qty||0)*(b.costPerUnit||0)); },0);
  const pkgCost=pkg.reduce((s,l)=>{ const p=pkgMap[l.pkgId]; return s+(l.qty*(p?p.costPerPiece:0)); },0);
  // options: รวมต้นทุนวัตถุดิบของแต่ละตัวเลือก แล้วเฉลี่ย (ลูกค้าเลือก 1 ตัวต่อแก้ว)
  const optByOption={}; opt.forEach(l=>{ const ing=ingMap[l.ingId]; const lc=(+l.qty||0)*(ing?ing.costPerUnit:0); optByOption[l.optionId]=(optByOption[l.optionId]||0)+lc; });
  const optCosts=Object.values(optByOption); const optAvg=optCosts.length?optCosts.reduce((s,x)=>s+x,0)/optCosts.length:0;
  const total=baseCost+batchCost+pkgCost+optAvg;
  const gpStore=menu.priceStore-total, gpStorePct=menu.priceStore?gpStore/menu.priceStore:0;
  // ราคา/กำไรแยกตามตัวเลือก
  const optSummary=Object.entries(optByOption).map(([oid,c])=>{ const o=db.options.find(x=>x.id===oid)||{}; const sell=menu.priceStore+(+o.addPrice||0); const cost=baseCost+pkgCost+c; return {oid,name:o.name||oid,addPrice:+o.addPrice||0,sell,cost,gp:sell?(sell-cost)/sell:0}; });

  const addBase=()=>{ const ing=db.ingredients[0]; setBase([...base,{_uid:Math.random(),menuId:menu.id,ingId:ing.id,qty:1,unit:ing.unit}]); };
  const addBatch=()=>{ const b=(db.batchRecipes||[])[0]; if(!b){ flash('ยังไม่มีสูตรฐานเบเกอรี่ ให้สร้างก่อน','err'); return; } setBatch([...batch,{_uid:Math.random(),menuId:menu.id,batchId:b.id,qty:1,unit:b.outputUnit||'g'}]); };
  const addPkg=()=>{ const p=db.packages[0]; setPkg([...pkg,{_uid:Math.random(),menuId:menu.id,pkgId:p.id,qty:1,unit:p.unit}]); };
  const addOpt=()=>{ const o=db.options[0]||{}; const ing=db.ingredients[0]||{}; setOpt([...opt,{_uid:Math.random(),menuId:menu.id,optionId:o.id,group:o.group,type:o.type,ingId:ing.id,qty:1,unit:ing.unit}]); };
  const applyAiDraft=(draft)=>{
    if(!draft) return;
    const b=(draft.lines||[]).map(l=>({ _uid:Math.random(), menuId:menu.id, ingId:l.item.id, qty:+l.qty||0, unit:l.item.unit||l.unit||'' }));
    const p=(draft.pkgLines||[]).map(l=>({ _uid:Math.random(), menuId:menu.id, pkgId:l.item.id, qty:+l.qty||0, unit:l.item.unit||'ชิ้น' }));
    if(!b.length&&!p.length){ flash('AI ยังจับคู่วัตถุดิบ/แพคเกจไม่ได้','err'); return; }
    setBase(b);
    setPkg(p);
    setPhotoDraft(draft);
    flash('AI เติมสูตรร่างให้แล้ว กดบันทึกสูตรเพื่อยืนยัน');
  };
  const analyzeRecipeImage=async(file)=>{
    if(!file) return;
    setPhotoBusy(true); setPhotoErr(''); setPhotoDraft(null);
    try{
      const dataUrl=window.aiFileToDataUrl ? await window.aiFileToDataUrl(file) : await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); });
      setPhotoPreview(dataUrl); setPhotoName(file.name||'รูปสูตร');
      let uploadedAsset=null;
      try{
        uploadedAsset = await window.saveJebarImageAsset(settings, addMediaAsset, file, {entityType:'menu', entityId:menu.id, role:'recipe-source'});
      }catch(uploadErr){
        setPhotoErr(`เลือกรูปได้แล้ว แต่ยังอัปโหลดขึ้น Storage ไม่สำเร็จ: ${uploadErr.message||uploadErr}`);
      }
      const ep=String(aiEndpoint||'').trim();
      if(ep){
        localStorage.setItem('jebar_ai_recipe_endpoint',ep);
        const res=await fetch(ep,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            image:dataUrl,
            imageUrl:uploadedAsset?.url||null,
            storagePath:uploadedAsset?.path||null,
            fileName:file.name||null,
            menu:{id:menu.id,name:menu.name,type:menu.type,category:menu.category,priceStore:menu.priceStore,priceLine:menu.priceLine},
            ingredients:(db.ingredients||[]).map(i=>({id:i.id,name:i.name,unit:i.unit,costPerUnit:i.costPerUnit,category:i.category,type:i.type})),
            packages:(db.packages||[]).map(p=>({id:p.id,name:p.name,unit:p.unit,costPerPiece:p.costPerPiece,category:p.category,type:p.type}))
          })
        });
        if(!res.ok) throw new Error((await res.text())||`AI endpoint error ${res.status}`);
        const json=await res.json();
        applyAiDraft(window.aiRecipeFromVision ? window.aiRecipeFromVision(menu,db,json) : null);
      }else{
        const draft=window.aiRecipeDraft ? window.aiRecipeDraft(menu,db) : null;
        applyAiDraft(draft ? {...draft,source:'local',notes:'ยังไม่ได้ต่อ AI Vision Endpoint จึงสร้างสูตรร่างจากชื่อเมนู'} : null);
      }
    }catch(err){
      setPhotoErr(`อ่านรูปด้วย AI ยังไม่สำเร็จ: ${err.message||err}`);
      const draft=window.aiRecipeDraft ? window.aiRecipeDraft(menu,db) : null;
      if(draft) applyAiDraft({...draft,source:'local',notes:'ใช้สูตรร่างจากชื่อเมนูแทน'});
    }finally{
      setPhotoBusy(false);
    }
  };
  const save=()=>{
    setDb(prev=>({
      ...prev,
      recipeBase:[...prev.recipeBase.filter(r=>r.menuId!==menu.id), ...base.map(l=>{const ing=ingMap[l.ingId];return {menuId:menu.id,ingId:l.ingId,qty:+l.qty||0,unit:ing?ing.unit:l.unit,costPerUnit:ing?ing.costPerUnit:0,lineCost:(+l.qty||0)*(ing?ing.costPerUnit:0)};})],
      recipeBatch:[...(prev.recipeBatch||[]).filter(r=>r.menuId!==menu.id), ...batch.map(l=>{const b=batchRecipeCost(prev,l.batchId);return {menuId:menu.id,batchId:l.batchId,qty:+l.qty||0,unit:b.outputUnit||l.unit||'g',costPerUnit:b.costPerUnit||0,lineCost:(+l.qty||0)*(b.costPerUnit||0)};})],
      recipePackage:[...prev.recipePackage.filter(r=>r.menuId!==menu.id), ...pkg.map(l=>{const p=pkgMap[l.pkgId];return {menuId:menu.id,pkgId:l.pkgId,qty:+l.qty||0,unit:p?p.unit:l.unit,costPerPiece:p?p.costPerPiece:0,lineCost:(+l.qty||0)*(p?p.costPerPiece:0)};})],
      recipeOption:[...prev.recipeOption.filter(r=>r.menuId!==menu.id), ...opt.map(l=>{const ing=ingMap[l.ingId]; const o=db.options.find(x=>x.id===l.optionId)||{}; return {menuId:menu.id,optionId:l.optionId,group:o.group||l.group||'',type:o.type||l.type||'',ingId:l.ingId,qty:+l.qty||0,unit:ing?ing.unit:l.unit,costPerUnit:ing?ing.costPerUnit:0,lineCost:(+l.qty||0)*(ing?ing.costPerUnit:0)};})],
    }));
    if(logActivity) logActivity('recipe.saved', {entityType:'menu', entityId:menu.id, note:`บันทึกสูตร ${menu.name}`});
    initialSnap.current='';
    flash('บันทึกสูตรแล้ว'); onClose();
  };

  const requestClose=()=>{
    const dirty=initialSnap.current && snapRecipe(base,batch,pkg,opt)!==initialSnap.current;
    if(dirty && !confirmUnsaved('สูตรนี้ยังไม่ได้บันทึก ต้องการออกโดยไม่บันทึกหรือไม่?')) return;
    onClose();
  };

  const lineRow=(l,arr,setArr,map,idKey,opts)=>{
    const item=map[l[idKey]];
    const cpu=item?(idKey==='ingId'?item.costPerUnit:item.costPerPiece):0;
    return <div key={l._uid} style={{display:'grid',gridTemplateColumns:'1fr 92px 80px 32px',gap:8,alignItems:'center'}}>
      <Select value={l[idKey]} options={opts} onChange={e=>setArr(arr.map(x=>x._uid===l._uid?{...x,[idKey]:e.target.value}:x))}/>
      <Input type="number" value={l.qty} onChange={e=>setArr(arr.map(x=>x._uid===l._uid?{...x,qty:e.target.value}:x))} style={{textAlign:'right'}}/>
      <span className="tnum" style={{fontSize:13.5,textAlign:'right',color:'var(--ink-2)'}}>{fmtB((+l.qty||0)*cpu,2)}</span>
      <IconBtn name="trash" danger size={15} onClick={()=>setArr(arr.filter(x=>x._uid!==l._uid))}/>
    </div>;
  };

  return <Modal open={open} onClose={requestClose} title={`สูตร · ${menu.name}`} width={760}
    footer={<><Button variant="secondary" onClick={requestClose}>ยกเลิก</Button><Button onClick={save} icon="check">บันทึกสูตร</Button></>}>
    <div style={{display:'flex',flexDirection:'column',gap:22}}>
      <div style={{display:'grid',gridTemplateColumns:`repeat(${(opt.length?6:5)},1fr)`,gap:10}}>
        {[['วัตถุดิบตรง',baseCost,'var(--ink)'],['สูตรฐาน',batchCost,'var(--ink)'],['ต้นทุนแพคเกจ',pkgCost,'var(--ink)'],...(opt.length?[['ออปชัน (เฉลี่ย/แก้ว)',optAvg,'var(--ink)']]:[]),['ต้นทุนรวม',total,'var(--accent)'],['GP หน้าร้าน',gpStorePct,'var(--green)']].map(([k,v,c],i,arr)=>
          <div key={i} style={{background:'var(--surface-2)',borderRadius:12,padding:'12px 14px'}}>
            <div style={{fontSize:11.5,color:'var(--ink-3)',marginBottom:4}}>{k}</div>
            <div className="tnum" style={{fontSize:18,fontWeight:700,color:c}}>{i===arr.length-1?fmtPct(v):fmtB(v,2)}</div>
          </div>)}
      </div>

      <div style={{border:'1px solid var(--line-2)',borderRadius:14,padding:14,background:'var(--surface-2)',display:'grid',gap:12}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <div>
            <h4 style={{fontSize:15,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Icon name="chart" size={17} color="var(--accent)"/>AI อ่านรูปเพื่อเติมสูตร</h4>
            <p style={{fontSize:12.5,color:'var(--ink-3)',marginTop:4}}>เลือก/ถ่ายรูปสูตรหรือรูปเมนู ระบบจะเติมวัตถุดิบและแพคเกจให้อัตโนมัติเป็นสูตรร่าง</p>
          </div>
          <ImageSourceButtons onPick={analyzeRecipeImage}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'minmax(140px,220px) 1fr',gap:12,alignItems:'start'}} className="r-stack">
          {photoPreview ? <img src={photoPreview} alt="รูปสูตรที่เลือก" style={{width:'100%',maxHeight:150,objectFit:'cover',borderRadius:10,border:'1px solid var(--line)'}}/> :
            <div style={{height:120,borderRadius:10,background:'var(--chip)',display:'grid',placeItems:'center',fontSize:12.5,color:'var(--ink-3)'}}>ยังไม่ได้เลือกรูป</div>}
          <div style={{display:'grid',gap:9}}>
            <Field label="AI Vision Endpoint (ถ้ามี)">
              <Input value={aiEndpoint} onChange={e=>setAiEndpoint(e.target.value)} placeholder="ว่างได้ ถ้ายังไม่ได้ต่อ AI อ่านรูปจริง"/>
            </Field>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',fontSize:12.5,color:'var(--ink-3)'}}>
              {photoBusy ? <Badge tone="blue">กำลังอ่านรูป...</Badge> : photoDraft ? <Badge tone={photoDraft.source==='vision'?'green':'orange'}>{photoDraft.source==='vision'?'อ่านจาก Vision แล้ว':'สูตรร่างจากชื่อเมนู'}</Badge> : <Badge tone="gray">รอเลือกรูป</Badge>}
              {photoName&&<span>{photoName}</span>}
              {photoPreview&&<Button variant="secondary" size="sm" icon="search" onClick={()=>setPhotoOpen(true)}>ดูรูปเต็ม</Button>}
              {photoDraft&&<span>ต้นทุนร่าง {fmtB(photoDraft.total,2)} · GP {fmtPct(photoDraft.gp)}</span>}
            </div>
            {photoErr&&<div style={{fontSize:12.5,color:'var(--red)',lineHeight:1.55}}>{photoErr}</div>}
            {photoDraft?.missing?.length>0&&<div style={{fontSize:12.5,color:'var(--orange)',lineHeight:1.55}}>AI เจอรายการที่ยังไม่มีในข้อมูลหลัก: {photoDraft.missing.join(', ')}</div>}
          </div>
        </div>
      </div>

      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <h4 style={{fontSize:14.5,fontWeight:600,display:'flex',alignItems:'center',gap:7}}><Icon name="leaf" size={17} color="var(--green)"/>วัตถุดิบ</h4>
          <Button variant="soft" size="sm" icon="plus" onClick={addBase}>เพิ่มวัตถุดิบ</Button>
        </div>
        {base.length? <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 92px 80px 32px',gap:8,fontSize:11.5,color:'var(--ink-3)',fontWeight:600}}>
            <span>วัตถุดิบ</span><span style={{textAlign:'right'}}>ปริมาณ</span><span style={{textAlign:'right'}}>ต้นทุน</span><span></span></div>
          {base.map(l=>lineRow(l,base,setBase,ingMap,'ingId',db.ingredients.map(i=>({value:i.id,label:`${i.name} (${fmtB(i.costPerUnit,3)}/${i.unit})`}))))}
        </div> : <p style={{fontSize:13,color:'var(--ink-3)',padding:'8px 0'}}>ยังไม่มีวัตถุดิบ</p>}
      </div>

      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div>
            <h4 style={{fontSize:14.5,fontWeight:600,display:'flex',alignItems:'center',gap:7}}><Icon name="layers" size={17} color="var(--purple)"/>ใช้สูตรฐานเบเกอรี่</h4>
            <p style={{fontSize:12,color:'var(--ink-3)',marginTop:4}}>สำหรับเค้ก/ขนมปัง: ดึงเนื้อเค้ก โดว์ ครีม หรือไส้จากสูตรฐาน แล้วระบุปริมาณที่ใช้ต่อ 1 ชิ้นขาย</p>
          </div>
          <Button variant="soft" size="sm" icon="plus" onClick={addBatch} disabled={!(db.batchRecipes||[]).length}>เพิ่มสูตรฐาน</Button>
        </div>
        {batch.length? <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 92px 80px 32px',gap:8,fontSize:11.5,color:'var(--ink-3)',fontWeight:600}}>
            <span>สูตรฐาน</span><span style={{textAlign:'right'}}>ปริมาณ</span><span style={{textAlign:'right'}}>ต้นทุน</span><span></span></div>
          {batch.map(l=>{ const b=batchRecipeCost(db,l.batchId); return <div key={l._uid} style={{display:'grid',gridTemplateColumns:'1fr 92px 80px 32px',gap:8,alignItems:'center'}}>
            <Select value={l.batchId} options={(db.batchRecipes||[]).map(x=>{ const c=batchRecipeCost(db,x.id); return {value:x.id,label:`${x.name} (${fmtB(c.costPerUnit,3)}/${x.outputUnit||'g'})`}; })} onChange={e=>setBatch(batch.map(x=>x._uid===l._uid?{...x,batchId:e.target.value}:x))}/>
            <Input type="number" value={l.qty} onChange={e=>setBatch(batch.map(x=>x._uid===l._uid?{...x,qty:e.target.value}:x))} style={{textAlign:'right'}}/>
            <span className="tnum" style={{fontSize:13.5,textAlign:'right',color:'var(--ink-2)'}}>{fmtB((+l.qty||0)*(b.costPerUnit||0),2)}</span>
            <IconBtn name="trash" danger size={15} onClick={()=>setBatch(batch.filter(x=>x._uid!==l._uid))}/>
          </div>; })}
        </div> : <p style={{fontSize:13,color:'var(--ink-3)',padding:'8px 0'}}>ยังไม่ได้ใช้สูตรฐาน</p>}
      </div>

      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <h4 style={{fontSize:14.5,fontWeight:600,display:'flex',alignItems:'center',gap:7}}><Icon name="box" size={17} color="var(--orange)"/>แพคเกจ</h4>
          <Button variant="soft" size="sm" icon="plus" onClick={addPkg}>เพิ่มแพคเกจ</Button>
        </div>
        {pkg.length? <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 92px 80px 32px',gap:8,fontSize:11.5,color:'var(--ink-3)',fontWeight:600}}>
            <span>แพคเกจ</span><span style={{textAlign:'right'}}>จำนวน</span><span style={{textAlign:'right'}}>ต้นทุน</span><span></span></div>
          {pkg.map(l=>lineRow(l,pkg,setPkg,pkgMap,'pkgId',db.packages.map(p=>({value:p.id,label:`${p.name} (${fmtB(p.costPerPiece,2)})`}))))}
        </div> : <p style={{fontSize:13,color:'var(--ink-3)',padding:'8px 0'}}>ยังไม่มีแพคเกจ</p>}
      </div>

      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <h4 style={{fontSize:14.5,fontWeight:600,display:'flex',alignItems:'center',gap:7}}><Icon name="sliders" size={17} color="var(--accent)"/>ออปชัน (ตัวเลือก)</h4>
          <Button variant="soft" size="sm" icon="plus" onClick={addOpt} disabled={!db.options.length||!db.ingredients.length}>เพิ่มออปชัน</Button>
        </div>
        <p style={{fontSize:12,color:'var(--ink-3)',marginBottom:10}}>เช่น เลือกชนิดเมล็ดคั่ว — แต่ละตัวเลือกผูกกับวัตถุดิบ + ปริมาณ · ลูกค้าเลือก 1 ตัวต่อแก้ว (ต้นทุนเฉลี่ยถูกใช้ในการคำนวณ GP)</p>
        {opt.length? <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'grid',gridTemplateColumns:'1.1fr 1.3fr 70px 72px 28px',gap:8,fontSize:11.5,color:'var(--ink-3)',fontWeight:600}}>
            <span>ตัวเลือก</span><span>วัตถุดิบที่ใช้</span><span style={{textAlign:'right'}}>ปริมาณ</span><span style={{textAlign:'right'}}>ต้นทุน</span><span></span></div>
          {opt.map(l=>{ const ing=ingMap[l.ingId]; const cpu=ing?ing.costPerUnit:0;
            return <div key={l._uid} style={{display:'grid',gridTemplateColumns:'1.1fr 1.3fr 70px 72px 28px',gap:8,alignItems:'center'}}>
              <Select value={l.optionId} options={db.options.map(o=>({value:o.id,label:o.name+(o.addPrice?` (+${fmtB(o.addPrice)})`:'')}))} onChange={e=>setOpt(opt.map(x=>x._uid===l._uid?{...x,optionId:e.target.value}:x))}/>
              <Select value={l.ingId} options={db.ingredients.map(i=>({value:i.id,label:`${i.name} (${fmtB(i.costPerUnit,3)}/${i.unit})`}))} onChange={e=>setOpt(opt.map(x=>x._uid===l._uid?{...x,ingId:e.target.value}:x))}/>
              <Input type="number" value={l.qty} onChange={e=>setOpt(opt.map(x=>x._uid===l._uid?{...x,qty:e.target.value}:x))} style={{textAlign:'right'}}/>
              <span className="tnum" style={{fontSize:13.5,textAlign:'right',color:'var(--ink-2)'}}>{fmtB((+l.qty||0)*cpu,2)}</span>
              <IconBtn name="trash" danger size={15} onClick={()=>setOpt(opt.filter(x=>x._uid!==l._uid))}/>
            </div>; })}
        </div> : <p style={{fontSize:13,color:'var(--ink-3)',padding:'8px 0'}}>ยังไม่มีออปชัน</p>}

        {optSummary.length>0 && <div style={{marginTop:14,border:'1px solid var(--line-2)',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'9px 14px',background:'var(--surface-2)',fontSize:12,fontWeight:600,color:'var(--ink-2)'}}>ราคา / กำไร แยกตามตัวเลือก</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{color:'var(--ink-3)',fontSize:11.5}}>
              <th style={{textAlign:'left',padding:'8px 14px',fontWeight:600}}>ตัวเลือก</th>
              <th style={{textAlign:'right',padding:'8px 10px',fontWeight:600}}>+ราคา</th>
              <th style={{textAlign:'right',padding:'8px 10px',fontWeight:600}}>ราคาขายรวม</th>
              <th style={{textAlign:'right',padding:'8px 10px',fontWeight:600}}>ต้นทุนรวม</th>
              <th style={{textAlign:'right',padding:'8px 14px',fontWeight:600}}>GP</th>
            </tr></thead>
            <tbody>{optSummary.map(s=>(
              <tr key={s.oid} style={{borderTop:'1px solid var(--line-2)'}}>
                <td style={{padding:'8px 14px',fontWeight:600}}>{s.name}</td>
                <td className="tnum" style={{textAlign:'right',padding:'8px 10px',color:'var(--ink-2)'}}>{s.addPrice?'+'+fmtB(s.addPrice):'—'}</td>
                <td className="tnum" style={{textAlign:'right',padding:'8px 10px'}}>{fmtB(s.sell)}</td>
                <td className="tnum" style={{textAlign:'right',padding:'8px 10px',color:'var(--ink-2)'}}>{fmtB(s.cost,2)}</td>
                <td className="tnum" style={{textAlign:'right',padding:'8px 14px',fontWeight:600,color:s.gp>=0.6?'var(--green)':s.gp>=0.4?'var(--orange)':'var(--red)'}}>{fmtPct(s.gp)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>}
      </div>
    </div>
    <Modal open={photoOpen} onClose={()=>setPhotoOpen(false)} title="รูปสูตรฐาน" width={920}
      footer={<Button variant="secondary" onClick={()=>setPhotoOpen(false)}>ปิด</Button>}>
      <img src={photoPreview||''} alt="รูปสูตรฐาน" style={{width:'100%',maxHeight:'75vh',objectFit:'contain',borderRadius:12,border:'1px solid var(--line-2)',background:'var(--surface-2)'}}/>
    </Modal>
  </Modal>;
}

function BatchRecipeModal({ open, onClose, initial }){
  const { db, setDb, settings, addMediaAsset, logActivity, flash } = useData();
  const [f,setF]=React.useState({});
  const [lines,setLines]=React.useState([]);
  const [photoPreview,setPhotoPreview]=React.useState('');
  const [photoOpen,setPhotoOpen]=React.useState(false);
  const [photoName,setPhotoName]=React.useState('');
  const [photoBusy,setPhotoBusy]=React.useState(false);
  const [photoErr,setPhotoErr]=React.useState('');
  const [photoDraft,setPhotoDraft]=React.useState(null);
  const [aiEndpoint,setAiEndpoint]=React.useState(()=>localStorage.getItem('jebar_ai_recipe_endpoint')||'');
  const initialSnap=React.useRef('');
  const snapBatch=(form,lineRows)=>JSON.stringify({
    id:form.id||'',
    name:form.name||'',
    category:form.category||'',
    outputQty:String(form.outputQty??''),
    outputUnit:form.outputUnit||'',
    note:form.note||'',
    lines:stableRecipeRows(lineRows,['ingId','qty','unit'])
  });
  React.useEffect(()=>{ if(open){
    let nextForm, nextLines;
    if(initial){
      nextForm={...initial};
      nextLines=(db.batchRecipeLines||[]).filter(r=>r.batchId===initial.id).map(r=>({...r,_uid:Math.random()}));
    } else {
      const id=nextCode(db.batchRecipes||[],'BAT');
      nextForm={id,name:'',category:'เนื้อเค้ก',outputQty:1000,outputUnit:'g',status:'ใช้',note:''};
      nextLines=[];
    }
    setF(nextForm);
    setLines(nextLines);
    initialSnap.current=snapBatch(nextForm,nextLines);
    setPhotoPreview(''); setPhotoName(''); setPhotoErr(''); setPhotoDraft(null);
  } },[open,initial]);
  if(!open) return null;
  const ingMap=Object.fromEntries((db.ingredients||[]).map(i=>[i.id,i]));
  const total=lines.reduce((s,l)=>{ const ing=ingMap[l.ingId]; return s+(+l.qty||0)*(ing?+ing.costPerUnit||0:+l.costPerUnit||0); },0);
  const cpu=(+f.outputQty||0)?total/(+f.outputQty||0):0;
  const addLine=()=>{ const ing=(db.ingredients||[]).find(i=>i.name)||db.ingredients[0]; if(!ing){ flash('ยังไม่มีวัตถุดิบ','err'); return; } setLines([...lines,{_uid:Math.random(),batchId:f.id,ingId:ing.id,qty:1,unit:ing.unit}]); };
  const localBatchDraft=()=>{
    const name=String([f.name,f.category].join(' ')).toLowerCase();
    const add=(label, words, qty)=>{
      const item=(window.aiMatchNamed&&window.aiMatchNamed(db.ingredients,label)) || (window.aiMatchNamed&&window.aiMatchNamed(db.ingredients,words.join(' '))) || null;
      return item?{label,item,qty,unit:item.unit||''}:null;
    };
    const wants=[];
    if(/โดว์|ขนมปัง|bread|dough/.test(name)) wants.push(['แป้ง', ['แป้ง','flour'], 500], ['ยีสต์',['ยีสต์','yeast'],8], ['น้ำตาล',['น้ำตาล','sugar'],60], ['เนย',['เนย','butter'],60], ['นม',['นม','milk'],250]);
    else if(/ครีม|cream/.test(name)) wants.push(['วิปครีม',['ครีม','cream','วิป'],500], ['น้ำตาล',['น้ำตาล','sugar'],50]);
    else if(/ไส้|ซอส|filling|sauce/.test(name)) wants.push(['วัตถุดิบหลักของไส้',['ไส้','ผลไม้','fruit','ซอส'],300], ['น้ำตาล',['น้ำตาล','sugar'],50]);
    else wants.push(['แป้ง',['แป้ง','flour'],300], ['ไข่',['ไข่','egg'],5], ['น้ำตาล',['น้ำตาล','sugar'],180], ['เนย',['เนย','butter'],120], ['นม',['นม','milk'],120]);
    const found=wants.map(w=>add(w[0],w[1],w[2])).filter(Boolean);
    return {source:'local',lines:found,missing:wants.filter(w=>!found.some(x=>x.label===w[0])).map(w=>w[0]),notes:'ยังไม่ได้ต่อ AI Vision Endpoint จึงสร้างสูตรฐานร่างจากชื่อสูตร'};
  };
  const visionBatchDraft=(raw)=>{
    const src=raw?.recipe||raw?.data||raw||{};
    const rows=src.ingredients||src.items||src.materials||src.recipeItems||[];
    const found=[], missing=[];
    rows.forEach((r,i)=>{
      const label=r.name||r.ingredient||r.item||r.material||`วัตถุดิบ #${i+1}`;
      const item=window.aiMatchNamed ? window.aiMatchNamed(db.ingredients,label) : null;
      const qty=parseFloat(String(r.qty??r.quantity??r.amount??1).replace(/[^0-9.\-]/g,''))||1;
      if(item) found.push({label,item,qty,unit:item.unit||r.unit||''});
      else missing.push(window.aiMissingLabel ? window.aiMissingLabel(label, db.ingredients) : label);
    });
    if(!found.length) return localBatchDraft();
    return {source:'vision',lines:found,missing,notes:src.notes||raw?.notes||''};
  };
  const applyBatchDraft=(draft)=>{
    if(!draft||!draft.lines.length){ flash('AI ยังจับคู่วัตถุดิบสูตรฐานไม่ได้','err'); return; }
    setLines(draft.lines.map(l=>({_uid:Math.random(),batchId:f.id,ingId:l.item.id,qty:+l.qty||0,unit:l.item.unit||l.unit||''})));
    setPhotoDraft(draft);
    flash('AI เติมวัตถุดิบสูตรฐานให้แล้ว กดบันทึกสูตรฐานเพื่อยืนยัน');
  };
  const analyzeBatchImage=async(file)=>{
    if(!file) return;
    setPhotoBusy(true); setPhotoErr(''); setPhotoDraft(null);
    try{
      const dataUrl=window.aiFileToDataUrl ? await window.aiFileToDataUrl(file) : await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); });
      setPhotoPreview(dataUrl); setPhotoName(file.name||'รูปสูตรฐาน');
      let uploadedAsset=null;
      try{
        uploadedAsset = await window.saveJebarImageAsset(settings, addMediaAsset, file, {entityType:'batchRecipe', entityId:f.id||'new-batch', role:'batch-recipe-source'});
      }catch(uploadErr){
        setPhotoErr(`เลือกรูปได้แล้ว แต่ยังอัปโหลดขึ้น Storage ไม่สำเร็จ: ${uploadErr.message||uploadErr}`);
      }
      const ep=String(aiEndpoint||'').trim();
      if(ep){
        localStorage.setItem('jebar_ai_recipe_endpoint',ep);
        const res=await fetch(ep,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            targetType:'bakery_batch',
            image:dataUrl,
            imageUrl:uploadedAsset?.url||null,
            storagePath:uploadedAsset?.path||null,
            fileName:file.name||null,
            batch:{id:f.id,name:f.name,category:f.category,outputQty:f.outputQty,outputUnit:f.outputUnit},
            ingredients:(db.ingredients||[]).filter(i=>i.name).map(i=>({id:i.id,name:i.name,unit:i.unit,costPerUnit:i.costPerUnit,category:i.category,type:i.type}))
          })
        });
        if(!res.ok) throw new Error((await res.text())||`AI endpoint error ${res.status}`);
        applyBatchDraft(visionBatchDraft(await res.json()));
      }else{
        applyBatchDraft(localBatchDraft());
      }
    }catch(err){
      setPhotoErr(`อ่านรูปสูตรฐานด้วย AI ยังไม่สำเร็จ: ${err.message||err}`);
      applyBatchDraft(localBatchDraft());
    }finally{
      setPhotoBusy(false);
    }
  };
  const save=()=>{
    if(!String(f.name||'').trim()){ flash('กรอกชื่อสูตรฐาน','err'); return; }
    if(!(+f.outputQty>0)){ flash('กรอกผลผลิตที่ได้ เช่น 2400 g หรือ 24 ชิ้น','err'); return; }
    setDb(prev=>{
      const item={...f,outputQty:+f.outputQty||0};
      const exists=(prev.batchRecipes||[]).some(b=>b.id===item.id);
      const batchRecipes=exists?(prev.batchRecipes||[]).map(b=>b.id===item.id?item:b):[item,...(prev.batchRecipes||[])];
      const batchRecipeLines=[...(prev.batchRecipeLines||[]).filter(r=>r.batchId!==item.id),...lines.map(l=>{ const ing=ingMap[l.ingId]||{}; return {batchId:item.id,ingId:l.ingId,qty:+l.qty||0,unit:ing.unit||l.unit||'',costPerUnit:+ing.costPerUnit||0,lineCost:(+l.qty||0)*(+ing.costPerUnit||0)}; })];
      return {...prev,batchRecipes,batchRecipeLines};
    });
    if(logActivity) logActivity('batch_recipe.saved', {entityType:'batchRecipe', entityId:f.id, note:`บันทึกสูตรฐาน ${f.name||f.id}`});
    initialSnap.current='';
    flash('บันทึกสูตรฐานแล้ว'); onClose();
  };
  const requestClose=()=>{
    const dirty=initialSnap.current && snapBatch(f,lines)!==initialSnap.current;
    if(dirty && !confirmUnsaved('สูตรฐานนี้ยังไม่ได้บันทึก ต้องการออกโดยไม่บันทึกหรือไม่?')) return;
    onClose();
  };
  return <Modal open={open} onClose={requestClose} title={initial?'แก้สูตรฐานเบเกอรี่':'เพิ่มสูตรฐานเบเกอรี่'} width={780}
    footer={<><Button variant="secondary" onClick={requestClose}>ยกเลิก</Button><Button icon="check" onClick={save}>บันทึกสูตรฐาน</Button></>}>
    <div style={{display:'grid',gap:18}}>
      <div style={{display:'grid',gridTemplateColumns:'1.4fr .8fr .65fr .65fr',gap:12}} className="r-stack">
        <Field label="ชื่อสูตรฐาน"><Input autoFocus value={f.name||''} placeholder="เช่น เนื้อเค้กสปันจ์ / โดว์ขนมปัง / ครีมส้ม" onChange={e=>setF({...f,name:e.target.value})}/></Field>
        <Field label="ประเภท"><TypeSelect value={f.category||''} options={['เนื้อเค้ก','โดว์ขนมปัง','ครีม','ไส้','ซอส','อื่นๆ']} onChange={v=>setF({...f,category:v})}/></Field>
        <Field label="ผลผลิตที่ได้"><Input type="number" value={f.outputQty||''} onChange={e=>setF({...f,outputQty:e.target.value})} style={{textAlign:'right'}}/></Field>
        <Field label="หน่วย"><Select value={f.outputUnit||'g'} options={['g','ml','ชิ้น','ก้อน','ปอนด์']} onChange={e=>setF({...f,outputUnit:e.target.value})}/></Field>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}} className="r-2col">
        <div style={{background:'var(--surface-2)',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:11.5,color:'var(--ink-3)'}}>ต้นทุนทั้ง batch</div><b className="tnum" style={{fontSize:18}}>{fmtB(total,2)}</b></div>
        <div style={{background:'var(--surface-2)',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:11.5,color:'var(--ink-3)'}}>ต้นทุนต่อ {f.outputUnit||'g'}</div><b className="tnum" style={{fontSize:18,color:'var(--accent)'}}>{fmtB(cpu,3)}</b></div>
        <div style={{background:'var(--surface-2)',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:11.5,color:'var(--ink-3)'}}>ผลผลิต</div><b className="tnum" style={{fontSize:18}}>{fmt(+f.outputQty||0,1)} {f.outputUnit||'g'}</b></div>
      </div>
      <div style={{border:'1px solid var(--line-2)',borderRadius:14,padding:14,background:'var(--surface-2)',display:'grid',gap:12}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <div>
            <h4 style={{fontSize:14.5,fontWeight:700,display:'flex',alignItems:'center',gap:7}}><Icon name="chart" size={17} color="var(--accent)"/>AI อ่านรูปสูตรฐาน</h4>
            <p style={{fontSize:12,color:'var(--ink-3)',marginTop:4}}>ใช้กับชื่อสูตรฐานนี้โดยตรง เช่น เนื้อเค้ก โดว์ ครีม หรือไส้ แล้วเติมวัตถุดิบของ batch ให้</p>
          </div>
          <ImageSourceButtons onPick={analyzeBatchImage}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'minmax(140px,220px) 1fr',gap:12,alignItems:'start'}} className="r-stack">
          {photoPreview ? <img src={photoPreview} alt="รูปสูตรฐานที่เลือก" style={{width:'100%',maxHeight:140,objectFit:'cover',borderRadius:10,border:'1px solid var(--line)'}}/> :
            <div style={{height:112,borderRadius:10,background:'var(--chip)',display:'grid',placeItems:'center',fontSize:12.5,color:'var(--ink-3)'}}>ยังไม่ได้เลือกรูป</div>}
          <div style={{display:'grid',gap:9}}>
            <Field label="AI Vision Endpoint (ถ้ามี)">
              <Input value={aiEndpoint} onChange={e=>setAiEndpoint(e.target.value)} placeholder="ว่างได้ ถ้ายังไม่ได้ต่อ AI อ่านรูปจริง"/>
            </Field>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',fontSize:12.5,color:'var(--ink-3)'}}>
              {photoBusy ? <Badge tone="blue">กำลังอ่านรูป...</Badge> : photoDraft ? <Badge tone={photoDraft.source==='vision'?'green':'orange'}>{photoDraft.source==='vision'?'อ่านจาก Vision แล้ว':'สูตรร่างจากชื่อสูตรฐาน'}</Badge> : <Badge tone="gray">รอเลือกรูป</Badge>}
              {photoName&&<span>{photoName}</span>}
              {photoPreview&&<Button variant="secondary" size="sm" icon="search" onClick={()=>setPhotoOpen(true)}>View image</Button>}
              {photoDraft&&<span>จับคู่ได้ {fmt(photoDraft.lines.length)} รายการ</span>}
            </div>
            {photoErr&&<div style={{fontSize:12.5,color:'var(--red)',lineHeight:1.55}}>{photoErr}</div>}
            {photoDraft?.missing?.length>0&&<div style={{fontSize:12.5,color:'var(--orange)',lineHeight:1.55}}>AI เจอรายการที่ยังไม่มีในข้อมูลหลัก: {photoDraft.missing.join(', ')}</div>}
          </div>
        </div>
      </div>
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:10}}>
          <div><h4 style={{fontSize:14.5,fontWeight:700,display:'flex',alignItems:'center',gap:7}}><Icon name="leaf" size={17} color="var(--green)"/>วัตถุดิบในสูตรฐาน</h4>
          <p style={{fontSize:12,color:'var(--ink-3)',marginTop:4}}>กรอกปริมาณที่ใช้ในการทำ 1 batch แล้วระบบจะคำนวณต้นทุนต่อหน่วยให้เอง</p></div>
          <Button variant="soft" size="sm" icon="plus" onClick={addLine}>เพิ่มวัตถุดิบ</Button>
        </div>
        {lines.length?<div style={{display:'grid',gap:8}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 92px 80px 32px',gap:8,fontSize:11.5,color:'var(--ink-3)',fontWeight:600}}>
            <span>วัตถุดิบ</span><span style={{textAlign:'right'}}>ปริมาณ</span><span style={{textAlign:'right'}}>ต้นทุน</span><span></span></div>
          {lines.map(l=>{ const ing=ingMap[l.ingId]||{}; return <div key={l._uid} style={{display:'grid',gridTemplateColumns:'1fr 92px 80px 32px',gap:8,alignItems:'center'}}>
            <Select value={l.ingId} options={(db.ingredients||[]).filter(i=>i.name).map(i=>({value:i.id,label:`${i.name} (${fmtB(i.costPerUnit,3)}/${i.unit||''})`}))} onChange={e=>setLines(lines.map(x=>x._uid===l._uid?{...x,ingId:e.target.value}:x))}/>
            <Input type="number" value={l.qty} onChange={e=>setLines(lines.map(x=>x._uid===l._uid?{...x,qty:e.target.value}:x))} style={{textAlign:'right'}}/>
            <span className="tnum" style={{textAlign:'right',fontSize:13.5,color:'var(--ink-2)'}}>{fmtB((+l.qty||0)*(+ing.costPerUnit||0),2)}</span>
            <IconBtn name="trash" danger size={15} onClick={()=>setLines(lines.filter(x=>x._uid!==l._uid))}/>
          </div>; })}
        </div>:<Empty icon="leaf" title="ยังไม่มีวัตถุดิบในสูตรฐาน" sub="เพิ่มวัตถุดิบเพื่อเริ่มคำนวณต้นทุน batch"/>}
      </div>
      <Field label="หมายเหตุ"><Input value={f.note||''} placeholder="เช่น สูตรนี้แบ่งได้ 2 พิมพ์ 2 ปอนด์ หรือใช้ทำเค้กส้ม/เค้กสตรอเบอรี่" onChange={e=>setF({...f,note:e.target.value})}/></Field>
    </div>
    <Modal open={photoOpen} onClose={()=>setPhotoOpen(false)} title="Batch image" width={920}
      footer={<Button variant="secondary" onClick={()=>setPhotoOpen(false)}>Close</Button>}>
      <img src={photoPreview||''} alt="Batch image" style={{width:'100%',maxHeight:'75vh',objectFit:'contain',borderRadius:12,border:'1px solid var(--line-2)',background:'var(--surface-2)'}}/>
    </Modal>
  </Modal>;
}

function BakeryBatchView(){
  const { db, setDb, flash } = useData();
  const [q,setQ]=React.useState('');
  const [modal,setModal]=React.useState(false);
  const [edit,setEdit]=React.useState(null);
  const rows=(db.batchRecipes||[]).filter(b=>!q||[b.name,b.category,b.note].join(' ').toLowerCase().includes(q.toLowerCase())).map(b=>({b,c:batchRecipeCost(db,b.id)}));
  const used=(db.recipeBatch||[]).reduce((m,r)=>({...m,[r.batchId]:(m[r.batchId]||0)+1}),{});
  const removeBatch=(id)=>{
    if(!confirm('ลบสูตรฐานนี้? เมนูที่เคยอ้างอิงสูตรนี้จะถูกถอดสูตรฐานออกด้วย')) return;
    setDb(prev=>({...prev,
      batchRecipes:(prev.batchRecipes||[]).filter(b=>b.id!==id),
      batchRecipeLines:(prev.batchRecipeLines||[]).filter(r=>r.batchId!==id),
      recipeBatch:(prev.recipeBatch||[]).filter(r=>r.batchId!==id)
    }));
    flash('ลบสูตรฐานแล้ว');
  };
  return <div className="view-enter" style={{display:'grid',gap:18}}>
    <div className="r-2col" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
      <Stat label="สูตรฐาน" value={fmt((db.batchRecipes||[]).length)} icon="layers" sub="เนื้อเค้ก / โดว์ / ครีม / ไส้"/>
      <Stat label="ถูกใช้ในเมนู" value={fmt(Object.keys(used).length)} icon="recipe" tone="var(--accent)" sub={`${fmt((db.recipeBatch||[]).length)} รายการอ้างอิง`}/>
      <Stat label="ต้นทุนเฉลี่ย/สูตร" value={fmtB(rows.length?rows.reduce((s,r)=>s+r.c.total,0)/rows.length:0,1)} icon="chart" tone="var(--green)"/>
    </div>
    <Card>
      <SectionTitle sub="สร้างสูตรผลิต 1 batch แล้วนำไปใช้ต่อในเมนูขาย เช่น เค้กส้มใช้เนื้อเค้ก 120g ต่อชิ้น">
        สูตรฐานเบเกอรี่
      </SectionTitle>
      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
        <Search value={q} onChange={setQ} placeholder="ค้นหาสูตรฐาน"/>
        <div style={{flex:1}}/>
        <Button icon="plus" onClick={()=>{setEdit(null);setModal(true);}}>เพิ่มสูตรฐาน</Button>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
          <thead><tr style={{fontSize:12.5,color:'var(--ink-2)'}}>
            <th style={{textAlign:'left',padding:'12px 14px'}}>สูตรฐาน</th>
            <th style={{textAlign:'left',padding:'12px 10px'}}>ประเภท</th>
            <th style={{textAlign:'right',padding:'12px 10px'}}>ต้นทุน batch</th>
            <th style={{textAlign:'right',padding:'12px 10px'}}>ผลผลิต</th>
            <th style={{textAlign:'right',padding:'12px 10px'}}>ต้นทุน/หน่วย</th>
            <th style={{textAlign:'center',padding:'12px 10px'}}>ใช้ในเมนู</th>
            <th style={{padding:'12px 14px',width:86}}></th>
          </tr></thead>
          <tbody>{rows.map(({b,c})=><tr key={b.id} style={{borderTop:'1px solid var(--line-2)'}}>
            <td style={{padding:'12px 14px'}}><div style={{fontWeight:700}}>{b.name}</div><div style={{fontSize:12,color:'var(--ink-3)'}}>{b.id} · {b.note||'ไม่มีหมายเหตุ'}</div></td>
            <td style={{padding:'12px 10px'}}><Badge tone="gray">{b.category||'อื่นๆ'}</Badge></td>
            <td className="tnum" style={{textAlign:'right',padding:'12px 10px'}}>{fmtB(c.total,2)}</td>
            <td className="tnum" style={{textAlign:'right',padding:'12px 10px'}}>{fmt(c.outputQty,1)} {c.outputUnit}</td>
            <td className="tnum" style={{textAlign:'right',padding:'12px 10px',fontWeight:700,color:'var(--accent)'}}>{fmtB(c.costPerUnit,3)}</td>
            <td style={{textAlign:'center',padding:'12px 10px'}}><Badge tone={used[b.id]?'green':'orange'}>{fmt(used[b.id]||0)}</Badge></td>
            <td style={{padding:'8px 14px'}}><div style={{display:'flex',justifyContent:'flex-end',gap:2}}>
              <IconBtn name="edit" title="แก้ไข" onClick={()=>{setEdit(b);setModal(true);}}/>
              <IconBtn name="trash" danger title="ลบ" onClick={()=>removeBatch(b.id)}/>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!rows.length&&<Empty icon="layers" title="ยังไม่มีสูตรฐานเบเกอรี่" sub="เริ่มจากเพิ่มสูตรฐาน เช่น เนื้อเค้กสปันจ์ หรือโดว์ขนมปัง"/>}
    </Card>
    <BatchRecipeModal open={modal} onClose={()=>setModal(false)} initial={edit}/>
  </div>;
}

function MenuView(){
  const { db, remove } = useData();
  const [q,setQ]=React.useState('');
  const [cat,setCat]=React.useState('');
  const [modal,setModal]=React.useState(false);
  const [edit,setEdit]=React.useState(null);
  const [recipe,setRecipe]=React.useState(null);

  const rows=db.menus.filter(m=>
    (!q || m.name.toLowerCase().includes(q.toLowerCase())||m.id.toLowerCase().includes(q.toLowerCase())) &&
    (!cat || m.category===cat)
  ).map(m=>({m,e:menuEconomics(db,m)}));

  const withRecipe=rows.filter(r=>r.e.hasRecipe);
  const avgGP=withRecipe.length?withRecipe.reduce((s,r)=>s+r.e.gpStorePct,0)/withRecipe.length:0;

  return <div className="view-enter" style={{display:'flex',flexDirection:'column',gap:18}}>
    <div className="r-2col" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
      <Stat label="เมนูทั้งหมด" value={fmt(db.menus.length)} icon="cup" sub={`${db.menus.filter(m=>m.status==='ขาย').length} กำลังขาย`}/>
      <Stat label="มีสูตรต้นทุน" value={fmt(withRecipe.length)} icon="recipe" tone="var(--accent)"/>
      <Stat label="GP เฉลี่ย (มีสูตร)" value={fmtPct(avgGP)} icon="trend" tone="var(--green)"/>
    </div>

    <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
      <Search value={q} onChange={setQ} placeholder="ค้นหาเมนู / รหัส"/>
      <div style={{minWidth:160}}><Select value={cat} placeholder="ทุกหมวดหมู่" options={db.categories} onChange={e=>setCat(e.target.value)}/></div>
      <div style={{flex:1}}/>
      <Button icon="plus" onClick={()=>{setEdit(null);setModal(true);}}>เพิ่มเมนู</Button>
    </div>

    <Card pad={0}>
      <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
        <thead><tr style={{color:'var(--ink-2)',fontSize:12.5}}>
          <th style={{textAlign:'left',padding:'13px 22px',fontWeight:600}}>เมนู</th>
          <th style={{textAlign:'left',padding:'13px 10px',fontWeight:600}}>ประเภท</th>
          <th style={{textAlign:'right',padding:'13px 10px',fontWeight:600}}>ราคา</th>
          <th style={{textAlign:'right',padding:'13px 10px',fontWeight:600}}>ต้นทุน</th>
          <th style={{textAlign:'right',padding:'13px 10px',fontWeight:600}}>GP%</th>
          <th style={{textAlign:'center',padding:'13px 10px',fontWeight:600}}>สถานะ</th>
          <th style={{padding:'13px 22px',width:110}}></th>
        </tr></thead>
        <tbody>
          {rows.slice(0,200).map(({m,e})=>(
            <tr key={m.id} style={{borderTop:'1px solid var(--line-2)'}}
              onMouseEnter={ev=>ev.currentTarget.style.background='var(--surface-2)'}
              onMouseLeave={ev=>ev.currentTarget.style.background=''}>
              <td style={{padding:'11px 22px'}}>
                <div style={{fontWeight:600}}>{m.name}</div>
                <div style={{fontSize:12,color:'var(--ink-3)'}}>{m.id}</div>
              </td>
              <td style={{padding:'11px 10px'}}><Badge tone="gray">{m.type}</Badge></td>
              <td className="tnum" style={{textAlign:'right',padding:'11px 10px'}}>{fmtB(m.priceStore)}</td>
              <td className="tnum" style={{textAlign:'right',padding:'11px 10px',color:e.hasRecipe?'var(--ink)':'var(--ink-3)'}}>{e.hasRecipe?fmtB(e.total,1):'—'}</td>
              <td className="tnum" style={{textAlign:'right',padding:'11px 10px',fontWeight:600,
                color:!e.hasRecipe?'var(--ink-3)':e.gpStorePct>=0.6?'var(--green)':e.gpStorePct>=0.4?'var(--orange)':'var(--red)'}}>
                {e.hasRecipe?fmtPct(e.gpStorePct):'—'}</td>
              <td style={{textAlign:'center',padding:'11px 10px'}}><Badge tone={m.status==='ขาย'?'green':'gray'}>{m.status}</Badge></td>
              <td style={{padding:'8px 18px'}}>
                <div style={{display:'flex',gap:2,justifyContent:'flex-end'}}>
                  <IconBtn name="recipe" title="แก้สูตร" color={e.hasRecipe?'var(--accent)':'var(--ink-3)'} onClick={()=>setRecipe(m)}/>
                  <IconBtn name="edit" title="แก้ไข" onClick={()=>{setEdit(m);setModal(true);}}/>
                  <IconBtn name="trash" title="ลบ" danger onClick={()=>{if(confirm('ลบเมนูนี้?'))remove('menus',m.id);}}/>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {rows.length>200 && <p style={{textAlign:'center',padding:14,fontSize:12.5,color:'var(--ink-3)'}}>แสดง 200 จาก {rows.length} รายการ — ใช้ค้นหาเพื่อกรอง</p>}
      {rows.length===0 && <Empty icon="cup" title="ไม่พบเมนู"/>}
    </Card>

    <MenuModal open={modal} onClose={()=>setModal(false)} initial={edit}/>
    <RecipeEditor open={!!recipe} onClose={()=>setRecipe(null)} menu={recipe}/>
  </div>;
}
Object.assign(window, { MenuView, BakeryBatchView, BatchRecipeModal });
