# JEBAR Architecture Diagram

Updated: 2026-06-12

ไฟล์นี้ใช้สรุปภาพรวมสถาปัตยกรรมของระบบ JEBAR ปัจจุบัน และทิศทางการเชื่อม HR + DATA + OPS ในอนาคต

---

## 1. High-level Architecture

```mermaid
flowchart LR
    U1["เจ้าของร้าน / แอดมิน"] --> HR["HR JEBAR<br/>Cloudflare Pages<br/>hr-jebar.pages.dev"]
    U2["พนักงาน"] --> HR
    U3["เจ้าของร้าน / ผู้จัดการ"] --> DATA["JEBAR DATA<br/>Cloudflare Workers/Pages<br/>jebar-data.je-bar.workers.dev"]

    HR --> HRSB["Supabase HR Project<br/>Auth + Postgres + Storage"]
    DATA --> LS["Browser localStorage<br/>jebar_db_v1<br/>jebar_settings_v1"]
    DATA --> DSB["Supabase DATA Project<br/>table: jebar_app_state<br/>bucket: jebar-images"]

    OPS["JEBAR OPS / Bakery Operations<br/>(future app)"] --> DSB
    OPS --> DATA

    POS["Wongnai POS Export"] --> DATA
    LM["LINE MAN Export"] --> DATA
    IMG["รูปเมนู / รูปสูตร / รูปวัตถุดิบ"] --> DATA
    DATA --> DSB

    HR -. เปิดหน้า OPS .-> OPSWEB["/ops/ entry inside HR"]
```

---

## 2. Data Ownership

```mermaid
flowchart TB
    DATAOWNER["JEBAR DATA = เจ้าของข้อมูล master data"]
    HROWNER["HR JEBAR = เจ้าของข้อมูลพนักงาน/เวลาเข้างาน"]
    OPSOWNER["OPS = เจ้าของข้อมูลปฏิบัติการสต๊อกบางส่วน"]

    DATAOWNER --> D1["เมนู<br/>db.menus"]
    DATAOWNER --> D2["วัตถุดิบ / supplies<br/>db.ingredients"]
    DATAOWNER --> D3["แพ็กเกจ<br/>db.packages"]
    DATAOWNER --> D4["สูตรตรง<br/>db.recipeBase"]
    DATAOWNER --> D5["สูตรฐานเบเกอรี่<br/>db.batchRecipes<br/>db.batchRecipeLines"]
    DATAOWNER --> D6["ลิงก์สูตรเมนู -> สูตรฐาน<br/>db.recipeBatch"]
    DATAOWNER --> D7["รูปภาพ metadata<br/>db.mediaAssets"]
    DATAOWNER --> D8["ยอดขาย / รายงาน / AI context"]

    HROWNER --> H1["พนักงาน"]
    HROWNER --> H2["PIN / session"]
    HROWNER --> H3["attendance / OT / leave / payroll"]

    OPSOWNER --> O1["stockBalances"]
    OPSOWNER --> O2["stockMovements"]
    OPSOWNER --> O3["purchaseEvents"]
    OPSOWNER --> O4["productionEvents"]
    OPSOWNER --> O5["wasteEvents"]
    OPSOWNER --> O6["integrationInbox / integrationOutbox"]
```

---

## 3. Runtime and Deployment Architecture

```mermaid
flowchart LR
    subgraph Cloudflare
        HRAPP["HR JEBAR<br/>Pages project: hr-jebar"]
        DATAAPP["JEBAR DATA<br/>Worker/Pages project: jebar-data"]
    end

    subgraph Supabase
        HRDB["HR database<br/>separate project"]
        DATADB["DATA database<br/>public.jebar_app_state"]
        BUCKET["Storage bucket<br/>jebar-images"]
    end

    HRAPP --> HRDB
    DATAAPP --> DATADB
    DATAAPP --> BUCKET
```

---

## 4. JEBAR DATA Internal Storage Flow

