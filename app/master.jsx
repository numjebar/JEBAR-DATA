// ============ Master data: Ingredients / Packages / Options / Overhead ============

function ingCost(f){ const y=(+f.yield||1); const q=(+f.buyQty||0)*y; return q? (+f.buyPrice||0)/q : 0; }
function pkgCost(f){ const q=(+f.buyQty||0); return q? (+f.buyPrice||0)/q : 0; }

// ---------- CSV import for master data ----------
function mDetect(header, keys){ const norm=header.map(h=>String(h||'').trim().toLowerCase());
  for(let i=0;i<norm.length;i++){ if(keys.some(k=>norm[i]===k)) return i; }
  for(let i=0;i<norm.length;i++){ if(keys.some(k=>norm[i].startsWith(k))) return i; }
  for(let i=0;i<norm.length;i++){ if(keys.some(k=>norm[i].includes(k))) return i; }
  return -1; }
function mNum(v){ const n=parseFloat(String(v==null?'':v).replace(/[^0-9.\-]/g,'')); return isNaN(n)?0:n; }
const MASTER_SCHEMA={
  ingredients:{ code:'ING', costKey:'costPerUnit', cost:ingCost,
    cols:[['id',['รหัส','id','code']],['name',['ชื่อวัตถุดิบ','ชื่อ','วัตถุดิบ','name','item']],['category',['หมวด','category','กลุ่ม']],
      ['buyPrice',['ราคาซื้อ','ราคา','buyprice','price','cost']],['buyQty',['ปริมาณซื้อ','ปริมาณ','จำนวนซื้อ','จำนวน','qty','buyqty']],
      ['unit',['หน่วยใช้งาน','หน่วย','unit']],['buyUnit',['หน่วยซื้อ','buyunit']],['yield',['yield','ใช้ได้จริง']],
      ['supplier',['ผู้ขาย','supplier','vendor']],['status',['สถานะ','status']],['note',['หมายเหตุ','note']]],
    tmpl:'รหัส,ชื่อวัตถุดิบ,หมวด,ราคาซื้อ,ปริมาณซื้อ,หน่วยใช้งาน,Yield,ผู้ขาย,สถานะ\n,เมล็ดกาแฟ,Coffee,450,1000,กรัม,1,ร้านกาแฟ,ใช้\n,นมสด,Milk,55,1000,ml,1,แม็คโคร,ใช้\n' },
  packages:{ code:'PKG', costKey:'costPerPiece', cost:pkgCost,
    cols:[['id',['รหัส','id','code']],['name',['ชื่อแพคเกจ','ชื่อ','แพคเกจ','name','item']],['type',['ประเภท','type','หมวด']],
      ['buyPrice',['ราคาซื้อ','ราคา','buyprice','price','cost']],['buyQty',['จำนวนซื้อ','จำนวน','ปริมาณ','qty','buyqty']],
      ['unit',['หน่วย','unit']],['supplier',['ผู้ขาย','supplier']],['status',['สถานะ','status']],['note',['หมายเหตุ','note']]],
    tmpl:'รหัส,ชื่อแพคเกจ,ประเภท,ราคาซื้อ,จำนวนซื้อ,สถานะ\n,แก้ว 16oz,แก้ว,200,100,ใช้\n,ฝาแก้ว,ฝา,80,100,ใช้\n' },
  options:{ code:'OP',
    cols:[['id',['รหัส','id','code']],['name',['ชื่อตัวเลือก','ชื่อ','ตัวเลือก','name']],['group',['กลุ่ม','group']],
      ['type',['ประเภท','type']],['addPrice',['เพิ่มราคา','addprice','ราคา','price']],['status',['สถานะ','status']]],
    tmpl:'รหัส,ชื่อตัวเลือก,กลุ่ม,ประเภท,เพิ่มราคา,สถานะ\n,เพิ่มช็อต,ROAST,ROAST,15,ใช้\n,หวานน้อย,SWEET,SWEET,0,ใช้\n' },
  overhead:{ key:'name',
    cols:[['name',['รายการ','ชื่อ','name','item']],['amount',['จำนวน','amount','ค่าใช้จ่าย','cost']],['type',['ประเภท','type']],['note',['หมายเหตุ','note']]],
    tmpl:'รายการ,จำนวน,ประเภท,หมายเหตุ\nค่าเช่าสถานที่,15000,Fixed,รายเดือน\nค่าไฟฟ้า,4000,Variable,\n' },
};

