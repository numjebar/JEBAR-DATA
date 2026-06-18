// ============ Sales analytics · รายวัน / รายเดือน / รายปี ============
function SalesAnalytics(){
  const { fdb:db, settings, THAI_MONTHS, THAI_MONTHS_SHORT, THAI_WEEKDAYS } = useData();
  const months = aggregateByMonth(db);
  const oh = overheadTotal(db);
  const avgP = settings.avgPrice>0?settings.avgPrice:avgSellingPrice(db);
  const [period,setPeriod]=React.useState('month');
  const seriesDef=[{key:'store',color:'#0071e3',name:'หน้าร้าน'},{key:'line',color:'#30a46c',name:'LINE MAN'},{key:'other',color:'#d97a16',name:'อื่นๆ'}];
  const Legend=()=> <div style={{display:'flex',gap:18,justifyContent:'center',marginTop:8}}>
    {seriesDef.map(s=><div key={s.key} style={{display:'flex',alignItems:'center',gap:7}}><span style={{width:10,height:10,borderRadius:3,background:s.color}}/><span style={{fontSize:13,color:'var(--ink-2)'}}>{s.name}</span></div>)}</div>;

  if(!months.length) return <Empty icon="chart" title="ยังไม่มีข้อมูลยอดขาย"/>;

  // ---------- DAILY ----------
  function Daily(){
    const [mk,setMk]=React.useState(months[months.length-1].key);
    const cur=months.find(m=>m.key===mk);
    const rows=db.dailySales.filter(d=>monthKey(d.date)===mk).sort((a,b)=>a.date<b.date?-1:1);
    const bars=rows.map(d=>({label:String(parseInt(d.date.slice(8))),values:{store:d.store,line:d.line,other:d.other}}));
    let acc=0; const cum=rows.map(d=>{acc+=dailyTotal(d);return {x:d.date,y:acc};});
    const totals=rows.map(dailyTotal);
    const best=rows.reduce((a,d)=>dailyTotal(d)>dailyTotal(a)?d:a,rows[0]);
    const worst=rows.reduce((a,d)=>dailyTotal(d)<dailyTotal(a)?d:a,rows[0]);
    // weekday averages
    const wd={}; rows.forEach(d=>{const w=weekdayOf(d.date);(wd[w]=wd[w]||[]).push(dailyTotal(d));});
    const wdBars=THAI_WEEKDAYS.map((nm,i)=>({label:nm.slice(0,2),values:{v:wd[i]?wd[i].reduce((s,x)=>s+x,0)/wd[i].length:0}}));
    const bestWd=wdBars.reduce((a,b)=>b.values.v>a.values.v?b:a,wdBars[0]);
    return <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <Segmented value={mk} onChange={setMk} options={months.map(m=>({value:m.key,label:`${THAI_MONTHS[m.monthIdx]} ${parseInt(m.year)+543}`}))}/>
      <div className="r-2col" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
        <Stat label="รวมทั้งเดือน" value={fmtB(cur.total)} icon="sales"/>
        <Stat label="เฉลี่ยต่อวัน" value={fmtB(cur.total/cur.days)} icon="trend"/>
        <Stat label="วันขายดีสุด" value={fmtB(dailyTotal(best))} tone="var(--green)" icon="target" sub={fmtDate(best.date)}/>
        <Stat label="วันขายน้อยสุด" value={fmtB(dailyTotal(worst))} tone="var(--orange)" icon="chart" sub={fmtDate(worst.date)}/>
      </div>
      <Card><SectionTitle sub={`แยกช่องทางรายวัน · ${THAI_MONTHS[cur.monthIdx]} ${parseInt(cur.year)+543}`}>ยอดขายรายวัน</SectionTitle>
        <SalesChart data={bars} series={seriesDef} height={240} type={settings.salesChart}/><Legend/></Card>
      <div className="r-stack" style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:16}}>
        <Card><SectionTitle sub="รายได้สะสมภายในเดือน">ยอดสะสม</SectionTitle>
          <LineChart data={cum} height={200} color="#7d5bd6" xlabels={(i)=>(i%4===0)?parseInt(rows[i].date.slice(8)):null}/></Card>
        <Card><SectionTitle sub="ค่าเฉลี่ยยอดขายตามวันในสัปดาห์" right={<Badge tone="green">ขายดี: {bestWd.label}</Badge>}>ตามวันในสัปดาห์</SectionTitle>
          <BarChart data={wdBars} series={[{key:'v',color:'#0071e3',name:'เฉลี่ย'}]} height={200}/></Card>
      </div>
    </div>;
  }

  // ---------- MONTHLY ----------
  function Monthly(){
    const years=[...new Set(months.map(m=>m.year))].sort();
    const [year,setYear]=React.useState(years[years.length-1]);
    const yMonths=months.filter(m=>m.year===year);
    const frame=THAI_MONTHS.map((nm,i)=>{const m=yMonths.find(x=>x.monthIdx===i);return {idx:i,label:THAI_MONTHS_SHORT[i],store:m?m.store:0,line:m?m.line:0,other:m?m.other:0,total:m?m.total:0};});
    const bars=frame.map(f=>({label:f.label,values:{store:f.store,line:f.line,other:f.other}}));
    const active=frame.filter(f=>f.total>0);
    const yearTotal=frame.reduce((s,f)=>s+f.total,0);
    const pnl=frame.map(f=>{const gp=f.total*settings.estGP;return {...f,gp,cogs:f.total-gp,net:gp-(f.total>0?oh:0)};});
    let acc=0; const cum=frame.map(f=>{acc+=f.total;return {x:f.label,y:acc};});
    return <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <Segmented value={year} onChange={setYear} options={years.map(y=>({value:y,label:`ปี ${parseInt(y)+543}`}))}/>
        <Badge tone="blue">บันทึก {active.length} เดือน</Badge></div>
      <div className="r-2col" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
        <Stat label="รายได้รวมทั้งปี" value={fmtB(yearTotal)} icon="sales"/>
        <Stat label="กำไรขั้นต้น (ประมาณ)" value={fmtB(yearTotal*settings.estGP)} tone="var(--green)" icon="trend"/>
        <Stat label="ค่าใช้จ่าย (ประมาณ)" value={fmtB(oh*active.length)} tone="var(--orange)" icon="wallet" sub={`${fmtB(oh)} × ${active.length} เดือน`}/>
        <Stat label="กำไรสุทธิ (ประมาณ)" value={fmtB(yearTotal*settings.estGP-oh*active.length)} tone="var(--green)" icon="target"/></div>
      <Card><SectionTitle sub="รายได้แยกช่องทางรายเดือน">รายได้รายเดือน</SectionTitle>
        <SalesChart data={bars} series={seriesDef} height={250} type={settings.salesChart}/><Legend/></Card>
      {settings.vatEnabled && yearTotal>0 && (()=>{ const v=vatBreakdown(yearTotal,settings);
        return <Card><SectionTitle sub={`คำนวณ VAT ${fmtPct(v.rate,0)} แบบ${settings.vatMode==='inclusive'?'ราคารวม VAT':'ราคายังไม่รวม VAT'}`}>ภาษีมูลค่าเพิ่ม (รวมทั้งปี)</SectionTitle>
          <div className="r-2col" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
            <div style={{background:'var(--surface-2)',borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:12.5,color:'var(--ink-3)'}}>ยอดก่อน VAT</div><div className="tnum" style={{fontSize:20,fontWeight:700,marginTop:3}}>{fmtB(v.base)}</div></div>
            <div style={{background:'var(--surface-2)',borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:12.5,color:'var(--ink-3)'}}>ภาษีขาย (VAT)</div><div className="tnum" style={{fontSize:20,fontWeight:700,marginTop:3,color:'var(--orange)'}}>{fmtB(v.vat)}</div></div>
            <div style={{background:'var(--accent-soft)',borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:12.5,color:'var(--accent)'}}>ยอดรวม</div><div className="tnum" style={{fontSize:20,fontWeight:700,marginTop:3,color:'var(--accent)'}}>{fmtB(v.total)}</div></div>
          </div></Card>; })()}
      <div className="r-stack" style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:16}}>
        <Card><SectionTitle sub="ประมาณการจาก GP เฉลี่ย และค่าใช้จ่ายคงที่">งบกำไร-ขาดทุน (P&L)</SectionTitle>
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13.5}}>
            <thead><tr style={{color:'var(--ink-2)',fontSize:12}}>
              <th style={{textAlign:'left',padding:'9px 10px',fontWeight:600}}>เดือน</th><th style={{textAlign:'right',padding:'9px 10px',fontWeight:600}}>รายได้</th>
              <th style={{textAlign:'right',padding:'9px 10px',fontWeight:600}}>ต้นทุน</th><th style={{textAlign:'right',padding:'9px 10px',fontWeight:600}}>กำไรขั้นต้น</th>
              <th style={{textAlign:'right',padding:'9px 10px',fontWeight:600}}>กำไรสุทธิ</th></tr></thead>
            <tbody>{pnl.filter(p=>p.total>0).map(p=><tr key={p.idx} style={{borderTop:'1px solid var(--line-2)'}}>
              <td style={{padding:'10px',fontWeight:500}}>{THAI_MONTHS[p.idx]}</td>
              <td className="tnum" style={{textAlign:'right',padding:'10px'}}>{fmt(p.total)}</td>
              <td className="tnum" style={{textAlign:'right',padding:'10px',color:'var(--ink-2)'}}>{fmt(p.cogs)}</td>
              <td className="tnum" style={{textAlign:'right',padding:'10px',color:'var(--green)',fontWeight:600}}>{fmt(p.gp)}</td>
              <td className="tnum" style={{textAlign:'right',padding:'10px',fontWeight:700,color:p.net>=0?'var(--green)':'var(--red)'}}>{fmt(p.net)}</td></tr>)}
              {!pnl.some(p=>p.total>0)&&<tr><td colSpan={5}><Empty icon="chart" title="ยังไม่มีข้อมูล"/></td></tr>}</tbody>
          </table></div></Card>
        <Card><SectionTitle sub="จุดคุ้มทุนต่อเดือน">Break-even</SectionTitle>
          <div>{[['ค่าใช้จ่ายคงที่/เดือน',fmtB(oh)],['ราคาขายเฉลี่ย/แก้ว',fmtB(avgP,0)],['GP เฉลี่ย/แก้ว',fmtB(avgP*settings.estGP,1)],['จุดคุ้มทุน',`${fmt(oh/(avgP*settings.estGP||1))} แก้ว`],['คิดเป็นรายได้',fmtB(oh/settings.estGP)]].map(([k,v],i)=>
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'13px 2px',borderTop:i?'1px solid var(--line-2)':'none'}}>
              <span style={{fontSize:13.5,color:'var(--ink-2)'}}>{k}</span><span className="tnum" style={{fontSize:14.5,fontWeight:600}}>{v}</span></div>)}</div></Card>
      </div>
      <Card><SectionTitle sub="รายได้สะสมตลอดปี">รายได้สะสม</SectionTitle><LineChart data={cum} height={190} color="#7d5bd6" xlabels={(i)=>frame[i].label}/></Card>
    </div>;
  }

  // ---------- CUSTOM RANGE ----------
  function Range(){
    const all=db.dailySales.slice().sort((a,b)=>a.date<b.date?-1:1);
    const minD=all.length?all[0].date:'2026-01-01', maxD=all.length?all[all.length-1].date:'2026-12-31';
    const [from,setFrom]=React.useState(minD);
    const [to,setTo]=React.useState(maxD);
    const inRange=all.filter(d=>d.date>=from && d.date<=to);
    const sum=inRange.reduce((a,d)=>({store:a.store+d.store,line:a.line+d.line,other:a.other+d.other,bills:a.bills+(d.bills||0)}),{store:0,line:0,other:0,bills:0});
    const total=sum.store+sum.line+sum.other;
    const bars=inRange.map(d=>({label:`${parseInt(d.date.slice(8))}/${parseInt(d.date.slice(5,7))}`,values:{store:d.store,line:d.line,other:d.other}}));
    const best=inRange.length?inRange.reduce((a,d)=>dailyTotal(d)>dailyTotal(a)?d:a,inRange[0]):null;
    const days=inRange.length;
    return <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <Card pad={18}><div style={{display:'flex',gap:16,alignItems:'flex-end',flexWrap:'wrap'}}>
        <Field label="ตั้งแต่วันที่"><Input type="date" value={from} min={minD} max={to} onChange={e=>setFrom(e.target.value)}/></Field>
        <Field label="ถึงวันที่"><Input type="date" value={to} min={from} max={maxD} onChange={e=>setTo(e.target.value)}/></Field>
        <Badge tone="blue">{days} วัน</Badge>
      </div></Card>
      {days? <>
        <div className="r-2col" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
          <Stat label="รายได้รวมช่วงนี้" value={fmtB(total)} icon="sales"/>
          <Stat label="เฉลี่ยต่อวัน" value={fmtB(total/days)} icon="trend"/>
          <Stat label="กำไรขั้นต้น (ประมาณ)" value={fmtB(total*settings.estGP)} tone="var(--green)" icon="chart"/>
          {best && <Stat label="วันขายดีสุด" value={fmtB(dailyTotal(best))} tone="var(--green)" icon="target" sub={fmtDate(best.date)}/>}
        </div>
        <Card><SectionTitle sub={`${fmtDate(from)} – ${fmtDate(to)}`}>ยอดขายในช่วงที่เลือก</SectionTitle>
          <SalesChart data={bars} series={seriesDef} height={250} type={settings.salesChart}/><Legend/></Card>
        {settings.vatEnabled && (()=>{ const v=vatBreakdown(total,settings); return <Card>
          <SectionTitle sub={`VAT ${fmtPct(v.rate,0)}`}>ภาษีมูลค่าเพิ่มในช่วงนี้</SectionTitle>
          <div className="r-2col" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
            <div style={{background:'var(--surface-2)',borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:12.5,color:'var(--ink-3)'}}>ยอดก่อน VAT</div><div className="tnum" style={{fontSize:20,fontWeight:700,marginTop:3}}>{fmtB(v.base)}</div></div>
            <div style={{background:'var(--surface-2)',borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:12.5,color:'var(--ink-3)'}}>ภาษีขาย</div><div className="tnum" style={{fontSize:20,fontWeight:700,marginTop:3,color:'var(--orange)'}}>{fmtB(v.vat)}</div></div>
            <div style={{background:'var(--accent-soft)',borderRadius:12,padding:'14px 16px'}}><div style={{fontSize:12.5,color:'var(--accent)'}}>ยอดรวม</div><div className="tnum" style={{fontSize:20,fontWeight:700,marginTop:3,color:'var(--accent)'}}>{fmtB(v.total)}</div></div>
          </div></Card>; })()}
      </> : <Empty icon="calendar" title="ไม่มียอดขายในช่วงที่เลือก"/>}
    </div>;
  }

  // ---------- YEARLY ----------
  function Yearly(){
    const ym={}; months.forEach(m=>{const y=m.year;if(!ym[y])ym[y]={year:y,store:0,line:0,other:0,total:0,months:0};ym[y].store+=m.store;ym[y].line+=m.line;ym[y].other+=m.other;ym[y].total+=m.total;ym[y].months++;});
    const years=Object.values(ym).sort((a,b)=>a.year<b.year?-1:1);
    const bars=years.map(y=>({label:`${parseInt(y.year)+543}`,values:{store:y.store,line:y.line,other:y.other}}));
    const last=years[years.length-1], prev=years[years.length-2];
    const growth=prev&&prev.total?((last.total-prev.total)/prev.total)*100:null;
    const grandStore=years.reduce((s,y)=>s+y.store,0),grandLine=years.reduce((s,y)=>s+y.line,0),grandOther=years.reduce((s,y)=>s+y.other,0),grand=grandStore+grandLine+grandOther;
    const mix=[{name:'หน้าร้าน',value:grandStore,color:'#0071e3'},{name:'LINE MAN',value:grandLine,color:'#30a46c'},{name:'อื่นๆ',value:grandOther,color:'#d97a16'}].filter(s=>s.value>0);
    return <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div className="r-2col" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
        <Stat label="รายได้รวมทุกปี" value={fmtB(grand)} icon="sales"/>
        <Stat label={`ปีล่าสุด (${parseInt(last.year)+543})`} value={fmtB(last.total)} icon="trend" delta={growth} sub={`${last.months} เดือน`}/>
        <Stat label="เฉลี่ยต่อเดือน" value={fmtB(last.total/last.months)} icon="chart"/>
        <Stat label="กำไรสุทธิ (ประมาณ)" value={fmtB(grand*settings.estGP-oh*months.length)} tone="var(--green)" icon="target"/></div>
      <Card><SectionTitle sub="เปรียบเทียบรายได้แต่ละปี">รายได้รายปี</SectionTitle>
        <BarChart data={bars} series={seriesDef} height={240}/><Legend/></Card>
      <div className="r-stack" style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:16}}>
        <Card pad={0}><div style={{padding:'22px 22px 0'}}><SectionTitle sub="สรุปรายได้และกำไรแต่ละปี">ตารางรายปี</SectionTitle></div>
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13.5}}>
            <thead><tr style={{color:'var(--ink-2)',fontSize:12}}>
              <th style={{textAlign:'left',padding:'10px 22px',fontWeight:600}}>ปี</th><th style={{textAlign:'right',padding:'10px',fontWeight:600}}>หน้าร้าน</th>
              <th style={{textAlign:'right',padding:'10px',fontWeight:600}}>LINE MAN</th><th style={{textAlign:'right',padding:'10px',fontWeight:600}}>รวม</th>
              <th style={{textAlign:'right',padding:'10px 22px',fontWeight:600}}>กำไรสุทธิ</th></tr></thead>
            <tbody>{years.map(y=><tr key={y.year} style={{borderTop:'1px solid var(--line-2)'}}>
              <td style={{padding:'11px 22px',fontWeight:600}}>{parseInt(y.year)+543}</td>
              <td className="tnum" style={{textAlign:'right',padding:'11px'}}>{fmt(y.store)}</td>
              <td className="tnum" style={{textAlign:'right',padding:'11px'}}>{fmt(y.line)}</td>
              <td className="tnum" style={{textAlign:'right',padding:'11px',fontWeight:700}}>{fmt(y.total)}</td>
              <td className="tnum" style={{textAlign:'right',padding:'11px 22px',fontWeight:600,color:'var(--green)'}}>{fmt(y.total*settings.estGP-oh*y.months)}</td></tr>)}</tbody>
          </table></div></Card>
        <Card><SectionTitle sub="สัดส่วนช่องทางรวมทุกปี">ช่องทางการขาย</SectionTitle>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
            <Donut segments={mix} size={168} thickness={28} center={{top:fmtPct(grandStore/grand,0),bot:'หน้าร้าน'}}/>
            <div style={{display:'flex',flexDirection:'column',gap:9,width:'100%'}}>{mix.map(s=><div key={s.name} style={{display:'flex',alignItems:'center',gap:9}}>
              <span style={{width:10,height:10,borderRadius:3,background:s.color}}/><span style={{fontSize:13.5,flex:1}}>{s.name}</span>
              <span className="tnum" style={{fontSize:13.5,fontWeight:600}}>{fmtB(s.value)}</span></div>)}</div></div></Card>
      </div>
    </div>;
  }

  return <div style={{display:'flex',flexDirection:'column',gap:20}}>
    <div style={{display:'flex',justifyContent:'center'}}>
      <Segmented value={period} onChange={setPeriod} options={[{value:'day',label:'รายวัน'},{value:'month',label:'รายเดือน'},{value:'year',label:'รายปี'},{value:'range',label:'ช่วงเอง'}]}/>
    </div>
    {period==='day'?<Daily/>:period==='month'?<Monthly/>:period==='year'?<Yearly/>:<Range/>}
  </div>;
}
Object.assign(window, { SalesAnalytics });
