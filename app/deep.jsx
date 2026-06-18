// ============ วิเคราะห์เชิงลึก (Deep Analytics) ============
// #1 GP ต่อเมนู · #3 เมนูใช้ Fallback (ต้นทุนสำรอง) · #4 กำไรจริง LINE MAN
// #2 ยอดขายต่อเมนู (อันดับขายดี ราย วัน/สัปดาห์/เดือน/ปี) · #5 Heatmap ชั่วโมงขายดี

// ---------- helpers ----------
function dpNum(v){ const n=parseFloat(String(v==null?'':v).replace(/[^0-9.\-]/g,'')); return isNaN(n)?0:n; }
function dpNormName(s){ return String(s||'').trim().toLowerCase(); }
function dpDetectCol(header, keys){
  const norm=header.map(h=>dpNormName(h));
  // 1) exact match (กันคอลัมน์ที่มีคำซ้อนอยู่ในข้อความยาว เช่น "ต้นทุน ... x จำนวนการขาย")
  for(let i=0;i<norm.length;i++){ if(keys.some(k=>norm[i]===dpNormName(k))) return i; }
  // 2) startsWith
  for(let i=0;i<norm.length;i++){ if(keys.some(k=>norm[i].startsWith(dpNormName(k)))) return i; }
  // 3) includes
  for(let i=0;i<norm.length;i++){ if(keys.some(k=>norm[i].includes(dpNormName(k)))) return i; }
  return -1;
}
function dpFromYmd(s){ // "20260525" -> "2026-05-25"
  const m=String(s).match(/^(\d{4})(\d{2})(\d{2})$/); return m? `${m[1]}-${m[2]}-${m[3]}` : '';
}
function dpRangeFromName(name){
  const m=String(name).match(/(\d{8})\s*[-–]\s*(\d{8})/);
  if(m) return { start:dpFromYmd(m[1]), end:dpFromYmd(m[2]) };
  const one=String(name).match(/(\d{8})/);
  if(one) return { start:dpFromYmd(one[1]), end:dpFromYmd(one[1]) };
  return { start:'', end:'' };
}
function dpSpanOf(start,end){
  if(!start||!end) return 'custom';
  const d=Math.round((new Date(end)-new Date(start))/86400000);
  if(d<=0) return 'day'; if(d<=9) return 'week'; if(d<=45) return 'month'; return 'year';
}
const DP_SPAN_LABEL={day:'รายวัน',week:'รายสัปดาห์',month:'รายเดือน',year:'รายปี',custom:'กำหนดเอง'};
function dpParseHour(v){
  const s=String(v||'').trim().toLowerCase();
  if(!s) return null;
  let m=s.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?$/);
  if(m){
    let h=+m[1];
    if(m[3]==='pm' && h<12) h+=12;
    if(m[3]==='am' && h===12) h=0;
    return h>=0 && h<24 ? h : null;
  }
  m=s.match(/(\d{1,2})\s*(?:น\.|โมง|hour|hr)/);
  if(m){ const h=+m[1]; return h>=0 && h<24 ? h : null; }
  return null;
}
function dpLooksLikeHourHeader(h){
  const n=dpNormName(h);
  return dpParseHour(n)!==null || ['ชั่วโมง','เวลา','hour','time','ช่วงเวลา','order time'].some(k=>n.includes(dpNormName(k)));
}
function dpHasSalesHeader(header){
  return dpDetectCol(header,['ยอดขาย','sales','amount','total','revenue','net sales','ยอดรวม','รวมเงิน'])>=0;
}
function dpDetectImportKind(header, fileName=''){
  const productCol=dpDetectCol(header,['ชื่อเมนู','เมนู','ชื่อสินค้า','สินค้า','menu','product','item','name']);
  const hourCol=dpDetectCol(header,['ชั่วโมง','เวลา','hour','time','ช่วงเวลา','order time']);
  const hourCols=header.map((h,i)=>dpParseHour(h)!==null?i:-1).filter(i=>i>=0);
  const salesCol=dpDetectCol(header,['ยอดขาย','sales','amount','total','revenue','net sales','ยอดรวม','รวมเงิน']);
  const text=(String(fileName||'')+' '+header.join(' ')).toLowerCase();
  const hourlyHint=/รายชั่วโมง|ชั่วโมง|เวลา|hour|time/.test(text);
  if((hourCol>=0 || hourCols.length>=2) && (salesCol>=0 || hourCols.length>=2)) return {type:'hourly', productCol, hourCol, hourCols, salesCol};
  if(hourlyHint && salesCol>=0) return {type:'hourly', productCol, hourCol, hourCols, salesCol};
  if(productCol>=0) return {type:'product', productCol, hourCol, hourCols, salesCol};
  if(salesCol>=0) return {type:'product', productCol, hourCol, hourCols, salesCol};
  return {type:'unknown', productCol, hourCol, hourCols, salesCol};
}
function dpReportLabel(r){
  if(r.start && r.end && r.start!==r.end) return `${window.fmtDate(r.start)} – ${window.fmtDate(r.end)}`;
  if(r.start) return window.fmtDate(r.start);
  return r.label||'ไม่ระบุช่วง';
}

