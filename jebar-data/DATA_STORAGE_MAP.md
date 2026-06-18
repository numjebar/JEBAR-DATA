# JEBAR DATA Storage Map

Updated: 2026-06-12

## Main storage

- Browser localStorage key: `jebar_db_v1`
  - Main business data JSON
  - Menus: `db.menus`
  - Ingredients: `db.ingredients`
  - Packages: `db.packages`
  - Direct menu recipes: `db.recipeBase`
  - Bakery base recipes: `db.batchRecipes`
  - Bakery base lines: `db.batchRecipeLines`
  - Menu-to-batch links: `db.recipeBatch`
  - Daily sales: `db.dailySales`
  - Product reports: `db.menuReports`
  - Hourly reports: `db.hourlyReports`
  - Images metadata: `db.mediaAssets`
  - Activity log: `db.activityLogs`

- Browser localStorage key: `jebar_settings_v1`
  - Brand settings
  - Logo URL
  - Supabase URL
  - Supabase anon key
  - `shop_code`

## Online shared storage

- Supabase table: `public.jebar_app_state`
  - Read one row by `shop_code`
  - Use field `db` as the full app state
  - Save the full updated `db` object back to the same row

## Image storage

- Supabase Storage bucket: `jebar-images`
  - Product images
  - Recipe images
  - Logo images
  - Import or reference images

- Image metadata path in app state: `db.mediaAssets`
  - Fields:
    - `id`
    - `bucket`
    - `path`
    - `url`
    - `entityType`
    - `entityId`
    - `role`
    - `fileName`

## Stock schema for future integrations

- Stock master links: `db.stockItems`
  - One row per stock-controlled item
  - Suggested fields:
    - `id`
    - `refType` (`ingredient`, `package`, `menu`, `batchRecipe`)
    - `refId`
    - `name`
    - `unit`
    - `status`

- Stock lots: `db.stockLots`
  - Lot or batch level inventory
  - Suggested fields:
    - `id`
    - `stockItemId`
    - `lotCode`
    - `receivedAt`
    - `qtyIn`
    - `qtyRemaining`
    - `unitCost`

- Stock balances: `db.stockBalances`
  - Current summary by item
  - Suggested fields:
    - `stockItemId`
    - `onHand`
    - `reserved`
    - `available`
    - `lastUpdatedAt`

- Stock movements: `db.stockMovements`
  - Every stock in/out/change event
  - Suggested fields:
    - `id`
    - `stockItemId`
    - `movementType`
    - `qty`
    - `unit`
    - `refType`
    - `refId`
    - `createdAt`

- Purchase events: `db.purchaseEvents`
- Production events: `db.productionEvents`
- Waste events: `db.wasteEvents`

## Integration message lanes

- Incoming jobs from other systems: `db.integrationInbox`
- Outgoing jobs to other systems: `db.integrationOutbox`

Suggested fields:
- `id`
- `source` or `target`
- `eventType`
- `status`
- `createdAt`

## Recommended write-back flow

1. Read one row from `jebar_app_state` by `shop_code`
2. Use `db.menus`, `db.ingredients`, `db.packages`, `db.batchRecipes` as reference master data
3. Use `db.mediaAssets` for image lookup
4. Write stock summary to `db.stockBalances`
5. Write stock transactions to `db.stockMovements`
6. Write purchase / production / waste events to their matching arrays
7. Save the full `db` object back to `jebar_app_state`