// ---------- sorting ----------
function mCodeNum(id){ const m=String(id||'').match(/(\d+)/); return m?+m[1]:0; }
const MASTER_SORT={
  ingredients:[['code','รหัส'],['category','หมวด'],['name','ชื่อ'],['price','ราคาซื้อ'],['cost','ต้นทุน/หน่วย']],
  packages:[['code','รหัส'],['type','ประเภท'],['name','ชื่อ'],['price','ราคาซื้อ'],['cost','ต้นทุน/ชิ้น']],
  options:[['code','รหัส'],['group','กลุ่ม'],['name','ชื่อ'],['price','เพิ่มราคา']],
  overhead:[['name','รายการ'],['type','ประเภท'],['amount','จำนวน']],
};
function mSortVal(tab,it,field){
  switch(field){
    case 'code': return mCodeNum(it.id);
    case 'name': return it.name||'';
    case 'category': return it.category||'';
    case 'type': return it.type||'';
    case 'group': return it.group||'';
    case 'price': return tab==='options'?(+it.addPrice||0):(+it.buyPrice||0);
    case 'cost': return tab==='ingredients'?(+it.costPerUnit||0):(+it.costPerPiece||0);
    case 'amount': return +it.amount||0;
    default: return 0;
  }
}
function mSortRows(tab, arr, field, dir){
  const s=[...arr].sort((a,b)=>{ const va=mSortVal(tab,a,field), vb=mSortVal(tab,b,field);
    let c; if(typeof va==='string'||typeof vb==='string') c=String(va).localeCompare(String(vb),'th'); else c=va-vb;
    if(c===0) c=mCodeNum(a.id)-mCodeNum(b.id);
    return dir==='desc'?-c:c; });
  return s;
}