// join imported menu rows with live menu economics (GP)
function dpJoinEconomics(db, rows){
  const byName = Object.fromEntries(db.menus.map(m=>[dpNormName(m.name),m]));
  return rows.map(r=>{
    const m = byName[dpNormName(r.name)];
    const e = m ? window.menuEconomics(db,m) : null;
    const gpPct = e && e.hasRecipe ? e.gpStorePct : null;
    const profit = e && e.hasRecipe ? r.qty*(m.priceStore-e.total) : null;
    return { ...r, menu:m||null, matched:!!m, gpPct, profit };
  });
}

// ---------- smart importer (ranking OR hourly) ----------
function DeepImport({ onClose }){
  const { db, setDb, flash } = useData();
  const [parsed,setParsed]=React.useState(null); // {type, rows, hours?, fileName}
  const [start,setStart]=React.useState('');
  const [end,setEnd]=React.useState('');
  const [err,setErr]=React.useState('');
  const fileRef=React.useRef();

  const handle=async(file)=>{
    if(!file) return; setErr('');
    try{
      const raw=await window.__posReadFile(file);
      if(!raw||raw.length<2){ setErr('ไฟล์ว่างหรืออ่านไม่ได้'); return; }
      const header=raw[0].map(c=>String(c||'').trim());
      const kind=dpDetectImportKind(header, file.name);
      const rng=dpRangeFromName(file.name); setStart(rng.start); setEnd(rng.end);

      if(kind.type==='hourly'){
        // ----- hourly file -----
        const dateIdx=dpDetectCol(header,['วันที่','date','day','order date']);
        const billIdx=dpDetectCol(header,['จำนวนบิล','บิล','bills','bill count','orders','order count','transactions']);
        const channelIdx=dpDetectCol(header,['ช่องทาง','channel','platform','source','แหล่งขาย']);
        const amountIdx=kind.salesCol;
        const rows=[]; const hours=new Array(24).fill(0);
        let totalBills=0, totalAmount=0;

        if(kind.hourCols.length>=2){
          for(let r=1;r<raw.length;r++){
            const row=raw[r]; if(!row) continue;
            const first=String(row[0]||'').trim().toLowerCase();
            if(first==='total') continue;
            let hasValue=false;
            kind.hourCols.forEach(ci=>{
              const hour=dpParseHour(header[ci]);
              if(hour===null) return;
              const sales=dpNum(row[ci]);
              if(sales){ hasValue=true; hours[hour]+=sales; totalAmount+=sales; }
            });
            if(hasValue) rows.push({
              date: dateIdx>=0 ? (window.normDate ? window.normDate(row[dateIdx]) : String(row[dateIdx]||'')) : '',
              hour: null,
              channel: channelIdx>=0 ? String(row[channelIdx]||'').trim() || 'รวมทุกช่องทาง' : 'รวมทุกช่องทาง',
              sales: kind.hourCols.reduce((s,ci)=>s+dpNum(row[ci]),0),
              bills: billIdx>=0 ? dpNum(row[billIdx]) : 0,
            });
          }
        } else {
          if(kind.hourCol<0){ setErr('หาคอลัมน์เวลาไม่เจอ'); return; }
          if(amountIdx<0){ setErr('หาคอลัมน์ยอดขายไม่เจอ'); return; }
          for(let r=1;r<raw.length;r++){
            const row=raw[r]; if(!row) continue;
            const first=String(row[0]||'').trim().toLowerCase();
            if(first==='total') continue;
            const hour=dpParseHour(row[kind.hourCol]);
            if(hour===null) continue;
            const sales=dpNum(row[amountIdx]);
            const bills=billIdx>=0 ? dpNum(row[billIdx]) : 0;
            const channel=channelIdx>=0 ? String(row[channelIdx]||'').trim() || 'รวมทุกช่องทาง' : 'รวมทุกช่องทาง';
            hours[hour]+=sales; totalAmount+=sales; totalBills+=bills;
            rows.push({
              date: dateIdx>=0 ? (window.normDate ? window.normDate(row[dateIdx]) : String(row[dateIdx]||'')) : '',
              hour, channel, sales, bills,
            });
          }
        }
        if(!rows.length){ setErr('ไม่พบข้อมูลยอดขายรายชั่วโมง'); return; }
        if(!totalBills) totalBills=rows.reduce((s,r)=>s+(r.bills||0),0);
        setParsed({ type:'hourly', rows, hours, fileName:file.name, amount:totalAmount, bills:totalBills });
      } else if(kind.type==='product') {
        // ----- ranking file (MENU_NAME, BILLS, SALES) -----
        const ni=kind.productCol;
        const qi=dpDetectCol(header,['bills','bill','จำนวน','ขาย','qty','quantity','sold','units','ชิ้น','แก้ว']);
        const ai=dpDetectCol(header,['sales','ยอด','amount','total','revenue','รวม','บาท']);
        if(ni<0){ setErr('หาคอลัมน์ชื่อเมนูไม่เจอ'); return; }
        const rows=[];
        for(let r=1;r<raw.length;r++){
          const row=raw[r]; if(!row) continue;
          const name=String(row[ni]||'').trim();
          if(!name || name.toLowerCase()==='total') continue;
          rows.push({ name, qty:qi>=0?dpNum(row[qi]):0, amount:ai>=0?dpNum(row[ai]):0 });
        }
        if(!rows.length){ setErr('ไม่พบแถวข้อมูล'); return; }
        setParsed({ type:'ranking', rows, fileName:file.name });
      } else {
        if(kind.hourCol<0 && !kind.hourCols.length) setErr('หาคอลัมน์เวลาไม่เจอ');
        else setErr('ไม่รู้จักรูปแบบไฟล์ import');
      }
    }catch(e){ setErr('อ่านไฟล์ไม่สำเร็จ: '+e.message); }
  };

  const byName = Object.fromEntries(db.menus.map(m=>[dpNormName(m.name),m]));
  const matched = parsed && parsed.type==='ranking' ? parsed.rows.filter(r=>byName[dpNormName(r.name)]).length : 0;

  const doImport=()=>{
    const base={ id:Date.now(), start, end, label: (start&&end)?dpReportLabel({start,end}):parsed.fileName };
    if(parsed.type==='hourly'){
      const totBills=parsed.bills || parsed.rows.reduce((s,r)=>s+(r.bills||0),0);
      const totAmt=parsed.amount || parsed.rows.reduce((s,r)=>s+(r.sales||0),0);
      const rep={ ...base, hours:parsed.hours, qty:totBills, amount:totAmt, rows:parsed.rows };
      setDb(prev=>({ ...prev, hourlyReports:[rep, ...(prev.hourlyReports||[])] }));
      flash('นำเข้าข้อมูลรายชั่วโมงแล้ว');
    } else {
      const rep={ ...base, span:dpSpanOf(start,end), rows:parsed.rows };
      setDb(prev=>({ ...prev, menuReports:[rep, ...(prev.menuReports||[])] }));
      flash(`นำเข้าอันดับเมนู ${parsed.rows.length} รายการ`);
    }
    onClose();
  };

  return <Modal open title="นำเข้าข้อมูล POS วงใน" onClose={onClose} width={780}
    footer={<><Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
      {parsed && <Button icon="check" onClick={doImport}>นำเข้า</Button>}</>}>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {!parsed && <>
        <div onClick={()=>fileRef.current.click()} style={{border:'2px dashed var(--line)',borderRadius:14,padding:'38px 20px',textAlign:'center',cursor:'pointer',background:'var(--surface-2)'}}>
          <Icon name="upload" size={30} color="var(--accent)"/>
          <div style={{fontWeight:600,marginTop:10}}>เลือกไฟล์ CSV / Excel จาก POS วงใน</div>
          <div style={{fontSize:12.5,color:'var(--ink-3)',marginTop:5}}>รองรับทั้งไฟล์ "อันดับเมนูขายดี" และ "ยอดขายรายชั่วโมง" — ระบบแยกประเภทให้อัตโนมัติ</div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.txt" style={{display:'none'}} onChange={e=>handle(e.target.files[0])}/>
        </div>
      </>}
      {err && <div style={{background:'var(--red-soft)',color:'var(--red)',padding:'10px 14px',borderRadius:10,fontSize:13}}>{err}</div>}
      {parsed && <>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          <Badge tone="blue">{parsed.type==='hourly'?'ไฟล์รายชั่วโมง':'ไฟล์อันดับเมนู'}</Badge>
          <Badge tone="green">พบ {parsed.rows.length} รายการ</Badge>
          {parsed.type==='ranking' && <Badge tone={matched===parsed.rows.length?'green':'orange'}>จับคู่เมนูในระบบ {matched}/{parsed.rows.length}</Badge>}
          {parsed.type==='hourly' && <Badge tone="gray">ใช้เฉพาะวิเคราะห์รายชั่วโมง ไม่เข้า Top menu</Badge>}
        </div>
        <div className="r-2col" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <Field label="ช่วงข้อมูล — วันเริ่ม"><Input type="date" value={start} onChange={e=>setStart(e.target.value)}/></Field>
          <Field label="ถึงวันที่"><Input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></Field>
        </div>
        {parsed.type!=='hourly' && start && end && <div style={{fontSize:12.5,color:'var(--ink-3)'}}>จัดเป็น: <b>{DP_SPAN_LABEL[dpSpanOf(start,end)]}</b> (จากช่วงวันที่)</div>}
        {parsed.type==='hourly' && <div style={{fontSize:12.5,color:'var(--ink-3)'}}>ไฟล์นี้ไม่มีสินค้า จึงจะไม่ถูกใช้คำนวณ Top menu / Best seller / Product analysis</div>}
        <div style={{maxHeight:240,overflow:'auto',border:'1px solid var(--line-2)',borderRadius:12}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{color:'var(--ink-2)',fontSize:11.5,position:'sticky',top:0,background:'var(--surface)'}}>
              <th style={{textAlign:'left',padding:'9px 14px'}}>{parsed.type==='hourly'?'เวลา / ช่องทาง':'เมนู'}</th>
              <th style={{textAlign:'right',padding:'9px 10px'}}>{parsed.type==='hourly'?'บิล':'จำนวน'}</th>
              <th style={{textAlign:'right',padding:'9px 14px'}}>ยอดขาย</th>
            </tr></thead>
            <tbody>{parsed.rows.slice(0,50).map((r,i)=>{ const ok=parsed.type==='ranking' ? byName[dpNormName(r.name)] : true;
              return <tr key={i} style={{borderTop:'1px solid var(--line-2)'}}>
                <td style={{padding:'7px 14px'}}>{parsed.type==='hourly' ? `${r.hour==null?'หลายช่วงเวลา':String(r.hour).padStart(2,'0')+':00'} · ${r.channel||'รวมทุกช่องทาง'}` : r.name} {!ok&&<Badge tone="orange">ไม่พบ</Badge>}</td>
                <td className="tnum" style={{textAlign:'right',padding:'7px 10px'}}>{window.fmt(parsed.type==='hourly' ? (r.bills||0) : r.qty)}</td>
                <td className="tnum" style={{textAlign:'right',padding:'7px 14px'}}>{window.fmtB(parsed.type==='hourly' ? r.sales : r.amount)}</td>
              </tr>; })}</tbody>
          </table>
        </div>
        {parsed.type==='ranking'
          ? <p style={{fontSize:11.5,color:'var(--ink-3)'}}>ระบบจับคู่เมนูจาก "ชื่อ" — ชื่อที่ไม่ตรงกับเมนูในระบบจะยังนำเข้าได้ แต่จะไม่มีข้อมูล GP/กำไร</p>
          : <p style={{fontSize:11.5,color:'var(--ink-3)'}}>ข้อมูลรายชั่วโมงจะถูกใช้เฉพาะ Heatmap ชั่วโมงขายดี วางแผนพนักงาน และช่วงเวลาทำโปรโมชัน</p>}
      </>}
    </div>
  </Modal>;
}

