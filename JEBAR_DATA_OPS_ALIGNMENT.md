# JEBAR DATA <-> JEBAR OPS Alignment

Updated: 2026-06-12

## Goal

Make `JEBAR DATA` the single source of truth for master data, while `JEBAR OPS` handles stock and operational transactions.

This document is the agreed integration contract between both apps.

---

## 1. Data ownership

### JEBAR DATA owns master data

The following records must be created and maintained in `JEBAR DATA`:

- Menus
- Ingredients
- Consumables / supplies
- Packages
- Menu recipes
- Bakery base recipes
- Batch-to-menu recipe links
- Image references
- Shared codes / IDs

In practice, this means:

- `db.menus`
- `db.ingredients`
- `db.packages`
- `db.recipeBase`
- `db.batchRecipes`
- `db.batchRecipeLines`
- `db.recipeBatch`
- `db.mediaAssets`

### JEBAR OPS owns operational transactions

The following records must be created and maintained in `JEBAR OPS`:

- Purchase bills
- Purchase bill items
- Stock in / out / count movements
- Production logs
- Waste logs
- Purchase orders
- Finished goods stock
- Audit logs
- Alerts

---

## 2. Single source of truth rule

`JEBAR DATA` is the master owner.

`JEBAR OPS` must sync master data from `JEBAR DATA`.

`JEBAR OPS` must not become a second master for menu names, ingredient names, recipe structure, units, or item codes.

If a menu, ingredient, package, or supply is new:

1. Create it in `JEBAR DATA`
2. Sync it to `JEBAR OPS`
3. Then use it in stock, purchase, production, and waste flows

---

## 3. Consumables / supplies policy

Consumables must now live in `JEBAR DATA` too.

Do **not** keep supplies only inside OPS anymore.

Examples:

- Dishwashing liquid
- Tissue paper
- Floor cleaner
- Gloves
- Garbage bags
- Cleaning cloth
- Takeaway cup lids
- Straw
- Tape

Recommended storage:

- Keep them in `db.ingredients`
- Use category values such as:
  - `Supplies`
  - `Cleaning`
  - `Packaging`
  - `Consumables`

Recommended code pattern:

- `SUP001`
- `SUP002`
- `SUP003`

This gives both apps one shared master list.

---

## 4. Shared ID and code contract

Codes from `JEBAR DATA` are the shared keys across systems.

Examples:

- Ingredients: `ING001`, `ING039`
- Supplies: `SUP001`, `SUP012`
- Packages: `PKG001`
- Coffee menu: `COF001`
- Bakery menu: `BAK001`

### Mapping rules

- `JEBAR DATA db.ingredients[].id` -> `JEBAR OPS ingredients.code`
- `JEBAR DATA db.menus[].id` -> `JEBAR OPS recipes.code`
- `JEBAR DATA db.packages[].id` -> optional OPS package code if needed

The code must remain stable.

Do not generate new unrelated IDs in OPS for already-synced master records.

---

## 5. DATA -> OPS sync contract

OPS should sync master data from:

- Supabase table: `public.jebar_app_state`
- Row filter: `shop_code = 'jebar'` (or the configured shop code)
- Main field: `db`

### Read from JEBAR DATA

- `db.menus`
- `db.ingredients`
- `db.packages`
- `db.recipeBase`
- `db.batchRecipes`
- `db.batchRecipeLines`
- `db.recipeBatch`
- `db.mediaAssets`

### Sync into OPS tables

- `db.menus[]` -> `recipes`
- `db.ingredients[]` -> `ingredients`
- `db.recipeBase` + expanded batch formulas -> `recipe_items`

### Important rule

This master sync is primarily:

- `DATA -> OPS`

Not:

- `OPS -> DATA` for master definitions

---

## 6. How OPS should build recipe_items

OPS should treat `JEBAR DATA` as the recipe authority.

To build final ingredient usage per menu:

1. Read direct lines from `db.recipeBase`
2. Read menu-to-batch links from `db.recipeBatch`
3. Read batch ingredient lines from `db.batchRecipeLines`
4. Scale batch usage using `db.batchRecipes.outputQty`
5. Flatten into final ingredient-per-menu rows for OPS `recipe_items`

This lets bakery formulas still work even when the menu depends on a shared base such as cake batter, cream, bread dough, or filling.

---

## 7. What OPS may send back to DATA

OPS may send back stock and movement summaries only.

Safe write-back zones in `JEBAR DATA`:

- `db.stockItems`
- `db.stockLots`
- `db.stockBalances`
- `db.stockMovements`
- `db.purchaseEvents`
- `db.productionEvents`
- `db.wasteEvents`
- `db.integrationInbox`
- `db.integrationOutbox`

OPS must **not** overwrite these master zones:

- `db.menus`
- `db.ingredients`
- `db.packages`
- `db.recipeBase`
- `db.batchRecipes`
- `db.batchRecipeLines`
- `db.recipeBatch`
- `db.mediaAssets`

---

## 8. Recommended stock bridge in DATA

`JEBAR DATA` now has a stock bridge structure for integrations.

### `db.stockItems`

Purpose:
- shared stock master links

Suggested fields:
- `id`
- `refType` = `ingredient | package | menu | batchRecipe`
- `refId`
- `name`
- `unit`
- `status`

### `db.stockBalances`

Purpose:
- current stock summary

Suggested fields:
- `stockItemId`
- `onHand`
- `reserved`
- `available`
- `lastUpdatedAt`

### `db.stockMovements`

Purpose:
- stock history

Suggested fields:
- `id`
- `stockItemId`
- `movementType`
- `qty`
- `unit`
- `refType`
- `refId`
- `createdAt`

### `db.stockLots`

Purpose:
- lot-level tracking when needed

Suggested fields:
- `id`
- `stockItemId`
- `lotCode`
- `receivedAt`
- `qtyIn`
- `qtyRemaining`
- `unitCost`

---

## 9. Practical operational rule

If the shop adds a new consumable such as:

- dishwashing liquid
- tissue
- floor cleaner

The workflow should be:

1. Add the item in `JEBAR DATA`
2. Give it a stable code like `SUP013`
3. Set category such as `Cleaning` or `Supplies`
4. Sync it into `JEBAR OPS ingredients`
5. Use it in OPS for:
   - purchase
   - stock count
   - reorder alerts
   - waste if needed

This keeps both apps aligned without duplicate setup.

---

## 10. Message to the OPS app team

Use this exact interpretation:

- `JEBAR DATA` is the master catalog
- `JEBAR OPS` is the stock and execution layer
- Consumables are now part of the shared master, not OPS-only records
- Shared code is the integration key
- OPS may write back stock summaries and movement history
- OPS must not write back menu/ingredient/recipe definitions

---

## 11. Current source references

- Main app state storage map:
  - `outputs/jebar-data/DATA_STORAGE_MAP.md`

- Main online source:
  - Supabase table `public.jebar_app_state`

- Images:
  - Supabase Storage bucket `jebar-images`
