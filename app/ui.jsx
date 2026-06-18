// ============ JEBAR UI kit (Apple-style) ============
const { useState: useStateU, useEffect: useEffectU, useRef: useRefU } = React;

// ---- Icons (stroke) ----
const ICONS = {
  dashboard:'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  sales:'M4 4h16v16l-2.5-1.5L15 20l-3-1.5L9 20l-2.5-1.5L4 20V4z|M8 8h8M8 12h8',
  chart:'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8',
  cup:'M5 8h12l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z|M17 9h2a2 2 0 0 1 0 6h-1M8 8V5M12 8V4',
  recipe:'M9 3h6M10 3v5l-4 9a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-4-9V3|M7 16h10',
  leaf:'M5 19c0-8 6-13 14-13 0 8-5 14-13 14M5 19c2-4 5-7 9-9',
  box:'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  sliders:'M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4|M16 4v4M8 10v4M14 16v4',
  menu:'M3 6h18M3 12h18M3 18h18',
  wallet:'M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M3 7h16v4h-3a2 2 0 0 0 0 4h3|M16 12.5h.01',
  plus:'M12 5v14M5 12h14',
  edit:'M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z|M13.5 6.5l3 3',
  trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  close:'M6 6l12 12M18 6L6 18',
  check:'M5 12l5 5L20 6',
  chevron:'M9 6l6 6-6 6',
  chevronDown:'M6 9l6 6 6-6',
  download:'M12 3v12M7 10l5 5 5-5M5 21h14',
  upload:'M12 21V9M7 14l5-5 5 5M5 3h14',
  print:'M7 8V3h10v5M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7v-7z',
  settings:'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z|M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 2h-4l-.4 2.6a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1z',
  target:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z|M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z|M12 12h.01',
  trend:'M3 17l6-6 4 4 8-8M15 7h6v6',
  reset:'M4 12a8 8 0 1 1 2.3 5.6M4 12V7M4 12h5',
  store:'M4 9l1.5-5h13L20 9M4 9h16M4 9v11h16V9M9 20v-6h6v6',
  layers:'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  doc:'M6 2h8l4 4v16H6V2z|M14 2v4h4M9 12h6M9 16h6',
  bell:'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9|M13.7 21a2 2 0 0 1-3.4 0',
  lock:'M5 11h14v10H5z|M8 11V7a4 4 0 0 1 8 0v4',
  shield:'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z|M9 12l2 2 4-4',
  calendar:'M3 9h18M7 3v3M17 3v3M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  moon:'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  receipt:'M5 3v18l2-1.2L9 21l2-1.2L13 21l2-1.2L17 21l2-1.2V3l-2 1.2L15 3l-2 1.2L11 3 9 4.2 7 3 5 4.2z|M8 8h8M8 12h8M8 16h5',
  info:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z|M12 11v5|M12 7.5h.01',
  cloud:'M7 18a4.5 4.5 0 0 1-.5-8.97 6 6 0 0 1 11.5 1.3A3.8 3.8 0 0 1 17.5 18z',
  sync:'M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8|M21 4v4h-4M3 20v-4h4',
};
function Icon({ name, size=20, color, strokeWidth=1.7, style }){
  const d = ICONS[name]||'';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color||'currentColor'}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,...style}}>
      {d.split('|').map((p,i)=><path key={i} d={p}/>)}
    </svg>
  );
}

// ---- Card ----
function Card({ children, style, className='', pad=22, ...rest }){
  return <div className={className} style={{background:'var(--surface)',borderRadius:'var(--radius-lg)',
    boxShadow:'var(--shadow-sm)',border:'1px solid var(--line-2)',padding:pad,...style}} {...rest}>{children}</div>;
}

