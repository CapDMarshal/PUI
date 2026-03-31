'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface Report {
  id: number;
  image_urls: string[];
  created_at: string;
  waste_type: string;
  waste_volume: string;
  location_category: string;
  notes: string | null;
  latitude: number;
  longitude: number;
}

export default function RiwayatLaporanPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const fetchReports = async () => {
    if (!user) return;

    try {
      // Use RPC function to get user's reports with extracted coordinates
      const { data, error }: { data: Report[] | null; error: any } = await supabase
        .rpc('get_user_reports_with_coordinates', {
          p_user_id: user.id
        } as any);

      if (error) throw error;

      setReports(data || []);
    } catch (error) {
      setToast({
        message: 'Gagal memuat riwayat laporan',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getWasteTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'organik': 'Organik',
      'anorganik': 'Anorganik',
      'campuran': 'Campuran'
    };
    return labels[type] || type;
  };

  const getHazardRiskLabel = (risk: string) => {
    const labels: Record<string, string> = {
      'tidak_ada': 'Tidak Ada',
      'rendah': 'Rendah',
      'menengah': 'Menengah',
      'tinggi': 'Tinggi'
    };
    return labels[risk] || risk;
  };

  const getHazardRiskColor = (risk: string) => {
    const colors: Record<string, string> = {
      'tidak_ada': 'bg-gray-100 text-gray-600',
      'rendah': 'bg-yellow-100 text-yellow-700',
      'menengah': 'bg-orange-100 text-orange-700',
      'tinggi': 'bg-red-100 text-red-700',
    };
    return colors[risk] ?? 'bg-gray-100 text-gray-600';
  };

  const getVolumeLabel = (volume: string) => {
    const labels: Record<string, string> = {
      'kurang_dari_1kg': '< 1 kg',
      '1_5kg': '1-5 kg',
      '6_10kg': '6-10 kg',
      'lebih_dari_10kg': '> 10 kg'
    };
    return labels[volume] || volume;
  };

  const getLocationLabel = (location: string) => {
    const labels: Record<string, string> = {
      'sungai': 'Sungai',
      'pinggir_jalan': 'Pinggir Jalan',
      'area_publik': 'Area Publik',   // ← BUG-01 fixed: was 'area_public'
      'tanah_kosong': 'Tanah Kosong',
      'lainnya': 'Lainnya'
    };
    return labels[location] || location;
  };

  const getStatusBadge = () => {
    // For now, all reports are "Terkirim" since we don't have status field
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
        Terkirim
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center px-4 py-4">
            <button onClick={() => router.back()} className="mr-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900">Riwayat Laporan</h1>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center px-4 py-4">
          <button onClick={() => router.back()} className="mr-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Riwayat Laporan</h1>
        </div>
      </div>

      <div className="p-6">
        {reports.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Laporan</h3>
            <p className="text-gray-500">Anda belum membuat laporan sampah</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          Laporan #{report.id}
                        </h3>
                        {getStatusBadge()}
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatDate(report.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Photos */}
                  {report.image_urls && report.image_urls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {report.image_urls.slice(0, 3).map((url, index) => (
                        <img
                          key={index}
                          src={url}
                          alt={`Foto ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  )}

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-600">
                        {getLocationLabel(report.location_category)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      <span className="text-gray-600">
                        {getWasteTypeLabel(report.waste_type)} • {getVolumeLabel(report.waste_volume)}
                      </span>
                    </div>
                    {report.notes && (
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-600 flex-1">
                          {report.notes}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
