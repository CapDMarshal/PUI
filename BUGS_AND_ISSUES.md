# 🐛 WasteCare — Bugs & Issues Report

> Generated from a full source-code audit of every file and folder.  
> Severity: 🔴 Critical · 🟡 Medium · 🟢 Minor / Informational

---

## Table of Contents

1. [Frontend Bugs](#1-frontend-bugs)
2. [Incomplete / Unfinished Features](#2-incomplete--unfinished-features)
3. [Database Schema Issues (already fixed in `supabase_schema.sql`)](#3-database-schema-issues-already-fixed)
4. [Recommendations for Fork](#4-recommendations-for-fork)

---

## 1. Frontend Bugs

---

### 🔴 BUG-01 — `area_public` vs `area_publik` label key mismatch

| Property | Detail |
|---|---|
| **Severity** | 🔴 Critical |
| **Type** | Wrong enum key in UI label map |
| **Affected Files** | `src/hooks/useReports.ts` (line ~104) |
| | `src/app/akun/riwayat-laporan/page.tsx` (line ~91) |

**Description:**  
Both files define a label lookup map for `location_category` values.
They use the key `'area_public'` (no `k`), but the value actually stored
in the database CHECK constraint is `'area_publik'` (with `k`).

As a result, any report with `location_category = 'area_publik'` will
display the raw database string instead of the human-readable label
`'Area Publik'`.

**Current (broken) code — `useReports.ts`:**
```typescript
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'sungai': 'Di tengah sungai',
    'pinggir_jalan': 'Pinggir jalan',
    'area_public': 'Area publik',   // ← wrong key
    'tanah_kosong': 'Tanah kosong',
    'lainnya': 'Lainnya'
  };
  return labels[category] || category;
}
```

**Fix:**
```diff
- 'area_public': 'Area publik',
+ 'area_publik': 'Area publik',
```

Apply the same fix in `riwayat-laporan/page.tsx`:
```diff
  const getLocationLabel = (location: string) => {
    const labels: Record<string, string> = {
      'sungai': 'Sungai',
      'pinggir_jalan': 'Pinggir Jalan',
-     'area_public': 'Area Publik',
+     'area_publik': 'Area Publik',
      'tanah_kosong': 'Tanah Kosong',
      'lainnya': 'Lainnya'
    };
```

---

### 🟡 BUG-02 — `dashboard/buat-campaign` does NOT write to Supabase

| Property | Detail |
|---|---|
| **Severity** | 🟡 Medium |
| **Type** | Unimplemented feature / dead code |
| **Affected File** | `src/app/dashboard/buat-campaign/page.tsx` |

**Description:**  
The create-campaign page reachable from the dashboard map
(`/dashboard/buat-campaign?reportId=...`) contains a
`// TODO: Submit to Supabase` comment. Instead of inserting into the
database, it just runs `await new Promise(resolve => setTimeout(resolve, 2000))`
and shows a fake success toast.

The **real** working implementation is at `/buat-campaign`
(`src/app/buat-campaign/CreateCampaignForm.tsx`), which correctly does:
```typescript
await supabase.from('campaigns').insert(campaignData).select().single();
```

**Fix options:**
- **Option A (recommended):** Delete `src/app/dashboard/buat-campaign/page.tsx`
  and update the dashboard's "Buat Campaign" button to route to `/buat-campaign`
  instead.
- **Option B:** Complete the TODO by importing and calling the same
  `supabase.from('campaigns').insert(...)` logic from `CreateCampaignForm.tsx`.

---

### 🟡 BUG-03 — `add_exp_to_profile` RPC: fallback path can silently fail

| Property | Detail |
|---|---|
| **Severity** | 🟡 Medium |
| **Type** | Race condition / silent failure |
| **Affected File** | `src/lib/expService.ts` |

**Description:**  
`addExpToUser()` first tries the `add_exp_to_profile` RPC. If that fails
or returns no rows, it falls back to a manual `SELECT` → `UPDATE` chain.
Between those two queries there is no transaction, so if two concurrent
requests hit the same user at the same time, both could read the same
`currentExp` value and each add their amount — resulting in only one
increment being applied (lost update).

**Fix:**  
Rely exclusively on the `add_exp_to_profile` database function (already
fixed in `supabase_schema.sql` to use an atomic `UPDATE … RETURNING`),
and remove the manual fallback path in `expService.ts`:

```typescript
// Remove the entire manual fallback block.
// Just call the RPC and return the result.
const { data: rpcResult, error: rpcError } = await supabase
  .rpc('add_exp_to_profile', { user_id: userId, exp_amount: amount });

if (rpcError || !rpcResult) {
  return { success: false, error: rpcError?.message ?? 'RPC failed' };
}
return { success: true, newExp: rpcResult[0].new_exp };
```

---

### 🟢 BUG-04 — `profiles` INSERT policy blocks the trigger path (edge case)

| Property | Detail |
|---|---|
| **Severity** | 🟢 Minor |
| **Type** | RLS policy gap |
| **Affected area** | Supabase RLS on `public.profiles` |

**Description:**  
The RLS INSERT policy on `profiles` is:
```sql
WITH CHECK (auth.uid() = id)
```
The `handle_new_user` trigger runs as `SECURITY DEFINER` so it bypasses RLS.
However, `ensureProfileExists()` in `expService.ts` also tries to
`INSERT` a profile from the client SDK when the trigger hasn't run yet
(e.g. OAuth users). This client-side INSERT is subject to the RLS check.
If `auth.uid()` doesn't match `id` for any reason, the insert silently
fails (error code `42501`), leaving the user with no profile and 0 EXP
permanently visible.

**Fix:**  
Add a fallback: if the client-side insert fails with `42501`, log a
warning and call the `add_exp_to_profile` RPC instead (which creates the
profile via SECURITY DEFINER context).

---

### 🟢 BUG-05 — Google OAuth users may never get `full_name` in leaderboard

| Property | Detail |
|---|---|
| **Severity** | 🟢 Minor |
| **Type** | Missing metadata for OAuth users |
| **Affected Files** | `src/lib/auth.ts`, `src/app/api/leaderboard/users/route.ts` |

**Description:**  
When a user registers with **email/password**, `full_name` is written to
`auth.users.raw_user_meta_data` via `options.data.full_name`. But when a
user signs in with **Google OAuth**, their name comes from
`user.user_metadata.name` (or `user.user_metadata.full_name` — depends on
the Google provider config). The leaderboard API reads
`user.user_metadata?.full_name`, so OAuth users with only
`user.user_metadata.name` will show a censored email instead of their
name.

**Fix — `src/app/api/leaderboard/users/route.ts`:**
```diff
  fullName: user.user_metadata?.full_name
+           || user.user_metadata?.name
+           || '',
```

---

## 2. Incomplete / Unfinished Features

---

### 🟡 INCOMPLETE-01 — `/revalidasi` flow never writes to the database

| Property | Detail |
|---|---|
| **Severity** | 🟡 Medium |
| **Affected Routes** | `/revalidasi`, `/revalidasi/foto`, `/revalidasi/konfirmasi-data` |
| **Affected Files** | `src/app/revalidasi/**`, `src/contexts/RevalidationContext.tsx` |

**Description:**  
The entire revalidation flow (3 steps: location → photo → confirm) stores
data in `RevalidationContext` client-side only. There is no API call, no
Supabase insert, and **no `revalidations` table** in the database.
The feature appears to have been scaffolded but not finished.

**To implement, add this table:**
```sql
CREATE TABLE public.revalidations (
  id          SERIAL      PRIMARY KEY,
  report_id   INTEGER     NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_urls  TEXT[]      NOT NULL DEFAULT '{}',
  notes       TEXT,
  status      TEXT        NOT NULL CHECK (status IN ('clean', 'still_dirty')),
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.revalidations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view revalidations" ON public.revalidations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert revalidations"
  ON public.revalidations FOR INSERT WITH CHECK (auth.uid() = user_id);
```

Then wire up `src/app/revalidasi/konfirmasi-data/useConfirmation.ts` to
call `supabase.from('revalidations').insert(...)` on confirm.

---

### 🟢 INCOMPLETE-02 — EXP actions `COMPLETE_CAMPAIGN` and `CREATE_CAMPAIGN` are never triggered

| Property | Detail |
|---|---|
| **Severity** | 🟢 Minor / Informational |
| **Affected File** | `src/config/exp.config.ts`, `src/lib/expService.ts` |

**Description:**  
`exp.config.ts` defines:
- `COMPLETE_CAMPAIGN: 150 EXP`
- `CREATE_CAMPAIGN: 200 EXP`

And `expService.ts` exports `addExpForCompleteCampaign()` and
`addExpForCreateCampaign()`. However, **neither function is called anywhere
in the codebase.** They are dead code.

**Fix:**  
Call `addExpForCreateCampaign(user.id)` after a successful campaign INSERT
in `CreateCampaignForm.tsx`. Implement campaign completion detection
(e.g. a cron job or a trigger that fires when `end_time` passes) and call
`addExpForCompleteCampaign()` for each participant.

---

### 🟢 INCOMPLETE-03 — Reports have no `status` column (no verification flow)

| Property | Detail |
|---|---|
| **Severity** | 🟢 Minor / Informational |
| **Affected File** | `src/app/akun/riwayat-laporan/page.tsx` (line ~98) |

**Description:**  
`getStatusBadge()` in the report history page hardcodes `"Terkirim"`
(Submitted) for every report with a comment:
```typescript
// For now, all reports are "Terkirim" since we don't have status field
```
There is no report status column in the database. The revalidation flow
was presumably designed to change this status but was never completed
(see INCOMPLETE-01).

**Fix (if desired):**  
Add a `status` column to `public.reports`:
```sql
ALTER TABLE public.reports
  ADD COLUMN status TEXT NOT NULL DEFAULT 'terkirim'
    CHECK (status IN ('terkirim', 'bersih', 'masih_kotor'));
```
Update it when a `revalidations` row is inserted.

---

## 3. Database Schema Issues (already fixed)

These were incorrect in the first generated schema and have been
corrected in the current `supabase_schema.sql`:

| # | Issue | Fix Applied |
|---|---|---|
| S-01 | `reports.id` was `BIGSERIAL` | Changed to `SERIAL` (matches TypeScript `id: number` and README SQL) |
| S-02 | `campaigns.id` was `BIGSERIAL` | Changed to `SERIAL` |
| S-03 | `campaigns.report_id` FK was `BIGINT` | Changed to `INTEGER` (must match `reports.id SERIAL`) |
| S-04 | `get_reports_distribution()` was missing entirely | Added — called by `debugService.fetchReportsDistribution()` |
| S-05 | `add_exp_to_profile` used a non-atomic upsert | Rewritten with `UPDATE … RETURNING` + conditional INSERT |
| S-06 | Schema used Postgres ENUM types | Reverted to `TEXT + CHECK` constraints (matches README SQL) |
| S-07 | `max_participants DEFAULT 50` | Corrected to `DEFAULT 10` (per README SQL; 50 was a TS dev default) |
| S-08 | `get_reports_with_coordinates` return type was `BIGINT` for `id` | Corrected to `INTEGER` |

---

## 4. Recommendations for Fork

If you are forking this project, here is a prioritised action list:

### Must fix before launch
- [ ] **BUG-01** — Fix `area_public` → `area_publik` in label maps (2 files)
- [ ] **BUG-02** — Delete or complete `dashboard/buat-campaign/page.tsx`
- [ ] **BUG-03** — Remove manual EXP fallback; rely on atomic RPC only

### Should fix
- [ ] **BUG-04** — Handle RLS edge case for OAuth profile creation
- [ ] **BUG-05** — Support `user.user_metadata.name` for Google OAuth in leaderboard
- [ ] **INCOMPLETE-01** — Complete revalidation flow & add `revalidations` table

### Nice to have
- [ ] **INCOMPLETE-02** — Trigger `CREATE_CAMPAIGN` and `COMPLETE_CAMPAIGN` EXP rewards
- [ ] **INCOMPLETE-03** — Add `status` column to `reports` for verification lifecycle

---

*Audit performed: 2026-04-01 · All 60+ source files across `src/app/`, `src/lib/`, `src/hooks/`, `src/contexts/`, `src/types/`, `src/config/`, and `src/utils/` were read.*
