// ============ Product analysis: GP ร้าน vs LINE MAN, margins, channel coverage ============
function ProductAnalysis(){
  const { db, settings, setSettings } = useData();
  const comm = settings.lineCommission ?? 0.32;
  const markup = settings.lineMarkup ?? 0.45;
  const targetGP = settings.priceTargetGP ?? 0.65;
  const [q,setQ]=React.useState('');
  const [cat,setCat]=React.useState('');
  const [sort,setSort]=React.useState('gpStore');
  const [onlyRecipe,setOnlyRecipe]=React.useState(false);
  const roundB = v => Math.round(v); // ปัดเป็นบาทเต็ม
  const coverMarkup = comm<1 ? comm/(1-comm) : null; // ส่วนบวกขั้นต่ำที่ทำให้กำไรไลน์ = หน้าร้าน

  // build economics for every priced menu
  const rows = db.menus.filter(m=>m.priceStore>0).map(m=>{
    const e = menuEconomics(db, m);
    const lineNet = m.priceLine*(1-comm);                 // เงินที่ได้จริงหลังหัก % LINE MAN
    const obsMarkup = m.priceStore? (m.priceLine-m.priceStore)/m.priceStore : 0;
    const lineNetVsStore = lineNet - m.priceStore;         // ส่วนต่างหลังหักค่าคอม เทียบหน้าร้าน
    const gpLineNet = e.hasRecipe ? lineNet - e.total : null;
    const gpLineNetPct = (e.hasRecipe && m.priceLine) ? gpLineNet/m.priceLine : null;
    // ราคาแนะนำ
    const recStore = e.hasRecipe && targetGP<1 ? roundB(e.total/(1-targetGP)) : null;  // อิงต้นทุน + GP เป้าหมาย
    const recBase = recStore ?? m.priceStore;
    const recLine = roundB(recBase*(1+markup));            // ราคาร้านแนะนำ + ส่วนบวกไลน์แมน
    return { m, e, lineNet, markup:obsMarkup, lineNetVsStore, gpLineNet, gpLineNetPct, recStore, recLine,
      covered: m.priceLine>0 ? lineNet>=m.priceStore : null };
  });

  let view = rows.filter(r=>
    (!q || r.m.name.toLowerCase().includes(q.toLowerCase()) || r.m.id.toLowerCase().includes(q.toLowerCase())) &&
    (!cat || r.m.category===cat) &&
    (!onlyRecipe || r.e.hasRecipe)
  );
  const sorters={
    gpStore:(a,b)=>(b.e.gpStorePct)-(a.e.gpStorePct),
    gpLine:(a,b)=>(b.gpLineNetPct??-9)-(a.gpLineNetPct??-9),
    markup:(a,b)=>b.markup-a.markup,
    price:(a,b)=>b.m.priceStore-a.m.priceStore,
    name:(a,b)=>a.m.name.localeCompare(b.m.name,'th'),
  };
  view = [...view].sort(sorters[sort]);

  // aggregates
  const withLine = rows.filter(r=>r.m.priceLine>0);
  const coveredN = withLine.filter(r=>r.covered).length;
  const avgMarkup = withLine.length? withLine.reduce((s,r)=>s+r.markup,0)/withLine.length : 0;
  const recipeRows = rows.filter(r=>r.e.hasRecipe);
  const avgGPstore = recipeRows.length? recipeRows.reduce((s,r)=>s+r.e.gpStorePct,0)/recipeRows.length : 0;
  const avgGPline = recipeRows.length? recipeRows.reduce((s,r)=>s+(r.gpLineNetPct||0),0)/recipeRows.length : 0;

  // category avg GP (recipe menus)
  const catMap={};
  recipeRows.forEach(r=>{ const c=r.m.category; (catMap[c]=catMap[c]||[]).push(r.e.gpStorePct); });
  const catBars=Object.entries(catMap).map(([c,arr])=>({label:c,value:(arr.reduce((s,x)=>s+x,0)/arr.length)*100,color:'#0071e3'})).sort((a,b)=>b.value-a.value);

  // GP distribution buckets (recipe menus, store)
  const buckets=[['<40%',0,0.4],['40–55%',0.4,0.55],['55–65%',0.55,0.65],['65–75%',0.65,0.75],['>75%',0.75,99]];
  const dist=buckets.map(([label,lo,hi])=>({label,values:{n:recipeRows.filter(r=>r.e.gpStorePct>=lo&&r.e.gpStorePct<hi).length}}));

  const SortBtn=({id,children})=> <button onClick={()=>setSort(id)} style={{padding:'6px 12px',borderRadius:8,fontSize:12.5,fontWeight:sort===id?600:500,
    color:sort===id?'var(--accent)':'var(--ink-2)',background:sort===id?'var(--accent-soft)':'transparent'}}>{children}</button>;

  const Slider=({label,hint,value,min,max,step,onChange})=> <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
      <span style={{fontSize:13,fontWeight:600,color:'var(--ink-2)'}}>{label}</span>
      <span className="tnum" style={{fontSize:18,fontWeight:700,color:'var(--accent)'}}>{fmtPct(value,0)}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)}
      style={{width:'100%',accentColor:'var(--accent)'}}/>
    <div style={{fontSize:11.5,color:'var(--ink-3)',marginTop:5}}>{hint}</div>
  </div>;

  return <div style={{display:'flex',flexDirection:'column',gap:20}}>
    {/* pricing controls */}
    <Card pad={20}>
      <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:16}}>
        <Icon name="sliders" size={18} color="var(--accent)"/>
        <div style={{fontSize:15,fontWeight:600}}>ตัวแปรราคา & คอมมิชชัน</div>
      </div>
      <div className="r-stack" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:24}}>
        <Slider label="ค่าคอมมิชชัน LINE MAN" hint="ค่าธรรมเนียมแพลตฟอร์ม · ปกติ 30–35%" value={comm} min={0} max={1} step={0.01}
          onChange={v=>setSettings({...settings,lineCommission:v})}/>
        <Slider label="ส่วนบวกราคาไลน์แมน" hint={coverMarkup!=null?`แนะนำ ≥ ${fmtPct(coverMarkup,0)} เพื่อคุ้มค่าคอม`:'ค่าคอม 100% – ตั้งราคาอย่างไรก็ไม่คุ้ม'} value={markup} min={0} max={1} step={0.01}
          onChange={v=>setSettings({...settings,lineMarkup:v})}/>
        <Slider label="GP เป้าหมาย (ราคาแนะนำ)" hint="ใช้คำนวณราคาแนะนำจากต้นทุน" value={targetGP} min={0.3} max={0.85} step={0.01}
          onChange={v=>setSettings({...settings,priceTargetGP:v})}/>
      </div>
    </Card>

    {/* KPIs */}
    <div className="r-2col" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
      <Stat label="GP เฉลี่ย หน้าร้าน" value={fmtPct(avgGPstore)} tone="#0071e3" icon="store" sub={`จาก ${recipeRows.length} เมนูที่มีสูตร`}
        info="ค่าเฉลี่ย GP หน้าร้านของเมนูที่มีสูตรต้นทุน · เกณฑ์ร้านกาแฟ/เบเกอรี่ที่ดี 60–70% — ถ้าต่ำกว่า 55% ควรทบทวนราคาหรือลดต้นทุนรวม"/>
      <Stat label="GP เฉลี่ย LINE MAN" value={fmtPct(avgGPline)} tone="#30a46c" icon="trend" sub={`หลังหักค่าคอม ${fmtPct(comm,0)}`}
        info={`GP สุทธิเฉลี่ยหลังแพลตฟอร์มหักค่าคอม ${fmtPct(comm,0)} · ควร ≥ 45–50% เพราะค่าคอมกินกำไรไปมาก — ถ้าต่ำ ควรขึ้นราคาไลน์แมนหรือเพิ่มส่วนบวก`}/>
      <Stat label="ส่วนบวกราคา LINE MAN" value={fmtPct(avgMarkup,0)} icon="chart" sub="ราคาไลน์แมนสูงกว่าหน้าร้านเฉลี่ย"
        info={`ราคาไลน์แมนตั้งสูงกว่าหน้าร้านเฉลี่ยกี่ % · แนะนำอย่างน้อย ${coverMarkup!=null?fmtPct(coverMarkup,0):'—'} (= ค่าคอม ÷ (1−ค่าคอม)) เพื่อให้กำไรไลน์แมนไม่น้อยกว่าขายหน้าร้าน`}/>
      <Stat label="เมนูที่ราคาคุ้มค่าคอม" value={`${coveredN}/${withLine.length}`} tone={coveredN>=withLine.length*0.8?'var(--green)':'var(--orange)'} icon="check"
        sub="ราคาไลน์แมนหลังหักคอม ≥ หน้าร้าน"
        info="จำนวนเมนูที่ตั้งราคาไลน์แมนได้คุ้มค่าคอม (ขายผ่านไลน์แมนแล้วกำไรไม่น้อยกว่าหน้าร้าน) · ควรเข้าใกล้เต็มทุกเมนู"/>
    </div>

    {/* charts */}
    <div className="r-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <Card>
        <SectionTitle info="ค่าเฉลี่ย GP% (กำไรขั้นต้น) ของเมนูในแต่ละหมวด — ยิ่งสูงยิ่งกำไรดี ช่วยบอกว่าควรดันหมวดไหน (นับเฉพาะเมนูที่ใส่สูตรต้นทุนไว้แล้ว)" sub="GP% หน้าร้านเฉลี่ยแต่ละหมวด (เมนูที่มีสูตร)">GP ตามหมวดสินค้า</SectionTitle>
        {catBars.length? <HBars items={catBars} valueFmt={v=>v.toFixed(0)+'%'}/> : <Empty icon="recipe" title="ยังไม่มีสูตรเมนู"/>}
      </Card>
      <Card>
        <SectionTitle info="นับจำนวนเมนูว่าตกอยู่ช่วง GP% ไหนบ้าง — ถ้าเมนูส่วนใหญ่กระจุกช่วง GP ต่ำ (ซ้าย) ควรทบทวนราคา/สูตร สำหรับร้านกาแฟควรอยู่ช่วง 60–75%" sub="จำนวนเมนูแบ่งตามช่วง GP% หน้าร้าน">การกระจายของ GP</SectionTitle>
        {recipeRows.length? <>
          <BarChart data={dist} series={[{key:'n',color:'#7d5bd6',name:'จำนวนเมนู'}]} height={210}/>
          <p style={{textAlign:'center',fontSize:12.5,color:'var(--ink-3)',marginTop:6}}>เมนูส่วนใหญ่ควรอยู่ช่วง 60–75% สำหรับร้านกาแฟ</p>
        </> : <Empty icon="chart" title="ยังไม่มีสูตรเมนู"/>}
      </Card>
    </div>

    {/* filters */}
    <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
      <Search value={q} onChange={setQ} placeholder="ค้นหาเมนู"/>
      <div style={{minWidth:150}}><Select value={cat} placeholder="ทุกหมวด" options={db.categories} onChange={e=>setCat(e.target.value)}/></div>
      <button onClick={()=>setOnlyRecipe(!onlyRecipe)} style={{padding:'9px 14px',borderRadius:10,fontSize:13,fontWeight:550,border:'1px solid var(--line)',
        background:onlyRecipe?'var(--accent-soft)':'var(--card)',color:onlyRecipe?'var(--accent)':'var(--ink-2)'}}>เฉพาะที่มีสูตร</button>
      <div style={{flex:1}}/>
      <div style={{display:'flex',gap:2,background:'var(--chip)',padding:3,borderRadius:10}}>
        <SortBtn id="gpStore">GP ร้าน</SortBtn><SortBtn id="gpLine">GP ไลน์</SortBtn><SortBtn id="markup">ส่วนบวก</SortBtn><SortBtn id="price">ราคา</SortBtn>
      </div>
    </div>

    {/* table */}
    <Card pad={0}>
      <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13.5}}>
        <thead><tr style={{color:'var(--ink-2)',fontSize:12}}>
          <th style={{textAlign:'left',padding:'13px 22px',fontWeight:600}}>เมนู</th>
          <th style={{textAlign:'right',padding:'13px 9px',fontWeight:600}}><ColHead align="right" info="ราคาขายที่หน้าร้าน (ไม่ผ่านแพลตฟอร์ม)">ราคาร้าน</ColHead></th>
          <th style={{textAlign:'right',padding:'13px 9px',fontWeight:600}}><ColHead align="right" info="ราคาที่ตั้งขายบน LINE MAN (ก่อนแพลตฟอร์มหักค่าคอม)">ราคาไลน์</ColHead></th>
          <th style={{textAlign:'right',padding:'13px 9px',fontWeight:600}}><ColHead align="right" info="เงินที่ร้านได้จริงต่อแก้วหลังแพลตฟอร์มหักค่าคอม = ราคาไลน์ × (1 − ค่าคอม) · ควร ≥ ราคาร้าน ถึงจะคุ้ม">ไลน์สุทธิ</ColHead></th>
          <th style={{textAlign:'right',padding:'13px 9px',fontWeight:600}}><ColHead align="right" info="ต้นทุนวัตถุดิบ + แพคเกจ (+ ออปชันเฉลี่ย) ต่อแก้ว คำนวณจากสูตร">ต้นทุน</ColHead></th>
          <th style={{textAlign:'right',padding:'13px 9px',fontWeight:600,color:'var(--accent)'}}><ColHead align="right" info="ราคาหน้าร้านที่แนะนำ = ต้นทุน ÷ (1 − GP เป้าหมาย) · ปรับ GP เป้าหมายได้ที่แถบด้านบน">แนะนำ ร้าน</ColHead></th>
          <th style={{textAlign:'right',padding:'13px 9px',fontWeight:600,color:'var(--accent)'}}><ColHead align="right" info="ราคาไลน์แมนแนะนำ = ราคาแนะนำร้าน × (1 + ส่วนบวก) · ตั้งให้คุ้มค่าคอม">แนะนำ ไลน์</ColHead></th>
          <th style={{textAlign:'right',padding:'13px 9px',fontWeight:600}}><ColHead align="right" info="GP หน้าร้าน = (ราคาร้าน − ต้นทุน) ÷ ราคาร้าน · กำไรขั้นต้นต่อแก้วก่อนหักค่าใช้จ่ายร้าน · เกณฑ์ดี 60–70%">GP ร้าน</ColHead></th>
          <th style={{textAlign:'right',padding:'13px 9px',fontWeight:600}}><ColHead align="right" info="GP LINE MAN สุทธิ = (ไลน์สุทธิ − ต้นทุน) ÷ ราคาไลน์ · กำไรหลังแพลตฟอร์มหักค่าคอม · ควร ≥ 45–50%">GP ไลน์</ColHead></th>
          <th style={{textAlign:'center',padding:'13px 16px',fontWeight:600}}><ColHead align="center" info="คุ้ม = ไลน์สุทธิ (หลังหักค่าคอม) ≥ ราคาหน้าร้าน · ขายผ่านไลน์แมนแล้วกำไรไม่น้อยกว่าหน้าร้าน">คุ้มคอม</ColHead></th>
        </tr></thead>
        <tbody>
          {view.slice(0,200).map(({m,e,lineNet,gpLineNetPct,covered,recStore,recLine})=>(
            <tr key={m.id} style={{borderTop:'1px solid var(--line-2)'}}
              onMouseEnter={ev=>ev.currentTarget.style.background='var(--surface-2)'}
              onMouseLeave={ev=>ev.currentTarget.style.background=''}>
              <td style={{padding:'10px 22px'}}><div style={{fontWeight:600}}>{m.name}</div><div style={{fontSize:11.5,color:'var(--ink-3)'}}>{m.id} · {m.category}</div></td>
              <td className="tnum" style={{textAlign:'right',padding:'10px 9px'}}>{fmtB(m.priceStore)}</td>
              <td className="tnum" style={{textAlign:'right',padding:'10px 9px'}}>{m.priceLine?fmtB(m.priceLine):'—'}</td>
              <td className="tnum" style={{textAlign:'right',padding:'10px 9px',color:'var(--ink-2)'}}>{m.priceLine?fmtB(lineNet,0):'—'}</td>
              <td className="tnum" style={{textAlign:'right',padding:'10px 9px',color:e.hasRecipe?'var(--ink)':'var(--ink-3)'}}>{e.hasRecipe?fmtB(e.total,1):'—'}</td>
              <td className="tnum" style={{textAlign:'right',padding:'10px 9px',fontWeight:600,color:'var(--accent)'}}>{recStore!=null?fmtB(recStore):'—'}</td>
              <td className="tnum" style={{textAlign:'right',padding:'10px 9px',fontWeight:600,color:'var(--accent)'}}>{fmtB(recLine)}</td>
              <td className="tnum" style={{textAlign:'right',padding:'10px 9px',fontWeight:600,color:!e.hasRecipe?'var(--ink-3)':e.gpStorePct>=0.6?'var(--green)':e.gpStorePct>=0.4?'var(--orange)':'var(--red)'}}>{e.hasRecipe?fmtPct(e.gpStorePct):'—'}</td>
              <td className="tnum" style={{textAlign:'right',padding:'10px 9px',fontWeight:600,color:gpLineNetPct==null?'var(--ink-3)':gpLineNetPct>=0.5?'var(--green)':gpLineNetPct>=0.3?'var(--orange)':'var(--red)'}}>{gpLineNetPct!=null?fmtPct(gpLineNetPct):'—'}</td>
              <td style={{textAlign:'center',padding:'10px 16px'}}>{covered==null?<span style={{color:'var(--ink-3)'}}>—</span>:covered?<Badge tone="green">คุ้ม</Badge>:<Badge tone="red">ไม่คุ้ม</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {view.length>200 && <p style={{textAlign:'center',padding:14,fontSize:12.5,color:'var(--ink-3)'}}>แสดง 200 จาก {view.length} — ใช้ค้นหาเพื่อกรอง</p>}
      {view.length===0 && <Empty icon="cup" title="ไม่พบเมนู"/>}
    </Card>
    <p style={{fontSize:12,color:'var(--ink-3)',textAlign:'center',lineHeight:1.7}}>
      <b>ราคาแนะนำร้าน</b> = ต้นทุน ÷ (1 − GP เป้าหมาย {fmtPct(targetGP,0)}) · <b>ราคาแนะนำไลน์</b> = ราคาแนะนำร้าน × (1 + ส่วนบวก {fmtPct(markup,0)}) ปัดเป็นบาทเต็ม<br/>
      ไลน์สุทธิ = ราคาไลน์แมน × (1 − ค่าคอม {fmtPct(comm,0)}) · ราคาแนะนำร้านคำนวณเฉพาะเมนูที่มีสูตรต้นทุน ({recipeRows.length} รายการ) เมนูอื่นอิงราคาร้านปัจจุบัน
    </p>
  </div>;
}
Object.assign(window, { ProductAnalysis });
