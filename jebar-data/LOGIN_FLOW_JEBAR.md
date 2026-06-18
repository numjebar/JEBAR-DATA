# JEBAR Login Flow

Updated: 2026-06-12

เอกสารนี้อธิบาย flow การเข้าใช้งานของระบบ JEBAR ในปัจจุบัน และแนวทางรวม HR + OPS + DATA ให้ผู้ใช้ login แบบเหมาะกับบทบาท

---

## 1. Current Login Landscape

```mermaid
flowchart LR
    Owner["เจ้าของร้าน / แอดมิน"] --> HRAdmin["HR JEBAR Admin Login"]
    Employee["พนักงาน"] --> HREmp["HR JEBAR Employee PIN Login"]
    Manager["เจ้าของร้าน / ผู้จัดการ"] --> DataOpen["JEBAR DATA"]

    HRAdmin --> HRAdminApp["HR admin area"]
    HREmp --> HREmpApp["HR employee area"]
    DataOpen --> DataApp["DATA dashboard / sales / recipes / AI"]
```

---

## 2. Current HR Login Flow

```mermaid
flowchart TB
    Start["เปิด hr-jebar.pages.dev"] --> Choose{"เลือกทางเข้า"}
    Choose --> Admin["เจ้าของร้าน / แอดมิน"]
    Choose --> Emp["พนักงาน"]

    Admin --> AdminLogin["Supabase Auth<br/>email + password"]
    AdminLogin --> AdminRole{"มีสิทธิ์ใน admin_roles ?"}
    AdminRole -->|Yes| AdminShell["Admin shell<br/>Dashboard / employees / payroll / settings"]
    AdminRole -->|No| AdminDenied["ไม่ให้เข้า admin"]

    Emp --> PinLogin["PIN login / employee session token"]
    PinLogin --> EmpHome["Employee home"]
    EmpHome --> Attendance["ลงเวลา / attendance"]
    EmpHome --> Income["รายได้ / history / profile"]
```

---

## 3. Current DATA Access Flow

```mermaid
flowchart TB
    OpenData["เปิด JEBAR DATA"] --> RuntimeDetect{"runtime mode"}
    RuntimeDetect -->|owner| OwnerMode["Owner mode"]
    RuntimeDetect -->|employee| EmployeeMode["Employee mode"]

    OwnerMode --> OwnerNav["เห็นเมนูครบ<br/>AI / master / integration / settings"]
    EmployeeMode --> EmployeeNav["เห็นเฉพาะเมนูที่อนุญาต"]
```

Key note:

- DATA app ตอนนี้ยังไม่ได้ผูก auth จริง
- ใช้ runtime mode เพื่อซ่อน/แสดงหน้า
- ถ้าจะให้พนักงานใช้จริงใน production ต้องพึ่ง HR เป็นประตูหลัก

---

## 4. Current OPS Entry from HR

```mermaid
flowchart LR
    Employee["พนักงาน login HR สำเร็จ"] --> EmpHome["Employee home"]
    EmpHome --> OpsButton["ปุ่ม เปิดระบบร้าน / OPS"]
    OpsButton --> OpsPage["/ops/ page"]
```

ข้อจำกัดตอนนี้:

- `/ops/` เป็น static entry
- ยังไม่ได้ใช้ employee session ของ HR แบบเต็มรูปแบบ
- ถ้าจะให้ปลอดภัยจริง ต้องมี session handshake หรือ route guard จาก HR

---

## 5. Recommended Unified Login Target

```mermaid
flowchart TB
    Open["เปิด JEBAR Operations System"] --> RoleGate{"บทบาทผู้ใช้"}
    RoleGate -->|Owner/Admin| OwnerLogin["Supabase Auth"]
    RoleGate -->|Employee| EmployeeLogin["PIN login / employee session"]

    OwnerLogin --> OwnerHub["Owner hub"]
    EmployeeLogin --> EmployeeHub["Employee hub"]

    OwnerHub --> HRAdminArea["HR admin functions"]
    OwnerHub --> DataOwnerArea["DATA owner functions"]
    OwnerHub --> OpsOwnerArea["OPS / stock / production"]

    EmployeeHub --> AttendanceArea["Clock in/out"]
    EmployeeHub --> EmployeeOps["OPS tasks allowed for employee"]
    EmployeeHub --> EmployeeSelf["History / income / profile"]
```

---

## 6. Recommended Security Model

### Owner / Admin

- Login ด้วย Supabase Auth ของ HR
- เช็ก role จาก `admin_roles`
- ได้สิทธิ์:
  - HR admin
  - DATA owner pages
  - OPS admin pages

### Employee

- Login ด้วย PIN
- สร้าง session token ของพนักงาน
- ได้สิทธิ์:
  - attendance
  - employee profile
  - OPS เฉพาะงานที่กำหนด
- ไม่มีสิทธิ์:
  - master data
  - pricing
  - integration settings
  - Supabase sync controls

---

## 7. Recommended Integration Gate Between HR and OPS

```mermaid
sequenceDiagram
    participant E as Employee
    participant HR as HR App
    participant OPS as OPS Page

    E->>HR: login ด้วย PIN
    HR-->>E: employee session token
    E->>HR: กดปุ่ม เปิดระบบร้าน / OPS
    HR->>OPS: open OPS with trusted session context
    OPS->>HR: verify employee session / role
    HR-->>OPS: employee identity + allowed scopes
    OPS-->>E: เปิดเฉพาะเมนูงานที่ได้รับสิทธิ์
```

แนวคิดนี้ดีกว่าการเปิด `/ops/` แบบ public ตรง ๆ

---

## 8. Access Matrix

| Function | Owner/Admin | Employee |
|---|---:|---:|
| HR admin dashboard | Yes | No |
| Employee attendance | Yes | Yes |
| Payroll / deductions | Yes | No |
| JEBAR DATA dashboard | Yes | Limited |
| AI advisor | Yes | No |
| Master data | Yes | No |
| Menu pricing | Yes | No |
| Bakery base formulas | Yes | No |
| OPS stock receive | Yes | Scoped |
| OPS production record | Yes | Scoped |
| OPS waste record | Yes | Scoped |
| Supabase sync button | Yes | No |
| Integration docs | Yes | No |

---

## 9. Recommended Phases

### Phase 1

- HR remains main login app
- Employee enters through HR only
- OPS opens from HR employee page
- DATA remains owner/admin tool

### Phase 2

- OPS reads employee session from HR
- OPS enforces role-based access
- DATA owner screens remain hidden from employees

### Phase 3

- Single brand shell:
  - JEBAR Operations System
- Shared top-level navigation
- HR, OPS, DATA become modules behind one login experience

---

## 10. Implementation Notes

- HR is the best source of identity
- DATA is the best source of business master data
- OPS should be the task workspace for stock / production / wastage
- Do not make DATA the main employee login app
- Do not allow employee direct access to owner sync tools or master edits

