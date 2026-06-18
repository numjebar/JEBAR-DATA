// ============ AI business assistant (local insights) ============
function aiMoney(v){ return window.fmtB ? window.fmtB(v,0) : `฿${Math.round(v||0).toLocaleString()}`; }
function aiPct(v){ return window.fmtPct ? window.fmtPct(v,0) : `${Math.round((v||0)*100)}%`; }
function aiAvg(arr){ return arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : 0; }
function aiTrend(values){
  const clean=values.filter(v=>Number.isFinite(v));
  if(clean.length<4) return {label:'ข้อมูลยังน้อย', tone:'gray', pct:null};
  const half=Math.floor(clean.length/2);
  const a=aiAvg(clean.slice(0,half));
  const b=aiAvg(clean.slice(half));
  const pct=a>0?(b-a)/a:null;
  if(pct==null) return {label:'ข้อมูลยังน้อย', tone:'gray', pct:null};
  if(pct>0.08) return {label:'ยอดกำลังโต', tone:'green', pct};
  if(pct<-0.08) return {label:'ยอดกำลังตก', tone:'red', pct};
  return {label:'ยอดค่อนข้างนิ่ง', tone:'orange', pct};
}
function aiMenuEconomics(db){
  return (db.menus||[]).map(m=>({m,e:menuEconomics(db,m)}));
}
function aiText(s){ return String(s||'').toLowerCase(); }
function aiNormName(s){
  return aiText(s)
    .replace(/[(){}\[\]'"“”‘’]/g,' ')
    .replace(/[_\-+/.,:;|]/g,' ')
    .replace(/\b(กรัม|g|ml|มล|ชิ้น|pcs|piece|pack|แพค|ถุง|ขวด)\b/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function aiCompactName(s){
  return aiNormName(s).replace(/\s+/g,'');
}
function aiNameTokens(s){
  return aiNormName(s).split(/\s+/).filter(w=>w.length>1);
}
function aiTokenScore(a, b){
  const aw=aiNameTokens(a), bw=aiNameTokens(b);
  if(!aw.length||!bw.length) return 0;
  const aset=new Set(aw), bset=new Set(bw);
  let hit=0;
  aset.forEach(w=>{ if(bset.has(w) || [...bset].some(x=>x.includes(w)||w.includes(x))) hit++; });
  return hit / Math.max(aset.size, bset.size);
}
function aiMatchCandidates(list, name){
  const clean=aiNormName(name);
  const compact=aiCompactName(name);
  const tokens=aiNameTokens(name);
  if(!clean) return [];
  return (list||[]).map(item=>{
    const text=aiNormName(item.name||'');
    const meta=aiNormName([item.category,item.type,item.id].join(' '));
    const itemCompact=aiCompactName(item.name||'');
    const tokenScore=aiTokenScore(clean, text);
    let score=0;
    if(text===clean) score+=100;
    if(itemCompact && compact && itemCompact===compact) score+=95;
    if(text.includes(clean)||clean.includes(text)) score+=60;
    score += Math.round(tokenScore*60);
    if(meta && (meta.includes(clean)||clean.includes(meta))) score+=8;
    const first=tokens[0];
    if(first && text.includes(first)) score+=10;
    return {item,score,tokenScore,text,itemCompact};
  }).filter(x=>x.score>0 && (x.tokenScore>=0.34 || x.text===clean || x.itemCompact===compact || x.text.includes(clean) || clean.includes(x.text)))
    .sort((a,b)=>b.score-a.score);
}
function aiFindByWords(list, words){
  const scored=(list||[]).map(item=>{
    const text=aiText([item.name,item.category,item.type,item.id].join(' '));
    const score=words.reduce((s,w)=>s+(text.includes(aiText(w))?1:0),0);
    return {item,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  return scored[0]?.item||null;
}
function aiRecipeDraft(menu, db){
  const name=aiText(menu.name+' '+menu.type+' '+menu.category);
  const ing=db.ingredients||[], pkgs=db.packages||[];
  const lines=[], pkgLines=[], missing=[];
  const addIng=(label, words, qty, unit)=>{
    const found=aiFindByWords(ing, words);
    if(found) lines.push({label, item:found, qty, unit:found.unit||unit||''});
    else missing.push(label);
  };
  const addPkg=(label, words, qty)=>{
    const found=aiFindByWords(pkgs, words);
    if(found) pkgLines.push({label, item:found, qty});
    else missing.push(label);
  };
  const isCoffee=/coffee|espresso|americano|latte|cappuccino|mocha|กาแฟ|เอสเปรส|อเมริกาโน|ลาเต้|คาปู|มอคค่า/.test(name);
  const isMilk=/latte|cappuccino|mocha|milk|นม|ลาเต้|คาปู|มอคค่า|โกโก้|cocoa|ชาไทย|ชาเขียว|matcha/.test(name);
  const isTea=/tea|ชา|matcha|มัทฉะ/.test(name);
  const isBakery=/bread|toast|cake|ครัวซอง|ขนม|ปัง|เค้ก|เบเกอรี่|bakery|pastry/.test(name);
  const isSweet=/honey|caramel|vanilla|syrup|หวาน|น้ำผึ้ง|คาราเมล|วนิลา/.test(name);
  if(isCoffee) addIng('เมล็ดกาแฟ', ['เมล็ดกาแฟ','coffee','espresso','bean'], /americano|อเมริกาโน/.test(name)?10:12, 'g');
  if(isTea) addIng('ชา / ผงชา', ['ชา','tea','matcha','มัทฉะ'], 8, 'g/ml');
  if(isMilk) addIng('นมสด', ['นม','milk'], /latte|ลาเต้/.test(name)?150:120, 'ml');
  if(/cocoa|โกโก้|mocha|มอคค่า/.test(name)) addIng('ผงโกโก้', ['โกโก้','cocoa','chocolate'], 18, 'g');
  if(isSweet) addIng('ไซรัป / น้ำเชื่อม', ['ไซรัป','syrup','น้ำเชื่อม','honey','น้ำผึ้ง','caramel','คาราเมล'], 15, 'ml');
  if(!lines.length && isBakery){
    addIng('วัตถุดิบหลักเบเกอรี่', ['แป้ง','flour','เนย','butter','ขนมปัง','bread'], 1, 'ชิ้น/สูตร');
  }
  if(!lines.length){
    const byType=aiFindByWords(ing,[menu.type,menu.category]);
    if(byType) lines.push({label:'วัตถุดิบหลักตามประเภท', item:byType, qty:1, unit:byType.unit||''});
  }
  if(!isBakery) addPkg('แก้ว/ภาชนะ', ['แก้ว','cup','16oz','แก้ว 16','ภาชนะ'], 1);
  if(!isBakery) addPkg('ฝา/หลอด/ซอง', ['ฝา','lid','หลอด','straw','ซอง'], 1);
  if(isBakery) addPkg('ถุง/กล่องเบเกอรี่', ['ถุง','กล่อง','box','bag','bakery'], 1);
  const total=lines.reduce((s,l)=>s+(+l.qty||0)*(+l.item.costPerUnit||0),0)+pkgLines.reduce((s,l)=>s+(+l.qty||0)*(+l.item.costPerPiece||0),0);
  const gp=menu.priceStore? (menu.priceStore-total)/menu.priceStore : 0;
  return {lines,pkgLines,missing,total,gp};
}
function aiDataGaps(db){
  const menus=db.menus||[], ing=db.ingredients||[], pkgs=db.packages||[];
  const missingPrice=menus.filter(m=>m.status!=='หยุดขาย' && !(+m.priceStore>0));
  const missingLinePrice=menus.filter(m=>m.status!=='หยุดขาย' && !(+m.priceLine>0));
  const missingRecipe=menus.filter(m=>m.status!=='หยุดขาย' && !menuEconomics(db,m).hasRecipe);
  const badIngredients=ing.filter(i=>!(+i.buyPrice>0)||!(+i.buyQty>0)||!(+i.costPerUnit>0));
  const badPackages=pkgs.filter(p=>!(+p.buyPrice>0)||!(+p.buyQty>0)||!(+p.costPerPiece>0));
  const noSupplier=ing.filter(i=>!String(i.supplier||'').trim()).slice(0,10);
  return {missingPrice,missingLinePrice,missingRecipe,badIngredients,badPackages,noSupplier};
}
function aiNum(v, fallback=1){
  const n=parseFloat(String(v??'').replace(/[^0-9.\-]/g,''));
  return Number.isFinite(n)?n:fallback;
}
function aiFileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(r.result);
    r.onerror=()=>reject(r.error||new Error('อ่านไฟล์รูปไม่สำเร็จ'));
    r.readAsDataURL(file);
  });
}
function aiMatchNamed(list, name){
  const best=aiMatchCandidates(list, name)[0];
  return best && best.score>=45 ? best.item : null;
}
function aiMissingLabel(label, list){
  const near=aiMatchCandidates(list, label).slice(0,3).map(x=>x.item.name).filter(Boolean);
  return near.length ? `${label} (ใกล้เคียง: ${near.join(', ')})` : label;
}
function aiRecipeFromVision(menu, db, raw){
  const src=raw?.recipe||raw?.data||raw||{};
  const ingredientRows=src.ingredients||src.items||src.materials||src.recipeItems||[];
  const packageRows=src.packages||src.packageItems||src.containers||[];
  const lines=[], pkgLines=[], missing=[];
  ingredientRows.forEach((row,i)=>{
    const label=row.name||row.ingredient||row.item||row.material||`วัตถุดิบ #${i+1}`;
    const item=aiMatchNamed(db.ingredients,label);
    const qty=aiNum(row.qty??row.quantity??row.amount,1);
    if(item) lines.push({label,item,qty,unit:item.unit||row.unit||''});
    else missing.push(aiMissingLabel(label, db.ingredients));
  });
  packageRows.forEach((row,i)=>{
    const label=row.name||row.package||row.item||`แพคเกจ #${i+1}`;
    const item=aiMatchNamed(db.packages,label);
    const qty=aiNum(row.qty??row.quantity??row.amount,1);
    if(item) pkgLines.push({label,item,qty,unit:item.unit||row.unit||'ชิ้น'});
    else missing.push(aiMissingLabel(label, db.packages));
  });
  if(!lines.length&&!pkgLines.length){
    const fallback=aiRecipeDraft(menu,db);
    return {...fallback,source:'local',notes:'AI Vision ยังไม่ได้ส่งสูตรที่จับคู่ได้ ระบบจึงสร้างสูตรร่างจากชื่อเมนูแทน'};
  }
  const total=lines.reduce((s,l)=>s+(+l.qty||0)*(+l.item.costPerUnit||0),0)+pkgLines.reduce((s,l)=>s+(+l.qty||0)*(+l.item.costPerPiece||0),0);
  const gp=menu.priceStore? (menu.priceStore-total)/menu.priceStore : 0;
  return {lines,pkgLines,missing,total,gp,source:'vision',notes:src.notes||raw?.notes||''};
}
function aiBuildInsights(db, settings){
  const months=aggregateByMonth(db);
  const cur=months[months.length-1]||null;
  const prev=months[months.length-2]||null;
  const daily=(db.dailySales||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const recent=daily.slice(-14);
  const recentVals=recent.map(d=>dailyTotal(d));
  const trend=aiTrend(recentVals);
  const oh=overheadTotal(db);
  const gp=cur?cur.total*(settings.estGP||0):0;
  const net=gp-oh;
  const targetPct=cur&&settings.target>0?cur.total/settings.target:0;
  const avgDay=cur&&cur.days?cur.total/cur.days:0;
  const remainingTarget=cur?Math.max(0,(settings.target||0)-cur.total):0;
  const gpRows=aiMenuEconomics(db).filter(x=>x.e.hasRecipe&&x.m.priceStore>0);
  const lowGp=gpRows.filter(x=>x.e.gpStorePct<0.55).sort((a,b)=>a.e.gpStorePct-b.e.gpStorePct).slice(0,6);
  const topGp=gpRows.slice().sort((a,b)=>b.e.gpStorePct-a.e.gpStorePct).slice(0,6);
  const missingRecipe=(db.menus||[]).filter(m=>m.status!=='เลิกขาย' && !menuEconomics(db,m).hasRecipe).slice(0,8);
  const gaps=aiDataGaps(db);
  const lineComm=Number(settings.lineCommission||0);
  const lineRisk=gpRows.map(x=>{
    const linePrice=Number(x.m.priceLine||0);
    const profit=linePrice ? linePrice*(1-lineComm)-x.e.total : null;
    return {...x,lineProfit:profit,linePrice};
  }).filter(x=>x.linePrice>0 && x.lineProfit!=null).sort((a,b)=>a.lineProfit-b.lineProfit).slice(0,6);

  const menuReports=db.menuReports||[];
  const latestMenu=menuReports[0]||null;
  const bestSellers=latestMenu ? dpJoinEconomics(db, latestMenu.rows||[]).sort((a,b)=>(b.qty||0)-(a.qty||0)).slice(0,6) : [];
  const sellerLowGp=bestSellers.filter(x=>x.gpPct!=null && x.gpPct<0.55);

  const hourlyReports=db.hourlyReports||[];
  const latestHr=hourlyReports[0]||null;
  const hours=latestHr&&latestHr.hours?latestHr.hours:[];
  const peakHours=hours.map((v,h)=>({h,v})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,4);
  const weakHours=hours.map((v,h)=>({h,v})).filter(x=>x.v>0).sort((a,b)=>a.v-b.v).slice(0,4);

  const actions=[];
  if(cur){
    if(net<0) actions.push({tone:'red', title:'กำไรสุทธิติดลบ', body:`เดือนนี้รายได้ ${aiMoney(cur.total)} แต่กำไรสุทธิประมาณ ${aiMoney(net)} หลังหักค่าใช้จ่าย ${aiMoney(oh)} ควรคุมต้นทุนและดันเมนูกำไรสูงก่อนเพิ่มโปรแรง`, route:'analytics'});
    else actions.push({tone:'green', title:'กำไรสุทธิยังเป็นบวก', body:`เดือนนี้กำไรสุทธิประมาณ ${aiMoney(net)} จากรายได้ ${aiMoney(cur.total)} ใช้ช่วงนี้ดันเมนู GP สูงและเพิ่มยอดเฉลี่ยต่อบิล`, route:'dashboard'});
    if(settings.target>0 && targetPct<0.8) actions.push({tone:'orange', title:'ยอดยังต่ำกว่าเป้า', body:`ทำได้ ${aiPct(targetPct)} ของเป้า ยังขาด ${aiMoney(remainingTarget)} ถ้าเหลือเวลาไม่มากควรทำโปรช่วงเงียบและเพิ่มการขายเสริม`, route:'sales'});
    if(prev&&prev.total>0&&cur.total<prev.total*0.92) actions.push({tone:'red', title:'ยอดต่ำกว่าเดือนก่อน', body:`ยอดเดือนนี้ต่ำกว่าเดือนก่อนประมาณ ${aiPct((prev.total-cur.total)/prev.total)} ควรเช็กวันยอดตกและช่องทางที่หายไป`, route:'analytics'});
  }
  if(trend.pct!=null) actions.push({tone:trend.tone, title:trend.label, body:`แนวโน้ม 14 วันล่าสุดเปลี่ยน ${trend.pct>=0?'+':''}${aiPct(trend.pct)} เทียบครึ่งแรกกับครึ่งหลัง`, route:'sales'});
  if(sellerLowGp.length) actions.push({tone:'red', title:'ขายดีแต่ GP ต่ำ', body:`${sellerLowGp.map(x=>x.name).slice(0,3).join(', ')} ขายดีแต่ GP ต่ำ ควรปรับสูตร/ราคา หรือทำ bundle กับเมนูกำไรสูง`, route:'insights'});
  if(lowGp.length) actions.push({tone:'orange', title:'เมนูกำไรต่ำ', body:`พบ ${lowGp.length} เมนู GP ต่ำกว่า 55% เริ่มจาก ${lowGp[0].m.name} GP ${aiPct(lowGp[0].e.gpStorePct)}`, route:'menu'});
  if(missingRecipe.length) actions.push({tone:'orange', title:'ยังมีเมนูไม่มีสูตร', body:`มีเมนูที่ยังไม่ได้ใส่สูตรต้นทุน ${missingRecipe.length} รายการ เช่น ${missingRecipe.slice(0,3).map(m=>m.name).join(', ')} ทำให้กำไรเป็นค่าประมาณ`, route:'menu'});
  if(lineRisk.length&&lineRisk[0].lineProfit<10) actions.push({tone:'red', title:'LINE MAN กำไรบาง', body:`${lineRisk[0].m.name} กำไร LINE MAN ประมาณ ${aiMoney(lineRisk[0].lineProfit)} ต่อชิ้น ควรปรับราคา LINE MAN หรือหยุดโปร`, route:'products'});
  if(peakHours.length) actions.push({tone:'green', title:'ช่วงเวลาพีค', body:`ช่วงขายดีคือ ${peakHours.slice(0,3).map(x=>String(x.h).padStart(2,'0')+':00').join(', ')} ควรเตรียมคนและสต๊อกก่อนช่วงนี้`, route:'insights'});
  if(weakHours.length) actions.push({tone:'blue', title:'ช่วงเหมาะทำโปร', body:`ช่วงยอดเบากว่าเวลาอื่น: ${weakHours.slice(0,3).map(x=>String(x.h).padStart(2,'0')+':00').join(', ')} เหมาะกับโปรเพิ่ม traffic`, route:'insights'});

  const plan=[
    lowGp.length ? `ทบทวนราคา/สูตรเมนู GP ต่ำ: ${lowGp.slice(0,3).map(x=>x.m.name).join(', ')}` : 'รักษาเมนู GP ดี และใช้เป็นตัวหลักในโปร',
    topGp.length ? `ดันเมนูกำไรสูงในป้าย/LINE MAN: ${topGp.slice(0,3).map(x=>x.m.name).join(', ')}` : 'ใส่สูตรต้นทุนให้เมนูหลักก่อน เพื่อให้ระบบแนะนำได้แม่นขึ้น',
    peakHours.length ? `จัดพนักงานเสริมก่อน ${String(peakHours[0].h).padStart(2,'0')}:00 น.` : 'นำเข้าไฟล์ยอดขายรายชั่วโมง เพื่อให้แนะนำเวลาพีคได้',
    missingRecipe.length ? 'ปิดงานสูตรต้นทุนของเมนูขายอยู่ให้ครบก่อนทำโปรใหญ่' : 'ตรวจยอดขายรายวันต่อเนื่องและตั้งเป้าโปรรายสัปดาห์'
  ];
  return {cur,prev,trend,net,gp,oh,targetPct,avgDay,actions:actions.slice(0,8),plan,topGp,lowGp,missingRecipe,lineRisk,bestSellers,peakHours,weakHours,gaps};
}

function AIAdvisor({ go }){
  const { fdb:db, settings, setDb, addMediaAsset, logActivity, flash } = useData();
  const [focus,setFocus]=React.useState('overview');
  const [recipeMenuId,setRecipeMenuId]=React.useState('');
  const [photoMenuId,setPhotoMenuId]=React.useState('');
  const [photoPreview,setPhotoPreview]=React.useState('');
  const [photoOpen,setPhotoOpen]=React.useState(false);
  const [photoName,setPhotoName]=React.useState('');
  const [photoDraft,setPhotoDraft]=React.useState(null);
  const [photoAsset,setPhotoAsset]=React.useState(null);
  const [photoBusy,setPhotoBusy]=React.useState(false);
  const [photoErr,setPhotoErr]=React.useState('');
  const [aiEndpoint,setAiEndpoint]=React.useState(()=>localStorage.getItem('jebar_ai_recipe_endpoint')||'');
  const insight=React.useMemo(()=>aiBuildInsights(db,settings),[db,settings,focus]);
  const recipeTargets=(insight.gaps.missingRecipe||[]).slice(0,80);
  React.useEffect(()=>{ if(!recipeMenuId && recipeTargets[0]) setRecipeMenuId(recipeTargets[0].id); },[recipeTargets.length,recipeMenuId]);
  const activeMenus=(db.menus||[]).filter(m=>m.status!=='หยุดขาย'&&m.status!=='เลิกขาย');
  React.useEffect(()=>{ if(!photoMenuId && activeMenus[0]) setPhotoMenuId(activeMenus[0].id); },[activeMenus.length,photoMenuId]);
  const recipeMenu=(db.menus||[]).find(m=>m.id===recipeMenuId)||recipeTargets[0]||null;
  const photoMenu=(db.menus||[]).find(m=>m.id===photoMenuId)||activeMenus[0]||null;
  const recipeDraft=recipeMenu?aiRecipeDraft(recipeMenu,db):null;
  const applyDraft=()=>{
    if(!recipeMenu||!recipeDraft) return;
    if(!recipeDraft.lines.length&&!recipeDraft.pkgLines.length){ flash('ยังสร้างสูตรร่างไม่ได้ เพราะไม่พบวัตถุดิบ/แพคเกจที่เข้าคู่','err'); return; }
    setDb(prev=>{
      const base=recipeDraft.lines.map(l=>({menuId:recipeMenu.id,ingId:l.item.id,qty:+l.qty||0,unit:l.item.unit||l.unit||'',costPerUnit:+l.item.costPerUnit||0,lineCost:(+l.qty||0)*(+l.item.costPerUnit||0)}));
      const pkg=recipeDraft.pkgLines.map(l=>({menuId:recipeMenu.id,pkgId:l.item.id,qty:+l.qty||0,unit:l.item.unit||'ชิ้น',costPerPiece:+l.item.costPerPiece||0,lineCost:(+l.qty||0)*(+l.item.costPerPiece||0)}));
      return {...prev,
        recipeBase:[...prev.recipeBase.filter(r=>r.menuId!==recipeMenu.id),...base],
        recipePackage:[...prev.recipePackage.filter(r=>r.menuId!==recipeMenu.id),...pkg],
      };
    });
    flash(`สร้างสูตรร่างให้ ${recipeMenu.name} แล้ว`);
  };
  const onPhotoFile=async(file)=>{
    if(!file) return;
    try{
      setPhotoErr('');
      setPhotoDraft(null);
      setPhotoAsset(null);
      setPhotoName(file.name||'รูปสูตร');
      setPhotoPreview(await aiFileToDataUrl(file));
      try{
        const asset = await window.saveJebarImageAsset(settings, addMediaAsset, file, {entityType:'menu', entityId:photoMenu?.id||'unassigned', role:'recipe-source'});
        if(asset) setPhotoAsset(asset);
      }catch(uploadErr){
        setPhotoErr(`เลือกรูปได้แล้ว แต่ยังอัปโหลดขึ้น Storage ไม่สำเร็จ: ${uploadErr.message||uploadErr}`);
      }
    }catch(err){
      setPhotoErr(err.message||'อ่านไฟล์รูปไม่สำเร็จ');
    }
  };
  const analyzePhoto=async()=>{
    if(!photoMenu){ setPhotoErr('กรุณาเลือกเมนูก่อน'); return; }
    setPhotoBusy(true);
    setPhotoErr('');
    try{
      const ep=String(aiEndpoint||'').trim();
      if(ep){
        localStorage.setItem('jebar_ai_recipe_endpoint',ep);
        const res=await fetch(ep,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            image:photoPreview||null,
            imageUrl:photoAsset?.url||null,
            storagePath:photoAsset?.path||null,
            fileName:photoName||null,
            menu:{id:photoMenu.id,name:photoMenu.name,type:photoMenu.type,category:photoMenu.category,priceStore:photoMenu.priceStore,priceLine:photoMenu.priceLine},
            ingredients:(db.ingredients||[]).map(i=>({id:i.id,name:i.name,unit:i.unit,costPerUnit:i.costPerUnit,category:i.category,type:i.type})),
            packages:(db.packages||[]).map(p=>({id:p.id,name:p.name,unit:p.unit,costPerPiece:p.costPerPiece,category:p.category,type:p.type}))
          })
        });
        if(!res.ok) throw new Error((await res.text())||`AI endpoint error ${res.status}`);
        const json=await res.json();
        setPhotoDraft(aiRecipeFromVision(photoMenu,db,json));
      }else{
        setPhotoDraft({...aiRecipeDraft(photoMenu,db),source:'local',notes:'ยังไม่ได้เชื่อม AI Vision Endpoint ระบบจึงสร้างสูตรร่างจากชื่อเมนูและวัตถุดิบที่มี'});
      }
    }catch(err){
      setPhotoErr(`AI Vision ยังใช้ไม่ได้: ${err.message||err}`);
      setPhotoDraft({...aiRecipeDraft(photoMenu,db),source:'local',notes:'ใช้สูตรร่างจากชื่อเมนูแทน เพราะ AI Vision ยังเชื่อมไม่สำเร็จ'});
    }finally{
      setPhotoBusy(false);
    }
  };
  const applyPhotoDraft=()=>{
    if(!photoMenu||!photoDraft) return;
    if(!photoDraft.lines.length&&!photoDraft.pkgLines.length){ flash('ยังบันทึกสูตรไม่ได้ เพราะไม่พบวัตถุดิบ/แพคเกจที่เข้าคู่','err'); return; }
    setDb(prev=>{
      const base=photoDraft.lines.map(l=>({menuId:photoMenu.id,ingId:l.item.id,qty:+l.qty||0,unit:l.item.unit||l.unit||'',costPerUnit:+l.item.costPerUnit||0,lineCost:(+l.qty||0)*(+l.item.costPerUnit||0)}));
      const pkg=photoDraft.pkgLines.map(l=>({menuId:photoMenu.id,pkgId:l.item.id,qty:+l.qty||0,unit:l.item.unit||'ชิ้น',costPerPiece:+l.item.costPerPiece||0,lineCost:(+l.qty||0)*(+l.item.costPerPiece||0)}));
      return {...prev,
        recipeBase:[...prev.recipeBase.filter(r=>r.menuId!==photoMenu.id),...base],
        recipePackage:[...prev.recipePackage.filter(r=>r.menuId!==photoMenu.id),...pkg],
      };
    });
    if(logActivity) logActivity('recipe.ai_photo_applied', {entityType:'menu', entityId:photoMenu.id, note:`บันทึกสูตรจากรูป: ${photoName||photoMenu.name}`});
    flash(`บันทึกสูตรร่างจากรูปให้ ${photoMenu.name} แล้ว`);
  };
  const cards=insight.actions.filter(a=>{
    if(focus==='profit') return ['red','orange','green'].includes(a.tone)&&/(กำไร|GP|LINE MAN|สูตร|ต้นทุน)/.test(a.title+a.body);
    if(focus==='sales') return /(ยอด|เป้า|ขาย|โปร|พีค|traffic)/.test(a.title+a.body);
    if(focus==='menu') return /(เมนู|สูตร|GP|LINE MAN)/.test(a.title+a.body);
    return true;
  });
  const AskChip=({children,onClick})=><button onClick={onClick} style={{padding:'8px 12px',borderRadius:999,background:'var(--chip)',fontSize:13,color:'var(--ink-2)',fontWeight:600}}>{children}</button>;
  const ActionCard=({a})=><div style={{border:'1px solid var(--line-2)',borderRadius:14,padding:16,background:'var(--surface-2)',display:'flex',gap:13}}>
    <div style={{width:38,height:38,borderRadius:12,display:'grid',placeItems:'center',background:`var(--${a.tone==='red'?'red':a.tone==='orange'?'orange':a.tone==='green'?'green':'accent'}-soft)`,color:`var(--${a.tone==='red'?'red':a.tone==='orange'?'orange':a.tone==='green'?'green':'accent'})`,flexShrink:0}}>
      <Icon name={a.tone==='red'?'bell':a.tone==='green'?'trend':'target'} size={18}/>
    </div>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'start'}}>
        <h3 style={{fontSize:15.5,fontWeight:700,marginBottom:5}}>{a.title}</h3>
        <Badge tone={a.tone==='blue'?'blue':a.tone}>{a.tone==='red'?'ด่วน':a.tone==='orange'?'ควรดู':a.tone==='green'?'โอกาส':'แนะนำ'}</Badge>
      </div>
      <p style={{fontSize:13.5,color:'var(--ink-2)',lineHeight:1.65}}>{a.body}</p>
      {a.route&&<Button variant="ghost" size="sm" icon="chevron" style={{marginTop:8,paddingLeft:0}} onClick={()=>go(a.route)}>ไปดูข้อมูล</Button>}
    </div>
  </div>;
  return <div className="view-enter" style={{display:'flex',flexDirection:'column',gap:18}}>
    <Card pad={24} style={{background:'linear-gradient(135deg,var(--surface),var(--surface-2))'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:18,alignItems:'center',flexWrap:'wrap'}}>
        <div>
          <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:8}}>
            <div style={{width:46,height:46,borderRadius:15,display:'grid',placeItems:'center',background:'var(--accent-soft)',color:'var(--accent)'}}><Icon name="chart" size={24}/></div>
            <div><h2 style={{fontSize:24,fontWeight:800,letterSpacing:'-.4px'}}>AI ผู้ช่วยบริหาร JEBAR</h2>
            <p style={{fontSize:13.5,color:'var(--ink-2)'}}>วิเคราะห์จากข้อมูลในระบบทันที: ยอดขาย กำไร เมนู ต้นทุน LINE MAN และช่วงเวลาขายดี</p></div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>
            <AskChip onClick={()=>setFocus('profit')}>วันนี้ควรแก้กำไรตรงไหน?</AskChip>
            <AskChip onClick={()=>setFocus('sales')}>ควรทำโปรช่วงไหน?</AskChip>
            <AskChip onClick={()=>setFocus('menu')}>เมนูไหนควรดัน?</AskChip>
            <AskChip onClick={()=>setFocus('overview')}>ภาพรวมทั้งหมด</AskChip>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(120px,1fr))',gap:10,minWidth:280}}>
          <div style={{background:'var(--surface)',border:'1px solid var(--line-2)',borderRadius:14,padding:'14px 16px'}}>
            <div style={{fontSize:12.5,color:'var(--ink-3)',marginBottom:5}}>ยอดเดือนนี้</div>
            <div className="tnum" style={{fontSize:23,fontWeight:800}}>{insight.cur?aiMoney(insight.cur.total):'ยังไม่มี'}</div>
            {insight.cur&&<div style={{fontSize:12,color:'var(--ink-3)',marginTop:4}}>{insight.cur.days} วันที่บันทึก</div>}
          </div>
          <div style={{background:'var(--surface)',border:'1px solid var(--line-2)',borderRadius:14,padding:'14px 16px'}}>
            <div style={{fontSize:12.5,color:'var(--ink-3)',marginBottom:5}}>กำไรสุทธิประมาณ</div>
            <div className="tnum" style={{fontSize:23,fontWeight:800,color:insight.net>=0?'var(--green)':'var(--red)'}}>{insight.cur?aiMoney(insight.net):'ยังไม่มี'}</div>
            <div style={{fontSize:12,color:'var(--ink-3)',marginTop:4}}>หักค่าใช้จ่าย {aiMoney(insight.oh)}</div>
          </div>
        </div>
      </div>
    </Card>

    <div className="r-stack" style={{display:'grid',gridTemplateColumns:'1.4fr .9fr',gap:16}}>
      <Card>
        <SectionTitle sub="เรียงตามเรื่องที่ควรจัดการก่อน">คำแนะนำจากข้อมูล</SectionTitle>
        <div style={{display:'grid',gap:12}}>
          {cards.length ? cards.map((a,i)=><ActionCard key={i} a={a}/>) :
            <Empty icon="chart" title="ข้อมูลยังไม่พอให้วิเคราะห์" sub="บันทึกยอดขาย ใส่สูตรต้นทุน และนำเข้าไฟล์รายชั่วโมงก่อน ระบบจะแนะนำได้แม่นขึ้น"/>}
        </div>
      </Card>
      <div style={{display:'grid',gap:16}}>
        <Card>
          <SectionTitle sub="แผนทำงานสั้น ๆ">แผน 7 วัน</SectionTitle>
          <div style={{display:'grid',gap:10}}>
            {insight.plan.map((p,i)=><div key={i} style={{display:'flex',gap:10,alignItems:'flex-start'}}>
              <Badge tone={i===0?'red':i===1?'green':i===2?'blue':'orange'}>{i+1}</Badge>
              <div style={{fontSize:13.5,lineHeight:1.6,color:'var(--ink-2)'}}>{p}</div>
            </div>)}
          </div>
        </Card>
        <Card>
          <SectionTitle sub="สำหรับตัดสินใจเร็ว">สรุปตัวเลข</SectionTitle>
          <div style={{display:'grid',gap:11,fontSize:13.5}}>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>เทียบเป้า</span><b className="tnum">{insight.cur?aiPct(insight.targetPct):'-'}</b></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>เฉลี่ย/วัน</span><b className="tnum">{insight.cur?aiMoney(insight.avgDay):'-'}</b></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>เมนูมีสูตร</span><b className="tnum">{insight.topGp.length+insight.lowGp.length}</b></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>ยังไม่มีสูตร</span><b className="tnum">{insight.missingRecipe.length}</b></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>ชั่วโมงพีค</span><b>{insight.peakHours[0]?String(insight.peakHours[0].h).padStart(2,'0')+':00':'ยังไม่มี'}</b></div>
          </div>
        </Card>
      </div>
    </div>

    <Card>
      <SectionTitle sub="เมนูและช่วงเวลาที่ระบบมองว่าน่าใช้วางแผน">รายละเอียดประกอบ</SectionTitle>
      <div className="r-stack" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:10}}>เมนูกำไรดี</h3>
          <div style={{display:'grid',gap:8}}>{insight.topGp.slice(0,5).map(x=><div key={x.m.id} style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:13.5,padding:'8px 0',borderBottom:'1px solid var(--line-2)'}}><span>{x.m.name}</span><b style={{color:'var(--green)'}}>{aiPct(x.e.gpStorePct)}</b></div>)}</div>
        </div>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:10}}>เมนูควรแก้</h3>
          <div style={{display:'grid',gap:8}}>{insight.lowGp.slice(0,5).map(x=><div key={x.m.id} style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:13.5,padding:'8px 0',borderBottom:'1px solid var(--line-2)'}}><span>{x.m.name}</span><b style={{color:'var(--orange)'}}>{aiPct(x.e.gpStorePct)}</b></div>)}</div>
        </div>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:10}}>เวลาที่ควรโฟกัส</h3>
          <div style={{display:'grid',gap:8}}>{insight.peakHours.slice(0,5).map(x=><div key={x.h} style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:13.5,padding:'8px 0',borderBottom:'1px solid var(--line-2)'}}><span>{String(x.h).padStart(2,'0')}:00 น.</span><b>{window.fmt(x.v)}</b></div>)}</div>
        </div>
      </div>
    </Card>

    <Card>
      <SectionTitle sub="อัปโหลดรูปเมนูหรือรูปสูตร แล้วให้ AI ช่วยร่างวัตถุดิบ ปริมาณ และต้นทุน">AI เพิ่มสูตรจากรูป</SectionTitle>
      <div className="r-stack" style={{display:'grid',gridTemplateColumns:'minmax(260px,.85fr) 1.15fr',gap:16,alignItems:'start'}}>
        <div style={{display:'grid',gap:12}}>
          <Field label="เลือกเมนูที่จะใส่สูตร">
            <Select value={photoMenu?.id||''} options={activeMenus.map(m=>({value:m.id,label:m.name}))} onChange={e=>{setPhotoMenuId(e.target.value);setPhotoDraft(null);}}/>
          </Field>
          <Field label="รูปเมนู / รูปสูตร / รูปวัตถุดิบ">
            <div style={{border:'1px dashed var(--line)',borderRadius:14,background:'var(--surface-2)',padding:14,display:'grid',gap:12}}>
              {photoPreview ? <img src={photoPreview} alt="รูปสำหรับให้ AI อ่านสูตร" style={{width:'100%',maxHeight:260,objectFit:'cover',borderRadius:10,border:'1px solid var(--line-2)'}}/> :
                <div style={{height:160,borderRadius:10,display:'grid',placeItems:'center',background:'var(--chip)',color:'var(--ink-3)',fontSize:13}}>ยังไม่ได้เลือกรูป</div>}
              <ImageSourceButtons onPick={onPhotoFile}/>
              {photoName&&<div style={{fontSize:12.5,color:'var(--ink-3)'}}>{photoName}</div>}
              {photoPreview&&<div><Button variant="secondary" size="sm" icon="search" onClick={()=>setPhotoOpen(true)}>ดูรูปเต็ม</Button></div>}
            </div>
          </Field>
          <Field label="AI Vision Endpoint (ถ้ามี)">
            <Input value={aiEndpoint} onChange={e=>setAiEndpoint(e.target.value)} placeholder="เช่น https://.../recipe-vision"/>
          </Field>
          <p style={{fontSize:12.5,color:'var(--ink-3)',lineHeight:1.65}}>
            ถ้ายังไม่ได้ต่อ Endpoint ปุ่มวิเคราะห์จะสร้างสูตรร่างจากชื่อเมนูและวัตถุดิบเดิมก่อน ส่วนการอ่านรูปจริงต้องใช้ Endpoint ที่เก็บ API key ไว้ฝั่ง Cloudflare Worker
          </p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <Button icon="chart" onClick={analyzePhoto} disabled={photoBusy||!photoMenu}>{photoBusy?'กำลังวิเคราะห์...':'วิเคราะห์รูป'}</Button>
            <Button variant="secondary" icon="check" onClick={applyPhotoDraft} disabled={!photoDraft||(!photoDraft.lines.length&&!photoDraft.pkgLines.length)}>บันทึกสูตรจากรูป</Button>
          </div>
          {photoErr&&<div style={{padding:'10px 12px',borderRadius:10,background:'var(--red-soft)',color:'var(--red)',fontSize:13,lineHeight:1.55}}>{photoErr}</div>}
        </div>
        <div style={{display:'grid',gap:12}}>
          {photoDraft ? <>
            <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
              <div>
                <h3 style={{fontSize:18,fontWeight:800}}>{photoMenu?.name}</h3>
                <p style={{fontSize:12.5,color:'var(--ink-3)'}}>{photoDraft.source==='vision'?'สูตรร่างจาก AI Vision':'สูตรร่างจากข้อมูลในระบบ'}{photoDraft.notes?` · ${photoDraft.notes}`:''}</p>
              </div>
              <div style={{display:'flex',gap:8}}>
                <Badge tone={photoDraft.source==='vision'?'green':'orange'}>{photoDraft.source==='vision'?'Vision':'Draft'}</Badge>
                <Badge tone={photoDraft.gp>=0.6?'green':photoDraft.gp>=0.4?'orange':'red'}>GP {aiPct(photoDraft.gp)}</Badge>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}} className="r-stack">
              <div style={{border:'1px solid var(--line-2)',borderRadius:13,overflow:'hidden'}}>
                <div style={{padding:'11px 13px',fontWeight:700,background:'var(--surface-2)',borderBottom:'1px solid var(--line-2)'}}>วัตถุดิบที่จับคู่ได้</div>
                <div style={{display:'grid'}}>
                  {photoDraft.lines.length?photoDraft.lines.map((l,i)=><div key={`${l.item.id}-${i}`} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,padding:'10px 13px',borderBottom:'1px solid var(--line-2)',fontSize:13.5}}>
                    <div><b>{l.item.name}</b><div style={{fontSize:11.5,color:'var(--ink-3)'}}>AI อ่านว่า: {l.label}</div></div>
                    <div className="tnum" style={{textAlign:'right'}}>{l.qty} {l.item.unit||l.unit}<div style={{fontSize:11.5,color:'var(--ink-3)'}}>{aiMoney((+l.qty||0)*(+l.item.costPerUnit||0))}</div></div>
                  </div>):<div style={{padding:13,color:'var(--ink-3)',fontSize:13}}>ยังไม่มีรายการวัตถุดิบ</div>}
                </div>
              </div>
              <div style={{border:'1px solid var(--line-2)',borderRadius:13,overflow:'hidden'}}>
                <div style={{padding:'11px 13px',fontWeight:700,background:'var(--surface-2)',borderBottom:'1px solid var(--line-2)'}}>แพคเกจที่จับคู่ได้</div>
                <div style={{display:'grid'}}>
                  {photoDraft.pkgLines.length?photoDraft.pkgLines.map((l,i)=><div key={`${l.item.id}-${i}`} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,padding:'10px 13px',borderBottom:'1px solid var(--line-2)',fontSize:13.5}}>
                    <div><b>{l.item.name}</b><div style={{fontSize:11.5,color:'var(--ink-3)'}}>AI อ่านว่า: {l.label}</div></div>
                    <div className="tnum" style={{textAlign:'right'}}>{l.qty} ชิ้น<div style={{fontSize:11.5,color:'var(--ink-3)'}}>{aiMoney((+l.qty||0)*(+l.item.costPerPiece||0))}</div></div>
                  </div>):<div style={{padding:13,color:'var(--ink-3)',fontSize:13}}>ยังไม่มีรายการแพคเกจ</div>}
                </div>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}} className="r-2col">
              <div style={{background:'var(--chip)',borderRadius:11,padding:'10px 12px'}}><div style={{fontSize:11.5,color:'var(--ink-3)'}}>ต้นทุนรวม</div><b className="tnum">{aiMoney(photoDraft.total)}</b></div>
              <div style={{background:'var(--chip)',borderRadius:11,padding:'10px 12px'}}><div style={{fontSize:11.5,color:'var(--ink-3)'}}>ราคาหน้าร้าน</div><b className="tnum">{aiMoney(photoMenu?.priceStore||0)}</b></div>
              <div style={{background:'var(--chip)',borderRadius:11,padding:'10px 12px'}}><div style={{fontSize:11.5,color:'var(--ink-3)'}}>กำไร/ชิ้น</div><b className="tnum">{aiMoney((photoMenu?.priceStore||0)-(photoDraft.total||0))}</b></div>
            </div>
            {photoDraft.missing.length>0&&<div style={{padding:'11px 13px',borderRadius:12,background:'var(--orange-soft)',color:'var(--orange)',fontSize:13,lineHeight:1.6}}>
              AI พบรายการที่ยังไม่มีในข้อมูลหลัก: {photoDraft.missing.join(', ')} ควรเพิ่มวัตถุดิบ/แพคเกจเหล่านี้ก่อน แล้ววิเคราะห์ซ้ำ
            </div>}
          </> : <Empty icon="recipe" title="เริ่มจากเลือกรูปหรือกดวิเคราะห์" sub="ระบบจะสร้างสูตรร่างให้ตรวจ ก่อนบันทึกเข้าเมนู & สูตร"/>}
        </div>
      </div>
    </Card>

    <div className="r-stack" style={{display:'grid',gridTemplateColumns:'1.15fr .85fr',gap:16}}>
      <Card>
        <SectionTitle sub="ตรวจว่าข้อมูลไหนทำให้วิเคราะห์ต้นทุนยังไม่แม่น">AI ตรวจข้อมูลที่ขาด</SectionTitle>
        <div style={{display:'grid',gap:10}}>
          {[
            ['เมนูยังไม่มีสูตร', insight.gaps.missingRecipe.length, insight.gaps.missingRecipe.slice(0,4).map(m=>m.name).join(', '), 'menu'],
            ['เมนูไม่มีราคาหน้าร้าน', insight.gaps.missingPrice.length, insight.gaps.missingPrice.slice(0,4).map(m=>m.name).join(', '), 'menu'],
            ['เมนูไม่มีราคา LINE MAN', insight.gaps.missingLinePrice.length, insight.gaps.missingLinePrice.slice(0,4).map(m=>m.name).join(', '), 'products'],
            ['วัตถุดิบต้นทุนไม่ครบ', insight.gaps.badIngredients.length, insight.gaps.badIngredients.slice(0,4).map(i=>i.name).join(', '), 'master'],
            ['แพคเกจต้นทุนไม่ครบ', insight.gaps.badPackages.length, insight.gaps.badPackages.slice(0,4).map(p=>p.name).join(', '), 'master'],
          ].map(([title,count,detail,route])=><div key={title} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:12,alignItems:'center',padding:'12px 14px',border:'1px solid var(--line-2)',borderRadius:12,background:count?'var(--surface-2)':'var(--green-soft)'}}>
            <div><div style={{fontWeight:700,fontSize:14}}>{title}</div><div style={{fontSize:12.5,color:'var(--ink-3)',marginTop:3}}>{count?detail||'มีรายการต้องเติมข้อมูล':'ครบแล้ว'}</div></div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}><Badge tone={count?'orange':'green'}>{window.fmt(count)}</Badge>{count>0&&<Button variant="ghost" size="sm" onClick={()=>go(route)}>ไปแก้</Button>}</div>
          </div>)}
        </div>
      </Card>

      <Card>
        <SectionTitle sub="สร้างสูตรเริ่มต้นจากชื่อเมนูและวัตถุดิบที่มี">AI ช่วยเพิ่มสูตร</SectionTitle>
        {recipeTargets.length ? <>
          <Field label="เลือกเมนูที่ยังไม่มีสูตร">
            <Select value={recipeMenu?.id||''} options={recipeTargets.map(m=>({value:m.id,label:m.name}))} onChange={e=>setRecipeMenuId(e.target.value)}/>
          </Field>
          {recipeDraft&&<div style={{marginTop:14,display:'grid',gap:10}}>
            <div style={{padding:'12px 14px',borderRadius:12,background:'var(--surface-2)'}}>
              <div style={{fontWeight:700,marginBottom:8}}>{recipeMenu.name}</div>
              <div style={{display:'grid',gap:6,fontSize:13.5}}>
                {recipeDraft.lines.map(l=><div key={l.item.id} style={{display:'flex',justifyContent:'space-between',gap:10}}><span>{l.item.name}</span><b className="tnum">{l.qty} {l.item.unit||l.unit}</b></div>)}
                {recipeDraft.pkgLines.map(l=><div key={l.item.id} style={{display:'flex',justifyContent:'space-between',gap:10}}><span>{l.item.name}</span><b className="tnum">{l.qty} ชิ้น</b></div>)}
                {!recipeDraft.lines.length&&!recipeDraft.pkgLines.length&&<div style={{color:'var(--orange)'}}>ยังจับคู่วัตถุดิบไม่ได้</div>}
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div style={{background:'var(--chip)',borderRadius:11,padding:'10px 12px'}}><div style={{fontSize:11.5,color:'var(--ink-3)'}}>ต้นทุนร่าง</div><b className="tnum">{aiMoney(recipeDraft.total)}</b></div>
              <div style={{background:'var(--chip)',borderRadius:11,padding:'10px 12px'}}><div style={{fontSize:11.5,color:'var(--ink-3)'}}>GP ร่าง</div><b className="tnum" style={{color:recipeDraft.gp>=0.6?'var(--green)':recipeDraft.gp>=0.4?'var(--orange)':'var(--red)'}}>{aiPct(recipeDraft.gp)}</b></div>
            </div>
            {recipeDraft.missing.length>0&&<div style={{fontSize:12.5,color:'var(--orange)',lineHeight:1.6}}>ควรเพิ่มข้อมูล: {recipeDraft.missing.join(', ')}</div>}
            <Button icon="check" onClick={applyDraft} disabled={!recipeDraft.lines.length&&!recipeDraft.pkgLines.length}>สร้างสูตรร่าง</Button>
            <p style={{fontSize:11.5,color:'var(--ink-3)',lineHeight:1.6}}>สูตรร่างเป็นค่าเริ่มต้น ควรเข้าเมนู & สูตรเพื่อตรวจปริมาณจริงก่อนใช้งานจริง</p>
          </div>}
        </> : <Empty icon="recipe" title="ทุกเมนูมีสูตรแล้ว" sub="ถ้าต้องการปรับสูตร ให้เข้าเมนู & สูตรเพื่อแก้ปริมาณรายเมนู"/>}
      </Card>
    </div>
    <Modal open={photoOpen} onClose={()=>setPhotoOpen(false)} title="รูปสำหรับ AI" width={920}
      footer={<Button variant="secondary" onClick={()=>setPhotoOpen(false)}>ปิด</Button>}>
      <img src={photoPreview||''} alt="รูปสำหรับ AI" style={{width:'100%',maxHeight:'75vh',objectFit:'contain',borderRadius:12,border:'1px solid var(--line-2)',background:'var(--surface-2)'}}/>
    </Modal>
  </div>;
}
Object.assign(window, { AIAdvisor, aiBuildInsights, aiRecipeDraft, aiRecipeFromVision, aiFileToDataUrl, aiMatchNamed, aiMatchCandidates, aiMissingLabel });