function IngredientModal({ open, onClose, initial }){
  const { db, upsert, flash } = useData();
  const blank={id:'',name:'',category:db.ingCategories[0]||'',unit:'กรัม',buyPackName:'',buyPrice:'',buyQty:'',buyUnit:'',yield:1,supplier:'',status:'ใช้',note:''};
  const [f,setF]=React.useState(blank);
  React.useEffect(()=>{ if(open) setF(initial?{...initial}:{...blank,id:nextCode(db.ingredients,'ING')}); },[open,initial]);
  const cpu=ingCost(f);
  const submit=()=>{ if(!f.name){flash('กรอกชื่อวัตถุดิบ','err');return;}
    if(dupName(db.ingredients,f.name,'id',initial?initial.id:null)){flash('มีวัตถุดิบชื่อนี้แล้ว','err');return;}
    const id=(f.id||'').trim()||nextCode(db.ingredients,'ING');
    if(!initial && db.ingredients.some(x=>x.id===id)){flash('รหัสนี้มีอยู่แล้ว ลองแก้รหัส','err');return;}
    upsert('ingredients',{...f,id,buyPrice:+f.buyPrice||0,buyQty:+f.buyQty||0,yield:Math.max(0.01,Math.min(1,+f.yield||1)),costPerUnit:cpu}); flash('บันทึกแล้ว'); onClose(); };
  return <Modal open={open} onClose={onClose} title={initial?'แก้ไขวัตถุดิบ':'เพิ่มวัตถุดิบ'} width={580}
    footer={<><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button onClick={submit} icon="check">บันทึก</Button></>}>
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'grid',gridTemplateColumns:'130px 1fr 130px',gap:12}}>
        <Field label="รหัส" hint={initial?'แก้ไม่ได้':'อัตโนมัติ · แก้ได้'}><Input value={f.id} disabled={!!initial} placeholder="อัตโนมัติ" onChange={e=>setF({...f,id:e.target.value.toUpperCase()})}/></Field>
        <Field label="ชื่อวัตถุดิบ"><Input autoFocus value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></Field>
        <Field label="หมวด"><TypeSelect value={f.category} options={db.ingCategories} coll="ingCategories" onChange={v=>setF({...f,category:v})}/></Field>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        <Field label="ราคาซื้อ (฿)"><Input type="number" value={f.buyPrice} onChange={e=>setF({...f,buyPrice:e.target.value})}/></Field>
        <Field label="ปริมาณซื้อ"><Input type="number" value={f.buyQty} onChange={e=>setF({...f,buyQty:e.target.value})}/></Field>
        <Field label="หน่วยใช้งาน"><Input value={f.unit} placeholder="กรัม / ml" onChange={e=>setF({...f,unit:e.target.value})}/></Field>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        <Field label="Yield % (ใช้ได้จริง)" hint="0–100% · เช่น 90 = หลังเตรียมเหลือใช้ 90%"><Input type="number" step="1" min="0" max="100" value={(f.yield!=null&&f.yield!=='')?Math.round((+f.yield)*100):100} onChange={e=>{ let p=parseFloat(e.target.value); if(isNaN(p)) p=100; p=Math.max(0,Math.min(100,p)); setF({...f,yield:p/100}); }}/></Field>
        <Field label="ผู้ขาย"><Input value={f.supplier} onChange={e=>setF({...f,supplier:e.target.value})}/></Field>
        <Field label="สถานะ"><Select value={f.status} options={['ใช้','ไม่ใช้']} onChange={e=>setF({...f,status:e.target.value})}/></Field>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px',background:'var(--green-soft)',borderRadius:12}}>
        <span style={{fontSize:13.5,fontWeight:600,color:'var(--green)'}}>ต้นทุน/หน่วย (คำนวณอัตโนมัติ)</span>
        <span className="tnum" style={{fontSize:19,fontWeight:700,color:'var(--green)'}}>{fmtB(cpu,3)} / {f.unit||'หน่วย'}</span>
      </div>
    </div>
  </Modal>;
}

function PackageModal({ open, onClose, initial }){
  const { db, upsert, flash } = useData();
  const blank={id:'',name:'',type:db.pkgTypes[0]||'',unit:'ชิ้น',buyPackName:'',buyPrice:'',buyQty:'',buyUnit:'',supplier:'',status:'ใช้',note:''};
  const [f,setF]=React.useState(blank);
  React.useEffect(()=>{ if(open) setF(initial?{...initial}:{...blank,id:nextCode(db.packages,'PKG')}); },[open,initial]);
  const cpp=pkgCost(f);
  const submit=()=>{ if(!f.name){flash('กรอกชื่อแพคเกจ','err');return;}
    if(dupName(db.packages,f.name,'id',initial?initial.id:null)){flash('มีแพคเกจชื่อนี้แล้ว','err');return;}
    const id=(f.id||'').trim()||nextCode(db.packages,'PKG');
    if(!initial && db.packages.some(x=>x.id===id)){flash('รหัสนี้มีอยู่แล้ว','err');return;}
    upsert('packages',{...f,id,buyPrice:+f.buyPrice||0,buyQty:+f.buyQty||0,costPerPiece:cpp}); flash('บันทึกแล้ว'); onClose(); };
  return <Modal open={open} onClose={onClose} title={initial?'แก้ไขแพคเกจ':'เพิ่มแพคเกจ'} width={560}
    footer={<><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button onClick={submit} icon="check">บันทึก</Button></>}>
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'grid',gridTemplateColumns:'130px 1fr 120px',gap:12}}>
        <Field label="รหัส" hint={initial?'แก้ไม่ได้':'อัตโนมัติ'}><Input value={f.id} disabled={!!initial} placeholder="อัตโนมัติ" onChange={e=>setF({...f,id:e.target.value.toUpperCase()})}/></Field>
        <Field label="ชื่อแพคเกจ"><Input autoFocus value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></Field>
        <Field label="ประเภท"><TypeSelect value={f.type} options={db.pkgTypes} coll="pkgTypes" onChange={v=>setF({...f,type:v})}/></Field>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        <Field label="ราคาซื้อ (฿)"><Input type="number" value={f.buyPrice} onChange={e=>setF({...f,buyPrice:e.target.value})}/></Field>
        <Field label="จำนวนซื้อ"><Input type="number" value={f.buyQty} onChange={e=>setF({...f,buyQty:e.target.value})}/></Field>
        <Field label="สถานะ"><Select value={f.status} options={['ใช้','ไม่ใช้']} onChange={e=>setF({...f,status:e.target.value})}/></Field>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px',background:'var(--orange-soft)',borderRadius:12}}>
        <span style={{fontSize:13.5,fontWeight:600,color:'var(--orange)'}}>ต้นทุน/ชิ้น (คำนวณอัตโนมัติ)</span>
        <span className="tnum" style={{fontSize:19,fontWeight:700,color:'var(--orange)'}}>{fmtB(cpp,3)}</span>
      </div>
    </div>
  </Modal>;
}

