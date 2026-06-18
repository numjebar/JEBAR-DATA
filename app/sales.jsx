// ============ Daily Sales ============
function SaleModal({ open, onClose, initial }){
  const { saveSale, flash, db, settings } = useData();
  const multiBranch=(db.branches||[]).length>1;
  const [f,setF]=React.useState({date:'',store:'',line:'',other:'',bills:'',branch:''});
  React.useEffect(()=>{ if(open){ const defBranch = (settings.activeBranch && settings.activeBranch!=='ทั้งหมด')? settings.activeBranch : (db.branches&&db.branches[0])||''; setF(initial?{branch:'',...initial}:{date:new Date().toISOString().slice(0,10),store:'',line:'',other:'',bills:'',branch:defBranch}); } },[open,initial]);
  const total=(+f.store||0)+(+f.line||0)+(+f.other||0);
  const submit=()=>{
    if(!f.date){ flash('กรุณาเลือกวันที่','err'); return; }
    saveSale({date:f.date,store:+f.store||0,line:+f.line||0,other:+f.other||0,bills:+f.bills||0,...(multiBranch?{branch:f.branch}:{})});
    flash('บันทึกยอดขายแล้ว'); onClose();
  };
  return <Modal open={open} onClose={onClose} title={initial?'แก้ไขยอดขาย':'บันทึกยอดขาย'} width={460}
    footer={<><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button onClick={submit} icon="check">บันทึก</Button></>}>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <Field label="วันที่"><Input type="date" value={f.date} disabled={!!initial}
        onChange={e=>setF({...f,date:e.target.value})}/></Field>
      {multiBranch && <Field label="สาขา"><Select value={f.branch} options={db.branches} onChange={e=>setF({...f,branch:e.target.value})}/></Field>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Field label="หน้าร้าน (฿)"><Input type="number" inputMode="decimal" value={f.store} placeholder="0"
          onChange={e=>setF({...f,store:e.target.value})}/></Field>
        <Field label="LINE MAN (฿)"><Input type="number" inputMode="decimal" value={f.line} placeholder="0"
          onChange={e=>setF({...f,line:e.target.value})}/></Field>
      </div>
      <Field label="ช่องทางอื่นๆ (฿)"><Input type="number" inputMode="decimal" value={f.other} placeholder="0"
        onChange={e=>setF({...f,other:e.target.value})}/></Field>
      <Field label="จำนวนบิล (ออเดอร์)" hint="ไม่บังคับ — ใช้คำนวณยอดเฉลี่ย/บิล และจุดคุ้มทุนแม่นขึ้น"><Input type="number" inputMode="numeric" value={f.bills} placeholder="0"
        onChange={e=>setF({...f,bills:e.target.value})}/></Field>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px',background:'var(--accent-soft)',borderRadius:12}}>
        <span style={{fontSize:14,fontWeight:600,color:'var(--accent)'}}>รวมทั้งวัน</span>
        <span className="tnum" style={{fontSize:21,fontWeight:700,color:'var(--accent)'}}>{fmtB(total)}</span>
      </div>
    </div>
  </Modal>;
}

function Sales(){
  const { fdb:db, removeSale, THAI_MONTHS, settings } = useData();
  const months = aggregateByMonth(db);
  const [mk,setMk]=React.useState(months.length?months[months.length-1].key:'');
  const [modal,setModal]=React.useState(false);
  const [edit,setEdit]=React.useState(null);
  const [pos,setPos]=React.useState(false);

  const rows = db.dailySales.filter(d=>monthKey(d.date)===mk).sort((a,b)=>a.date<b.date?-1:1);
  const cur = months.find(m=>m.key===mk);
  const series = rows.map(d=>({label:String(parseInt(d.date.slice(8))),values:{store:d.store,line:d.line,other:d.other}}));
  const seriesDef=[{key:'store',color:'#0071e3',name:'หน้าร้าน'},{key:'line',color:'#30a46c',name:'LINE MAN'},{key:'other',color:'#d97a16',name:'อื่นๆ'}];
  const hasBills = rows.some(d=>(d.bills||0)>0);
  const monthBills = rows.reduce((s,d)=>s+(d.bills||0),0);

  const openNew=()=>{ setEdit(null); setModal(true); };
  const openEdit=(d)=>{ setEdit({date:d.date,store:d.store,line:d.line,other:d.other,bills:d.bills||''}); setModal(true); };

  return (
    <div className="view-enter" style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <Segmented value={mk} onChange={setMk}
          options={months.map(m=>({value:m.key,label:`${THAI_MONTHS[m.monthIdx]} ${parseInt(m.year)+543}`}))}/>
        <div style={{display:'flex',gap:10}}>
          <Button variant="secondary" icon="upload" onClick={()=>setPos(true)}>นำเข้าจาก POS วงใน</Button>
          <Button icon="plus" onClick={openNew}>บันทึกยอดขาย</Button>
        </div>
      </div>

      {cur && <div className="r-2col" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
        <Stat label="รวมทั้งเดือน" value={fmtB(cur.total)} icon="sales"/>
        <Stat label="เฉลี่ยต่อวัน" value={fmtB(cur.total/cur.days)} icon="trend"/>
        {hasBills
          ? <Stat label="จำนวนบิลรวม" value={fmt(monthBills)} tone="#0071e3" icon="sales" sub={`เฉลี่ย ${fmt(monthBills/cur.days)} บิล/วัน`}/>
          : <Stat label="หน้าร้าน" value={fmtB(cur.store)} tone="#0071e3" sub={fmtPct(cur.store/cur.total,0)}/>}
        {hasBills
          ? <Stat label="ยอดเฉลี่ย/บิล" value={fmtB(monthBills? cur.total/monthBills:0)} tone="#30a46c" icon="target" sub="Avg basket size"/>
          : <Stat label="LINE MAN" value={fmtB(cur.line)} tone="#30a46c" sub={fmtPct(cur.line/cur.total,0)}/>}
      </div>}

      <Card>
        <SectionTitle sub="แยกตามช่องทางรายวัน">ยอดขายรายวัน</SectionTitle>
        {series.length? <>
          <SalesChart data={series} series={seriesDef} height={250} type={settings.salesChart}/>
          <div style={{display:'flex',gap:18,justifyContent:'center',marginTop:8}}>
            {seriesDef.map(s=><div key={s.key} style={{display:'flex',alignItems:'center',gap:7}}>
              <span style={{width:10,height:10,borderRadius:3,background:s.color}}/>
              <span style={{fontSize:13,color:'var(--ink-2)'}}>{s.name}</span></div>)}
          </div>
        </> : <Empty icon="sales" title="ยังไม่มียอดขายในเดือนนี้" action={<Button icon="plus" onClick={openNew}>บันทึกยอดขาย</Button>}/>}
      </Card>

      {rows.length>0 && <Card pad={0}>
        <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
          <thead><tr style={{textAlign:'right',color:'var(--ink-2)',fontSize:12.5}}>
            <th style={{textAlign:'left',padding:'14px 22px',fontWeight:600}}>วันที่</th>
            <th style={{padding:'14px 14px',fontWeight:600}}>หน้าร้าน</th>
            <th style={{padding:'14px 14px',fontWeight:600}}>LINE MAN</th>
            <th style={{padding:'14px 14px',fontWeight:600}}>อื่นๆ</th>
            {hasBills && <th style={{padding:'14px 14px',fontWeight:600}}>บิล</th>}
            <th style={{padding:'14px 14px',fontWeight:600}}>รวม</th>
            <th style={{padding:'14px 22px',fontWeight:600,width:90}}></th>
          </tr></thead>
          <tbody>
            {rows.map((d,i)=>(
              <tr key={d.date} style={{borderTop:'1px solid var(--line-2)'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                onMouseLeave={e=>e.currentTarget.style.background=''}>
                <td style={{textAlign:'left',padding:'12px 22px',fontWeight:500}}>{fmtDate(d.date)}</td>
                <td className="tnum" style={{textAlign:'right',padding:'12px 14px'}}>{fmt(d.store)}</td>
                <td className="tnum" style={{textAlign:'right',padding:'12px 14px'}}>{fmt(d.line)}</td>
                <td className="tnum" style={{textAlign:'right',padding:'12px 14px',color:'var(--ink-2)'}}>{fmt(d.other)}</td>
                {hasBills && <td className="tnum" style={{textAlign:'right',padding:'12px 14px',color:'var(--ink-2)'}}>{d.bills?fmt(d.bills):'–'}</td>}
                <td className="tnum" style={{textAlign:'right',padding:'12px 14px',fontWeight:700}}>{fmt(dailyTotal(d))}</td>
                <td style={{padding:'8px 18px'}}>
                  <div style={{display:'flex',gap:2,justifyContent:'flex-end'}}>
                    <IconBtn name="edit" title="แก้ไข" onClick={()=>openEdit(d)}/>
                    <IconBtn name="trash" title="ลบ" danger onClick={()=>{ if(confirm('ลบยอดขายวันนี้?')) removeSale(d.date); }}/>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr style={{borderTop:'2px solid var(--line)',fontWeight:700,background:'var(--surface-2)'}}>
            <td style={{padding:'14px 22px'}}>รวม {rows.length} วัน</td>
            <td className="tnum" style={{textAlign:'right',padding:'14px'}}>{fmt(cur.store)}</td>
            <td className="tnum" style={{textAlign:'right',padding:'14px'}}>{fmt(cur.line)}</td>
            <td className="tnum" style={{textAlign:'right',padding:'14px'}}>{fmt(cur.other)}</td>
            {hasBills && <td className="tnum" style={{textAlign:'right',padding:'14px'}}>{fmt(monthBills)}</td>}
            <td className="tnum" style={{textAlign:'right',padding:'14px',color:'var(--accent)'}}>{fmt(cur.total)}</td>
            <td></td>
          </tr></tfoot>
        </table>
        </div>
      </Card>}

      <SaleModal open={modal} onClose={()=>setModal(false)} initial={edit}/>
      <POSImportModal open={pos} onClose={()=>setPos(false)}/>
    </div>
  );
}
Object.assign(window, { Sales });