```mermaid
flowchart LR
    Browser["Browser App: JEBAR DATA"] --> Local["localStorage<br/>jebar_db_v1<br/>jebar_settings_v1"]
    Browser --> Sync["Supabase Sync layer"]
    Sync --> Row["public.jebar_app_state<br/>shop_code = jebar<br/>field: db"]
    Browser --> MediaMeta["db.mediaAssets"]
    MediaMeta --> Bucket["Supabase bucket: jebar-images"]
```

---

## 5. Import Flow

```mermaid
flowchart LR
    POSFILE["Wongnai POS files"] --> PARSE["Import parser"]
    LMFILE["LINE MAN files"] --> PARSE
    CSV["Menu / ingredient CSV"] --> PARSE
    IMGFILE["Recipe / product images"] --> AIREAD["AI / image reader"]

    PARSE --> DBSTATE["db object in JEBAR DATA"]
    AIREAD --> DBSTATE
    DBSTATE --> LOCAL["localStorage"]
    DBSTATE --> SUPA["Supabase: jebar_app_state"]
    AIREAD --> IMGSTORE["jebar-images bucket + db.mediaAssets"]
```

---

## 6. Future Unified Employee App Flow

```mermaid
flowchart LR
    EMP["พนักงาน login ครั้งเดียว"] --> HRAPP["HR JEBAR"]
    HRAPP --> EMPHOME["หน้า employee home"]
    EMPHOME --> CLOCK["ลงเวลา / attendance"]
    EMPHOME --> OPSLINK["ปุ่มเข้าสู่ระบบร้าน / OPS"]
    OPSLINK --> OPSVIEW["OPS workflow<br/>สต๊อก / ผลิต / เบิกใช้"]

    OPSVIEW --> DATAMASTER["อ่าน master data จาก JEBAR DATA"]
    OPSVIEW --> STOCKWRITE["เขียนกลับเฉพาะ stock zones"]
    STOCKWRITE --> DATAROW["Supabase DATA: jebar_app_state.db"]
```

---

## 7. Direct Integration Contract for OPS

```mermaid
sequenceDiagram
    participant OPS as OPS App
    participant SUPA as Supabase DATA
    participant DATA as JEBAR DATA

    OPS->>SUPA: GET jebar_app_state by shop_code
    SUPA-->>OPS: row.db
    OPS->>OPS: read db.menus / db.ingredients / db.packages
    OPS->>OPS: build stock / production transactions
    OPS->>SUPA: PATCH db.stockBalances / db.stockMovements / events
    DATA->>SUPA: sync latest master data / media metadata
    SUPA-->>DATA: updated cloud state
```

---

## 8. Canonical Storage Paths

- HR app code:
  - `C:\Users\TEST_Lenovo\HR-JEBAR\app`
- JEBAR DATA app output:
  - `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\outputs\jebar-data`
- DATA local browser keys:
  - `jebar_db_v1`
  - `jebar_settings_v1`
- DATA online table:
  - `public.jebar_app_state`
- DATA image bucket:
  - `jebar-images`

---

## 9. Rules We Should Keep

1. `JEBAR DATA` เป็นเจ้าของ master data
2. `HR JEBAR` เป็นเจ้าของข้อมูลคนและเวลา
3. `OPS` อ่าน master data จาก DATA โดยตรง
4. `OPS` เขียนกลับได้เฉพาะ stock zones
5. รูปทั้งหมดต้องอ้างผ่าน `db.mediaAssets` และเก็บไฟล์จริงใน `jebar-images`
6. การรวมแอปพนักงานควรเป็น single login แต่ยังแยก ownership ของข้อมูลแต่ละโดเมน

---

## 10. Recommended Next Diagram

ถ้าต้องการต่อจากไฟล์นี้ แนะนำทำเพิ่มอีก 2 แผนภาพ:

1. `LOGIN_FLOW_JEBAR.md`
   - แยก owner / admin / employee / ops access

2. `DATA_MODEL_DIAGRAM_JEBAR.md`
   - แสดง relation ระหว่าง `menus`, `ingredients`, `recipeBase`, `batchRecipes`, `recipeBatch`, `mediaAssets`, `stockBalances`

