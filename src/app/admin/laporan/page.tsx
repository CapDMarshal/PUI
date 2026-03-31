import { requireAdmin } from '@/lib/adminGuard'
import { getAllReportsAdmin } from '@/lib/adminService'
import { Database } from '@/types/database.types'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, ChevronRight, Filter } from 'lucide-react'

type ReportStatus = Database['public']['Enums']['report_status_enum']

export const revalidate = 0

export default async function AdminLaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  
  const currentStatus = (params.status as ReportStatus) || undefined
  const reports = await getAllReportsAdmin(currentStatus)
  
  const tabs = [
    { label: 'Semua Laporan', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Disetujui', value: 'approved' },
    { label: 'Berbahaya', value: 'hazardous' },
    { label: 'Ditolak', value: 'rejected' }
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': 
        return <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">Menunggu</span>
      case 'approved': 
        return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">Disetujui</span>
      case 'hazardous': 
        return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">Berbahaya</span>
      case 'rejected': 
        return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">Ditolak</span>
      default: return null
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div>
        <h2 className="text-sm font-medium text-green-600 mb-1">Manajemen Data</h2>
        <h1 className="text-3xl font-bold text-gray-900">Daftar Laporan</h1>
        <p className="text-gray-500 mt-1">Review dan kelola semua laporan sampah dari masyarakat.</p>
      </div>

      {/* Tabs Filter */}
      <div className="bg-white p-2 rounded-xl flex items-center gap-2 overflow-x-auto shadow-sm border border-gray-100">
        <Filter size={18} className="text-gray-400 ml-2 shrink-0" />
        {tabs.map((tab) => {
          const isActive = currentStatus === tab.value || (!currentStatus && tab.value === '')
          return (
            <Link 
              key={tab.value}
              href={`/admin/laporan${tab.value ? `?status=${tab.value}` : ''}`}
              className={`px-4 py-2 font-medium text-sm rounded-lg whitespace-nowrap transition-colors ${
                isActive 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'text-gray-600 hover:bg-gray-50 border border-transparent'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* List */}
      <div className="bg-white shadow-sm border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100">
        {reports.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg font-medium text-gray-900">Tidak ada data ditemukan</p>
            <p className="mt-1">Coba sesuaikan filter status kembali.</p>
          </div>
        ) : (
          reports.map((report: any) => (
            <Link
              key={report.id}
              href={`/admin/laporan/${report.id}`}
              className="p-4 md:p-6 hover:bg-green-50/50 flex flex-col md:flex-row gap-4 md:items-center transition-colors group cursor-pointer"
            >
              <div className="relative w-full md:w-32 h-40 md:h-24 rounded-xl overflow-hidden bg-gray-200 shrink-0">
                {report.image_urls?.[0] ? (
                  <Image 
                    src={report.image_urls[0]} 
                    alt="Foto laporan"
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : null}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(report.status)}
                    <span className="text-sm text-gray-500">
                      ID: #{report.id}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500 hidden md:block">
                    {new Date(report.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-green-700 transition-colors">
                  Sampah {report.waste_type}
                </h3>
                
                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-2 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={16} className="text-gray-400" />
                    <span>Area {report.location_category.replace('_', ' ')}</span>
                  </div>
                  <div className="text-gray-400">•</div>
                  <div>
                    Risiko:{' '}
                    <span className="font-medium text-gray-900 capitalize">
                      {report.hazard_risk.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden md:flex self-center shrink-0 pr-2">
                <div className="bg-white border border-gray-200 p-2 rounded-full text-gray-400 group-hover:text-green-600 group-hover:border-green-300 group-hover:bg-green-50 transition-all">
                  <ChevronRight size={20} />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

    </div>
  )
}
