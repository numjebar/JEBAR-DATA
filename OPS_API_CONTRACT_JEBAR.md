# JEBAR OPS API Contract

Updated: 2026-06-12

เอกสารนี้เป็นสัญญากลางสำหรับเชื่อม `JEBAR OPS` หรือแอประบบบริหารร้านเค้ก เข้ากับ `JEBAR DATA`

---

## 1. Purpose

เป้าหมายคือให้อีกแอป:

1. อ่าน master data จาก `JEBAR DATA`
2. ใช้รหัสเดียวกันทั้งระบบ
3. เขียนกลับเฉพาะข้อมูล stock / operation
4. ไม่ทับเมนู สูตร วัตถุดิบ และรูปหลักของระบบ DATA

---

## 2. Primary connection target

Use direct Supabase access.

### Base URL

`https://eoinzxqpqbybwcrmsgww.supabase.co`

### Main table

`public.jebar_app_state`

### Filter key

`shop_code`

### Recommended shop code

`jebar`

### Main payload field

`db`

---

## 3. Read flow

OPS should read one row:

```http
GET /rest/v1/jebar_app_state?shop_code=eq.jebar&select=shop_code,updated_at,db
```

Required headers:

```text
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY>
```

---

## 4. Master data that OPS must read

Read these arrays from `row.db`:

- `db.menus`
- `db.ingredients`
- `db.packages`
- `db.recipeBase`
- `db.batchRecipes`
- `db.batchRecipeLines`
- `db.recipeBatch`
- `db.mediaAssets`

---

## 5. Shared ID contract

OPS must use DATA IDs as the stable shared keys.

### Examples

```text
COF001 = coffee menu
BAK001 = bakery menu
BAT001 = bakery base recipe
ING001 = ingredient
SUP001 = supply
PKG001 = package
```

### Mapping rules

- `db.menus[].id` -> `ops.recipes.code`
- `db.ingredients[].id` -> `ops.ingredients.code`
- `db.packages[].id` -> `ops.packages.code`
- `db.batchRecipes[].id` -> `ops.batch_bases.code`

OPS must not generate replacement IDs for synced records.

---

## 6. Bakery recipe expansion rule

OPS must support both direct recipes and bakery base recipes.

### Build menu ingredient usage like this

1. Read direct lines from `db.recipeBase`
2. Read menu-to-batch links from `db.recipeBatch`
3. Read base lines from `db.batchRecipeLines`
4. Read output quantity from `db.batchRecipes.outputQty`
5. Scale batch lines into final per-menu ingredient usage

### Example

If:

- `BAT001` = red velvet cake base
- `BAT001.outputQty = 1000 g`
- menu `CAK001` uses `120 g` from `BAT001`

Then OPS must calculate ingredient usage proportionally:

```text
final usage = batch line qty * (120 / 1000)
```

---

## 7. Consumables policy

Consumables and supplies must come from `db.ingredients`

Examples:

- dishwashing liquid
- tissue
- floor cleaner
- gloves
- garbage bags
- takeaway lids
- straws

Recommended categories:

- `Supplies`
- `Cleaning`
- `Packaging`
- `Consumables`

OPS must not keep a separate disconnected master for these.

---

## 8. Image contract

Actual files live in:

- Supabase bucket `jebar-images`

Metadata lives in:

- `db.mediaAssets`

Important fields:

```text
id
bucket
path
url
entityType
entityId
role
fileName
```

OPS should lookup images through `db.mediaAssets`.

Do not hardcode image paths without reading metadata first.

---

## 9. Write-back zones that OPS may update

OPS may write back only these zones:

- `db.stockItems`
- `db.stockLots`
- `db.stockBalances`
- `db.stockMovements`
- `db.purchaseEvents`
- `db.productionEvents`
- `db.wasteEvents`
- `db.integrationInbox`
- `db.integrationOutbox`

OPS must not overwrite:

- `db.menus`
- `db.ingredients`
- `db.packages`
- `db.recipeBase`
- `db.batchRecipes`
- `db.batchRecipeLines`
- `db.recipeBatch`
- `db.mediaAssets`

---

## 10. Write-back flow

Recommended sequence:

1. Read one row from `jebar_app_state`
2. Copy `row.db`
3. Update only allowed stock/ops arrays
4. Keep all master arrays untouched
5. PATCH the full updated `db` object back to the same row

### PATCH target

```http
PATCH /rest/v1/jebar_app_state?shop_code=eq.jebar
```

### Example body

```json
{
  "db": {
    "...existingData": true,
    "stockBalances": [],
    "stockMovements": [],
    "purchaseEvents": [],
    "productionEvents": [],
    "wasteEvents": [],
    "integrationInbox": [],
    "integrationOutbox": []
  }
}
```

---

## 11. Suggested OPS-side table mapping

### Master sync

- `db.menus` -> `recipes`
- `db.ingredients` -> `ingredients`
- `db.packages` -> `packages`
- `db.batchRecipes` -> `batch_bases`
- flattened final usage -> `recipe_items`

### Operational sync back to DATA

- `ops_stock_items` -> `db.stockItems`
- `ops_stock_lots` -> `db.stockLots`
- `ops_stock_balances` -> `db.stockBalances`
- `ops_stock_movements` -> `db.stockMovements`
- `ops_purchase_events` -> `db.purchaseEvents`
- `ops_production_events` -> `db.productionEvents`
- `ops_waste_events` -> `db.wasteEvents`

---

## 12. Minimum integration checklist

OPS integration is considered ready when it can:

1. Read `jebar_app_state` by `shop_code`
2. Parse `db.menus`
3. Parse `db.ingredients`
4. Parse `db.batchRecipes`, `db.batchRecipeLines`, `db.recipeBatch`
5. Build flattened bakery recipe usage
6. Read `db.mediaAssets`
7. Save stock summaries back into allowed arrays only

---

## 13. One-line handoff for the OPS developer

Read master data directly from `jebar_app_state.db` by `shop_code`. Treat `JEBAR DATA` as the owner of menus, ingredients, supplies, packages, direct recipes, bakery base recipes, batch links, and images. Use DATA IDs as shared codes. Write back only stock-related arrays such as `stockItems`, `stockLots`, `stockBalances`, `stockMovements`, `purchaseEvents`, `productionEvents`, `wasteEvents`, `integrationInbox`, and `integrationOutbox`.

