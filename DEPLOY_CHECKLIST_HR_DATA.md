# HR vs DATA Deploy Checklist

Updated: 2026-06-12

## Cloudflare projects

- HR project: `hr-jebar`
- DATA project: `jebar-data`

## Live URLs

- HR: `https://hr-jebar.pages.dev`
- DATA: `https://jebar-data.je-bar.workers.dev`

## Never mix these uploads

### Upload to HR project only

- Source code: `C:\Users\TEST_Lenovo\HR-JEBAR\app`
- Build output: `C:\Users\TEST_Lenovo\HR-JEBAR\app\dist`
- Backup zip: `HR-JEBAR-RESTORE.zip`

### Upload to DATA project only

- Deploy folder: `D:\JEBAR_SYSTEM_BACKUP\JEBAR-DATA-CLOUDFLARE`
- DATA backup zips:
  - `D:\JEBAR_SYSTEM_BACKUP\JEBAR-DATA-CLOUDFLARE-20260612-build-data7.zip`
  - `D:\JEBAR_SYSTEM_BACKUP\JEBAR-DATA-CLOUDFLARE-20260612-direct-supabase.zip`
  - `D:\JEBAR_SYSTEM_BACKUP\JEBAR-DATA-CLOUDFLARE-20260612-handoff-message.zip`

## HR deploy steps

1. Open:
   - `C:\Users\TEST_Lenovo\HR-JEBAR\app`
2. Run:
   - `npm.cmd run build`
3. Upload all files inside:
   - `C:\Users\TEST_Lenovo\HR-JEBAR\app\dist`
4. Upload only to:
   - Cloudflare project `hr-jebar`

## DATA deploy steps

1. Use the latest folder:
   - `D:\JEBAR_SYSTEM_BACKUP\JEBAR-DATA-CLOUDFLARE`
2. Or use the latest DATA zip
3. Upload only to:
   - Cloudflare project `jebar-data`

## Quick visual check

### HR should look like

- HR login
- Admin login page
- Employee clock-in / payroll / attendance

### DATA should look like

- Dashboard
- AI Advisor
- Daily Sales
- Menu & Recipes
- Bakery Base
- Integration

## Version check

### DATA

- Look at bottom-right build label
- Example:
  - `Build 2026.06.12-data7`

### HR

- Recommended next step:
  - add HR build label like `Build 2026.06.12-hr1`

## Emergency fix if HR becomes DATA again

1. Open Cloudflare project `hr-jebar`
2. Start new deployment
3. Upload files from:
   - `C:\Users\TEST_Lenovo\HR-JEBAR\app\dist`
4. Do not upload any `JEBAR-DATA` zip into `hr-jebar`

## Emergency fix if DATA becomes HR

1. Open Cloudflare project `jebar-data`
2. Start new deployment
3. Upload files from:
   - `D:\JEBAR_SYSTEM_BACKUP\JEBAR-DATA-CLOUDFLARE`
   - or latest DATA zip
4. Do not upload `HR-JEBAR-RESTORE.zip` into `jebar-data`