// ---- Buttons ----
function Button({ children, variant='primary', size='md', icon, style, ...rest }){
  const base={display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,fontWeight:550,
    borderRadius:size==='sm'?9:11,transition:'all .18s',whiteSpace:'nowrap',letterSpacing:'.1px'};
  const sizes={ sm:{padding:'7px 13px',fontSize:13}, md:{padding:'10px 18px',fontSize:14.5} };
  const variants={
    primary:{background:'var(--accent)',color:'#fff',boxShadow:'0 1px 2px rgba(0,0,0,.08)'},
    secondary:{background:'var(--card)',color:'var(--ink)',border:'1px solid var(--line)'},
    soft:{background:'var(--accent-soft)',color:'var(--accent)'},
    ghost:{background:'transparent',color:'var(--accent)'},
    danger:{background:'var(--red-soft)',color:'var(--red)'},
  };
  return <button style={{...base,...sizes[size],...variants[variant],...style}}
    onMouseDown={e=>e.currentTarget.style.transform='scale(.97)'}
    onMouseUp={e=>e.currentTarget.style.transform=''}
    onMouseLeave={e=>e.currentTarget.style.transform=''}
    {...rest}>{icon&&<Icon name={icon} size={size==='sm'?15:17}/>}{children}</button>;
}
function IconBtn({ name, onClick, title, color, danger, size=17 }){
  return <button title={title} onClick={onClick} style={{width:32,height:32,borderRadius:9,display:'grid',placeItems:'center',
    color:danger?'var(--red)':(color||'var(--ink-2)'),transition:'background .15s'}}
    onMouseEnter={e=>e.currentTarget.style.background=danger?'var(--red-soft)':'var(--chip)'}
    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
    <Icon name={name} size={size}/></button>;
}

// ---- Mobile-friendly image picker ----
const IMAGE_ACCEPT = 'image/*,.jpg,.jpeg,.png,.webp,.heic,.heif';
function ImageSourceButtons({ onPick, albumLabel='เลือกรูปจากอัลบั้ม', cameraLabel='ถ่ายรูป', size='sm', style }){
  const pick = (e) => {
    const input = e.target;
    const file = input.files && input.files[0];
    if(file && onPick) onPick(file);
    input.value = '';
  };
  const labelBase = {
    position:'relative',
    overflow:'hidden',
    display:'inline-flex',
    alignItems:'center',
    justifyContent:'center',
    gap:7,
    fontWeight:550,
    borderRadius:size==='sm'?9:11,
    padding:size==='sm'?'7px 13px':'10px 18px',
    fontSize:size==='sm'?13:14.5,
    whiteSpace:'nowrap',
    cursor:'pointer',
    userSelect:'none'
  };
  const realInput = {
    position:'absolute',
    inset:0,
    width:'100%',
    height:'100%',
    opacity:0,
    cursor:'pointer',
    fontSize:100
  };
  return <div style={{display:'flex',gap:8,flexWrap:'wrap',...style}}>
    <label style={{...labelBase,background:'var(--accent)',color:'#fff',boxShadow:'0 1px 2px rgba(0,0,0,.08)'}}>
      <Icon name="plus" size={size==='sm'?15:17}/>{albumLabel}
      <input type="file" accept={IMAGE_ACCEPT} onChange={pick} style={realInput}/>
    </label>
    <label style={{...labelBase,background:'var(--accent-soft)',color:'var(--accent)'}}>
      <Icon name="plus" size={size==='sm'?15:17}/>{cameraLabel}
      <input type="file" accept="image/*" capture="environment" onChange={pick} style={realInput}/>
    </label>
  </div>;
}

function ImagePreviewThumb({ src, alt, emptyText='ยังไม่ได้เลือกรูป', height=140, fit='cover' }){
  const [open,setOpen]=useStateU(false);
  if(!src){
    return <div style={{height,borderRadius:10,background:'var(--chip)',display:'grid',placeItems:'center',fontSize:12.5,color:'var(--ink-3)'}}>{emptyText}</div>;
  }
  return <>
    <button type="button" onClick={()=>setOpen(true)} title="ดูรูปเต็ม" style={{padding:0,border:'none',background:'transparent',width:'100%',textAlign:'left'}}>
      <div style={{position:'relative'}}>
        <img src={src} alt={alt||'preview'} style={{width:'100%',maxHeight:height,objectFit:fit,borderRadius:10,border:'1px solid var(--line-2)',display:'block'}}/>
        <div style={{position:'absolute',right:8,bottom:8,background:'rgba(17,24,39,.72)',color:'#fff',fontSize:12,fontWeight:600,padding:'5px 8px',borderRadius:8}}>ดูรูปเต็ม</div>
      </div>
    </button>
    <Modal open={open} onClose={()=>setOpen(false)} title={alt||'รูปภาพ'} width={920}
      footer={<Button variant="secondary" onClick={()=>setOpen(false)}>ปิด</Button>}>
      <img src={src} alt={alt||'preview'} style={{width:'100%',maxHeight:'75vh',objectFit:'contain',borderRadius:12,border:'1px solid var(--line-2)',background:'var(--surface-2)'}}/>
    </Modal>
  </>;
}

