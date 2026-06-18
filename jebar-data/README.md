# JEBAR — ระบบข้อมูลร้าน (Data System) · Developer Handoff

> เอกสารส่งต่อสำหรับนักพัฒนา (Claude Code) — อธิบายสถาปัตยกรรม, โครงสร้างข้อมูล, และวิธีแก้ไข/ต่อยอดระบบ

---

## 1. นี่คืออะไร

JEBAR เป็น **เว็บแอปจัดการข้อมูลร้านกาแฟ/บาร์** (ภาษาไทย) ทำงานฝั่ง client ล้วน — ไม่มี backend server ของตัวเอง ข้อมูลเก็บใน `localStorage` ของเบราว์เซอร์ และซิงค์ข้ามเครื่องผ่าน **Google Apps Script + Google Sheets** (ผู้ใช้ตั้งค่าเอง)

ความสามารถหลัก:
- **แดชบอร์ด** — ภาพรวมยอดขาย, กำไร, KPI
- **ยอดขายรายวัน** — บันทึก/นำเข้ายอดขายแยกช่องทาง (หน้าร้าน / LINE MAN / อื่นๆ) + จำนวนบิล
- **วิเคราะห์ยอดขาย** — สรุปราย วัน/เดือน/ปี
- **เมนู & สูตร** — จัดการเมนู + สูตรต้นทุน (วัตถุดิบ + แพคเกจ + ออปชัน) → คำนวณ GP
- **ข้อมูลหลัก (Master)** — วัตถุดิบ / แพคเกจ / ออปชัน / ค่าใช้จ่าย (overhead) + นำเข้า CSV
- **วิเคราะห์สินค้า** — GP หน้าร้าน vs LINE MAN, ราคาแนะนำ, ความคุ้มค่าคอม
- **วิเคราะห์เชิงลึก** — GP ต่อเมนู, เมนูใช้ต้นทุนสำรอง (Fallback), กำไรจริง LINE MAN, อันดับเมนูขายดี, Heatmap ชั่วโมงขายดี
- **POS Import** — นำเข้ายอดขายจากไฟล์ POS วงใน (CSV/XLSX)
- **ตั้งค่า** — ธีม/สี/ฟอนต์, สาขา, เชื่อม Google Sheet (ซิงค์คลาวด์)
- เป็น **PWA** — เพิ่มลงหน้าจอ/เดสก์ท็อปได้ เปิดแบบเต็มจอ

---

## 2. ⚠️ สำคัญมาก: ไฟล์เหล่านี้ "ทำงานได้จริง" ไม่ใช่แค่ดีไซน์

ต่างจาก handoff ดีไซน์ทั่วไป — **นี่คือซอร์สโค้ดของแอปที่ใช้งานจริงอยู่** (React) แบ่งเป็นไฟล์ `.jsx` หลายไฟล์ ผู้ใช้ใช้งานเวอร์ชันนี้อยู่ (deploy บน Netlify)

งานของนักพัฒนา **ไม่ใช่การสร้างใหม่จากศูนย์** แต่เป็นการ **แก้ไข/ต่อยอดโค้ดที่มีอยู่** โดยรักษาพฤติกรรมเดิมและข้อมูลของผู้ใช้ไว้ คุณสามารถ:
- แก้ไขไฟล์ `.jsx` ได้โดยตรง (ดูสถาปัตยกรรมข้อ 4)
- **หรือ** ถ้าต้องการยกระดับเป็นโปรเจกต์มาตรฐาน (Vite + React + TypeScript ฯลฯ) ให้ migrate ทีละส่วน โดยคงสัญญาเรื่องข้อมูล (localStorage keys, รูปแบบ Google Sheet sync) ไว้เป๊ะ ๆ เพื่อไม่ให้ข้อมูลผู้ใช้หาย

**Fidelity: High** — โค้ดนี้คือของจริงระดับ production พร้อมใช้ ไม่ใช่ mockup

---

## 3. วิธีรัน (ปัจจุบัน)

ไม่มี build step — เป็น HTML + React (โหลดผ่าน CDN) + Babel standalone (transpile `.jsx` ในเบราว์เซอร์)

```
# ต้องเสิร์ฟผ่าน HTTP (ไม่ใช่ file://) เพราะมีการ fetch ไฟล์ .jsx
cd <โฟลเดอร์นี้>
python3 -m http.server 8000
# เปิด http://localhost:8000/JEBAR Data System.html
```

