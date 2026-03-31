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

- [ ] Remove `'berbahaya'` from `waste_type` CHECK constraint (3 values remain)
- [ ] Add `hazard_risk TEXT NOT NULL DEFAULT 'tidak_ada'` column to `reports`
- [ ] Add CHECK constraint: `('tidak_ada', 'rendah', 'menengah', 'tinggi')`
- [ ] Add data migration block (UPDATE existing `'berbahaya'` rows before altering constraint)
- [ ] Update `get_waste_type_statistics()` RPC — remove `hazardous`, add `hazard_risk` breakdown columns
- [ ] Update `get_province_statistics()` RPC — remove `hazardous_count` column from return type

---

### Phase 2 — TypeScript Types

#### [MODIFY] `src/types/database.types.ts`

- [ ] Update `waste_type` union: remove `'berbahaya'`
- [ ] Add `hazard_risk` column to `reports` Row / Insert / Update types
- [ ] Update `waste_type_enum` — remove `'berbahaya'`
- [ ] Add `hazard_risk_enum` — `'tidak_ada' | 'rendah' | 'menengah' | 'tinggi'`
- [ ] Update `get_waste_type_statistics` function return type (remove hazardous, add hazard counts)

---

### Phase 3 — Services & Helpers

#### [MODIFY] `src/lib/reportService.ts`

- [ ] Update `SubmitReportParams` interface — remove `wasteType: 'berbahaya'` option
- [ ] Add `hazardRisk?: 'tidak_ada' | 'rendah' | 'menengah' | 'tinggi'` to params
- [ ] Update `SubmitReportResponse` validation type — remove `waste_type: 'berbahaya'`; add `hazard_risk`
- [ ] Pass `hazard_risk` in the request body sent to the Edge Function

#### [MODIFY] `src/lib/statisticsService.ts`

- [ ] Update `WasteTypeStatistics` interface — remove `hazardous`, add `hazard_risk` breakdown fields
- [ ] Update `fetchWasteTypeStatistics()` to handle new return shape

#### [MODIFY] `src/lib/provinceService.ts`

- [ ] Update `ProvinceStatistics` interface — remove `hazardous_count`

#### [MODIFY] `src/lib/nearbyReportsService.ts`

- [ ] Update `formatWasteType()` label map — remove `'berbahaya': 'Berbahaya'`

#### [MODIFY] `src/lib/campaignService.ts`

- [ ] Update `formatWasteVolume()` helper (no change needed, but confirm `waste_type` references)
- [ ] Check `transformCampaignRow()` — confirm no hardcoded `'berbahaya'` references

---

### Phase 4 — Frontend Label Maps

#### [MODIFY] `src/hooks/useReports.ts`

- [ ] `getWasteTypeLabel()` — remove `'berbahaya'`: `'Berbahaya'` entry
- [ ] *(Also fix existing BUG-01: `'area_public'` → `'area_publik'` in `getCategoryLabel()`)*

#### [MODIFY] `src/app/akun/riwayat-laporan/page.tsx`

- [ ] `getWasteTypeLabel()` — remove `'berbahaya'`: `'Berbahaya'` entry
- [ ] Add `getHazardRiskLabel()` helper for displaying `hazard_risk` values
- [ ] *(Also fix existing BUG-01: `'area_public'` → `'area_publik'`)*

#### [MODIFY] `src/app/lapor/konfirmasi-data/labels.ts`

- [ ] Remove `'berbahaya'` from waste type label/option list
- [ ] Add `hazard_risk` label map: `{ tidak_ada, rendah, menengah, tinggi }`

#### [MODIFY] `src/app/lapor/konfirmasi-data/ReportDetails.tsx`

- [ ] Remove `'berbahaya'` waste type option from the confirmation UI
- [ ] Add `hazard_risk` display row showing the risk level with a badge

#### [MODIFY] `src/app/campaign/page.tsx`

- [ ] Remove `'berbahaya'` from any waste type filter options

---

### Phase 5 — Edge Function (Supabase, deployed separately)

#### [MODIFY] `submit-report` Edge Function

> [!WARNING]
> This file lives outside the Next.js repo (in the Supabase functions folder).
> It must be redeployed via `supabase functions deploy submit-report` after changes.

- [ ] Update the Gemini AI prompt to classify waste into **3 types only** (no `berbahaya`)
- [ ] Add `hazard_risk` as a new AI output field (`tidak_ada` / `rendah` / `menengah` / `tinggi`)
- [ ] Update the DB INSERT to include `hazard_risk` field
- [ ] Update response payload to return `hazard_risk` alongside `waste_type`

---

### Phase 6 — Update Supporting Docs

#### [MODIFY] `supabase_schema.sql` — Section 12 Known Issues

- [ ] Update BUG-01 note (fixing it in this plan)
- [ ] Update `get_waste_type_statistics` return type documentation

#### [MODIFY] `BUGS_AND_ISSUES.md`

- [ ] Mark BUG-01 (`area_public` typo) as fixed
- [ ] Add note that `berbahaya` was removed from `waste_type` and replaced by `hazard_risk`

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
| Phase 1 — Database Schema | ⬜ Not started | Awaiting approval |
| Phase 2 — TypeScript Types | ⬜ Not started | Depends on Phase 1 |
| Phase 3 — Services & Helpers | ⬜ Not started | Depends on Phase 2 |
| Phase 4 — Frontend Label Maps | ⬜ Not started | Depends on Phase 3 |
| Phase 5 — Edge Function | ⬜ Not started | Manual step if no local source |
| Phase 6 — Docs | ⬜ Not started | Final step |