// ---- Badge ----
function Badge({ children, tone='gray' }){
  const tones={ gray:['var(--chip)','var(--ink-2)'], green:['var(--green-soft)','var(--green)'], red:['var(--red-soft)','var(--red)'],
    blue:['var(--accent-soft)','var(--accent)'], orange:['var(--orange-soft)','var(--orange)'] };
  const [bg,fg]=tones[tone]||tones.gray;
  return <span style={{background:bg,color:fg,fontSize:12,fontWeight:600,padding:'3px 9px',borderRadius:7,whiteSpace:'nowrap',display:'inline-block'}}>{children}</span>;
}

// ---- Info popover dot ----
function InfoDot({ text }){
  const [open,setOpen]=useStateU(false);
  const [pos,setPos]=useStateU(null);
  const ref=useRefU();
  useEffectU(()=>{ if(!open) return;
    const close=()=>setOpen(false);
    const h=e=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown',h);
    window.addEventListener('scroll',close,true); window.addEventListener('resize',close);
    return ()=>{ document.removeEventListener('mousedown',h); window.removeEventListener('scroll',close,true); window.removeEventListener('resize',close); };
  },[open]);
  const toggle=()=>{ if(!open && ref.current){ const r=ref.current.getBoundingClientRect(); const w=Math.min(280, window.innerWidth-20);
      let left=r.left+r.width/2 - w/2; left=Math.max(10, Math.min(left, window.innerWidth-w-10));
      let top=r.bottom+8; if(top+150>window.innerHeight) top=Math.max(10, r.top-8-150);
      setPos({left,top,w}); } setOpen(o=>!o); };
  return <span ref={ref} style={{display:'inline-flex',verticalAlign:'middle'}}>
    <button onClick={toggle} title="คำอธิบาย" style={{display:'grid',placeItems:'center',color:open?'var(--accent)':'var(--ink-3)',width:22,height:22,borderRadius:'50%',flexShrink:0}}
      onMouseEnter={e=>e.currentTarget.style.color='var(--accent)'} onMouseLeave={e=>{if(!open)e.currentTarget.style.color='var(--ink-3)';}}>
      <Icon name="info" size={16}/>
    </button>
    {open && pos && <span style={{position:'fixed',left:pos.left,top:pos.top,width:pos.w,background:'var(--surface)',
      border:'1px solid var(--line-2)',borderRadius:12,boxShadow:'var(--shadow-lg)',padding:'12px 14px',zIndex:9999,
      fontSize:12.5,fontWeight:400,lineHeight:1.65,color:'var(--ink-2)',textAlign:'left',whiteSpace:'normal',animation:'pop .16s'}}>{text}</span>}
  </span>;
}

// ---- Section title ----
function SectionTitle({ children, sub, right, info }){
  return <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:16,gap:12}}>
    <div><h3 style={{fontSize:19,fontWeight:600,letterSpacing:'-.2px',display:'flex',alignItems:'center',gap:5}}>{children}{info&&<InfoDot text={info}/>}</h3>
    {sub&&<p style={{fontSize:13,color:'var(--ink-3)',marginTop:3}}>{sub}</p>}</div>
    {right}</div>;
}

// ---- Column header with optional info popover (for tables) ----
function ColHead({ children, info, align='left' }){
  return <span style={{display:'inline-flex',alignItems:'center',gap:3,
    justifyContent:align==='right'?'flex-end':align==='center'?'center':'flex-start'}}>{children}{info&&<InfoDot text={info}/>}</span>;
}

