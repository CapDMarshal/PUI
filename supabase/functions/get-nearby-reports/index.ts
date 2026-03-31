// ============================================================
// get-nearby-reports  —  Supabase Edge Function
// ============================================================
// GET /functions/v1/get-nearby-reports
// Query params:
//   latitude    number   (required)
//   longitude   number   (required)
//   radius_km   number   default 10
//   limit       number   default 50
//
// Authorization: Bearer <token>  (optional — public endpoint)
//
// Response:
//   { success, data: { reports[], query, total_count } }
// ============================================================

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET')     return json({ success: false, error: 'Method not allowed' }, 405);

  const SUPABASE_URL     = Deno.env.get('SUPABASE_URL');
  const ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY');

  if (!SUPABASE_URL || !ANON_KEY) {
    return json({ success: false, error: 'Server configuration error' }, 500);
  }

  const url    = new URL(req.url);
  const params = url.searchParams;

  const latitude   = parseFloat(params.get('latitude')  ?? '');
  const longitude  = parseFloat(params.get('longitude') ?? '');
  const radiusKm   = parseFloat(params.get('radius_km') ?? '10');
  const limit      = parseInt(params.get('limit')       ?? '50', 10);

  if (isNaN(latitude) || isNaN(longitude)) {
    return json({ success: false, error: 'latitude dan longitude diperlukan' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, ANON_KEY);

  const { data, error } = await supabase.rpc('get_nearby_reports', {
    p_latitude:      latitude,
    p_longitude:     longitude,
    p_radius_meters: radiusKm * 1000,
    p_limit:         limit,
  });

  if (error) {
    return json({ success: false, error: error.message }, 500);
  }

  return json({
    success: true,
    data: {
      reports:     data ?? [],
      total_count: (data ?? []).length,
      query: { latitude, longitude, radius_km: radiusKm, limit },
    },
  });
});
