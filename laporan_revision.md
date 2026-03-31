# Reports Schema Revision Plan

## Goal
Revise the `reports` table to:
1. Reduce `waste_type` from 4 values → 3 values (remove `'berbahaya'`)
2. Add a new required `hazard_risk` column (`'tidak_ada'`, `'rendah'`, `'menengah'`, `'tinggi'`)

This separates **what the waste is** from **how dangerous it is**, giving a more expressive and analytically useful data model.

---

## Migration Strategy for Existing Data

> [!IMPORTANT]
> Any existing rows with `waste_type = 'berbahaya'` need to be converted before the
> CHECK constraint is tightened. The recommended conversion:
> - `waste_type` → `'campuran'`
> - `hazard_risk` → `'tinggi'`

---

## Proposed Changes

### Phase 1 — Database Schema

#### [MODIFY] `supabase_schema.sql`

- [x] Remove `'berbahaya'` from `waste_type` CHECK constraint (3 values remain)
- [x] Add `hazard_risk TEXT NOT NULL DEFAULT 'tidak_ada'` column to `reports`
- [x] Add CHECK constraint: `('tidak_ada', 'rendah', 'menengah', 'tinggi')`
- [x] ~~Add data migration block~~ — Not needed (empty database)
- [x] Update `get_waste_type_statistics()` RPC — removed `hazardous`, added `risk_none / risk_low / risk_medium / risk_high` columns
- [x] Update `get_province_statistics()` RPC — replaced `hazardous_count` with `high_risk_count` (based on `hazard_risk`)

---

### Phase 2 — TypeScript Types

#### [MODIFY] `src/types/database.types.ts`

- [x] Update `waste_type` union: remove `'berbahaya'` (Row / Insert / Update all use strict union now)
- [x] Add `hazard_risk` column to `reports` Row / Insert / Update types
- [x] Update `waste_type_enum` — removed `'berbahaya'`
- [x] Add `hazard_risk_enum` — `'tidak_ada' | 'rendah' | 'menengah' | 'tinggi'`
- [x] Update `get_province_statistics` return type — replaced `hazardous_count` with `high_risk_count`
- [x] Add `get_waste_type_statistics` function return type (new fields: risk_none / risk_low / risk_medium / risk_high)
- [x] Add `get_user_reports_with_coordinates` function return type (was missing; now typed with `hazard_risk`)
- [x] Update `get_reports_with_coordinates` return type — added `hazard_risk` field

---

### Phase 3 — Services & Helpers

#### [MODIFY] `src/lib/reportService.ts`

- [x] Update `SubmitReportParams` interface — removed `'berbahaya'` from `wasteType` union
- [x] Add `hazardRisk?: 'tidak_ada' | 'rendah' | 'menengah' | 'tinggi'` to params
- [x] Update both `SubmitReportResponse` validation type blocks — removed `'berbahaya'`; added `hazard_risk`
- [x] Pass `hazard_risk` in the request body sent to the Edge Function

#### [MODIFY] `src/lib/statisticsService.ts`

- [x] Update `WasteTypeStatistics` interface — removed `hazardous`, added `riskNone / riskLow / riskMedium / riskHigh`
- [x] Update `fetchWasteTypeStatistics()` return mapping — maps `risk_none / risk_low / risk_medium / risk_high` from RPC
- [x] Updated fallback object to match new shape

#### [MODIFY] `src/lib/provinceService.ts`

- [x] Update `ProvinceStatistics` interface — removed `hazardous_count`, added `high_risk_count`
- [x] Update `calculateStatistics()` — removed `berbahaya` filter; function now returns `{ total, organic, inorganic, mixed }`

#### [MODIFY] `src/lib/nearbyReportsService.ts`

- [x] `formatWasteType()` — removed `'berbahaya': 'Berbahaya'` entry
- [x] Added new `formatHazardRisk()` export helper with all 4 risk level labels

#### [VERIFY] `src/lib/campaignService.ts`

- [x] Verified — zero references to `'berbahaya'`; no changes needed

---

### Phase 4 — Frontend Label Maps

#### [MODIFY] `src/hooks/useReports.ts`

- [x] `getWasteTypeLabel()` — removed `'berbahaya': 'Berbahaya'` entry
- [x] `getCategoryLabel()` — fixed BUG-01: `'area_public'` → `'area_publik'`
- [x] `WasteMarker` interface — added `hazardRisk: string` field
- [x] Report mapping — maps `report.hazard_risk` to `hazardRisk` on each marker

#### [MODIFY] `src/app/akun/riwayat-laporan/page.tsx`

- [x] `getWasteTypeLabel()` — removed `'berbahaya': 'Berbahaya'` entry
- [x] `getLocationLabel()` — fixed BUG-01: `'area_public'` → `'area_publik'`
- [x] Added `getHazardRiskLabel()` helper
- [x] Added `getHazardRiskColor()` helper for badge colour

#### [MODIFY] `src/app/lapor/konfirmasi-data/labels.ts`

- [x] Removed `'berbahaya'` from `WASTE_TYPE_LABELS`
- [x] Added `HAZARD_RISK_LABELS` export with all 4 risk level labels

#### [MODIFY] `src/app/lapor/konfirmasi-data/ReportDetails.tsx`

- [x] Added `hazardRisk?` prop to component interface
- [x] Added hazard risk display row with colour-coded badge (gray/yellow/orange/red)
- [x] Imported `HAZARD_RISK_LABELS` from labels

#### [MODIFY] `src/components/shared/DetailItem.tsx`

- [x] Widened `description` prop from `string` to `React.ReactNode` to support badge JSX

#### [MODIFY] `src/contexts/ReportContext.tsx`

