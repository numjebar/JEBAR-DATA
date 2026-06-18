// ============ Settings page (branding · appearance · financial) ============
function SettingsSection({icon,title,sub,children}){
  return <Card style={{display:'flex',flexDirection:'column',gap:18}}>
    <div style={{display:'flex',alignItems:'center',gap:12}}>
      <div style={{width:40,height:40,borderRadius:11,background:'var(--accent-soft)',color:'var(--accent)',display:'grid',placeItems:'center',flexShrink:0}}><Icon name={icon} size={20}/></div>
      <div><div style={{fontSize:16,fontWeight:600,letterSpacing:'-.2px'}}>{title}</div>
      {sub&&<div style={{fontSize:12.5,color:'var(--ink-3)',marginTop:1}}>{sub}</div>}</div>
    </div>
    {children}
  </Card>;
}
function SettingsPage(){
  const { settings, setSettings, addMediaAsset, flash } = useData();
  const logoRef=React.useRef();
  const set=(patch)=>setSettings({...settings,...patch});

  const onLogo=async(e)=>{
    const file=e.target.files[0]; if(!file)return;
    if(file.size>2.5*1024*1024){ flash('ไฟล์ใหญ่เกิน 2.5MB','err'); return; }
    try{
      if(settings.supabaseEnabled && window.supabaseUploadImage && window.supabaseReady && window.supabaseReady(settings)){
        const asset = await window.supabaseUploadImage(settings, file, {entityType:'shop', entityId:settings.supabaseShopCode||settings.shopCode||'jebar', role:'logo'});
        set({logo:asset.url});
        addMediaAsset(asset);
        flash('อัปโหลดโลโก้ไป Storage แล้ว');
      } else {
        const reader=new FileReader();
        reader.onload=()=>{ set({logo:reader.result}); flash('อัปเดตโลโก้แล้ว (ยังเก็บในเครื่อง เพราะยังไม่ได้เปิด Supabase Storage)'); };
        reader.readAsDataURL(file);
      }
    }catch(err){
      flash('อัปโหลดรูปไม่สำเร็จ: '+err.message, 'err');
    }finally{
      e.target.value='';
    }
  };

  const Section=SettingsSection;

  return <div className="view-enter" style={{display:'flex',flexDirection:'column',gap:18,maxWidth:880}}>

    {/* BRAND */}
    <Section icon="store" title="ข้อมูลร้าน" sub="โลโก้และชื่อที่แสดงทั่วทั้งระบบ">
      <div style={{display:'flex',gap:22,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{width:150,height:104,borderRadius:14,border:'1px solid var(--line)',background:'var(--card)',display:'grid',placeItems:'center',padding:10,flexShrink:0}}>
          <img src={settings.logo} alt="logo" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',gap:10}}>
            <Button variant="soft" icon="upload" onClick={()=>logoRef.current.click()}>เปลี่ยนโลโก้</Button>
            <Button variant="secondary" onClick={()=>{set({logo:(window.JEBAR_LOGO||'assets/logo.png')});flash('คืนค่าโลโก้เริ่มต้น');}}>ค่าเริ่มต้น</Button>
          </div>
          <p style={{fontSize:12,color:'var(--ink-3)'}}>รองรับ PNG / JPG (พื้นหลังโปร่งใสจะสวยที่สุด) ขนาดไม่เกิน 2.5MB</p>
          <input ref={logoRef} type="file" accept="image/*" style={{display:'none'}} onChange={onLogo}/>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <Field label="ชื่อร้าน"><Input value={settings.shopName} onChange={e=>set({shopName:e.target.value})}/></Field>
        <Field label="คำโปรย / สาขา"><Input value={settings.shopTagline} onChange={e=>set({shopTagline:e.target.value})}/></Field>
      </div>
    </Section>

    {/* APPEARANCE */}
    <Section icon="sliders" title="การแสดงผล" sub="ธีม สี ฟอนต์ ขนาด และชนิดกราฟ">
      <Field label="ธีม">
        <Segmented value={settings.theme||'light'} onChange={v=>set({theme:v})}
          options={[{value:'light',label:'☀︎ สว่าง'},{value:'dark',label:'☾ มืด'}]}/>
      </Field>
      <Field label="สีหลัก (Accent)">
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:2}}>
          {ACCENT_OPTIONS.map(o=>{ const active=settings.accent===o.value;
            return <button key={o.value} onClick={()=>set({accent:o.value})} title={o.name}
              style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,width:78}}>
              <span style={{width:42,height:42,borderRadius:'50%',background:o.value,
                boxShadow:active?`0 0 0 3px #fff,0 0 0 5px ${o.value}`:'0 1px 3px rgba(0,0,0,.18)',transition:'all .15s'}}/>
              <span style={{fontSize:11,color:active?'var(--ink)':'var(--ink-3)',fontWeight:active?600:500,textAlign:'center',lineHeight:1.2}}>{o.name}</span>
            </button>;
          })}
        </div>
      </Field>

      <Field label="ฟอนต์">
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          {FONT_OPTIONS.map(f=>{ const active=settings.font===f;
            return <button key={f} onClick={()=>set({font:f})} style={{padding:'12px 14px',borderRadius:12,textAlign:'left',
              border:`1.5px solid ${active?'var(--accent)':'var(--line)'}`,background:active?'var(--accent-soft)':'var(--card)',transition:'all .15s'}}>
              <div style={{fontFamily:`"${f}",sans-serif`,fontSize:18,fontWeight:600,color:'var(--ink)'}}>เฌอบาร์ Aa</div>
              <div style={{fontSize:11.5,color:active?'var(--accent)':'var(--ink-3)',marginTop:2,fontWeight:active?600:500}}>{f}</div>
            </button>;
          })}
        </div>
      </Field>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
        <Field label="ขนาดการแสดงผล">
          <Segmented value={String(settings.displaySize||1)} onChange={v=>set({displaySize:+v})}
            options={[{value:'0.9',label:'กะทัดรัด'},{value:'1',label:'ปกติ'},{value:'1.1',label:'ใหญ่'}]}/>
        </Field>
        <Field label="ชนิดกราฟยอดขาย">
          <Segmented value={settings.salesChart||'bar'} onChange={v=>set({salesChart:v})}
            options={[{value:'bar',label:'แท่ง'},{value:'line',label:'เส้น'},{value:'area',label:'พื้นที่'}]}/>
        </Field>
      </div>
    </Section>

    {/* FINANCIAL */}
    <Section icon="wallet" title="ตั้งค่าการเงิน" sub="ใช้คำนวณกำไร จุดคุ้มทุน และ GP">
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <Field label="GP% เฉลี่ย" hint="สัดส่วนกำไรขั้นต้นเฉลี่ย เช่น 0.65 = 65%">
          <Input type="number" step="0.01" value={settings.estGP} onChange={e=>set({estGP:+e.target.value||0})}/></Field>
        <Field label="เป้ารายได้ต่อเดือน (฿)">
          <Input type="number" value={settings.target} onChange={e=>set({target:+e.target.value||0})}/></Field>
        <Field label="ราคาขายเฉลี่ย/แก้ว (฿)" hint="ใส่ 0 เพื่อคำนวณจากเมนูอัตโนมัติ">
          <Input type="number" value={settings.avgPrice} onChange={e=>set({avgPrice:+e.target.value||0})}/></Field>
        <Field label="ค่าคอมมิชชัน LINE MAN" hint="เช่น 0.32 = 32% (สูงสุด 1.0)">
          <Input type="number" step="0.01" value={settings.lineCommission} onChange={e=>set({lineCommission:+e.target.value||0})}/></Field>
        <Field label="ส่วนบวกราคาไลน์แมน" hint="ราคาไลน์สูงกว่าร้าน เช่น 0.45 = +45%">
          <Input type="number" step="0.01" value={settings.lineMarkup} onChange={e=>set({lineMarkup:+e.target.value||0})}/></Field>
        <Field label="GP เป้าหมาย (ราคาแนะนำ)" hint="ใช้คำนวณราคาแนะนำขาย เช่น 0.65 = 65%">
          <Input type="number" step="0.01" value={settings.priceTargetGP} onChange={e=>set({priceTargetGP:+e.target.value||0})}/></Field>
      </div>
    </Section>

    {/* BRANCHES */}
    <BranchSection/>

    {/* VAT */}
    <Section icon="receipt" title="ภาษีมูลค่าเพิ่ม (VAT)" sub="แยกแสดง VAT 7% ในรายงานและวิเคราะห์">
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <Toggle on={!!settings.vatEnabled} onChange={v=>set({vatEnabled:v})}/>
        <span style={{fontSize:14}}>{settings.vatEnabled?'เปิดใช้งาน — แสดงยอดก่อน VAT และภาษีขาย':'ปิดอยู่'}</span>
      </div>
      {settings.vatEnabled && <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <Field label="อัตรา VAT" hint="เช่น 0.07 = 7%"><Input type="number" step="0.01" value={settings.vatRate} onChange={e=>set({vatRate:+e.target.value||0})}/></Field>
        <Field label="รูปแบบราคา"><Segmented value={settings.vatMode||'inclusive'} onChange={v=>set({vatMode:v})}
          options={[{value:'inclusive',label:'รวม VAT แล้ว'},{value:'exclusive',label:'ยังไม่รวม VAT'}]}/></Field>
      </div>}
    </Section>

    {/* ALERTS */}
    <Section icon="bell" title="การแจ้งเตือน" sub="เตือนเมนู GP ต่ำ ยอดต่ำกว่าเป้า และอื่นๆ">
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <Toggle on={settings.alertsEnabled!==false} onChange={v=>set({alertsEnabled:v})}/>
        <span style={{fontSize:14}}>{settings.alertsEnabled!==false?'เปิดการแจ้งเตือนในกระดิ่ง':'ปิดอยู่'}</span>
      </div>
      {settings.alertsEnabled!==false && <Field label={`เกณฑ์เตือน GP ต่ำ — ต่ำกว่า ${fmtPct(settings.gpAlertThreshold??0.5,0)}`} style={{maxWidth:360}}>
        <input type="range" min="0.2" max="0.8" step="0.05" value={settings.gpAlertThreshold??0.5}
          onChange={e=>set({gpAlertThreshold:+e.target.value})} style={{width:'100%',accentColor:'var(--accent)'}}/>
      </Field>}
    </Section>

    {/* EXPORT */}
    <SettingsSection icon="download" title="การส่งออกไฟล์" sub="เลือกที่จัดเก็บไฟล์ตอนส่งออก/สำรองข้อมูล">
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <Toggle on={!!settings.askSaveLocation} onChange={v=>set({askSaveLocation:v})}/>
        <span style={{fontSize:14}}>{settings.askSaveLocation?'ถามที่จัดเก็บทุกครั้ง — เปิดกล่อง “Save As” ให้เลือกโฟลเดอร์เอง':'ดาวน์โหลดอัตโนมัติ (ไปโฟลเดอร์ Downloads)'}</span>
      </div>
      <p style={{fontSize:11.5,color:'var(--ink-3)',lineHeight:1.7}}>
        เปิดตัวเลือกนี้แล้วทุกครั้งที่ส่งออก จะมีหน้าต่างให้เลือกโฟลเดอร์ (เช่น ไดรฟ์ D โฟลเดอร์ที่ตั้งไว้) — รองรับ Chrome/Edge บนคอมพิวเตอร์<br/>
        หากต้องการเปลี่ยนโฟลเดอร์ดาวน์โหลดถาวร ให้ตั้งที่ Chrome → ตั้งค่า → ดาวน์โหลด → เปลี่ยนตำแหน่ง หรือเปิด “ถามตำแหน่งที่จัดเก็บก่อนดาวน์โหลด”
      </p>
    </SettingsSection>

    {/* CLOUD / GOOGLE SHEET */}
    <SheetSettings/>
    {window.SupabaseSettings && <SupabaseSettings/>}

    {/* SECURITY */}
    <Section icon="lock" title="ความปลอดภัย (PIN)" sub="ล็อกหน้าจอด้วยรหัส PIN กันคนอื่นเปิดดู">
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <Toggle on={!!settings.pinEnabled} onChange={v=>{ if(v && String(settings.pin||'').length<4){ flash('ตั้ง PIN 4–6 หลักก่อน','err'); return;} set({pinEnabled:v}); }}/>
        <span style={{fontSize:14}}>{settings.pinEnabled?'เปิดใช้งาน — ต้องใส่ PIN ทุกครั้งที่เปิด':'ปิดอยู่'}</span>
      </div>
      <Field label="รหัส PIN (4–6 หลัก)" hint="ตั้งหรือเปลี่ยนรหัส แล้วเปิดสวิตช์ด้านบน" style={{maxWidth:240}}>
        <Input type="text" inputMode="numeric" maxLength={6} value={settings.pin||''}
          onChange={e=>set({pin:e.target.value.replace(/\D/g,'').slice(0,6)})} placeholder="••••"/>
      </Field>
      <p style={{fontSize:11.5,color:'var(--ink-3)'}}>หมายเหตุ: PIN เก็บในเครื่องนี้เพื่อกันการเปิดดูทั่วไป ไม่ใช่การเข้ารหัสระดับสูง</p>
    </Section>

  </div>;
}

