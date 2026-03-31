import { supabase } from './supabase';

interface NearbyReportsParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
}

export interface ReportLocation {
  id: number;
  user_id: string;
  image_urls: string[];
  created_at: string;
  waste_type: string;
  waste_volume: string;
  location_category: string;
  notes: string | null;
  latitude: number;
  longitude: number;
  distance_km: number;
}

interface NearbyReportsResponse {
  success: boolean;
  data?: {
    reports: ReportLocation[];
    query: {
      latitude: string;
      longitude: string;
      radius_km: number;
    };
    total_count: number;
  };
  error?: string;
}

export async function getNearbyReports(
  params: NearbyReportsParams
): Promise<NearbyReportsResponse> {
  try {
    const { latitude, longitude, radiusKm = 10, limit = 50 } = params;

    // Get the session token with timeout
    let session = null;
    try {
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Session timeout')), 3000)
      );
      
      const { data: { session: currentSession } } = await Promise.race([
        sessionPromise,
        timeoutPromise
      ]) as any;
      
      session = currentSession;
    } catch (sessionError) {
      // Continue without session - endpoint is public
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Missing Supabase URL configuration');
    }

    // Build query parameters
    const queryParams = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius_km: radiusKm.toString(),
      limit: limit.toString(),
    });

    // Call the edge function
    const url = `${supabaseUrl}/functions/v1/get-nearby-reports?${queryParams}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Add authorization header if session exists (optional for this endpoint)
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
      headers['apikey'] = session.access_token;
    }

    // Add timeout for fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        mode: 'cors',
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timeout. Mohon coba lagi.');
      }
      throw new Error('Gagal menghubungi server. Periksa koneksi internet Anda.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch nearby reports: ${response.statusText}`);
    }

    const responseText = await response.text();

    let data: NearbyReportsResponse;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Server returned invalid JSON: ${responseText.substring(0, 200)}`);
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Format waste type label in Indonesian
 */
export function formatWasteType(type: string): string {
  const labels: Record<string, string> = {
    organik: 'Organik',
    anorganik: 'Anorganik',
    campuran: 'Campuran',
  };
  return labels[type] || type;
}

/**
 * Format hazard risk label in Indonesian
 */
export function formatHazardRisk(risk: string): string {
  const labels: Record<string, string> = {
    tidak_ada: 'Tidak Ada',
    rendah: 'Rendah',
    menengah: 'Menengah',
    tinggi: 'Tinggi',
  };
  return labels[risk] || risk;
}

/**
 * Format waste volume label in Indonesian
 */
export function formatWasteVolume(volume: string): string {
  const labels: Record<string, string> = {
    kurang_dari_1kg: 'Kurang dari 1kg',
    '1_5kg': '1-5kg',
    '6_10kg': '6-10kg',
    lebih_dari_10kg: 'Lebih dari 10kg',
  };
  return labels[volume] || volume;
}

/**
 * Format location category label in Indonesian
 */
export function formatLocationCategory(category: string): string {
  const labels: Record<string, string> = {
    sungai: 'Di sungai',
    pinggir_jalan: 'Pinggir jalan',
    area_publik: 'Area publik',
    tanah_kosong: 'Tanah kosong',
    lainnya: 'Lainnya',
  };
  return labels[category] || category;
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}
