// ============================================================
// submit-report  —  Supabase Edge Function
// ============================================================
// POST /functions/v1/submit-report
// Authorization: Bearer <user_access_token>
//
// Body (JSON):
//   image_base64       string   JPEG/PNG base64, max 10 MB
//   latitude           number
//   longitude          number
//   notes?             string
//   waste_type?        'organik'|'anorganik'|'campuran'   (AI-generated if omitted)
//   hazard_risk?       'tidak_ada'|'rendah'|'menengah'|'tinggi'  (AI-generated if omitted)
//   waste_volume?      'kurang_dari_1kg'|'1_5kg'|'6_10kg'|'lebih_dari_10kg'
//   location_category? 'sungai'|'pinggir_jalan'|'area_publik'|'tanah_kosong'|'lainnya'
//
// Response:
//   { success, data: { report_id, image_url, validation, created_at } }
// ============================================================

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS ─────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Constants ─────────────────────────────────────────────────
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const GEMINI_MODEL   = 'gemini-2.0-flash';

// ── Valid enum values ─────────────────────────────────────────
const VALID_WASTE_TYPES       = ['organik', 'anorganik', 'campuran'] as const;
const VALID_HAZARD_RISKS      = ['tidak_ada', 'rendah', 'menengah', 'tinggi'] as const;
const VALID_WASTE_VOLUMES     = ['kurang_dari_1kg', '1_5kg', '6_10kg', 'lebih_dari_10kg'] as const;
const VALID_LOCATION_CATS     = ['sungai', 'pinggir_jalan', 'area_publik', 'tanah_kosong', 'lainnya'] as const;

type WasteType      = typeof VALID_WASTE_TYPES[number];
type HazardRisk     = typeof VALID_HAZARD_RISKS[number];
type WasteVolume    = typeof VALID_WASTE_VOLUMES[number];
type LocationCat    = typeof VALID_LOCATION_CATS[number];

// ── Gemini AI response shape ──────────────────────────────────
interface GeminiClassification {
  is_waste:          boolean;
  confidence:        'tinggi' | 'menengah' | 'rendah';
  reason:            string;
  waste_type:        WasteType;
  hazard_risk:       HazardRisk;
  waste_volume:      WasteVolume;
  location_category: LocationCat;
}

// ── Helper — JSON response ────────────────────────────────────
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── Helper — call Gemini Vision ───────────────────────────────
async function classifyWithGemini(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
): Promise<GeminiClassification> {
  const prompt = `
You are a waste classification AI for WasteCare, an environmental reporting app in Indonesia.

Analyze this image and respond ONLY with a valid JSON object — no markdown, no extra text.

JSON schema:
{
  "is_waste": boolean,           // true if the image clearly contains waste/trash
  "confidence": "tinggi"|"menengah"|"rendah",
  "reason": string,             // 1-2 sentence explanation in Indonesian
  "waste_type": "organik"|"anorganik"|"campuran",  // organic, inorganic, or mixed
  "hazard_risk": "tidak_ada"|"rendah"|"menengah"|"tinggi",  // hazard level
  "waste_volume": "kurang_dari_1kg"|"1_5kg"|"6_10kg"|"lebih_dari_10kg",
  "location_category": "sungai"|"pinggir_jalan"|"area_publik"|"tanah_kosong"|"lainnya"
}

Classification guide:
- waste_type:
    organik   = biodegradable (food waste, leaves, vegetables, etc.)
    anorganik = non-biodegradable (plastic, glass, metal, paper, etc.)
    campuran  = clearly mixed organic and inorganic waste
- hazard_risk:
    tidak_ada = household/common waste, no obvious hazard
    rendah    = minor risk (sharp edges, mild chemicals visible on packaging)
    menengah  = moderate risk (batteries, paint containers, medical packaging)
    tinggi    = high risk (chemical drums, syringes, industrial waste, biohazard)
- If is_waste is false, still return valid enum values as defaults but set confidence to "rendah".
`.trim();

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const geminiData = await res.json();
  const rawText: string =
    geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!rawText) throw new Error('Gemini AI mengembalikan respons kosong');
  if (rawText.length > 4000)  throw new Error('AI_RESPONSE_TOO_LONG');

  let parsed: GeminiClassification;
  try {
    // Strip possible markdown backtick wrapping
    const cleaned = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Gemini AI tidak mengembalikan JSON yang valid');
  }

  // Sanitise/default any out-of-range values
  if (!VALID_WASTE_TYPES.includes(parsed.waste_type))       parsed.waste_type       = 'campuran';
  if (!VALID_HAZARD_RISKS.includes(parsed.hazard_risk))     parsed.hazard_risk      = 'tidak_ada';
  if (!VALID_WASTE_VOLUMES.includes(parsed.waste_volume))   parsed.waste_volume     = 'kurang_dari_1kg';
  if (!VALID_LOCATION_CATS.includes(parsed.location_category)) parsed.location_category = 'lainnya';

  return parsed;
}

