# JEBAR Direct Supabase API Guide

Updated: 2026-06-12

## Purpose

This guide tells external apps how to connect directly to `JEBAR DATA` through Supabase without downloading JSON files manually.

Primary source:

- Table: `public.jebar_app_state`
- Filter key: `shop_code`
- Main payload field: `db`

---

## 1. Connection target

Base URL:

- `https://eoinzxqpqbybwcrmsgww.supabase.co`

REST endpoint pattern:

- `https://eoinzxqpqbybwcrmsgww.supabase.co/rest/v1/<table>`

Main table for JEBAR DATA:

- `jebar_app_state`

Recommended shop code:

- `jebar`

---

## 2. Read the main app state

### Request

`GET /rest/v1/jebar_app_state?shop_code=eq.jebar&select=shop_code,updated_at,db`

Required headers:

- `apikey: <SUPABASE_ANON_KEY>`
- `Authorization: Bearer <SUPABASE_ANON_KEY>`

### Example fetch

```js
const SUPABASE_URL = "https://eoinzxqpqbybwcrmsgww.supabase.co";
const SUPABASE_KEY = "<SUPABASE_ANON_KEY>";
const SHOP_CODE = "jebar";

const res = await fetch(
  `${SUPABASE_URL}/rest/v1/jebar_app_state?shop_code=eq.${SHOP_CODE}&select=shop_code,updated_at,db`,
  {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  }
);

const rows = await res.json();
const row = rows[0];
const db = row?.db || {};
```

---

## 3. Read only the master data needed by OPS

After reading `db`, use these paths:

- Menus: `db.menus`
- Ingredients: `db.ingredients`
- Packages: `db.packages`
- Direct menu recipes: `db.recipeBase`
- Bakery base recipes: `db.batchRecipes`
- Bakery base lines: `db.batchRecipeLines`
- Menu-to-batch links: `db.recipeBatch`
- Images metadata: `db.mediaAssets`

### Shared key contract

- `db.ingredients[].id` = shared ingredient/supply code
- `db.menus[].id` = shared menu code
- `db.packages[].id` = shared package code if used

Examples:

- `ING001`
- `SUP001`
- `COF001`
- `BAK001`

---

## 4. Consumables / supplies rule

Consumables are part of the master data in `JEBAR DATA`.

External apps must not create a separate master list for supplies.

Examples of items that should exist in `db.ingredients`:

- dishwashing liquid
- tissue
- floor cleaner
- gloves
- garbage bags
- cup lids
- straws

Recommended categories:

- `Supplies`
- `Cleaning`
- `Packaging`
- `Consumables`

Recommended codes:

- `SUP001`
- `SUP002`
- `SUP003`

---

## 5. How OPS should map JEBAR DATA into its own tables

Recommended mapping:

- `db.ingredients[].id` -> `OPS ingredients.code`
- `db.menus[].id` -> `OPS recipes.code`

OPS should treat the DATA codes as stable external IDs.

Do not generate replacement codes in OPS for synced master records.

---

## 6. Build final recipe items for bakery and menu costing

OPS should build flattened ingredient usage per menu like this:

1. Read direct lines from `db.recipeBase`
2. Read links from `db.recipeBatch`
3. Read batch lines from `db.batchRecipeLines`
4. Scale batch lines using `db.batchRecipes.outputQty`
5. Produce a final per-menu ingredient list for OPS `recipe_items`

This is required because bakery menus may depend on shared bases such as:

- cake batter
- cream
- bread dough
- fillings

---

## 7. Read images

Bucket:

- `jebar-images`

Image metadata path:

- `db.mediaAssets`

Important fields:

- `bucket`
- `path`
- `url`
- `entityType`
- `entityId`
- `role`
- `fileName`

External apps should use `db.mediaAssets` as the image lookup table.

---

## 8. Safe write-back zones

OPS may write back stock and operation summaries into these zones only:

- `db.stockItems`
- `db.stockLots`
- `db.stockBalances`
- `db.stockMovements`
- `db.purchaseEvents`
- `db.productionEvents`
- `db.wasteEvents`
- `db.integrationInbox`
- `db.integrationOutbox`

OPS must not overwrite these master zones:

- `db.menus`
- `db.ingredients`
- `db.packages`
- `db.recipeBase`
- `db.batchRecipes`
- `db.batchRecipeLines`
- `db.recipeBatch`
- `db.mediaAssets`

---

## 9. Patch updated db back to Supabase

Recommended flow:

1. Read one row from `jebar_app_state`
2. Copy `row.db`
3. Update only the stock zones listed above
4. PATCH the same row back

### Example patch request

`PATCH /rest/v1/jebar_app_state?shop_code=eq.jebar`

Headers:

- `apikey: <SUPABASE_ANON_KEY>`
- `Authorization: Bearer <SUPABASE_ANON_KEY>`
- `Content-Type: application/json`
- `Prefer: return=representation`

Body example:

```json
{
  "db": {
    "...keepExistingDbFields": true,
    "stockBalances": [
      {
        "stockItemId": "STK_ING001",
        "onHand": 24,
        "reserved": 0,
        "available": 24,
        "lastUpdatedAt": "2026-06-12T08:30:00.000Z"
      }
    ],
    "stockMovements": [
      {
        "id": "mv_20260612_001",
        "stockItemId": "STK_ING001",
        "movementType": "count",
        "qty": 24,
        "unit": "bottle",
        "refType": "count",
        "refId": "count_20260612_01",
        "createdAt": "2026-06-12T08:30:00.000Z"
      }
    ]
  }
}
```

Important:

- Do not send partial destructive replacements for master arrays
- Always start from the latest `db` object that was just read
- Update only the allowed stock fields

---

## 10. Suggested stock bridge patterns

### `db.stockItems`

Suggested shape:

```json
{
  "id": "STK_SUP001",
  "refType": "ingredient",
  "refId": "SUP001",
  "name": "Dishwashing liquid",
  "unit": "bottle",
  "status": "active"
}
```

### `db.stockBalances`

Suggested shape:

```json
{
  "stockItemId": "STK_SUP001",
  "onHand": 12,
  "reserved": 0,
  "available": 12,
  "lastUpdatedAt": "2026-06-12T08:30:00.000Z"
}
```

### `db.stockMovements`

Suggested shape:

```json
{
  "id": "mv_20260612_sup001_01",
  "stockItemId": "STK_SUP001",
  "movementType": "in",
  "qty": 6,
  "unit": "bottle",
  "refType": "purchase",
  "refId": "bill_20260612_01",
  "createdAt": "2026-06-12T08:30:00.000Z"
}
```

---

## 11. Recommended production use

If OPS produces bakery items:

- Read menu and batch master from DATA
- Compute ingredient usage in OPS
- Save production transaction in OPS
- Optionally write a summarized event back to:
  - `db.productionEvents`
  - `db.stockMovements`

---

## 12. Recommended sync strategy

### Phase 1

- Use direct Supabase read from `jebar_app_state`
- OPS syncs master data into its own operational tables
- OPS writes back only stock summary/history

### Phase 2

- Add scheduled sync or open-on-app sync
- Add conflict rules if multiple writers exist

---

## 13. Short message for the OPS team

Use this rule:

`Read master data directly from jebar_app_state.db by shop_code. Treat JEBAR DATA as the owner of menus, ingredients, supplies, packages, recipes, batch recipes, and images. Use DATA ids as shared codes. OPS may write back only stock-related zones such as stockBalances, stockMovements, purchaseEvents, productionEvents, and wasteEvents. Do not overwrite master arrays such as menus, ingredients, recipes, or mediaAssets.`