function OptionModal({ open, onClose, initial }){
  const { db, upsert, flash } = useData();
  const blank={id:'',group:db.optionGroups[0]||'',type:'',name:'',addPrice:'',status:'ใช้'};
  const [f,setF]=React.useState(blank);
  React.useEffect(()=>{ if(open) setF(initial?{...initial}:{...blank,id:nextCode(db.options,'OP')}); },[open,initial]);
  const submit=()=>{ if(!f.name){flash('กรอกชื่อตัวเลือก','err');return;}
    if(dupName(db.options,f.name,'id',initial?initial.id:null)){flash('มีตัวเลือกชื่อนี้แล้ว','err');return;}
    const id=(f.id||'').trim()||nextCode(db.options,'OP');
    if(!initial && db.options.some(x=>x.id===id)){flash('รหัสนี้มีอยู่แล้ว','err');return;}
    upsert('options',{...f,id,addPrice:+f.addPrice||0}); flash('บันทึกแล้ว'); onClose(); };
  return <Modal open={open} onClose={onClose} title={initial?'แก้ไขออปชัน':'เพิ่มออปชัน'} width={520}
    footer={<><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button onClick={submit} icon="check">บันทึก</Button></>}>
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'grid',gridTemplateColumns:'120px 1fr',gap:12}}>
        <Field label="รหัส" hint={initial?'แก้ไม่ได้':'อัตโนมัติ'}><Input value={f.id} disabled={!!initial} placeholder="อัตโนมัติ" onChange={e=>setF({...f,id:e.target.value.toUpperCase()})}/></Field>
        <Field label="ชื่อตัวเลือก"><Input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></Field>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        <Field label="กลุ่ม"><TypeSelect value={f.group} options={db.optionGroups} coll="optionGroups" onChange={v=>setF({...f,group:v})}/></Field>
        <Field label="ประเภท"><Input value={f.type} placeholder="ROAST" onChange={e=>setF({...f,type:e.target.value})}/></Field>
        <Field label="เพิ่มราคา (฿)"><Input type="number" value={f.addPrice} onChange={e=>setF({...f,addPrice:e.target.value})}/></Field>
      </div>
      <Field label="สถานะ" style={{maxWidth:160}}><Select value={f.status} options={['ใช้','ไม่ใช้']} onChange={e=>setF({...f,status:e.target.value})}/></Field>
    </div>
  </Modal>;
}

function OverheadModal({ open, onClose, initial }){
  const { upsert, flash } = useData();
  const blank={name:'',amount:'',type:'Fixed',note:''};
  const [f,setF]=React.useState(blank);
  React.useEffect(()=>{ if(open) setF(initial?{...initial}:blank); },[open,initial]);
  const submit=()=>{ if(!f.name){flash('กรอกชื่อรายการ','err');return;}
    upsert('overhead',{...f,amount:+f.amount||0},'name'); flash('บันทึกแล้ว'); onClose(); };
  return <Modal open={open} onClose={onClose} title={initial?'แก้ไขค่าใช้จ่าย':'เพิ่มค่าใช้จ่าย'} width={480}
    footer={<><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button onClick={submit} icon="check">บันทึก</Button></>}>
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <Field label="รายการ"><Input value={f.name} disabled={!!initial} placeholder="ค่าเช่าสถานที่" onChange={e=>setF({...f,name:e.target.value})}/></Field>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Field label="จำนวน (฿/เดือน)"><Input type="number" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/></Field>
        <Field label="ประเภท"><Select value={f.type} options={['Fixed','Variable']} onChange={e=>setF({...f,type:e.target.value})}/></Field>
      </div>
      <Field label="หมายเหตุ"><Input value={f.note} onChange={e=>setF({...f,note:e.target.value})}/></Field>
    </div>
  </Modal>;
}