// ---------- 24-hour heatmap strip ----------
function HourHeatmap({ hours }){
  const max=Math.max(1,...hours);
  return <div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(24,1fr)',gap:3}}>
      {hours.map((v,h)=>{ const t=v/max;
        return <div key={h} title={`${String(h).padStart(2,'0')}:00 — ${window.fmt(v)} ชิ้น`}
          style={{height:46,borderRadius:6,background:v?`color-mix(in srgb, var(--accent) ${Math.round(15+t*85)}%, var(--chip))`:'var(--chip)',
            display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:3,position:'relative'}}>
          <span style={{fontSize:9,fontWeight:700,color:t>0.5?'#fff':'var(--ink-3)'}}>{v||''}</span>
        </div>; })}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(24,1fr)',gap:3,marginTop:5}}>
      {hours.map((v,h)=><div key={h} style={{textAlign:'center',fontSize:9,color:'var(--ink-3)'}}>{h%3===0?String(h).padStart(2,'0'):''}</div>)}
    </div>
  </div>;
}

// ---------- main page ----------
function DeepAnalytics({ go }){
  const { db, settings, flash, setDb } = useData();
  const estGP = settings.estGP ?? 0.65;
  const comm = settings.lineCommission ?? 0.32;
  const thr = settings.gpAlertThreshold ?? 0.5;
  const [imp,setImp]=React.useState(false);

  const priced = db.menus.filter(m=>m.priceStore>0);
  const eco = priced.map(m=>({ m, e: window.menuEconomics(db,m) }));
  const withRecipe = eco.filter(x=>x.e.hasRecipe);
  const fallback = eco.filter(x=>!x.e.hasRecipe && x.m.status==='ขาย');

  // #1 GP per menu
  const gpRows=[...withRecipe].sort((a,b)=>b.e.gpStorePct-a.e.gpStorePct);
  const topGP=gpRows.slice(0,8).map(x=>({label:x.m.name,value:x.e.gpStorePct*100,color:'var(--accent)'}));
  const lowGP=[...gpRows].reverse().slice(0,8).map(x=>({label:x.m.name,value:x.e.gpStorePct*100,color:'var(--red)'}));
  const avgGP = withRecipe.length? withRecipe.reduce((s,x)=>s+x.e.gpStorePct,0)/withRecipe.length : 0;

  // #4 LINE MAN net per menu
  const lineSorted = priced.filter(m=>m.priceLine>0).map(m=>{
    const e=window.menuEconomics(db,m); const lineNet=m.priceLine*(1-comm);
    return { m, e, lineNet, profit:e.hasRecipe?lineNet-e.total:null, pct:e.hasRecipe?(lineNet-e.total)/m.priceLine:null, hasRecipe:e.hasRecipe };
  }).filter(r=>r.hasRecipe).sort((a,b)=>b.pct-a.pct);
  const months=window.aggregateByMonth(db); const curM=months[months.length-1];
  const lineGrossProfit=(curM?curM.line:0)*(1-comm)*estGP;

  // #2 menu ranking reports
  const menuReports=db.menuReports||[];
  const [span,setSpan]=React.useState('all');
  const visReports = span==='all'? menuReports : menuReports.filter(r=>(r.span||dpSpanOf(r.start,r.end))===span);
  const [repId,setRepId]=React.useState(null);
  const activeRep = visReports.find(r=>r.id===repId) || visReports[0] || null;
  const rankRows = activeRep? dpJoinEconomics(db, activeRep.rows).sort((a,b)=>b.qty-a.qty) : [];
  const totQty=rankRows.reduce((s,x)=>s+x.qty,0), totAmt=rankRows.reduce((s,x)=>s+x.amount,0), totProfit=rankRows.reduce((s,x)=>s+(x.profit||0),0);
  const lowGpSellers=rankRows.filter(x=>x.gpPct!=null && x.gpPct<thr && x.qty>0).slice(0,10);

  // #5 hourly reports
  const hourlyReports=db.hourlyReports||[];
  const [hrId,setHrId]=React.useState(null);
  const activeHr=hourlyReports.find(r=>r.id===hrId)||hourlyReports[0]||null;
  const hours=activeHr? activeHr.hours : null;
  const peakHours=hours? hours.map((v,h)=>({h,v})).sort((a,b)=>b.v-a.v).slice(0,3).filter(x=>x.v>0) : [];

  return <div className="view-enter" style={{display:'flex',flexDirection:'column',gap:22}}>

    {/* KPIs */}
    <div className="r-2col" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
      <Stat label="GP เฉลี่ย หน้าร้าน" value={window.fmtPct(avgGP)} icon="store" tone="#0071e3" sub={`${withRecipe.length} เมนูมีสูตร`}
        info="GP เฉลี่ยของเมนูที่มีสูตร · ร้านกาแฟที่ดีควรอยู่ 60–70% — ต่ำกว่า 55% ควรขึ้นราคาหรือลดต้นทุน"/>
      <Stat label="เมนูใช้ต้นทุนสำรอง" value={window.fmt(fallback.length)} icon="recipe" tone={fallback.length?'var(--orange)':'var(--green)'} sub="ยังไม่มีสูตรต้นทุนจริง"
        info="เมนูที่ยังไม่ได้ใส่สูตร ระบบจึงประมาณต้นทุนจาก GP เฉลี่ยแทน — ควรทยอยให้เหลือ 0 เพื่อให้ต้นทุน/GP แม่นยำ"/>
      <Stat label="กำไร LINE MAN เดือนล่าสุด" value={window.fmtB(lineGrossProfit)} icon="wallet" tone="#30a46c" sub={`หลังหักคอม ${window.fmtPct(comm,0)} · อิง GP ${window.fmtPct(estGP,0)}`}
        info={`ประมาณกำไรขั้นต้นจากยอด LINE MAN เดือนล่าสุด = ยอดไลน์ × (1−ค่าคอม ${window.fmtPct(comm,0)}) × GP เฉลี่ย ${window.fmtPct(estGP,0)} · ปรับค่าได้ในหน้าตั้งค่า`}/>
      <Stat label="รายงานที่นำเข้า" value={window.fmt(menuReports.length+hourlyReports.length)} icon="chart" sub={`อันดับเมนู ${menuReports.length} · รายชั่วโมง ${hourlyReports.length}`}/>
    </div>

    {/* #1 GP per menu */}
    <div className="r-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <Card>
        <SectionTitle sub="GP% หน้าร้านสูงสุด (เมนูที่มีสูตรต้นทุน)" info="GP% = (ราคาขาย − ต้นทุน) ÷ ราคาขาย ยิ่งสูงยิ่งกำไรต่อแก้วดี">เมนูกำไรดีสุด</SectionTitle>
        {topGP.length? <HBars items={topGP} valueFmt={v=>v.toFixed(1)+'%'}/> : <Empty icon="recipe" title="ยังไม่มีสูตรเมนู" sub="เพิ่มสูตรในหน้าเมนู"/>}
      </Card>
      <Card>
        <SectionTitle sub="GP% หน้าร้านต่ำสุด — ควรทบทวนราคา/สูตร" info="เมนูกำไรต่อแก้วน้อย อาจต้องขึ้นราคาหรือลดต้นทุน">เมนูกำไรน้อยสุด</SectionTitle>
        {lowGP.length? <HBars items={lowGP} color="var(--red)" valueFmt={v=>v.toFixed(1)+'%'}/> : <Empty icon="recipe" title="ยังไม่มีสูตรเมนู"/>}
      </Card>
    </div>

    {/* #4 LINE MAN net */}
    <Card>
      <SectionTitle sub={`กำไรจริงต่อเมนู หลังหักค่าคอม LINE MAN ${window.fmtPct(comm,0)} และต้นทุน`}
        info="กำไรไลน์สุทธิ = ราคาไลน์แมน × (1 − ค่าคอม) − ต้นทุนเมนู · เฉพาะเมนูที่มีสูตรต้นทุน"
        right={<Button variant="ghost" size="sm" onClick={()=>go('products')}>ตั้งค่าราคา</Button>}>กำไรจริง LINE MAN ต่อเมนู</SectionTitle>
      {lineSorted.length? <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13.5}}>
          <thead><tr style={{color:'var(--ink-2)',fontSize:12}}>
            <th style={{textAlign:'left',padding:'11px 18px',fontWeight:600}}>เมนู</th>
            <th style={{textAlign:'right',padding:'11px 10px',fontWeight:600}}>ราคาไลน์</th>
            <th style={{textAlign:'right',padding:'11px 10px',fontWeight:600}}>หลังหักคอม</th>
            <th style={{textAlign:'right',padding:'11px 10px',fontWeight:600}}>ต้นทุน</th>
            <th style={{textAlign:'right',padding:'11px 10px',fontWeight:600}}>กำไรจริง/แก้ว</th>
            <th style={{textAlign:'right',padding:'11px 18px',fontWeight:600}}>GP ไลน์สุทธิ</th>
          </tr></thead>
          <tbody>{lineSorted.slice(0,30).map(({m,e,lineNet,profit,pct})=>(
            <tr key={m.id} style={{borderTop:'1px solid var(--line-2)'}}>
              <td style={{padding:'9px 18px'}}><div style={{fontWeight:600}}>{m.name}</div><div style={{fontSize:11.5,color:'var(--ink-3)'}}>{m.id}</div></td>
              <td className="tnum" style={{textAlign:'right',padding:'9px 10px'}}>{window.fmtB(m.priceLine)}</td>
              <td className="tnum" style={{textAlign:'right',padding:'9px 10px',color:'var(--ink-2)'}}>{window.fmtB(lineNet,0)}</td>
              <td className="tnum" style={{textAlign:'right',padding:'9px 10px',color:'var(--ink-2)'}}>{window.fmtB(e.total,1)}</td>
              <td className="tnum" style={{textAlign:'right',padding:'9px 10px',fontWeight:700,color:profit>=0?'var(--green)':'var(--red)'}}>{window.fmtB(profit,1)}</td>
              <td className="tnum" style={{textAlign:'right',padding:'9px 18px',fontWeight:600,color:pct>=0.5?'var(--green)':pct>=0.3?'var(--orange)':'var(--red)'}}>{window.fmtPct(pct)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div> : <Empty icon="wallet" title="ยังไม่มีเมนูที่มีทั้งราคาไลน์และสูตรต้นทุน"/>}
    </Card>

    {/* #3 Fallback */}
    <Card>
      <SectionTitle sub="เมนูที่ขายอยู่แต่ยังไม่มีสูตรต้นทุน — ระบบใช้ต้นทุนสำรอง (ประมาณจาก GP เฉลี่ย)"
        info={`ต้นทุนสำรอง = ราคาขาย × (1 − GP เฉลี่ย ${window.fmtPct(estGP,0)}) ใช้แทนชั่วคราวจนกว่าจะใส่สูตรจริง`}
        right={<Button variant="ghost" size="sm" onClick={()=>go('menu')}>ไปใส่สูตร</Button>}>เมนูใช้ต้นทุนสำรอง (Fallback)</SectionTitle>
      {fallback.length? <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13.5}}>
          <thead><tr style={{color:'var(--ink-2)',fontSize:12}}>
            <th style={{textAlign:'left',padding:'11px 18px',fontWeight:600}}>เมนู</th>
            <th style={{textAlign:'left',padding:'11px 10px',fontWeight:600}}>หมวด</th>
            <th style={{textAlign:'right',padding:'11px 10px',fontWeight:600}}>ราคาร้าน</th>
            <th style={{textAlign:'right',padding:'11px 10px',fontWeight:600}}>ต้นทุนสำรอง (ประมาณ)</th>
            <th style={{textAlign:'center',padding:'11px 18px',fontWeight:600}}>สถานะ</th>
          </tr></thead>
          <tbody>{fallback.map(({m})=>(
            <tr key={m.id} style={{borderTop:'1px solid var(--line-2)'}}>
              <td style={{padding:'9px 18px'}}><div style={{fontWeight:600}}>{m.name}</div><div style={{fontSize:11.5,color:'var(--ink-3)'}}>{m.id}</div></td>
              <td style={{padding:'9px 10px'}}><Badge tone="gray">{m.category}</Badge></td>
              <td className="tnum" style={{textAlign:'right',padding:'9px 10px'}}>{window.fmtB(m.priceStore)}</td>
              <td className="tnum" style={{textAlign:'right',padding:'9px 10px',color:'var(--orange)'}}>~{window.fmtB(m.priceStore*(1-estGP),1)}</td>
              <td style={{textAlign:'center',padding:'9px 18px'}}><Badge tone="orange">ยังไม่มีสูตร</Badge></td>
            </tr>
          ))}</tbody>
        </table>
      </div> : <Empty icon="check" title="เยี่ยม! ทุกเมนูที่ขายมีสูตรต้นทุนจริงครบ"/>}
    </Card>

    {/* #2 menu ranking */}
    <Card>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:6}}>
        <SectionTitle sub="อันดับเมนูขายดีตามช่วงเวลา + ตรวจเมนูขายดีแต่กำไรต่ำ">ยอดขายต่อเมนู (อันดับขายดี)</SectionTitle>
        <Button variant="secondary" size="sm" icon="upload" onClick={()=>setImp(true)}>นำเข้าข้อมูล POS วงใน</Button>
      </div>
      {menuReports.length===0 ? <Empty icon="chart" title="ยังไม่มีข้อมูลอันดับเมนู"
        sub="นำเข้าไฟล์ 'อันดับเมนูขายดี' จาก POS วงใน — ระบบจะจัดอันดับตามช่วงวันที่ (วัน/สัปดาห์/เดือน/ปี) และไขว้กับ GP เพื่อหาเมนูขายดีแต่กำไรต่ำ"
        action={<Button icon="upload" onClick={()=>setImp(true)}>นำเข้าข้อมูล</Button>}/> : <>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',marginTop:8,marginBottom:16}}>
          <Segmented value={span} onChange={v=>{setSpan(v);setRepId(null);}} options={[{value:'all',label:'ทั้งหมด'},{value:'day',label:'รายวัน'},{value:'week',label:'รายสัปดาห์'},{value:'month',label:'รายเดือน'},{value:'year',label:'รายปี'}]}/>
          <div style={{minWidth:230}}><Select value={activeRep?String(activeRep.id):''} onChange={e=>setRepId(+e.target.value)}
            options={visReports.map(r=>({value:String(r.id),label:dpReportLabel(r)}))}/></div>
          <div style={{flex:1}}/>
          {activeRep && <Button variant="ghost" size="sm" icon="trash" onClick={()=>{ if(confirm('ลบรายงานนี้?')){ setDb(prev=>({...prev,menuReports:(prev.menuReports||[]).filter(r=>r.id!==activeRep.id)})); setRepId(null); flash('ลบรายงานแล้ว'); } }}>ลบรายงานนี้</Button>}
        </div>
        {!activeRep ? <Empty icon="calendar" title="ไม่มีรายงานในช่วงนี้"/> : <>
          <div className="r-2col" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:18}}>
            <div style={{background:'var(--surface-2)',borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:12.5,color:'var(--ink-3)'}}>จำนวนขายรวม</div><div className="tnum" style={{fontSize:24,fontWeight:700}}>{window.fmt(totQty)}</div></div>
            <div style={{background:'var(--surface-2)',borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:12.5,color:'var(--ink-3)'}}>ยอดขายรวม</div><div className="tnum" style={{fontSize:24,fontWeight:700}}>{window.fmtB(totAmt)}</div></div>
            <div style={{background:'var(--surface-2)',borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:12.5,color:'var(--ink-3)'}}>กำไรขั้นต้นรวม (ประมาณ)</div><div className="tnum" style={{fontSize:24,fontWeight:700,color:'var(--green)'}}>{totProfit?window.fmtB(totProfit,0):'—'}</div></div>
          </div>
          {lowGpSellers.length>0 && <div style={{background:'var(--orange-soft)',borderRadius:12,padding:'14px 16px',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><Icon name="target" size={17} color="var(--orange)"/>
              <span style={{fontWeight:700,color:'var(--orange)'}}>เมนูขายดีแต่กำไรต่ำ (GP &lt; {window.fmtPct(thr,0)})</span></div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>{lowGpSellers.map((x,i)=>
              <span key={i} style={{background:'var(--surface)',borderRadius:9,padding:'7px 11px',fontSize:13}}>
                <b>{x.name}</b> · ขาย {window.fmt(x.qty)} · GP {window.fmtPct(x.gpPct,0)}</span>)}</div>
            <p style={{fontSize:12,color:'var(--ink-2)',marginTop:9}}>ขายเยอะแต่กำไรต่อแก้วน้อย — ขึ้นราคา/ลดต้นทุนนิดเดียวก็เพิ่มกำไรรวมได้มาก</p>
          </div>}
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13.5}}>
              <thead><tr style={{color:'var(--ink-2)',fontSize:12}}>
                <th style={{textAlign:'left',padding:'11px 18px',fontWeight:600}}>#</th>
                <th style={{textAlign:'left',padding:'11px 10px',fontWeight:600}}>เมนู</th>
                <th style={{textAlign:'right',padding:'11px 10px',fontWeight:600}}>จำนวนขาย</th>
                <th style={{textAlign:'right',padding:'11px 10px',fontWeight:600}}>ยอดขาย</th>
                <th style={{textAlign:'right',padding:'11px 10px',fontWeight:600}}>GP</th>
                <th style={{textAlign:'right',padding:'11px 18px',fontWeight:600}}>กำไรรวม (ประมาณ)</th>
              </tr></thead>
              <tbody>{rankRows.slice(0,150).map((x,i)=>(
                <tr key={i} style={{borderTop:'1px solid var(--line-2)'}}>
                  <td style={{padding:'9px 18px',color:'var(--ink-3)',fontWeight:600}}>{i+1}</td>
                  <td style={{padding:'9px 10px'}}><div style={{fontWeight:600}}>{x.name}</div>{!x.matched&&<Badge tone="orange">ไม่พบในระบบ</Badge>}</td>
                  <td className="tnum" style={{textAlign:'right',padding:'9px 10px',fontWeight:700}}>{window.fmt(x.qty)}</td>
                  <td className="tnum" style={{textAlign:'right',padding:'9px 10px'}}>{window.fmtB(x.amount)}</td>
                  <td className="tnum" style={{textAlign:'right',padding:'9px 10px',fontWeight:600,color:x.gpPct==null?'var(--ink-3)':x.gpPct>=0.6?'var(--green)':x.gpPct>=thr?'var(--orange)':'var(--red)'}}>{x.gpPct!=null?window.fmtPct(x.gpPct):'—'}</td>
                  <td className="tnum" style={{textAlign:'right',padding:'9px 18px',fontWeight:600,color:'var(--green)'}}>{x.profit!=null?window.fmtB(x.profit,0):'—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>}
      </>}
    </Card>

    {/* #5 hourly heatmap */}
    <Card>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:6}}>
        <SectionTitle sub="ชั่วโมงที่ขายดีที่สุด — วางแผนคน/สต๊อกตามช่วงพีค">Heatmap ชั่วโมงขายดี</SectionTitle>
        <Button variant="secondary" size="sm" icon="upload" onClick={()=>setImp(true)}>นำเข้าไฟล์รายชั่วโมง</Button>
      </div>
      {hourlyReports.length===0 ? <Empty icon="calendar" title="ยังไม่มีข้อมูลรายชั่วโมง"
        sub="นำเข้าไฟล์ 'ยอดขายตามสินค้ารายชั่วโมง' จาก POS วงใน — ระบบจะรวมยอดขายทุกเมนูเป็นรายชั่วโมง แล้วแสดงช่วงเวลาที่ขายดี"
        action={<Button icon="upload" onClick={()=>setImp(true)}>นำเข้าข้อมูล</Button>}/> : <>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',marginTop:8,marginBottom:18}}>
          <div style={{minWidth:230}}><Select value={activeHr?String(activeHr.id):''} onChange={e=>setHrId(+e.target.value)}
            options={hourlyReports.map(r=>({value:String(r.id),label:dpReportLabel(r)+` · ${window.fmt(r.qty)} ชิ้น`}))}/></div>
          <div style={{flex:1}}/>
          {activeHr && <Button variant="ghost" size="sm" icon="trash" onClick={()=>{ if(confirm('ลบรายงานรายชั่วโมงนี้?')){ setDb(prev=>({...prev,hourlyReports:(prev.hourlyReports||[]).filter(r=>r.id!==activeHr.id)})); setHrId(null); flash('ลบแล้ว'); } }}>ลบ</Button>}
        </div>
        {activeHr && <>
          {peakHours.length>0 && <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
            {peakHours.map((p,i)=><div key={p.h} style={{background:i===0?'var(--accent-soft)':'var(--surface-2)',borderRadius:11,padding:'10px 16px'}}>
              <div style={{fontSize:11.5,color:'var(--ink-3)'}}>{i===0?'พีคสุด':'ช่วงพีค #'+(i+1)}</div>
              <div style={{fontSize:19,fontWeight:700,color:i===0?'var(--accent)':'var(--ink)'}}>{String(p.h).padStart(2,'0')}:00 น.</div>
              <div style={{fontSize:12,color:'var(--ink-2)'}}>{window.fmt(p.v)} ชิ้น</div>
            </div>)}
          </div>}
          <HourHeatmap hours={hours}/>
          <p style={{fontSize:12,color:'var(--ink-3)',marginTop:12,textAlign:'center'}}>สีเข้ม = ขายดี · รวม {window.fmt(activeHr.qty)} ชิ้น · ยอด {window.fmtB(activeHr.amount)} ({dpReportLabel(activeHr)})</p>
        </>}
      </>}
    </Card>

    {imp && <DeepImport onClose={()=>setImp(false)}/>}
  </div>;
}
Object.assign(window, { DeepAnalytics });