function Toggle({ on, onChange }){
  return <button onClick={()=>onChange(!on)} style={{width:48,height:28,borderRadius:16,padding:2,border:'none',cursor:'pointer',
    background:on?'var(--green)':'var(--chip)',transition:'background .2s',display:'flex',alignItems:'center'}}>
    <span style={{width:24,height:24,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.3)',
      transform:on?'translateX(20px)':'translateX(0)',transition:'transform .2s'}}/>
  </button>;
}

function BranchSection(){
  const { db, setDb, settings, setSettings, flash } = useData();
  const [name,setName]=React.useState('');
  const branches=db.branches||[];
  const add=()=>{ const n=name.trim(); if(!n)return; if(branches.includes(n)){flash('มีสาขานี้แล้ว','err');return;}
    setDb(p=>({...p,branches:[...(p.branches||[]),n]})); setName(''); flash('เพิ่มสาขาแล้ว'); };
  const removeBranch=(b)=>{ if(!confirm(`ลบสาขา "${b}"? (ยอดขายที่ผูกกับสาขานี้จะยังอยู่)`))return;
    setDb(p=>({...p,branches:(p.branches||[]).filter(x=>x!==b)}));
    if(settings.activeBranch===b) setSettings({...settings,activeBranch:'ทั้งหมด'}); };
  return <SettingsSection icon="store" title="สาขา" sub="จัดการสาขาเพื่อแยกและเปรียบเทียบยอดขาย">
    <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
      {branches.map(b=><span key={b} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:10,
        background:'var(--chip)',fontSize:13.5,fontWeight:500}}>{b}
        <button onClick={()=>removeBranch(b)} style={{color:'var(--ink-3)',display:'grid',placeItems:'center'}}><Icon name="close" size={14}/></button></span>)}
      {!branches.length && <span style={{fontSize:13,color:'var(--ink-3)'}}>ยังไม่มีสาขา</span>}
    </div>
    <div style={{display:'flex',gap:10,maxWidth:420}}>
      <Input value={name} placeholder="ชื่อสาขาใหม่ เช่น สาขาเซ็นทรัล" onChange={e=>setName(e.target.value)}
        onKeyDown={e=>e.key==='Enter'&&add()}/>
      <Button icon="plus" onClick={add}>เพิ่ม</Button>
    </div>
    <p style={{fontSize:11.5,color:'var(--ink-3)'}}>เมื่อมีมากกว่า 1 สาขา จะมีตัวเลือกกรองสาขาที่แถบบน และเลือกสาขาตอนบันทึกยอดขาย</p>
  </SettingsSection>;
}

Object.assign(window, { SettingsPage });