// ---- swipe-to-delete row ----
function SwipeRow({ cells, onEdit, onDelete }){
  const [dx,setDx]=React.useState(0);
  const st=React.useRef({x:0,active:false});
  const down=e=>{ const x=e.touches?e.touches[0].clientX:e.clientX; st.current={x,active:true}; };
  const move=e=>{ const s=st.current; if(!s.active) return; const x=e.touches?e.touches[0].clientX:e.clientX; let d=x-s.x; if(d>0) d=0; if(d<-130) d=-130; setDx(d); };
  const up=()=>{ const s=st.current; if(!s.active) return; s.active=false; const del=dx<-70; setDx(0); if(del) onDelete(); };
  const red=Math.min(1,-dx/70);
  return <tr
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
    onTouchStart={down} onTouchMove={move} onTouchEnd={up}
    style={{borderTop:'1px solid var(--line-2)',transform:`translateX(${dx}px)`,transition:st.current.active?'none':'transform .22s',
      background: dx<0?`rgba(224,53,43,${0.05+red*0.13})`:'', touchAction:'pan-y'}}>
    {cells}
    <td style={{padding:'8px 18px'}}>
      <div style={{display:'flex',gap:2,justifyContent:'flex-end',alignItems:'center'}}>
        {dx<-12 && <span style={{fontSize:12,fontWeight:700,color:'var(--red)',marginRight:4,whiteSpace:'nowrap'}}>{dx<-70?'ปล่อยเพื่อลบ':'ลบ'}</span>}
        <IconBtn name="edit" title="แก้ไข" onClick={()=>onEdit()}/>
        <IconBtn name="trash" title="ลบ" danger onClick={()=>onDelete()}/>
      </div>
    </td>
  </tr>;
}

function MasterTable({ headers, rows, render, onEdit, onDelete, getKey }){
  return <Card pad={0}>
    <div style={{overflowX:'auto'}}>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
      <thead><tr style={{color:'var(--ink-2)',fontSize:12.5}}>
        {headers.map((h,i)=><th key={i} style={{textAlign:h.align||'left',padding:i===0?'13px 22px':'13px 10px',fontWeight:600}}>{h.label}</th>)}
        <th style={{padding:'13px 22px',width:80}}></th>
      </tr></thead>
      <tbody>
        {rows.map((r)=>(
          <SwipeRow key={getKey(r)} cells={render(r)} onEdit={()=>onEdit(r)} onDelete={()=>onDelete(r)}/>
        ))}
      </tbody>
    </table>
    </div>
    {rows.length===0 && <Empty icon="layers" title="ไม่พบรายการ"/>}
  </Card>;
}

