import { requireAdmin } from '@/lib/adminGuard'
import { getAdminStatistics, getPendingReports } from '@/lib/adminService'
import Link from 'next/link'
import { Clock, CheckCircle, XCircle, AlertTriangle, ChevronRight, MapPin } from 'lucide-react'
import Image from 'next/image'

// This page is server-rendered completely
export const revalidate = 0

export default async function AdminDashboardPage() {
  await requireAdmin()
  
  const [statsData, pendingReports] = await Promise.all([
    getAdminStatistics(),
    getPendingReports()
  ])

  // Extract from the RPC response
  const stats = statsData || { pending_count: 0, approved_count: 0, rejected_count: 0, hazardous_count: 0, total_count: 0 }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div>
        <h2 className="text-sm font-medium text-green-600 mb-1">Overview</h2>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Utama</h1>
        <p className="text-gray-500 mt-1">Ringkasan status laporan masyarakat yang masuk.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Pending */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="bg-orange-100 text-orange-600 p-3 rounded-xl mb-3">
            <Clock size={24} />
          </div>
          <p className="text-sm text-gray-500 font-medium">Menunggu</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pending_count}</p>
        </div>
        
        {/* Approved */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="bg-green-100 text-green-600 p-3 rounded-xl mb-3">
            <CheckCircle size={24} />
          </div>
          <p className="text-sm text-gray-500 font-medium">Disetujui</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.approved_count}</p>
        </div>
        
        {/* Hazardous */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="bg-red-100 text-red-600 p-3 rounded-xl mb-3">
            <AlertTriangle size={24} />
          </div>
          <p className="text-sm text-gray-500 font-medium">Berisiko Tinggi</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.hazardous_count}</p>
        </div>

        {/* Rejected */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="bg-gray-100 text-gray-600 p-3 rounded-xl mb-3">
            <XCircle size={24} />
          </div>
          <p className="text-sm text-gray-500 font-medium">Ditolak</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.rejected_count}</p>
        </div>
      </div>

      {/* Let's show recent pending reports (requires immediate attention) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Perlu Validasi</h3>
            <p className="text-sm text-gray-500">Laporan terbaru yang menunggu persetujuan Anda.</p>
          </div>
          <Link 
            href="/admin/laporan"
            className="text-green-600 text-sm font-medium hover:text-green-700 flex items-center gap-1"
          >
            Lihat semua <ChevronRight size={16} />
          </Link>
        </div>
        
        {pendingReports.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-900">Tidak ada laporan tertunda</p>
            <p className="mt-1">Semua laporan telah divalidasi dengan baik.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingReports.slice(0, 5).map((report: any) => (
              <Link 
                href={`/admin/laporan/${report.id}`} 
                key={report.id}
                className="p-4 hover:bg-gray-50 flex items-start gap-4 transition-colors group"
              >
                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-200 shrink-0">
                  {report.image_urls?.[0] ? (
                     <Image 
                      src={report.image_urls[0]} 
                      alt="Bukti foto"
                      fill
                      className="object-cover"
                    />
                  ) : null}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 uppercase tracking-wider">
                      Pending
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(report.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  
                  <h4 className="font-semibold text-gray-900 truncate group-hover:text-green-700 transition-colors">
                    Sampah {report.waste_type}
                  </h4>
                  
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-1 truncate">
                    <MapPin size={14} className="shrink-0" />
                    <span className="truncate">
                      Kategori {report.location_category.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                
                <div className="self-center pr-2 text-gray-300 group-hover:text-green-600 transition-colors">
                  <ChevronRight />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