// ── Main handler ──────────────────────────────────────────────
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  // ── Env vars ─────────────────────────────────────────────
  const SUPABASE_URL        = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const GEMINI_API_KEY      = Deno.env.get('GEMINI_API_KEY');

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ success: false, error: 'Server configuration error' }, 500);
  }
  if (!GEMINI_API_KEY) {
    return json({ success: false, error: 'AI service not configured' }, 500);
  }

  // ── Authenticate user ─────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');

  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !user) {
    return json({ success: false, error: 'Sesi tidak valid. Silakan login kembali.' }, 401);
  }

  // ── Parse request body ────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: 'Request body tidak valid' }, 400);
  }

  const {
    image_base64,
    latitude,
    longitude,
    notes = '',
    waste_type: overrideWasteType,
    hazard_risk: overrideHazardRisk,
    waste_volume: overrideWasteVolume,
    location_category: overrideLocationCat,
  } = body as {
    image_base64?: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
    waste_type?: string;
    hazard_risk?: string;
    waste_volume?: string;
    location_category?: string;
  };

  // ── Validate required fields ──────────────────────────────
  if (!image_base64 || typeof image_base64 !== 'string') {
    return json({ success: false, error: 'Gambar diperlukan' }, 400);
  }
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return json({ success: false, error: 'Koordinat GPS diperlukan' }, 400);
  }

  // ── Image size check ──────────────────────────────────────
  const imageBytes = Math.ceil(image_base64.length * 0.75);
  if (imageBytes > MAX_IMAGE_BYTES) {
    return json({
      success: false,
      error: `Ukuran gambar terlalu besar (${Math.round(imageBytes / 1024 / 1024)}MB). Maksimal 10MB.`,
    }, 400);
  }

  // ── Detect MIME type from base64 header ───────────────────
  let mimeType = 'image/jpeg';
  if (image_base64.startsWith('/9j/') || image_base64.includes('data:image/jpeg')) {
    mimeType = 'image/jpeg';
  } else if (image_base64.startsWith('iVBORw0KGgo') || image_base64.includes('data:image/png')) {
    mimeType = 'image/png';
  } else if (image_base64.startsWith('UklGR') || image_base64.includes('data:image/webp')) {
    mimeType = 'image/webp';
  }

  // Strip any data URL prefix if present
  const cleanBase64 = image_base64.replace(/^data:image\/[a-z]+;base64,/, '');

  // ── Gemini AI classification ──────────────────────────────
  let aiResult: GeminiClassification;
  try {
    aiResult = await classifyWithGemini(cleanBase64, mimeType, GEMINI_API_KEY);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: `Gagal memvalidasi gambar: ${msg}` }, 422);
  }

  // If AI says this is not waste, reject
  if (!aiResult.is_waste && aiResult.confidence === 'tinggi') {
    return json({
      success: false,
      error: 'Gambar tidak terdeteksi sebagai sampah. Pastikan gambar menampilkan lokasi sampah dengan jelas.',
      validation: {
        isWaste:    false,
        confidence: aiResult.confidence,
        reason:     aiResult.reason,
      },
    }, 422);
  }

  // Merge AI output with any client-side overrides
  const finalWasteType:  WasteType  = (VALID_WASTE_TYPES.includes(overrideWasteType as WasteType)
    ? overrideWasteType : aiResult.waste_type) as WasteType;
  const finalHazardRisk: HazardRisk = (VALID_HAZARD_RISKS.includes(overrideHazardRisk as HazardRisk)
    ? overrideHazardRisk : aiResult.hazard_risk) as HazardRisk;
  const finalVolume: WasteVolume    = (VALID_WASTE_VOLUMES.includes(overrideWasteVolume as WasteVolume)
    ? overrideWasteVolume : aiResult.waste_volume) as WasteVolume;
  const finalLocation: LocationCat  = (VALID_LOCATION_CATS.includes(overrideLocationCat as LocationCat)
    ? overrideLocationCat : aiResult.location_category) as LocationCat;

  // ── Upload image to Storage ───────────────────────────────
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const timestamp   = Date.now();
  const storagePath = `${user.id}/${timestamp}.jpg`;

  const imageBuffer = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));

  const { error: uploadError } = await adminClient
    .storage
    .from('report-images')
    .upload(storagePath, imageBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    return json({
      success: false,
      error: `Gagal mengunggah gambar: ${uploadError.message}`,
    }, 500);
  }

  // Get public URL
  const { data: { publicUrl } } = adminClient
    .storage
    .from('report-images')
    .getPublicUrl(storagePath);

  // ── Insert report into database ───────────────────────────
  // Using raw SQL via rpc to insert PostGIS POINT
  const { data: insertData, error: insertError } = await adminClient
    .rpc('insert_report_with_location', {
      p_user_id:           user.id,
      p_image_urls:        [publicUrl],
      p_waste_type:        finalWasteType,
      p_hazard_risk:       finalHazardRisk,
      p_waste_volume:      finalVolume,
      p_location_category: finalLocation,
      p_notes:             (notes as string) || null,
      p_latitude:          latitude,
      p_longitude:         longitude,
    });

  if (insertError) {
    // Clean up uploaded image on DB failure
    await adminClient.storage.from('report-images').remove([storagePath]);
    console.error('DB insert error:', insertError);
    return json({
      success: false,
      error: `Gagal menyimpan laporan: ${insertError.message}`,
    }, 500);
  }

  const report = Array.isArray(insertData) ? insertData[0] : insertData;

  // ── Return success ────────────────────────────────────────
  return json({
    success: true,
    data: {
      report_id:  report.id,
      image_url:  publicUrl,
      validation: {
        isWaste:           aiResult.is_waste,
        confidence:        aiResult.confidence,
        reason:            aiResult.reason,
        waste_type:        finalWasteType,
        hazard_risk:       finalHazardRisk,
        waste_volume:      finalVolume,
        location_category: finalLocation,
      },
      created_at: report.created_at,
    },
  });
});
