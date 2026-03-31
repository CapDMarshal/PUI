import { supabase } from './supabase';

export interface ProvinceStatistics {
  province_name: string;
  report_count: number;
  organic_count: number;
  inorganic_count: number;
  mixed_count: number;
  high_risk_count: number;
  avg_latitude: number;
  avg_longitude: number;
}

export interface MapReport {
  id: number;
  latitude: number;
  longitude: number;
  waste_type: string;
  location_category: string;
  image_urls: string[];
}

/**
 * Fetch top provinces by report count
 * @param limit Number of top provinces to return (default: 5)
 * @returns Array of province statistics
 */
export async function getTopProvinces(limit: number = 5): Promise<ProvinceStatistics[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_province_statistics', { limit_count: limit } as any);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    throw error;
  }
}

/**
 * Fetch all reports with coordinates for map display
 * @param limit Maximum number of reports to return
 * @returns Array of reports with coordinates
 */
export async function getReportsForMap(limit: number = 100): Promise<MapReport[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_reports_with_coordinates')
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data || []) as MapReport[];
  } catch (error) {
    throw error;
  }
}

/**
 * Calculate overall statistics from reports
 * @param reports Array of reports
 * @returns Statistics object
 */
export function calculateStatistics(reports: MapReport[]) {
  const total = reports.length;
  const organic = reports.filter(r => r.waste_type === 'organik').length;
  const inorganic = reports.filter(r => r.waste_type === 'anorganik').length;
  const mixed = reports.filter(r => r.waste_type === 'campuran').length;

  return {
    total,
    organic,
    inorganic,
    mixed,
  };
}