// ---- Stat card ----
function Stat({ label, value, sub, tone, spark, sparkColor, icon, delta, info }){
  return <Card pad={20} style={{display:'flex',flexDirection:'column',gap:10,minWidth:0}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>
      <span style={{fontSize:13,color:'var(--ink-2)',fontWeight:500,display:'flex',alignItems:'center',gap:4,minWidth:0}}>{label}{info&&<InfoDot text={info}/>}</span>
      {icon&&<div style={{color:'var(--ink-3)',flexShrink:0}}><Icon name={icon} size={18}/></div>}
    </div>
    <div style={{display:'flex',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
      <span className="tnum" style={{fontSize:27,fontWeight:600,letterSpacing:'-.6px',color:tone||'var(--ink)'}}>{value}</span>
      {delta!==undefined && delta!==null && <span className="tnum" style={{fontSize:13,fontWeight:600,
        color:delta>=0?'var(--green)':'var(--red)'}}>{delta>=0?'▲':'▼'} {Math.abs(delta).toFixed(1)}%</span>}
    </div>
    {sub&&<span style={{fontSize:12.5,color:'var(--ink-3)'}}>{sub}</span>}
    {spark&&<div style={{marginTop:2}}><Sparkline data={spark} color={sparkColor||'var(--accent)'} width={220} height={32}/></div>}
  </Card>;
}

// ---- Field / inputs ----
function Field({ label, children, hint, style }){
  return <label style={{display:'flex',flexDirection:'column',gap:6,...style}}>
    {label&&<span style={{fontSize:12.5,fontWeight:600,color:'var(--ink-2)'}}>{label}</span>}
    {children}
    {hint&&<span style={{fontSize:11.5,color:'var(--ink-3)'}}>{hint}</span>}
  </label>;
}
const inputStyle={width:'100%',padding:'10px 13px',borderRadius:10,border:'1px solid var(--line)',background:'var(--card)',
  fontSize:14.5,outline:'none',transition:'border .15s,box-shadow .15s'};
function Input(props){
  return <input {...props} style={{...inputStyle,...props.style}}
    onFocus={e=>{e.target.style.borderColor='var(--accent)';e.target.style.boxShadow='0 0 0 3.5px var(--accent-soft)';props.onFocus&&props.onFocus(e);}}
    onBlur={e=>{e.target.style.borderColor='var(--line)';e.target.style.boxShadow='none';props.onBlur&&props.onBlur(e);}}/>;
}
function Select({ options, value, onChange, style, placeholder }){
  return <div style={{position:'relative'}}>
    <select value={value} onChange={onChange} style={{...inputStyle,appearance:'none',paddingRight:34,cursor:'pointer',...style}}
      onFocus={e=>{e.target.style.borderColor='var(--accent)';e.target.style.boxShadow='0 0 0 3.5px var(--accent-soft)';}}
      onBlur={e=>{e.target.style.borderColor='var(--line)';e.target.style.boxShadow='none';}}>
      {placeholder&&<option value="">{placeholder}</option>}
      {options.map((o,i)=>{ const val=typeof o==='object'?o.value:o; const lab=typeof o==='object'?o.label:o;
        return <option key={i} value={val}>{lab}</option>; })}
    </select>
    <div style={{position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'var(--ink-3)'}}><Icon name="chevronDown" size={16}/></div>
  </div>;
}

// ---- Select that lets you add a new value (combobox) ----
function TypeSelect({ value, onChange, options, coll, placeholder }){
  const { db, setCollection } = useData();
  const [adding,setAdding]=useStateU(false);
  const [val,setVal]=useStateU('');
  const confirm=()=>{ const v=val.trim(); if(!v){ setAdding(false); setVal(''); return; }
    if(coll && !((db[coll]||[]).includes(v))) setCollection(coll,[...(db[coll]||[]),v]);
    onChange(v); setAdding(false); setVal(''); };
  if(adding) return <div style={{display:'flex',gap:6,alignItems:'center'}}>
    <Input autoFocus value={val} placeholder="พิมพ์ประเภทใหม่" onChange={e=>setVal(e.target.value)}
      onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); confirm(); } else if(e.key==='Escape'){ setAdding(false); setVal(''); } }}/>
    <IconBtn name="check" title="เพิ่ม" onClick={confirm}/>
    <IconBtn name="close" title="ยกเลิก" onClick={()=>{ setAdding(false); setVal(''); }}/>
  </div>;
  return <Select value={value} placeholder={placeholder}
    options={[...options.map(o=>({value:o,label:o})), {value:'__add__',label:'➕ เพิ่มประเภทใหม่…'}]}
    onChange={e=>{ if(e.target.value==='__add__') setAdding(true); else onChange(e.target.value); }}/>;
}

