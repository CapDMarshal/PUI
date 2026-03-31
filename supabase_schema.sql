-- ============================================================
-- COMPLETE SUPABASE DATABASE SCHEMA
-- Project: WasteCare (JawaraJawa)
-- Stack  : Next.js 15 + Supabase (PostgreSQL + PostGIS)
-- ============================================================
-- HOW TO USE
--   1. Open your Supabase project → SQL Editor
--   2. Paste this entire file and click Run
--   3. Deploy Edge Functions separately (see Section 7)
-- ============================================================


-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;          -- geographic POINT, ST_* functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- uuid_generate_v4()


-- ============================================================
-- 2. ENUMS
-- ============================================================
-- NOTE: The actual database uses TEXT columns with CHECK constraints
-- (as shown in the README SQL), NOT custom enum types.
-- The TypeScript enum types in database.types.ts are just TS-level aliases.
-- We define them as enums here for clarity, but you can also use the
-- TEXT + CHECK approach from the README (both work identically in Postgres).

-- If you prefer TEXT + CHECK (matching the original README exactly):
--   waste_type TEXT CHECK (waste_type IN ('organik','anorganik','berbahaya','campuran'))
-- Otherwise, use the enum approach below.

-- (Uncomment the block below if you want Postgres ENUM types)
-- CREATE TYPE waste_type_enum           AS ENUM ('organik','anorganik','berbahaya','campuran');
-- CREATE TYPE waste_volume_enum         AS ENUM ('kurang_dari_1kg','1_5kg','6_10kg','lebih_dari_10kg');
-- CREATE TYPE location_category_enum    AS ENUM ('sungai','pinggir_jalan','area_publik','tanah_kosong','lainnya');
-- CREATE TYPE campaign_status_enum      AS ENUM ('upcoming','ongoing','finished');
-- CREATE TYPE organizer_type_enum       AS ENUM ('personal','organization');


-- ============================================================
-- 3. TABLES
-- ============================================================

-- ── 3a. PROFILES ────────────────────────────────────────────
-- Extends Supabase auth.users.
-- Created automatically via trigger on new user signup.
-- Also stores user metadata (full_name) inside auth.users.raw_user_meta_data.
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exp        INTEGER     NOT NULL DEFAULT 0,
  role       TEXT        NOT NULL DEFAULT 'user'
    CHECK (role IN ('user','admin'))
);


-- ── 3b. REPORTS ─────────────────────────────────────────────
-- One report per waste sighting. Location stored as PostGIS POINT.
-- Images are stored in the 'report-images' Storage bucket;
-- image_urls holds the public URLs.
CREATE TABLE IF NOT EXISTS public.reports (
  id                SERIAL          PRIMARY KEY,   -- INTEGER (SERIAL), not BIGSERIAL
  user_id           UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_urls        TEXT[]          NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  waste_type        TEXT            NOT NULL
    CHECK (waste_type        IN ('organik','anorganik','campuran')),   -- 'berbahaya' removed; use hazard_risk instead
  waste_volume      TEXT            NOT NULL
    CHECK (waste_volume      IN ('kurang_dari_1kg','1_5kg','6_10kg','lebih_dari_10kg')),
  location_category TEXT            NOT NULL
    CHECK (location_category IN ('sungai','pinggir_jalan','area_publik','tanah_kosong','lainnya')),
  hazard_risk       TEXT            NOT NULL DEFAULT 'tidak_ada'
    CHECK (hazard_risk       IN ('tidak_ada','rendah','menengah','tinggi')),
  notes             TEXT,
  location          GEOGRAPHY(POINT, 4326) NOT NULL,  -- stored as POINT(longitude latitude)
  -- ── Admin review fields ─────────────────────────
  status            TEXT            NOT NULL DEFAULT 'pending'
    CHECK (status   IN ('pending','approved','rejected','hazardous')),
  reviewed_by       UUID            REFERENCES auth.users(id),        -- which admin reviewed
  reviewed_at       TIMESTAMPTZ,                                       -- when reviewed
  admin_notes       TEXT                                               -- rejection reason shown to user
);