- `JEBAR Data System.html` = ไฟล์หลัก (โหลด `.jsx` แยกไฟล์ — ใช้ตอนพัฒนา)
- `index.html` / `JEBAR ใช้งานจริง.html` = เวอร์ชัน bundle ไฟล์เดียว (สำหรับ deploy — **อย่าแก้ไฟล์นี้โดยตรง**, มันถูก generate จากไฟล์หลัก)

> **หมายเหตุ build:** เวอร์ชัน deploy ปัจจุบันถูก inline ทุกอย่างเป็นไฟล์เดียวด้วยเครื่องมือภายนอก ถ้าคุณ migrate ไป Vite/bundler มาตรฐาน ให้แทนกระบวนการนี้ด้วย `npm run build` ปกติ

---

## 4. สถาปัตยกรรม

### 4.1 รูปแบบการโหลด (สำคัญ)
แต่ละ `<script type="text/babel">` ถูก transpile แยก scope กัน — **คอมโพเนนต์แชร์กันผ่าน `window` ไม่ใช่ ES import** ทุกไฟล์จบด้วย `Object.assign(window, { ... })` เพื่อ export ของที่ไฟล์อื่นต้องใช้

**ลำดับโหลด (จาก `<head>` ของ HTML หลัก) — ห้ามสลับ เพราะมี dependency:**
```
1. React 18.3.1 + ReactDOM (CDN, pinned + integrity hash)
2. @babel/standalone 7.29.0 (CDN)
3. data/seed.js      → window.JEBAR_SEED (ข้อมูลตั้งต้น)
4. data/logo.js      → window.JEBAR_LOGO (โลโก้ base64)
5. app/store.jsx     → DataProvider, useData, helpers (fmt, fixYields, normDate...)
6. app/charts.jsx    → LineChart, HBars, ฯลฯ
7. app/ui.jsx        → UI kit (Button, Card, Stat, Modal, Select, TypeSelect, InfoDot...)
8. app/dashboard.jsx → Dashboard
9. app/sales.jsx     → Sales
10. app/periods.jsx  → SalesAnalytics + aggregateByMonth ฯลฯ
11. app/menu.jsx     → MenuView + RecipeEditor
12. app/master.jsx   → Master (วัตถุดิบ/แพคเกจ/ออปชัน/overhead) + CSV import
13. app/products.jsx → ProductAnalysis
14. app/deep.jsx     → DeepAnalytics (วิเคราะห์เชิงลึก)
15. app/pos.jsx      → POSImportModal + window.__posReadFile (อ่าน CSV/XLSX)
16. app/features.jsx → ฟีเจอร์เสริม
17. app/sheets.jsx   → ซิงค์ Google Sheet (useSheetSync)
18. app/settings.jsx → SettingsPage
19. app/main.jsx     → App shell, routing, import/export, ReactDOM.render
```

> เมื่อเพิ่มไฟล์ใหม่: วาง `<script type="text/babel" src="app/xxx.jsx">` ให้ถูกลำดับ (หลัง dependency, ก่อนผู้ใช้) แล้ว `Object.assign(window, {…})` สิ่งที่ต้อง export

### 4.2 State กลาง — `app/store.jsx`
- `DataProvider` ครอบทั้งแอป, ให้ state ผ่าน hook **`useData()`**
- ค่าที่ได้จาก `useData()`: `db`, `setDb`, `settings`, `setSettings`, `flash(msg, kind)` (toast), `saveSale`, `remove`, `setCollection`, `resetData`, `importDB`, ฯลฯ
- **Persistence:** เขียน `db` ลง `localStorage['jebar_db_v1']` และ `settings` ลง `localStorage['jebar_settings_v1']` อัตโนมัติทุกครั้งที่เปลี่ยน
- มี helper สำคัญที่ export ไป `window`: `fmt/fmtB/fmtPct` (จัดรูปตัวเลข/บาท/%), `normDate` (แปลงวันที่ทุกรูปแบบ → YYYY-MM-DD), `nextCode` (สร้างรหัสอัตโนมัติ เช่น ING001), `fixYields` (แก้ค่า yield ที่กรอกผิด), `menuEconomics` (คำนวณต้นทุน/GP ต่อเมนู), `aggregateByMonth`

### 4.3 Routing — `app/main.jsx`
Routing ทำเองด้วย state ตัวเดียว (`route`) ไม่มี react-router แมป route → component:
```js
const View = { dashboard:Dashboard, sales:Sales, analytics:SalesAnalytics,
  products:ProductAnalysis, insights:DeepAnalytics, menu:MenuView,
  master:Master, reports:Reports, settings:SettingsPage }[route];
```
เมนูนำทาง (sidebar) นิยามเป็น array `NAV` ในไฟล์เดียวกัน

