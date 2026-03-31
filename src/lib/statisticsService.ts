import { supabase } from './supabase';

export interface CityStatistic {
  rank: number;
  city: string;
  province: string;
  score: number;
  completedCampaigns: number;
  activeReports: number;
  cleanedAreas: number;
}

export interface OverallStatistics {
  totalCampaignsCompleted: number;
  totalParticipants: number;
  totalCleanedAreas: number;
}

export interface WasteTypeStatistics {
  total: number;
  organic: number;
  inorganic: number;
  mixed: number;
  riskNone: number;
  riskLow: number;
  riskMedium: number;
  riskHigh: number;
}

/**
 * Calculate cleanliness score based on the new algorithm
 * Formula: Score = ((A × 5) + (C × 1)) / TargetMax × E × 100
 * Where:
 * - A = Area Dibersihkan (cleanedAreas)
 * - C = Jumlah Campaign (completedCampaigns)
 * - L = Laporan Aktif (activeReports)
 * - E = Efektivitas = A / (A + L)
 * - TargetMax = 500 (konstanta untuk normalisasi ke persentase)
 */

export function calculateCleanlinessScore(
  cleanedAreas: number,
  completedCampaigns: number,
  activeReports: number
): number {
  const A = cleanedAreas;
  const C = completedCampaigns;
  const L = activeReports;
  
  // Efektivitas Penyelesaian (E): rasio area yang sudah dibersihkan
  const E = (A + L) > 0 ? A / (A + L) : 0;
  
  // Skor Basis: (A × 5) + (C × 1)
  const skorBasis = (A * 5) + (C * 1);
  
  // Target Max untuk normalisasi (500 = 100%)
  const TargetMax = 500;
  
  // Skor Akhir: (SkorBasis / TargetMax) × E × 100
  let score = (skorBasis / TargetMax) * E * 100;
  
  // Cap maksimal ke 100%
  if (score > 100) {
    score = 100;
  }
  
  return score;
}

/**
 * Fetch waste type statistics from the database
 */
export async function fetchWasteTypeStatistics(): Promise<WasteTypeStatistics> {
  try {
    const { data, error } = await supabase
      .rpc('get_waste_type_statistics')
      .single() as any;

    if (error) {
      throw error;
    }

    return {
      total: Number(data?.total || 0),
      organic: Number(data?.organic || 0),
      inorganic: Number(data?.inorganic || 0),
      mixed: Number(data?.mixed || 0),
      riskNone: Number(data?.risk_none || 0),
      riskLow: Number(data?.risk_low || 0),
      riskMedium: Number(data?.risk_medium || 0),
      riskHigh: Number(data?.risk_high || 0),
    };
  } catch (error) {
    return {
      total: 0,
      organic: 0,
      inorganic: 0,
      mixed: 0,
      riskNone: 0,
      riskLow: 0,
      riskMedium: 0,
      riskHigh: 0,
    };
  }
}

/**
 * Fetch overall statistics from the database
 */
export async function fetchOverallStatistics(): Promise<OverallStatistics> {
  try {
    const { data, error } = await supabase
      .rpc('get_overall_statistics')
      .single() as any;

    if (error) {
      throw error;
    }

    return {
      totalCampaignsCompleted: data?.total_campaigns_completed || 0,
      totalParticipants: data?.total_participants || 0,
      totalCleanedAreas: data?.total_cleaned_areas || 0,
    };
  } catch (error) {
    return {
      totalCampaignsCompleted: 0,
      totalParticipants: 0,
      totalCleanedAreas: 0,
    };
  }
}

/**
 * Fetch top cities by campaign completion and waste management performance
 */
export async function fetchTopCities(): Promise<CityStatistic[]> {
  try {
    // Add timeout to prevent long-running queries (reduced to 8s)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 8000);
    });

    const fetchPromise = supabase
      .rpc('get_city_statistics', { limit_count: 5 } as any);

    // Race between timeout and actual request
    const { data, error } = await Promise.race([
      fetchPromise,
      timeoutPromise
    ]) as any;

    if (error) {
      // Return empty array on error instead of throwing
      return [];
    }

    // If no data or empty, return empty array
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return [];
    }

    // Map and recalculate scores using the new algorithm
    const citiesWithNewScore = data.map((city: any) => ({
      city: city.city,
      province: city.province,
      completedCampaigns: Number(city.completed_campaigns),
      activeReports: Number(city.active_reports),
      cleanedAreas: Number(city.cleaned_areas),
      score: calculateCleanlinessScore(
        Number(city.cleaned_areas),
        Number(city.completed_campaigns),
        Number(city.active_reports)
      ),
    }));

    // Sort by new score (descending) and assign ranks
    const sortedCities = citiesWithNewScore
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5) // Top 5 only
      .map((city: any, index: number) => ({
        ...city,
        rank: index + 1,
      }));

    return sortedCities;
  } catch (error) {
    // Return empty array on any error including timeout
    return [];
  }
}