// ---- Segmented control ----
function Segmented({ options, value, onChange, size='md' }){
  return <div style={{
    display:'inline-flex',
    alignItems:'center',
    background:'var(--surface)',
    border:'1px solid var(--line)',
    borderRadius:12,
    padding:3,
    gap:2,
    boxShadow:'var(--shadow-sm)'
  }}>
    {options.map(o=>{ const val=typeof o==='object'?o.value:o; const lab=typeof o==='object'?o.label:o;
      const active=val===value;
      return <button key={val} onClick={()=>onChange(val)} style={{padding:size==='sm'?'5px 12px':'7px 16px',borderRadius:8,
        minWidth:size==='sm'?40:52,
        fontSize:size==='sm'?12.5:13.5,fontWeight:active?700:600,color:active?'var(--accent)':'var(--ink-2)',
        background:active?'var(--accent-soft)':'transparent',boxShadow:active?'inset 0 0 0 1px rgba(37,99,235,.12)':'none',transition:'all .18s'}}>{lab}</button>;
    })}
  </div>;
}

// ---- Search ----
function Search({ value, onChange, placeholder='ค้นหา' }){
  return <div style={{position:'relative',flex:1,maxWidth:340}}>
    <div style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--ink-3)'}}><Icon name="search" size={16}/></div>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{...inputStyle,paddingLeft:36,background:'var(--chip)',border:'1px solid transparent'}}
      onFocus={e=>{e.target.style.background='var(--card)';e.target.style.borderColor='var(--accent)';e.target.style.boxShadow='0 0 0 3.5px var(--accent-soft)';}}
      onBlur={e=>{e.target.style.background='var(--chip)';e.target.style.borderColor='transparent';e.target.style.boxShadow='none';}}/>
  </div>;
}

// ---- Modal ----
function Modal({ open, onClose, title, children, width=560, footer }){
  useEffectU(()=>{ if(open){ const h=e=>e.key==='Escape'&&onClose(); window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h);} },[open,onClose]);
  if(!open) return null;
  return <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.32)',backdropFilter:'blur(6px)',
    zIndex:100,display:'grid',placeItems:'center',padding:24,animation:'fadeIn .2s'}}>
    <div onClick={e=>e.stopPropagation()} style={{background:'var(--surface)',borderRadius:22,width:'100%',maxWidth:width,
      maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'var(--shadow-lg)',animation:'pop .26s cubic-bezier(.22,.61,.36,1)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 24px',borderBottom:'1px solid var(--line-2)'}}>
        <h3 style={{fontSize:18,fontWeight:600}}>{title}</h3>
        <IconBtn name="close" onClick={onClose}/>
      </div>
      <div style={{padding:24,overflowY:'auto'}}>{children}</div>
      {footer&&<div style={{display:'flex',justifyContent:'flex-end',gap:10,padding:'16px 24px',borderTop:'1px solid var(--line-2)'}}>{footer}</div>}
    </div>
  </div>;
}

// ---- Empty ----
function Empty({ icon='doc', title, sub, action }){
  return <div style={{textAlign:'center',padding:'56px 20px',color:'var(--ink-3)'}}>
    <div style={{width:56,height:56,borderRadius:16,background:'var(--chip)',display:'grid',placeItems:'center',margin:'0 auto 16px'}}><Icon name={icon} size={26}/></div>
    <p style={{fontSize:15.5,fontWeight:600,color:'var(--ink-2)'}}>{title}</p>
    {sub&&<p style={{fontSize:13.5,marginTop:5,maxWidth:360,marginInline:'auto'}}>{sub}</p>}
    {action&&<div style={{marginTop:18}}>{action}</div>}
  </div>;
}

Object.assign(window, { Icon, Card, Button, IconBtn, ImageSourceButtons, Badge, SectionTitle, ColHead, InfoDot, Stat, Field, Input, Select, TypeSelect, Segmented, Search, Modal, Empty, inputStyle, IMAGE_ACCEPT });