---

## 5. โครงสร้างข้อมูล (Data Model)

ทั้งหมดอยู่ใน object `db` ตัวเดียว (ดูตัวอย่างจริงใน `data/seed.js`). คอลเล็กชันหลัก:

| key | คือ | ฟิลด์สำคัญ |
|---|---|---|
| `menus` | เมนูขาย | `id`(BEV/COF...), `name`, `category`, `type`, `priceStore`, `priceLine`, `status` |
| `ingredients` | วัตถุดิบ | `id`(ING###), `name`, `category`, `buyPrice`, `buyQty`, `unit`, `yield`(0–1), `costPerUnit`(คำนวณ) |
| `packages` | บรรจุภัณฑ์ | `id`(PKG###), `name`, `type`, `buyPrice`, `buyQty`, `costPerPiece`(คำนวณ) |
| `options` | ตัวเลือกเสริม | `id`(OP###), `name`, `group`, `type`, `addPrice` |
| `overhead` | ค่าใช้จ่ายคงที่ | `name`, `amount`, `type` |
| `recipeBase` | สูตร: วัตถุดิบต่อเมนู | `menuId`, `ingId`, `qty`, `unit`, `costPerUnit`, `lineCost` |
| `recipePackage` | สูตร: แพคเกจต่อเมนู | `menuId`, `pkgId`, `qty`, `lineCost` |
| `recipeOption` | สูตร: ออปชันต่อเมนู | `menuId`, `optionId`, `ingId`, `qty`, `lineCost` |
| `dailySales` | ยอดขายรายวัน | `date`(YYYY-MM-DD), `store`, `line`, `other`, `bills`, `branch` |
| `menuReports` | อันดับเมนูขายดี (นำเข้า) | `id`, `start`, `end`, `span`, `rows:[{name,qty,amount}]` |
| `hourlyReports` | ยอดขายรายชั่วโมง (นำเข้า) | `id`, `start`, `end`, `hours:[24]`, `qty`, `amount`, `rows` |
| `categories`/`types`/`ingCategories`/`pkgTypes`/`optionGroups` | ลิสต์ประเภท (แก้ไข/เพิ่มเองได้) | array ของ string |
| `branches` | สาขา | array ของ string |

### กฎธุรกิจสำคัญ (business rules)
- **costPerUnit ของวัตถุดิบ** = `buyPrice / (buyQty × yield)` — `yield` คือสัดส่วนใช้ได้จริง (0–1). `fixYields()` จะแปลงค่าที่กรอกมาเป็น % (เช่น 90, 100) ให้เป็น 0–1 อัตโนมัติ
- **ต้นทุนเมนู** = ผลรวม recipeBase + recipePackage + **ค่าเฉลี่ยของ recipeOption ต่อตัวเลือก** (ลูกค้าเลือกออปชัน 1 ตัว/แก้ว — จึงใช้ค่าเฉลี่ย ไม่ใช่ผลรวมทุกตัว ดู `menuEconomics` ใน store.jsx)
- **GP หน้าร้าน** = `(priceStore − ต้นทุน) / priceStore`
- **GP LINE MAN สุทธิ** = `(priceLine × (1 − ค่าคอม) − ต้นทุน) / priceLine` (ค่าคอมเริ่มต้น ~32%, ตั้งใน settings)
- **เมนู Fallback** = เมนูที่ยังไม่มีสูตร → ประมาณต้นทุนจาก `priceStore × (1 − estGP)` (estGP ตั้งใน settings)
- **นำเข้ายอดขายวันซ้ำ** = เขียนทับ (1 วัน = 1 record, ใช้ date เป็น key)

---

## 6. ระบบซิงค์คลาวด์ — `app/sheets.jsx`

ผู้ใช้สร้าง **Google Apps Script Web App** เอง แล้ววางลิงก์ `/exec` ในหน้าตั้งค่า มี 2 โหมด:
- **ทั้งระบบ (full)** — sync `db` ทั้งก้อน (GET ดึง, POST ส่ง)
- (โหมดแยกตาราง ถ้ามี)

จุดที่ต้องระวังเมื่อแก้:
- ข้อมูลที่ดึงจากคลาวด์ถูกส่งผ่าน `fixYields()` ก่อนใช้ (กัน yield เพี้ยน) และถ้าพบของเสียจะ POST ตัวที่แก้แล้วกลับขึ้นไป
- ปัญหา "เปิดบนมือถือไม่ได้" มักเป็นการตั้ง **Apps Script deployment permission** ต้องเป็น *"Anyone"* (ไม่ใช่ "Anyone with Google account") — ไม่ใช่บั๊กโค้ด

---

## 7. ระบบดีไซน์ (Design Tokens)

นิยามเป็น CSS variables ใน `<style>` ของ HTML หลัก (`:root` + `[data-theme="dark"]`). อย่า hardcode สี — ใช้ var เสมอ

- **สีหลัก (accent):** ปรับได้จาก settings → `--accent` (ดีฟอลต์ `#0071e3`). มี `--accent-soft` คู่กัน
- **โทนกลาง:** `--ink`, `--ink-2`, `--ink-3` (ข้อความเข้ม→อ่อน), `--surface`, `--surface-2`, `--line`, `--line-2`, `--chip`
- **สีสถานะ:** `--green`, `--red`, `--orange` + เวอร์ชัน `-soft`
- **เงา:** `--shadow`, `--shadow-lg` · **มุมโค้ง:** การ์ดส่วนใหญ่ 12–14px
- **ฟอนต์:** ไทย — ดีฟอลต์ *Noto Sans Thai* (เลือกได้: IBM Plex Sans Thai, Sarabun, Prompt, Kanit, Mitr) ผ่าน `--font`
- **ธีม:** light/dark สลับผ่าน `data-theme` บน `<html>` (ดู `applyAppearance()` ใน store.jsx)
- **ตัวเลข:** ใช้ class `.tnum` (tabular-nums) ให้ตัวเลขเรียงตรง

UI kit ทั้งหมดอยู่ใน `app/ui.jsx`: `Button`, `IconBtn`, `Card`, `Badge`, `Stat`(การ์ด KPI), `SectionTitle`, `ColHead`(หัวตาราง+ⓘ), `InfoDot`(ป๊อปอัปคำอธิบาย), `Field`, `Input`, `Select`, `TypeSelect`(dropdown เพิ่มค่าใหม่ได้), `Segmented`, `Search`, `Modal`, `Empty`, `Icon`(ชุดไอคอน inline SVG)

---

## 8. ไฟล์ในแพ็กเกจนี้

```
JEBAR Data System.html   ← ไฟล์หลัก (โหลด .jsx แยก — แก้ที่นี่)
manifest.webmanifest     ← PWA manifest
app/                     ← ซอร์สโค้ด React ทั้งหมด (.jsx)
  store.jsx  ui.jsx  charts.jsx  main.jsx
  dashboard.jsx  sales.jsx  periods.jsx  menu.jsx
  master.jsx  products.jsx  deep.jsx  pos.jsx
  features.jsx  sheets.jsx  settings.jsx
data/
  seed.js    ← ข้อมูลตั้งต้น (window.JEBAR_SEED) — ดูโครงสร้างจริงที่นี่
  logo.js    ← โลโก้ base64
  jebar.json ← ข้อมูลตัวอย่าง (อ้างอิง)
assets/      ← ไอคอน PWA + โลโก้
sample-data/ ← ไฟล์ CSV ตัวอย่างสำหรับทดสอบการนำเข้า
```

---

## 9. งานที่ทำบ่อย (cheat sheet)

- **เพิ่มหน้าใหม่:** สร้าง `app/xxx.jsx` → `function XxxPage(){...}` → `Object.assign(window,{XxxPage})` → เพิ่ม `<script>` ใน HTML → เพิ่มใน `NAV` + แมป `View` ใน main.jsx
- **เพิ่มฟิลด์ข้อมูล:** แก้ที่ฟอร์ม (master.jsx/menu.jsx) + seed.js + จุดคำนวณที่เกี่ยวข้อง
- **แก้สูตรคำนวณต้นทุน/GP:** อยู่ที่ `menuEconomics()` ใน store.jsx (จุดเดียว — ใช้ร่วมทุกหน้า)
- **เพิ่ม ⓘ คำอธิบาย:** ใส่ prop `info="..."` ใน `<Stat>`, `<SectionTitle>`, หรือครอบหัวตารางด้วย `<ColHead info="...">`
- **แก้ไอคอน:** เพิ่ม path ใน `Icon` ของ ui.jsx

---

*สร้างโดยผู้ช่วยออกแบบ — หากต้องการภาพหน้าจอประกอบ แจ้งได้*