function Master(){
  const { db, remove, setCollection, setDb, flash } = useData();
  const [tab,setTab]=React.useState('ingredients');
  const [q,setQ]=React.useState('');
  const [modal,setModal]=React.useState(false);
  const [edit,setEdit]=React.useState(null);
  const impRef=React.useRef();
  const [sort,setSort]=React.useState('code');
  const [dir,setDir]=React.useState('asc');
  React.useEffect(()=>{ setQ(''); setSort(tab==='overhead'?'name':'code'); setDir('asc'); },[tab]);

  const open=(item)=>{ setEdit(item); setModal(true); };
  const ql=q.toLowerCase();
  const delWithUndo=(coll,item,keyField='id')=>{ const key=item[keyField]; remove(coll,key,keyField);
    flash('ลบ "'+(item.name||key)+'" แล้ว','ok',{label:'เลิกทำ',fn:()=>setDb(prev=>({...prev,[coll]:[item,...(prev[coll]||[])]}))}); };

  const downloadTemplate=()=>{ const sch=MASTER_SCHEMA[tab]; saveFileSmart(`master-${tab}-template.csv`, '\uFEFF'+sch.tmpl, 'text/csv', false); };
  const importCSV=async(file)=>{
    try{
      const rows=await window.__posReadFile(file);
      if(!rows||rows.length<2){ flash('ไม่พบข้อมูลในไฟล์','err'); return; }
      const header=rows[0].map(h=>String(h||'').trim());
      const sch=MASTER_SCHEMA[tab];
      const idx={}; sch.cols.forEach(([f,keys])=>{ idx[f]=mDetect(header,keys); });
      if(idx.name<0){ flash('หาคอลัมน์ชื่อไม่เจอ — ลองดาวน์โหลดเทมเพลตเป็นแนวทาง','err'); return; }
      const existing=[...db[tab]];
      const keyField=sch.key||'id';
      let added=0, updated=0;
      for(let r=1;r<rows.length;r++){
        const row=rows[r]; if(!row) continue;
        const name=String(row[idx.name]||'').trim();
        if(!name || name.toLowerCase()==='total') continue;
        const obj={};
        sch.cols.forEach(([f,keys])=>{ const c=idx[f]; if(c>=0 && row[c]!=null && String(row[c]).trim()!=='') obj[f]=String(row[c]).trim(); });
        ['buyPrice','buyQty','yield','addPrice','amount'].forEach(k=>{ if(obj[k]!=null) obj[k]=mNum(obj[k]); });
        obj.status=obj.status||'ใช้';
        if(tab==='ingredients'){ let y=obj.yield; if(y==null||isNaN(y)) y=1; if(y>1.5) y=y/100; obj.yield=Math.max(0.01,Math.min(1,y)); }
        if(tab==='overhead'){ obj.type=obj.type||'Fixed'; }
        else {
          let id=(obj.id||'').toString().trim().toUpperCase();
          if(!id) id=nextCode(existing,sch.code);
          obj.id=id;
          if(tab==='options') obj.group=obj.group||db.optionGroups[0]||'';
          if(sch.cost) obj[sch.costKey]=sch.cost(obj);
        }
        const k=obj[keyField];
        const i=existing.findIndex(x=>x[keyField]===k);
        if(i>=0){ existing[i]={...existing[i],...obj}; updated++; } else { existing.push(obj); added++; }
      }
      setDb(prev=>{
        const next={...prev,[tab]:existing};
        const listColl={ingredients:'ingCategories',packages:'pkgTypes',options:'optionGroups'}[tab];
        const listField={ingredients:'category',packages:'type',options:'group'}[tab];
        if(listColl){ const cur=prev[listColl]||[]; const add=[...new Set(existing.map(x=>x[listField]).filter(v=>v&&!cur.includes(v)))]; if(add.length) next[listColl]=[...cur,...add]; }
        return next;
      });
      flash(`นำเข้า ${added} รายการ`+(updated?` · อัปเดต ${updated}`:'')+(idx.id<0&&tab!=='overhead'?' · สร้างรหัสอัตโนมัติ':''));
    }catch(e){ flash('นำเข้าไม่สำเร็จ: '+e.message,'err'); }
  };

  const tabs=[
    {value:'ingredients',label:`วัตถุดิบ (${db.ingredients.length})`},
    {value:'packages',label:`แพคเกจ (${db.packages.length})`},
    {value:'options',label:`ออปชัน (${db.options.length})`},
    {value:'overhead',label:`ค่าใช้จ่าย (${db.overhead.length})`},
  ];

  let content;
  if(tab==='ingredients'){
    const rows=mSortRows(tab, db.ingredients.filter(i=>!q||i.name.toLowerCase().includes(ql)||i.id.toLowerCase().includes(ql)), sort, dir);
    content=<MasterTable getKey={r=>r.id}
      headers={[{label:'วัตถุดิบ'},{label:'หมวด'},{label:'ราคาซื้อ',align:'right'},{label:'Yield',align:'right'},{label:'ต้นทุน/หน่วย',align:'right'},{label:'สถานะ',align:'center'}]}
      rows={rows.slice(0,250)} onEdit={open} onDelete={r=>delWithUndo('ingredients',r)}
      render={i=><>
        <td style={{padding:'11px 22px'}}><div style={{fontWeight:600}}>{i.name}</div><div style={{fontSize:12,color:'var(--ink-3)'}}>{i.id}</div></td>
        <td style={{padding:'11px 10px'}}><Badge tone="gray">{i.category}</Badge></td>
        <td className="tnum" style={{textAlign:'right',padding:'11px 10px'}}>{fmtB(i.buyPrice)} <span style={{color:'var(--ink-3)',fontSize:12}}>/{fmt(i.buyQty)}{i.buyUnit||''}</span></td>
        <td className="tnum" style={{textAlign:'right',padding:'11px 10px',color:'var(--ink-2)'}}>{fmtPct(i.yield,0)}</td>
        <td className="tnum" style={{textAlign:'right',padding:'11px 10px',fontWeight:600,color:'var(--green)'}}>{fmtB(i.costPerUnit,3)}</td>
        <td style={{textAlign:'center',padding:'11px 10px'}}><Badge tone={i.status==='ใช้'?'green':'gray'}>{i.status}</Badge></td>
      </>}/>;
  } else if(tab==='packages'){
    const rows=mSortRows(tab, db.packages.filter(i=>!q||i.name.toLowerCase().includes(ql)||i.id.toLowerCase().includes(ql)), sort, dir);
    content=<MasterTable getKey={r=>r.id}
      headers={[{label:'แพคเกจ'},{label:'ประเภท'},{label:'ราคาซื้อ',align:'right'},{label:'ต้นทุน/ชิ้น',align:'right'},{label:'สถานะ',align:'center'}]}
      rows={rows.slice(0,250)} onEdit={open} onDelete={r=>delWithUndo('packages',r)}
      render={i=><>
        <td style={{padding:'11px 22px'}}><div style={{fontWeight:600}}>{i.name}</div><div style={{fontSize:12,color:'var(--ink-3)'}}>{i.id}</div></td>
        <td style={{padding:'11px 10px'}}><Badge tone="gray">{i.type}</Badge></td>
        <td className="tnum" style={{textAlign:'right',padding:'11px 10px'}}>{fmtB(i.buyPrice)} <span style={{color:'var(--ink-3)',fontSize:12}}>/{fmt(i.buyQty)}{i.buyUnit||''}</span></td>
        <td className="tnum" style={{textAlign:'right',padding:'11px 10px',fontWeight:600,color:'var(--orange)'}}>{fmtB(i.costPerPiece,3)}</td>
        <td style={{textAlign:'center',padding:'11px 10px'}}><Badge tone={i.status==='ใช้'?'green':'gray'}>{i.status}</Badge></td>
      </>}/>;
  } else if(tab==='options'){
    const rows=mSortRows(tab, db.options.filter(i=>!q||i.name.toLowerCase().includes(ql)||i.id.toLowerCase().includes(ql)), sort, dir);
    content=<MasterTable getKey={r=>r.id}
      headers={[{label:'ตัวเลือก'},{label:'กลุ่ม'},{label:'ประเภท'},{label:'เพิ่มราคา',align:'right'},{label:'สถานะ',align:'center'}]}
      rows={rows} onEdit={open} onDelete={r=>delWithUndo('options',r)}
      render={i=><>
        <td style={{padding:'11px 22px'}}><div style={{fontWeight:600}}>{i.name}</div><div style={{fontSize:12,color:'var(--ink-3)'}}>{i.id}</div></td>
        <td style={{padding:'11px 10px'}}><Badge tone="blue">{i.group}</Badge></td>
        <td style={{padding:'11px 10px',color:'var(--ink-2)'}}>{i.type}</td>
        <td className="tnum" style={{textAlign:'right',padding:'11px 10px',fontWeight:600}}>{i.addPrice>0?'+'+fmtB(i.addPrice):'ฟรี'}</td>
        <td style={{textAlign:'center',padding:'11px 10px'}}><Badge tone={i.status==='ใช้'?'green':'gray'}>{i.status}</Badge></td>
      </>}/>;
  } else {
    const rows=mSortRows(tab, db.overhead.filter(i=>!q||i.name.toLowerCase().includes(ql)), sort, dir);
    const total=overheadTotal(db);
    content=<><div style={{marginBottom:16}}>
      <Stat label="ค่าใช้จ่ายรวมต่อเดือน" value={fmtB(total)} icon="wallet" tone="var(--orange)"/></div>
      <MasterTable getKey={r=>r.name}
      headers={[{label:'รายการ'},{label:'ประเภท'},{label:'จำนวน/เดือน',align:'right'},{label:'หมายเหตุ'}]}
      rows={rows} onEdit={open} onDelete={r=>delWithUndo('overhead',r,'name')}
      render={i=><>
        <td style={{padding:'11px 22px',fontWeight:600}}>{i.name}</td>
        <td style={{padding:'11px 10px'}}><Badge tone={i.type==='Fixed'?'gray':'orange'}>{i.type}</Badge></td>
        <td className="tnum" style={{textAlign:'right',padding:'11px 10px',fontWeight:600}}>{fmtB(i.amount)}</td>
        <td style={{padding:'11px 10px',color:'var(--ink-2)',fontSize:13}}>{i.note||'—'}</td>
      </>}/></>;
  }

  const ModalEl={ingredients:IngredientModal,packages:PackageModal,options:OptionModal,overhead:OverheadModal}[tab];

  return <div className="view-enter" style={{display:'flex',flexDirection:'column',gap:18}}>
    <Segmented value={tab} onChange={setTab} options={tabs}/>
    <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
      <Search value={q} onChange={setQ} placeholder="ค้นหา"/>
      <div style={{flex:1}}/>
      <Button variant="ghost" size="sm" onClick={downloadTemplate}>เทมเพลต CSV</Button>
      <Button variant="secondary" icon="upload" onClick={()=>impRef.current.click()}>นำเข้า CSV</Button>
      <Button icon="plus" onClick={()=>{setEdit(null);setModal(true);}}>เพิ่มรายการ</Button>
      <input ref={impRef} type="file" accept=".csv,.xlsx,.txt" style={{display:'none'}} onChange={e=>{ if(e.target.files[0]) importCSV(e.target.files[0]); e.target.value=''; }}/>
    </div>
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
      <span style={{fontSize:12.5,color:'var(--ink-3)',fontWeight:600}}>เรียงตาม</span>
      <div style={{display:'flex',gap:2,background:'var(--chip)',padding:3,borderRadius:10,flexWrap:'wrap'}}>
        {MASTER_SORT[tab].map(([fld,label])=>(
          <button key={fld} onClick={()=>setSort(fld)} style={{padding:'6px 12px',borderRadius:8,fontSize:12.5,fontWeight:sort===fld?600:500,
            color:sort===fld?'var(--accent)':'var(--ink-2)',background:sort===fld?'var(--accent-soft)':'transparent'}}>{label}</button>
        ))}
      </div>
      <button onClick={()=>setDir(dir==='asc'?'desc':'asc')} title="สลับลำดับ"
        style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 13px',borderRadius:9,fontSize:12.5,fontWeight:600,border:'1px solid var(--line)',color:'var(--ink-2)',background:'var(--card)'}}>
        <span style={{fontSize:11}}>{dir==='asc'?'▲':'▼'}</span>{dir==='asc'?'น้อย → มาก':'มาก → น้อย'}
      </button>
      <span style={{fontSize:11.5,color:'var(--ink-3)'}}>· ปัดแถวไปทางซ้ายเพื่อลบ (มีปุ่มเลิกทำ)</span>
    </div>
    {content}
    <ModalEl open={modal} onClose={()=>setModal(false)} initial={edit}/>
  </div>;
}
Object.assign(window, { Master });
