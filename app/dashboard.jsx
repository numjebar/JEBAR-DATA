// ============ Dashboard ============
function Dashboard({ go }){
  const { fdb:db, settings, THAI_MONTHS } = useData();
  const months = aggregateByMonth(db);
  const cur = months[months.length-1];
  const prev = months[months.length-2];
  const avgP = settings.avgPrice>0 ? settings.avgPrice : avgSellingPrice(db);
  const oh = overheadTotal(db);
  const gpStats = recipeGPStats(db);

  if(!cur){
    return <Empty icon="sales" title="ยังไม่มีข้อมูลยอดขาย" sub="เริ่มต้นด้วยการบันทึกยอดขายรายวัน แล้วแดชบอร์ดจะคำนวณให้อัตโนมัติ"
      action={<Button icon="plus" onClick={()=>go('sales')}>บันทึกยอดขาย</Button>}/>;
  }

  const rev = cur.total;
  const curDaily = db.dailySales.filter(d=>monthKey(d.date)===cur.key);
  const monthBills = curDaily.reduce((s,d)=>s+(d.bills||0),0);
  const hasBills = monthBills>0;
  const grossProfit = rev*settings.estGP;
  const net = grossProfit - oh;
  const cups = avgP>0 ? rev/avgP : 0;
  const realAvgBasket = hasBills ? rev/monthBills : 0;
  const bepCups = (avgP*settings.estGP)>0 ? oh/(avgP*settings.estGP) : 0;
  const revDelta = prev && prev.total>0 ? ((rev-prev.total)/prev.total)*100 : null;
  const targetPct = settings.target>0 ? rev/settings.target : 0;

  // daily series for current month
  const dailySeries = curDaily.map(d=>({x:d.date, y:dailyTotal(d)}));
  const sparkAll = months.map(m=>m.total);

  // channel mix
  const mix=[
    {name:'หน้าร้าน',value:cur.store,color:'#0071e3'},
    {name:'LINE MAN',value:cur.line,color:'#30a46c'},
    {name:'อื่นๆ',value:cur.other,color:'#d97a16'},
  ].filter(s=>s.value>0);

  // top menus by GP%
  const topGP = db.menus.map(m=>({m,e:menuEconomics(db,m)})).filter(x=>x.e.hasRecipe&&x.m.priceStore>0)
    .sort((a,b)=>b.e.gpStorePct-a.e.gpStorePct).slice(0,5)
    .map(x=>({label:x.m.name, value:x.e.gpStorePct*100, color:settings.accent}));

  const bestDay = curDaily.reduce((a,d)=> dailyTotal(d)>dailyTotal(a)?d:a, curDaily[0]);

  return (
    <div className="view-enter" style={{display:'flex',flexDirection:'column',gap:22}}>
      {/* hero KPIs */}
      <div className="r-2col" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
        <Stat label={`รายได้ ${THAI_MONTHS[cur.monthIdx]}`} value={fmtB(rev)} icon="sales"
          delta={revDelta} sub={`${cur.days} วันที่บันทึก · เฉลี่ย ${fmtB(rev/cur.days)}/วัน`} spark={sparkAll}/>
        <Stat label="กำไรขั้นต้น (ประมาณ)" value={fmtB(grossProfit)} tone="var(--green)" icon="trend"
          sub={`อิง GP เฉลี่ย ${fmtPct(settings.estGP,0)}`}/>
        <Stat label="กำไรสุทธิ (ประมาณ)" value={fmtB(net)} tone={net>=0?'var(--green)':'var(--red)'} icon="wallet"
          sub={`หักค่าใช้จ่าย ${fmtB(oh)}/เดือน`}/>
        {hasBills
          ? <Stat label="จำนวนบิล (จริง)" value={fmt(monthBills)} icon="sales"
              sub={`ยอดเฉลี่ย ${fmtB(realAvgBasket,0)}/บิล · ${fmt(monthBills/cur.days)} บิล/วัน`}/>
          : <Stat label="จำนวนแก้ว (ประมาณ)" value={fmt(cups)} icon="cup"
              sub={`อิงราคาเฉลี่ย ${fmtB(avgP,0)}/แก้ว`}/>}
      </div>

      {/* revenue trend + channel */}
      <div className="r-stack" style={{display:'grid',gridTemplateColumns:'1.9fr 1fr',gap:16}}>
        <Card>
          <SectionTitle sub={`รายได้รวมรายวัน · ${THAI_MONTHS[cur.monthIdx]} ${parseInt(cur.year)+543}`}
            right={<Badge tone="blue">สูงสุด {fmtB(dailyTotal(bestDay))}</Badge>}>แนวโน้มยอดขาย</SectionTitle>
          <LineChart data={dailySeries} height={232} color={settings.accent}
            xlabels={(i)=> (i%4===0||i===dailySeries.length-1)?(parseInt(curDaily[i].date.slice(8))):null}/>
        </Card>
        <Card>
          <SectionTitle sub="สัดส่วนช่องทางขายเดือนนี้">ช่องทางการขาย</SectionTitle>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:18}}>
            <Donut segments={mix} size={172} thickness={28} center={{top:fmtPct(cur.store/rev,0),bot:'หน้าร้าน'}}/>
            <div style={{display:'flex',flexDirection:'column',gap:9,width:'100%'}}>
              {mix.map(s=><div key={s.name} style={{display:'flex',alignItems:'center',gap:9}}>
                <span style={{width:10,height:10,borderRadius:3,background:s.color}}/>
                <span style={{fontSize:13.5,flex:1}}>{s.name}</span>
                <span className="tnum" style={{fontSize:13.5,fontWeight:600}}>{fmtB(s.value)}</span>
              </div>)}
            </div>
          </div>
        </Card>
      </div>

      {/* target, break-even, top menus */}
      <div className="r-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1.4fr',gap:16}}>
        <Card>
          <SectionTitle sub={`เป้า ${fmtB(settings.target)}/เดือน`} info="เปรียบรายได้เดือนนี้กับเป้าที่ตั้งไว้ — ปรับเป้าได้ที่หน้าตั้งค่า → การเงิน">เทียบเป้ารายได้</SectionTitle>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,paddingTop:6}}>
            <Donut segments={[{value:Math.min(targetPct,1),color:targetPct>=1?'var(--green)':settings.accent},{value:Math.max(0,1-targetPct),color:'var(--chip)'}]}
              size={150} thickness={22} center={{top:fmtPct(targetPct,0),bot:'ของเป้า'}}/>
            <Badge tone={targetPct>=1?'green':'orange'}>{targetPct>=1?'บรรลุเป้าแล้ว':`ขาดอีก ${fmtB(Math.max(0,settings.target-rev))}`}</Badge>
          </div>
        </Card>
        <Card>
          <SectionTitle info="จุดคุ้มทุน = ขายได้เท่าไรถึงจะคุ้มทุนพอดี (ไม่กำไรไม่ขาดทุน) — คิดจาก ค่าใช้จ่ายคงที่ต่อเดือน ÷ กำไรขั้นต้นต่อแก้ว ถ้าขายได้มากกว่านี้คือเริ่มมีกำไร" sub="จุดคุ้มทุนต่อเดือน">Break-even</SectionTitle>
          <div style={{display:'flex',flexDirection:'column',gap:14,paddingTop:4}}>
            <div>
              <div className="tnum" style={{fontSize:30,fontWeight:600,letterSpacing:'-.6px'}}>{fmt(bepCups)}</div>
              <div style={{fontSize:12.5,color:'var(--ink-3)'}}>แก้ว/เดือน เพื่อคุ้มทุน</div>
            </div>
            <div style={{height:8,background:'var(--chip)',borderRadius:5,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${Math.min(100,(cups/bepCups)*100)}%`,
                background:cups>=bepCups?'var(--green)':'var(--orange)',borderRadius:5,transition:'width .8s'}}/>
            </div>
            <div style={{fontSize:12.5,color:'var(--ink-2)'}}>
              ขายได้ ~<b className="tnum">{fmt(cups)}</b> แก้ว · {cups>=bepCups?<span style={{color:'var(--green)'}}>เกินจุดคุ้มทุน</span>:<span style={{color:'var(--orange)'}}>ต่ำกว่าจุดคุ้มทุน</span>}
            </div>
          </div>
        </Card>
        <Card>
          <SectionTitle sub="GP% สูงสุดจากเมนูที่มีสูตร" info="GP% = อัตรากำไรขั้นต้น = (ราคาขาย − ต้นทุน) ÷ ราคาขาย — ยิ่งสูงยิ่งกำไรต่อแก้วดี แสดงเฉพาะเมนูที่ใส่สูตรต้นทุนไว้แล้ว" right={<Button variant="ghost" size="sm" onClick={()=>go('menu')}>ดูทั้งหมด</Button>}>เมนูกำไรดี</SectionTitle>
          {topGP.length? <HBars items={topGP} valueFmt={v=>v.toFixed(1)+'%'}/> :
            <Empty icon="recipe" title="ยังไม่มีสูตรเมนู" sub="เพิ่มสูตรในหน้าเมนูเพื่อคำนวณ GP"/>}
        </Card>
      </div>

      <p style={{fontSize:12,color:'var(--ink-3)',textAlign:'center',paddingBottom:6}}>
        กำไรขั้นต้น/สุทธิเป็นค่าประมาณจาก GP เฉลี่ย {fmtPct(settings.estGP,0)} (ปรับได้ในหน้าตั้งค่า) · เมนูที่มีสูตรคำนวณต้นทุนจริง {gpStats.count} รายการ
      </p>
    </div>
  );
}
Object.assign(window, { Dashboard });
