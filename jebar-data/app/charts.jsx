// ============ JEBAR charts (hand-rolled SVG) ============
const { useState: useStateC, useMemo: useMemoC, useId } = React;

// ---- Area / line chart ----
function LineChart({ data, height=220, color='#0071e3', label, valueFmt=(v=>v), xlabels, fill=true }){
  // data: [{x, y}]
  const gid = useId().replace(/:/g,'');
  const W = 760, H = height, padL=8, padR=8, padT=18, padB=26;
  const xs = data.map((d,i)=>i);
  const max = Math.max(1, ...data.map(d=>d.y));
  const min = 0;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const px = i => padL + (data.length<=1?innerW/2:(i/(data.length-1))*innerW);
  const py = v => padT + innerH - ((v-min)/(max-min))*innerH;
  const linePts = data.map((d,i)=>`${px(i)},${py(d.y)}`).join(' ');
  const areaPts = `${padL},${py(min)} ` + linePts + ` ${px(data.length-1)},${py(min)}`;
  const peak = data.reduce((a,d,i)=> d.y>data[a].y?i:a, 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:'block'}} preserveAspectRatio="none">
      <defs>
        <linearGradient id={'g'+gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0.25,0.5,0.75,1].map((f,i)=>(
        <line key={i} x1={padL} x2={W-padR} y1={padT+innerH*f} y2={padT+innerH*f} stroke="var(--hover)" strokeWidth="1"/>
      ))}
      <polygon points={areaPts} fill={fill?`url(#g${gid})`:'none'}/>
      <polyline points={linePts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={px(peak)} cy={py(data[peak].y)} r="4.5" fill="#fff" stroke={color} strokeWidth="2.5"/>
      {xlabels && data.map((d,i)=> (xlabels(i,d.x) ?
        <text key={i} x={px(i)} y={H-8} fontSize="11" fill="var(--ink-3)" textAnchor="middle" fontFamily="var(--font)">{xlabels(i,d.x)}</text> : null))}
    </svg>
  );
}

// ---- Stacked / grouped bar chart ----
function BarChart({ data, series, height=240, valueFmt=(v=>v) }){
  // data: [{label, values:{key:num}}], series:[{key,color,name}]
  const W=760, H=height, padT=18, padB=30, padL=8, padR=8;
  const innerW=W-padL-padR, innerH=H-padT-padB;
  const totals = data.map(d=>series.reduce((s,se)=>s+(d.values[se.key]||0),0));
  const max = Math.max(1, ...totals);
  const n = data.length;
  const slot = innerW/n;
  const bw = Math.min(46, slot*0.56);
  const py = v => padT + innerH - (v/max)*innerH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:'block'}}>
      {[0.25,0.5,0.75,1].map((f,i)=>(
        <line key={i} x1={padL} x2={W-padR} y1={padT+innerH*f} y2={padT+innerH*f} stroke="var(--hover)" strokeWidth="1"/>
      ))}
      {data.map((d,i)=>{
        const cx = padL + slot*i + slot/2;
        let acc=0;
        return (
          <g key={i}>
            {series.map((se,si)=>{
              const v = d.values[se.key]||0;
              const h = (v/max)*innerH;
              const y = py(acc+v);
              acc+=v;
              const topR = si===series.length-1?5:0;
              return v>0 ? (
                <rect key={se.key} x={cx-bw/2} y={y} width={bw} height={Math.max(0,h)} rx="3" fill={se.color}/>
              ) : null;
            })}
            <text x={cx} y={H-9} fontSize="11" fill="var(--ink-3)" textAnchor="middle" fontFamily="var(--font)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ---- Donut ----
function Donut({ segments, size=170, thickness=26, center }){
  // segments:[{value,color,name}]
  const total = segments.reduce((s,x)=>s+x.value,0)||1;
  const r = (size-thickness)/2, cx=size/2, cy=size/2, C=2*Math.PI*r;
  let acc=0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--chip)" strokeWidth={thickness}/>
      {segments.map((s,i)=>{
        const frac = s.value/total;
        const dash = frac*C;
        const off = acc*C;
        acc+=frac;
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
          strokeDasharray={`${dash} ${C-dash}`} strokeDashoffset={-off} transform={`rotate(-90 ${cx} ${cy})`}
          strokeLinecap="butt" style={{transition:'stroke-dasharray .6s'}}/>;
      })}
      {center && <text x={cx} y={cy-2} textAnchor="middle" fontSize="22" fontWeight="600" fill="var(--ink)" fontFamily="var(--font)">{center.top}</text>}
      {center && <text x={cx} y={cy+16} textAnchor="middle" fontSize="11" fill="var(--ink-3)" fontFamily="var(--font)">{center.bot}</text>}
    </svg>
  );
}

// ---- Sparkline ----
function Sparkline({ data, color='#0071e3', width=120, height=34 }){
  if(!data || data.length<2) return null;
  const max=Math.max(...data), min=Math.min(...data);
  const px=i=>(i/(data.length-1))*width;
  const py=v=>height-2 - ((v-min)/((max-min)||1))*(height-4);
  const pts=data.map((d,i)=>`${px(i)},${py(d)}`).join(' ');
  return <svg width={width} height={height} style={{display:'block'}}>
    <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

// ---- Horizontal ranking bars ----
function HBars({ items, color='#0071e3', valueFmt=(v=>v) }){
  const max = Math.max(1, ...items.map(i=>i.value));
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {items.map((it,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:26,height:26,borderRadius:8,background:i<3?'var(--accent-soft)':'var(--chip)',color:i<3?'var(--accent)':'var(--ink-3)',
            display:'grid',placeItems:'center',fontWeight:600,fontSize:13,flexShrink:0}}>{i+1}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,gap:8}}>
              <span style={{fontSize:13.5,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.label}</span>
              <span className="tnum" style={{fontSize:13.5,fontWeight:600,color:'var(--ink-2)',flexShrink:0}}>{valueFmt(it.value)}</span>
            </div>
            <div style={{height:7,background:'var(--chip)',borderRadius:5,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${(it.value/max)*100}%`,background:it.color||color,borderRadius:5,
                transition:'width .8s cubic-bezier(.22,.61,.36,1)'}}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { LineChart, BarChart, Donut, Sparkline, HBars, SalesChart });

// switches between stacked bars / line / area based on user setting
function SalesChart({ data, series, height=240, type='bar' }){
  if(!type || type==='bar') return <BarChart data={data} series={series} height={height}/>;
  const totals=data.map(d=>({x:d.label, y:series.reduce((s,se)=>s+(d.values[se.key]||0),0)}));
  const step=Math.max(1,Math.ceil(data.length/9));
  return <LineChart data={totals} height={height} color={series[0].color} fill={type==='area'}
    xlabels={(i)=> (i%step===0||i===data.length-1)?data[i].label:null}/>;
}
Object.assign(window, { SalesChart });