- [x] `AiValidation` — `waste_type` now strict union (3 values); added `hazard_risk` field
- [x] `ReportData` — `wasteType` union trimmed to 3 values; added `hazardRisk` field
- [x] `initialReportData` — `hazardRisk: null` added

#### [VERIFY] `src/app/campaign/page.tsx`

- [x] Verified — no waste-type filter UI; filters only by status. No changes needed.

---

### Phase 5 — Edge Function (Supabase, deployed separately)

#### [NEW] `supabase/functions/submit-report/index.ts`

- [x] Created full Deno edge function from scratch
- [x] Validates auth token (rejects anonymous callers)
- [x] Calls Gemini 2.0 Flash to classify: 3 waste types + `hazard_risk` level
- [x] Sanitises AI output (defaults invalid enum values, never crashes)
- [x] Rejects images where AI is highly confident they show no waste
- [x] Uploads image to `report-images` Storage bucket at `{user_id}/{timestamp}.jpg`
- [x] Calls `insert_report_with_location()` RPC to INSERT with PostGIS POINT
- [x] Returns `{ success, data: { report_id, image_url, validation, created_at } }`
- [x] Cleans up uploaded image if DB insert fails

#### [NEW] `supabase/functions/get-nearby-reports/index.ts`

- [x] Created GET wrapper around `get_nearby_reports` RPC
- [x] Accepts `latitude`, `longitude`, `radius_km`, `limit` query params
- [x] Returns `{ success, data: { reports[], query, total_count } }`

#### [NEW] `supabase_schema.sql` — RPC 7k

- [x] Added `insert_report_with_location()` RPC (SECURITY DEFINER)
- [x] Accepts all report fields including `hazard_risk` and constructs PostGIS POINT

#### [NEW] Supporting files

- [x] `supabase/config.toml` — Supabase CLI project config
- [x] `supabase/functions/deno.json` — Deno compiler config
- [x] `supabase/functions/import_map.json` — Deno import map
- [x] `.vscode/settings.json` — enables Deno language server for `supabase/functions/` (silences false-positive TS lint errors)

> [!IMPORTANT]
> Required environment variable for the edge function: `GEMINI_API_KEY`
> Add it to your Supabase project: Dashboard → Project Settings → Edge Functions → Secrets
> Also add: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (usually auto-injected by Supabase)

> [!NOTE]
> Deploy command: `supabase functions deploy submit-report && supabase functions deploy get-nearby-reports`

---

### Phase 6 — Update Supporting Docs

#### [MODIFY] `supabase_schema.sql` — Sections 10 & 12

- [x] Section 10 (Env Vars) — added `GEMINI_API_KEY` and Edge Function secrets documentation
- [x] Section 12 renamed to `Schema Revision Log & Known Issues`
- [x] Documented the `hazard_risk` revision with rationale
- [x] Marked BUG-01 as fixed
- [x] Added Edge Functions deployment note

#### [MODIFY] `BUGS_AND_ISSUES.md`

- [x] BUG-01 section marked ✅ FIXED with patch details
- [x] Schema table updated with S-09, S-10, S-11 entries for the revision
- [x] Must-fix checklist updated: BUG-01 and schema revision ticked off

---

## Open Questions

> [!IMPORTANT]
> Please confirm before execution:

1. **hazard_risk default** — Confirmed ✅: `NOT NULL DEFAULT 'tidak_ada'`
2. **Data migration** — For existing rows with `waste_type = 'berbahaya'`:
   - Convert to `waste_type = 'campuran'` + `hazard_risk = 'tinggi'`?
   - Or a different mapping? *(Awaiting confirmation)*
3. **Edge Function access** — Do you have the Edge Function source files locally?
   If not, Phase 5 will be documented as a manual step.

---

## Verification Plan

### Automated checks
- Run TypeScript compiler: `npx tsc --noEmit` — confirm 0 type errors
- Grep for remaining `'berbahaya'` references: `grep -r "berbahaya" src/`
- Grep for `'area_public'` to confirm BUG-01 is fixed: `grep -r "area_public" src/`

### Manual verification
- Submit a new report and confirm `hazard_risk` is stored correctly in Supabase Table Editor
- View report history (`/akun/riwayat-laporan`) and confirm `hazard_risk` badge displays
- Check leaderboard and statistics pages render without errors

---

## Progress Tracker

| Phase | Status | Notes |
|---|---|---|
| Phase 1 — Database Schema | ✅ Done | `hazard_risk` added, `waste_type` trimmed to 3, RPC functions updated |
| Phase 2 — TypeScript Types | ✅ Done | All Row/Insert/Update/Function types updated; enums corrected |
| Phase 3 — Services & Helpers | ✅ Done | All 4 service files updated; `campaignService` verified clean |
| Phase 4 — Frontend Label Maps | ✅ Done | BUG-01 fixed in 2 files; `hazard_risk` label/badge in 4 files; `ReportContext` updated |
| Phase 5 — Edge Function | ✅ Done | Both functions created locally; `insert_report_with_location` RPC added; VS Code Deno config added |
| Phase 6 — Docs | ✅ Done | Schema revision log updated; BUG-01 marked fixed in BUGS_AND_ISSUES.md |

---

## ✅ Revision Complete

All 6 phases executed. The `reports` table now has a clean, orthogonal schema:
- `waste_type`: `organik` | `anorganik` | `campuran`
- `hazard_risk`: `tidak_ada` | `rendah` | `menengah` | `tinggi` (NOT NULL, DEFAULT `'tidak_ada'`)

**Next steps before going live:**
1. Run `supabase_schema.sql` in Supabase SQL Editor
2. Add `GEMINI_API_KEY` to Supabase Edge Function secrets
3. Deploy: `supabase functions deploy submit-report && supabase functions deploy get-nearby-reports`
4. Install the [Deno VS Code extension](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno) to silence editor lint warnings in edge function files