-- Spatial index (required for ST_DWithin / ST_Distance queries)
CREATE INDEX IF NOT EXISTS idx_reports_location   ON public.reports USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_reports_user_id    ON public.reports (user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports (created_at DESC);


-- ── 3c. CAMPAIGNS ───────────────────────────────────────────
-- Each campaign is linked to exactly ONE report (report_id).
-- Status is stored in the DB but also recalculated client-side
-- based on start_time / end_time.
-- DEFAULT max_participants = 10  (per README; TypeScript type shows 50 as a dev default)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id               SERIAL      PRIMARY KEY,
  title            TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  max_participants INTEGER     NOT NULL DEFAULT 10,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status           TEXT        NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming','ongoing','finished')),
  report_id        INTEGER     NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  organizer_name   TEXT        NOT NULL,
  organizer_type   TEXT        NOT NULL
    CHECK (organizer_type IN ('personal','organization'))
);

CREATE INDEX IF NOT EXISTS idx_campaigns_report_id  ON public.campaigns (report_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status     ON public.campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaigns_start_time ON public.campaigns (start_time DESC);


-- ── 3d. CAMPAIGN_PARTICIPANTS ────────────────────────────────
-- Junction table: which profiles joined which campaign.
CREATE TABLE IF NOT EXISTS public.campaign_participants (
  campaign_id INTEGER     NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  profile_id  UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_participants_profile_id
  ON public.campaign_participants (profile_id);


-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles"   ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile"  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
-- Users see: their own reports (any status) + others' approved/hazardous only
CREATE POLICY "Users can view relevant reports" ON public.reports FOR SELECT
  USING (
    auth.uid() = user_id
    OR status IN ('approved', 'hazardous')
  );
-- Admins can see ALL reports regardless of status
CREATE POLICY "Admins can view all reports" ON public.reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Authenticated users can insert reports"   ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);
-- Users can update their own non-status fields
CREATE POLICY "Users can update own reports"             ON public.reports FOR UPDATE
  USING (auth.uid() = user_id);
-- Admins can update any report (for status changes)
CREATE POLICY "Admins can update any report"             ON public.reports FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Users can delete own reports"             ON public.reports FOR DELETE
  USING (auth.uid() = user_id);

-- campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view campaigns"                  ON public.campaigns FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create campaigns"   ON public.campaigns FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update campaigns"   ON public.campaigns FOR UPDATE
  USING (auth.role() = 'authenticated');

-- campaign_participants
ALTER TABLE public.campaign_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view participants"  ON public.campaign_participants FOR SELECT USING (true);
CREATE POLICY "Users can join campaigns"      ON public.campaign_participants FOR INSERT
  WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can leave campaigns"     ON public.campaign_participants FOR DELETE
  USING (auth.uid() = profile_id);


-- ============================================================
-- 5. STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('report-images', 'report-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS (objects table)
CREATE POLICY "Public read for report images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'report-images');

CREATE POLICY "Authenticated users can upload report images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'report-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own report images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'report-images'
    AND auth.uid()::text = (storage.foldername(name))[1]);


-- ============================================================
-- 6. TRIGGER – Auto-create profile on signup
-- ============================================================
-- Called when a new row is inserted into auth.users.
-- Stores user metadata (full_name) in auth.users.raw_user_meta_data
-- via the signUp() options.data.full_name field (set in auth.ts).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, exp)
  VALUES (NEW.id, 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 7. RPC FUNCTIONS
-- ============================================================

-- ── 7a. get_reports_with_coordinates ────────────────────────
-- Returns all reports with lat/lng extracted from PostGIS.
-- Used by: campaignService.fetchCampaigns(), provinceService.getReportsForMap()
CREATE OR REPLACE FUNCTION public.get_reports_with_coordinates()
RETURNS TABLE (
  id                INTEGER,
  user_id           UUID,
  image_urls        TEXT[],
  created_at        TIMESTAMPTZ,
  waste_type        TEXT,
  hazard_risk       TEXT,
  waste_volume      TEXT,
  location_category TEXT,
  notes             TEXT,
  status            TEXT,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    r.image_urls,
    r.created_at,
    r.waste_type,
    r.hazard_risk,
    r.waste_volume,
    r.location_category,
    r.notes,
    r.status,
    ST_Y(r.location::geometry) AS latitude,
    ST_X(r.location::geometry) AS longitude
  FROM public.reports r
  WHERE r.status IN ('approved', 'hazardous')  -- only validated reports on public map
  ORDER BY r.created_at DESC;
END;
$$;


-- ── 7b. get_user_reports_with_coordinates ───────────────────
-- Returns reports for a specific user with coordinates.
-- Used by: rpcHelpers.getUserReportsWithCoordinates()
CREATE OR REPLACE FUNCTION public.get_user_reports_with_coordinates(p_user_id UUID)
RETURNS TABLE (
  id                INTEGER,
  user_id           UUID,
  image_urls        TEXT[],
  created_at        TIMESTAMPTZ,
  waste_type        TEXT,
  hazard_risk       TEXT,
  waste_volume      TEXT,
  location_category TEXT,
  notes             TEXT,
  status            TEXT,
  admin_notes       TEXT,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    r.image_urls,
    r.created_at,
    r.waste_type,
    r.hazard_risk,
    r.waste_volume,
    r.location_category,
    r.notes,
    r.status,
    r.admin_notes,
    ST_Y(r.location::geometry) AS latitude,
    ST_X(r.location::geometry) AS longitude
  FROM public.reports r
  WHERE r.user_id = p_user_id
  ORDER BY r.created_at DESC;
END;
$$;


-- ── 7c. get_report_with_coordinates ─────────────────────────
-- Returns a single report by ID with coordinates.
-- Used by: rpcHelpers.getReportWithCoordinates()
CREATE OR REPLACE FUNCTION public.get_report_with_coordinates(p_report_id INTEGER)
RETURNS TABLE (
  id                INTEGER,
  user_id           UUID,
  image_urls        TEXT[],
  created_at        TIMESTAMPTZ,
  waste_type        TEXT,
  waste_volume      TEXT,
  location_category TEXT,
  notes             TEXT,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    r.image_urls,
    r.created_at,
    r.waste_type,
    r.waste_volume,
    r.location_category,
    r.notes,
    ST_Y(r.location::geometry) AS latitude,
    ST_X(r.location::geometry) AS longitude
  FROM public.reports r
  WHERE r.id = p_report_id;
END;
$$;


-- ── 7d. get_nearby_reports ───────────────────────────────────
-- Returns reports within a radius (meters), sorted by distance.
-- Used by: rpcHelpers.getNearbyReportsRPC()
-- NOTE: The Edge Function 'get-nearby-reports' wraps this for the HTTP layer.
CREATE OR REPLACE FUNCTION public.get_nearby_reports(
  p_latitude      DOUBLE PRECISION,
  p_longitude     DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION DEFAULT 10000,
  p_limit         INTEGER          DEFAULT 50
)
RETURNS TABLE (
  id                INTEGER,
  user_id           UUID,
  image_urls        TEXT[],
  created_at        TIMESTAMPTZ,
  waste_type        TEXT,
  waste_volume      TEXT,
  location_category TEXT,
  notes             TEXT,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  distance_km       DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    r.image_urls,
    r.created_at,
    r.waste_type,
    r.waste_volume,
    r.location_category,
    r.notes,
    ST_Y(r.location::geometry)                              AS latitude,
    ST_X(r.location::geometry)                              AS longitude,
    ST_Distance(
      r.location,
      ST_GeogFromText('POINT(' || p_longitude || ' ' || p_latitude || ')')
    ) / 1000.0                                              AS distance_km
  FROM public.reports r
  WHERE ST_DWithin(
    r.location,
    ST_GeogFromText('POINT(' || p_longitude || ' ' || p_latitude || ')'),
    p_radius_meters
  )
  AND r.status IN ('approved', 'hazardous')  -- only validated reports shown publicly
  ORDER BY distance_km ASC
  LIMIT p_limit;
END;
$$;


-- ── 7e. get_province_statistics ─────────────────────────────
-- Aggregates report counts by province.
-- Used by: provinceService.getTopProvinces()
-- NOTE: Province is inferred from coordinates via the 'get_city_statistics'
-- lookup. For a real deploy, integrate proper reverse-geocoding or add a
-- 'province' column to reports.
CREATE OR REPLACE FUNCTION public.get_province_statistics(limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
  province_name   TEXT,
  report_count    BIGINT,
  organic_count   BIGINT,
  inorganic_count BIGINT,
  mixed_count     BIGINT,
  high_risk_count BIGINT,
  avg_latitude    DOUBLE PRECISION,
  avg_longitude   DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ('Region ' || ROUND(ST_Y(r.location::geometry))::TEXT)   AS province_name,
    COUNT(*)                                                   AS report_count,
    COUNT(*) FILTER (WHERE r.waste_type = 'organik')          AS organic_count,
    COUNT(*) FILTER (WHERE r.waste_type = 'anorganik')        AS inorganic_count,
    COUNT(*) FILTER (WHERE r.waste_type = 'campuran')         AS mixed_count,
    COUNT(*) FILTER (WHERE r.hazard_risk IN ('menengah','tinggi')) AS high_risk_count,
    AVG(ST_Y(r.location::geometry))                           AS avg_latitude,
    AVG(ST_X(r.location::geometry))                           AS avg_longitude
  FROM public.reports r
  GROUP BY ROUND(ST_Y(r.location::geometry))
  ORDER BY report_count DESC
  LIMIT limit_count;
END;
$$;


-- ── 7f. get_city_statistics ──────────────────────────────────
-- Used by: statisticsService.fetchTopCities()
-- Returns top cities ranked by campaign completion.
CREATE OR REPLACE FUNCTION public.get_city_statistics(limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
  rank                BIGINT,
  city                TEXT,
  province            TEXT,
  score               DOUBLE PRECISION,
  completed_campaigns BIGINT,
  active_reports      BIGINT,
  cleaned_areas       BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH city_data AS (
    SELECT
      ROUND(ST_Y(r.location::geometry)::NUMERIC, 1)::TEXT || ', '
        || ROUND(ST_X(r.location::geometry)::NUMERIC, 1)::TEXT  AS city,
      'Indonesia'                                               AS province,
      COUNT(DISTINCT c.id)
        FILTER (WHERE c.status = 'finished' OR NOW() > c.end_time) AS completed_campaigns,
      COUNT(DISTINCT r.id)                                      AS active_reports,
      COUNT(DISTINCT c.id)
        FILTER (WHERE c.status = 'finished' OR NOW() > c.end_time) AS cleaned_areas
    FROM public.reports r
    LEFT JOIN public.campaigns c ON c.report_id = r.id
    GROUP BY
      ROUND(ST_Y(r.location::geometry)::NUMERIC, 1),
      ROUND(ST_X(r.location::geometry)::NUMERIC, 1)
  )
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY cd.completed_campaigns DESC, cd.active_reports DESC
    )                                 AS rank,
    cd.city,
    cd.province,
    0::DOUBLE PRECISION               AS score,   -- recalculated client-side
    cd.completed_campaigns,
    cd.active_reports,
    cd.cleaned_areas
  FROM city_data cd
  ORDER BY rank
  LIMIT limit_count;
END;
$$;


-- ── 7g. get_overall_statistics ───────────────────────────────
-- Used by: statisticsService.fetchOverallStatistics()
CREATE OR REPLACE FUNCTION public.get_overall_statistics()
RETURNS TABLE (
  total_campaigns_completed BIGINT,
  total_participants        BIGINT,
  total_cleaned_areas       BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)
     FROM public.campaigns
     WHERE status = 'finished' OR NOW() > end_time)             AS total_campaigns_completed,
    (SELECT COUNT(*) FROM public.campaign_participants)          AS total_participants,
    (SELECT COUNT(DISTINCT report_id)
     FROM public.campaigns
     WHERE status = 'finished' OR NOW() > end_time)             AS total_cleaned_areas;
END;
$$;


-- ── 7h. get_waste_type_statistics ───────────────────────────
-- Used by: statisticsService.fetchWasteTypeStatistics()
CREATE OR REPLACE FUNCTION public.get_waste_type_statistics()
RETURNS TABLE (
  total       BIGINT,
  organic     BIGINT,
  inorganic   BIGINT,
  mixed       BIGINT,
  risk_none   BIGINT,
  risk_low    BIGINT,
  risk_medium BIGINT,
  risk_high   BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)                                             AS total,
    COUNT(*) FILTER (WHERE waste_type = 'organik')      AS organic,
    COUNT(*) FILTER (WHERE waste_type = 'anorganik')    AS inorganic,
    COUNT(*) FILTER (WHERE waste_type = 'campuran')     AS mixed,
    COUNT(*) FILTER (WHERE hazard_risk = 'tidak_ada')   AS risk_none,
    COUNT(*) FILTER (WHERE hazard_risk = 'rendah')      AS risk_low,
    COUNT(*) FILTER (WHERE hazard_risk = 'menengah')    AS risk_medium,
    COUNT(*) FILTER (WHERE hazard_risk = 'tinggi')      AS risk_high
  FROM public.reports;
END;
$$;


-- ── 7i. add_exp_to_profile ───────────────────────────────────
-- Atomically updates EXP for a user.
-- Used by: expService.addExpToUser() (called after submit report / join campaign)
-- The TypeScript code first tries this RPC, then falls back to a manual SELECT+UPDATE.
-- Parameters match the call in expService.ts:
--   supabase.rpc('add_exp_to_profile', { user_id: userId, exp_amount: amount })
CREATE OR REPLACE FUNCTION public.add_exp_to_profile(
  user_id    UUID,
  exp_amount INTEGER
)
RETURNS TABLE (new_exp INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_exp INTEGER;
BEGIN
  UPDATE public.profiles
  SET exp = exp + exp_amount
  WHERE id = user_id
  RETURNING exp INTO v_new_exp;

  -- If no row was found (profile not yet created), insert it
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, exp)
    VALUES (user_id, exp_amount)
    ON CONFLICT (id) DO UPDATE SET exp = public.profiles.exp + EXCLUDED.exp
    RETURNING exp INTO v_new_exp;
  END IF;

  RETURN QUERY SELECT v_new_exp;
END;
$$;


-- ── 7k. insert_report_with_location ─────────────────────────
-- Called by the submit-report Edge Function (SECURITY DEFINER so it
-- bypasses RLS when called from the service-role context).
-- Accepts flat parameters and constructs the PostGIS POINT internally.
-- Returns the new row's id and created_at.
CREATE OR REPLACE FUNCTION public.insert_report_with_location(
  p_user_id           UUID,
  p_image_urls        TEXT[],
  p_waste_type        TEXT,
  p_hazard_risk       TEXT,
  p_waste_volume      TEXT,
  p_location_category TEXT,
  p_notes             TEXT,
  p_latitude          DOUBLE PRECISION,
  p_longitude         DOUBLE PRECISION
)
RETURNS TABLE (id INTEGER, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.reports (
    user_id,
    image_urls,
    waste_type,
    hazard_risk,
    waste_volume,
    location_category,
    notes,
    location,
    status
  )
  VALUES (
    p_user_id,
    p_image_urls,
    p_waste_type,
    p_hazard_risk,
    p_waste_volume,
    p_location_category,
    p_notes,
    ST_GeogFromText('POINT(' || p_longitude || ' ' || p_latitude || ')'),
    'pending'
  )
  RETURNING reports.id, reports.created_at;
END;
$$;


-- ── 7l. get_pending_reports ──────────────────────────────────
-- Returns all reports that need validation by an admin.
CREATE OR REPLACE FUNCTION public.get_pending_reports()
RETURNS TABLE (
  id                INTEGER,
  user_id           UUID,
  image_urls        TEXT[],
  created_at        TIMESTAMPTZ,
  waste_type        TEXT,
  hazard_risk       TEXT,
  waste_volume      TEXT,
  location_category TEXT,
  notes             TEXT,
  status            TEXT,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    r.image_urls,
    r.created_at,
    r.waste_type,
    r.hazard_risk,
    r.waste_volume,
    r.location_category,
    r.notes,
    r.status,
    ST_Y(r.location::geometry) AS latitude,
    ST_X(r.location::geometry) AS longitude
  FROM public.reports r
  WHERE r.status = 'pending'
  ORDER BY r.created_at ASC;
END;
$$;


-- ── 7m. get_admin_statistics ─────────────────────────────────
-- Returns overall report counts grouped by status.
CREATE OR REPLACE FUNCTION public.get_admin_statistics()
RETURNS TABLE (
  pending_count   BIGINT,
  approved_count  BIGINT,
  rejected_count  BIGINT,
  hazardous_count BIGINT,
  total_count     BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
    COUNT(*) FILTER (WHERE status = 'hazardous') AS hazardous_count,
    COUNT(*) AS total_count
  FROM public.reports;
END;
$$;


-- ── 7j. get_reports_distribution (DEBUG) ────────────────────
-- Used by: debugService.fetchReportsDistribution()  (debug page only)
-- Returns report counts and bounding boxes grouped by city/region.
CREATE OR REPLACE FUNCTION public.get_reports_distribution()
RETURNS TABLE (
  city         TEXT,
  province     TEXT,
  report_count BIGINT,
  min_lat      DOUBLE PRECISION,
  max_lat      DOUBLE PRECISION,
  min_lng      DOUBLE PRECISION,
  max_lng      DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(ST_Y(r.location::geometry)::NUMERIC, 1)::TEXT || ', '
      || ROUND(ST_X(r.location::geometry)::NUMERIC, 1)::TEXT  AS city,
    'Indonesia'                                               AS province,
    COUNT(*)                                                  AS report_count,
    MIN(ST_Y(r.location::geometry))                           AS min_lat,
    MAX(ST_Y(r.location::geometry))                           AS max_lat,
    MIN(ST_X(r.location::geometry))                           AS min_lng,
    MAX(ST_X(r.location::geometry))                           AS max_lng
  FROM public.reports r
  GROUP BY
    ROUND(ST_Y(r.location::geometry)::NUMERIC, 1),
    ROUND(ST_X(r.location::geometry)::NUMERIC, 1)
  ORDER BY report_count DESC;
END;
$$;


-- ============================================================
-- 8. EDGE FUNCTIONS  (deployed via Supabase CLI, not SQL)
-- ============================================================
--
-- supabase functions deploy submit-report
-- supabase functions deploy get-nearby-reports
--
-- ── submit-report ────────────────────────────────────────────
--   POST /functions/v1/submit-report
--   Authorization: Bearer <user_access_token>
--   Body (JSON):
--     image_base64     string   – JPEG base64, max 10 MB
--     latitude         number
--     longitude        number
--     notes?           string
--     waste_type?      string   – AI-generated if omitted
--     waste_volume?    string   – AI-generated if omitted
--     location_category? string – AI-generated if omitted
--
--   Logic:
--     1. Validate image (AI: confirm it contains waste)
--     2. Upload to Storage bucket 'report-images'
--     3. INSERT into public.reports with PostGIS POINT location
--     4. Return { success, data: { report_id, image_url, validation, created_at } }
--
-- ── get-nearby-reports ───────────────────────────────────────
--   GET /functions/v1/get-nearby-reports
--   Query params: latitude, longitude, radius_km, limit
--   Authorization: Bearer <token>  (optional – endpoint is public)
--
--   Logic:
--     Calls get_nearby_reports() RPC and returns:
--     { success, data: { reports[], query, total_count } }


-- ============================================================
-- 9. API ROUTES  (Next.js server-side, uses supabaseAdmin)
-- ============================================================
--
-- POST /api/leaderboard/users
--   Body: { userIds: string[] }
--   Uses SUPABASE_SERVICE_ROLE_KEY to call supabaseAdmin.auth.admin.listUsers()
--   Returns: { users: [{ id, email, fullName }] }
--   Purpose: fetch censored emails and full names for the leaderboard UI.


-- ============================================================
-- 10. ENVIRONMENT VARIABLES  (.env.local + Supabase Secrets)
-- ============================================================
--
-- Next.js (.env.local):
--   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
--   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
--   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   ← server-side only (API routes)
--   NEXT_PUBLIC_MAPTILER_API_KEY=<maptiler-key>    ← map tiles
--
-- Edge Function secrets (Supabase Dashboard → Project Settings → Edge Functions → Secrets):
--   GEMINI_API_KEY=<gemini-key>   ← required by submit-report function
--   SUPABASE_URL                  ← auto-injected by Supabase
--   SUPABASE_ANON_KEY             ← auto-injected by Supabase
--   SUPABASE_SERVICE_ROLE_KEY     ← must be set manually in secrets


-- ============================================================
-- 11. EXP REWARD CONFIG  (client-side, src/config/exp.config.ts)
-- ============================================================
--
-- CREATE_REPORT   = 100 EXP   (after submit-report Edge Function succeeds)
-- JOIN_CAMPAIGN   = 100 EXP   (after campaign_participants INSERT succeeds)
-- COMPLETE_CAMPAIGN = 150 EXP (future)
-- CREATE_CAMPAIGN = 200 EXP   (future)
--
-- Level formula: level = FLOOR(exp / 1000) + 1


-- ============================================================
-- 12. SCHEMA REVISION LOG & KNOWN ISSUES
-- ============================================================
--
-- ── Revision: reports.hazard_risk (applied 2026-04-01) ───────────────────────
--   Removed 'berbahaya' from waste_type CHECK (now: organik, anorganik, campuran).
--   Added hazard_risk column: NOT NULL DEFAULT 'tidak_ada'
--     CHECK (hazard_risk IN ('tidak_ada','rendah','menengah','tinggi')).
--   Rationale: separates waste classification from hazard level, allowing
--   any waste type to carry an independent risk assessment.
--   All downstream code (TypeScript types, services, label maps, edge function)
--   has been updated to match.
--
-- ── Fixed: BUG-01 'area_public' typo (applied 2026-04-01) ─────────────────
--   getCategoryLabel() / getLocationLabel() in two frontend files used
--   'area_public' (no 'k') as a label key. Fixed to 'area_publik' in:
--     src/hooks/useReports.ts
--     src/app/akun/riwayat-laporan/page.tsx
--
-- ── Revision: Admin Dashboard & Validation (applied 2026-04-01) ───────────
--   Added `role` to `public.profiles` ('user' | 'admin').
--   Added `status`, `reviewed_by`, `reviewed_at`, `admin_notes` to `public.reports`.
--   Added `get_pending_reports()` & `get_admin_statistics()`.
--   RLS updated: pending reports hidden from public map queries.
--
-- ── Still open: dashboard/buat-campaign is a prototype ────────────────
--   src/app/dashboard/buat-campaign/page.tsx has a // TODO and does not
--   write to Supabase. The real flow is at /buat-campaign.
--
-- ── Still open: /revalidasi flow is incomplete ──────────────────────
--   The revalidation pages capture data client-side but do NOT write to DB.
--   There is no 'revalidations' table. If you want to implement it, add:
--
--   CREATE TABLE public.revalidations (
--     id          SERIAL      PRIMARY KEY,
--     report_id   INTEGER     NOT NULL REFERENCES public.reports(id),
--     user_id     UUID        NOT NULL REFERENCES auth.users(id),
--     image_urls  TEXT[]      NOT NULL DEFAULT '{}',
--     notes       TEXT,
--     status      TEXT        NOT NULL CHECK (status IN ('clean','still_dirty')),
--     latitude    DOUBLE PRECISION,
--     longitude   DOUBLE PRECISION,
--     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
--   );
--
-- ── Edge Functions ─────────────────────────────────────────────────
--   Source is now in supabase/functions/ (version-controlled).
--   Deploy: supabase functions deploy submit-report
--           supabase functions deploy get-nearby-reports

-- ============================================================
-- 13. VERIFICATION QUERIES  (run after setup to confirm)
-- ============================================================

-- Check tables
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;

-- Check RPC functions
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_type = 'FUNCTION' ORDER BY 1;

-- Check extensions
-- SELECT extname FROM pg_extension WHERE extname IN ('postgis','uuid-ossp');

-- Smoke-test functions
-- SELECT * FROM get_overall_statistics();
-- SELECT * FROM get_waste_type_statistics();
-- SELECT * FROM get_reports_with_coordinates() LIMIT 5;
