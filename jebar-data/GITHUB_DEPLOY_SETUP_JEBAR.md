# GitHub + Cloudflare Auto Deploy Setup

This file prepares JEBAR DATA for automatic deploy later.

## Current status

- Local project path:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\outputs\jebar-data`
- Workflow file prepared:
  `.github/workflows/deploy-cloudflare-pages.yml`
- GitHub CLI is not installed on this machine yet
- Git repository is not confirmed yet for this app

## Recommended repo structure

Put the `outputs\jebar-data` folder contents at the root of a dedicated repo, or keep this folder layout and use the workflow as-is.

## GitHub secrets required

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## GitHub variable recommended

- `CLOUDFLARE_PROJECT_NAME`
  - example: `jebar-data`

## Cloudflare token permissions

Use an API token with:

- Account
- Cloudflare Pages
- Edit

For the correct Cloudflare account only.

## Deploy trigger

Every push to `main` triggers deploy.

## Important note

This workflow targets Cloudflare Pages because JEBAR DATA is a static app. If production must remain on Workers instead of Pages, replace the workflow with a Wrangler Worker deploy flow after the hosting decision is confirmed.
