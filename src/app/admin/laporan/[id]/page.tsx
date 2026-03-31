import { requireAdmin } from '@/lib/adminGuard'
import { getReportDetailAdmin } from '@/lib/adminService'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle, MapPin, Calendar, Check, ExternalLink } from 'lucide-react'
import { approveAction, rejectAction, forwardHazardousAction } from './actions'

// Server component
export default async function AdminReportDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  await requireAdmin()
  const { id } = await params
  
  const report = await getReportDetailAdmin(parseInt(id, 10))
  if (!report) return notFound()

  // Status badge config
  const statusColors = {
    pending: 'bg-orange-100 text-orange-700 border-orange-200',
    approved: 'bg-green-100 text-green-700 border-green-200',
    rejected: 'bg-gray-100 text-gray-700 border-gray-200',
    hazardous: 'bg-red-100 text-red-700 border-red-200',
  }

  // Parse location manually just for preview if needed
  // This is generic handling, assume we let them open maps for now
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${report.location}` // Usually location string contains raw Point(...) but Google Maps uses standard coords. Just a placeholder for the URL concept.

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      
      <div className="flex items-center gap-3 text-sm text-gray-500 mb-6">
        <Link href="/admin/laporan" className="flex items-center gap-1 hover:text-green-700 transition">
          <ArrowLeft size={16} /> Kembali
        </Link>
        <span>/</span>
        <span>ID Laporan: #{report.id}</span>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Sampah {report.waste_type}
          </h1>
          <div className="flex items-center gap-3 mt-3">
            <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${statusColors[report.status as keyof typeof statusColors]}`}>
              Status: {report.status}
            </span>
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Calendar size={14} /> 
              {new Date(report.created_at).toLocaleDateString('id-ID', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        
        {/* Photo Gallery */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Foto Lampiran</h3>
          <div className="aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden relative border border-gray-200">
            {report.image_urls?.[0] ? (
              <Image 
                src={report.image_urls[0]}
                alt="Bukti foto"
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                Tidak ada foto
              </div>
            )}
          </div>
          {report.image_urls?.length > 1 && (
            <div className="flex gap-2">
              {report.image_urls.slice(1).map((imgUrl: string, i: number) => (
                <div key={i} className="w-16 h-16 relative rounded-lg overflow-hidden border border-gray-200">
                  <Image src={imgUrl} alt={`Foto ${i+2}`} fill className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details & Actions */}
        <div className="space-y-6">
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Volume Estimasi</p>
              <p className="font-medium text-gray-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 block"></span>
                {report.waste_volume.replace(/_/g, ' ')}
              </p>
            </div>
            
            <div>
              <p className="text-gray-500 mb-1">Risiko Bahaya (AI Prediction)</p>
              <p className={`font-medium capitalize flex items-center gap-2 ${report.hazard_risk === 'tinggi' ? 'text-red-600' : 'text-gray-900'}`}>
                {report.hazard_risk === 'tinggi' && <AlertTriangle size={16} />}
                {report.hazard_risk.replace(/_/g, ' ')}
              </p>
            </div>

            <div>
              <p className="text-gray-500 mb-1">Kategori Lokasi</p>
              <p className="font-medium text-gray-900 flex items-center gap-2">
                <MapPin size={16} className="text-gray-500" />
                {report.location_category.replace(/_/g, ' ')}
              </p>
            </div>

            {report.notes && (
              <div>
                <p className="text-gray-500 mb-1">Catatan Pelapor</p>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-gray-700 italic">
                  "{report.notes}"
                </div>
              </div>
            )}
          </div>
          
          {/* Action Bar */}
          {report.status === 'pending' && (
            <div className="pt-6 border-t border-gray-100 flex flex-col gap-3">
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Aksi Validasi</h3>
              
              <form action={async () => { 'use server'; await approveAction(report.id) }}>
                <button type="submit" className="w-full flex justify-center items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-xl transition-colors">
                  <CheckCircle size={18} />
                  Setujui (Valid)
                </button>
              </form>
              
              <div className="flex gap-3">
                <form className="w-1/2" action={async () => { 'use server'; await forwardHazardousAction(report.id) }}>
                  <button type="submit" className="w-full justify-center flex items-center gap-2 bg-orange-100 hover:bg-orange-200 text-orange-700 font-medium py-3 px-4 rounded-xl transition-colors">
                    <AlertTriangle size={18} />
                    Teruskan (Bahaya)
                  </button>
                </form>
                
                {/* Note: In a real app we would use a client component form to gather admin_notes. For simplicity we just reject without notes here, or hardcode. */}
                <form className="w-1/2" action={async () => { 'use server'; await rejectAction(report.id, "Ditolak admin") }}>
                  <button type="submit" className="w-full justify-center flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors">
                    <XCircle size={18} />
                    Tolak Laporan
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Approved state (show campaign button) */}
          {report.status === 'approved' && (
            <div className="pt-6 border-t border-gray-100 space-y-3">
              <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl text-sm flex items-start gap-3">
                <CheckCircle className="shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="font-semibold">Laporan Disetujui</p>
                  <p className="opacity-80">Anda telah menyetujui laporan ini. Langkah selanjutnya adalah membuat campaign kebersihan.</p>
                </div>
              </div>
              <Link 
                href={`/admin/campaign/buat?reportId=${report.id}`}
                className="w-full flex justify-center items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Buat Campaign Kebersihan
              </Link>
            </div>
          )}

          {/* Hazardous state */}
          {report.status === 'hazardous' && (
            <div className="pt-6 border-t border-gray-100">
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm flex items-start gap-3">
                <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="font-semibold">Laporan Diteruskan Eksternal</p>
                  <p className="opacity-80">Telah ditandai sebagai berbahaya dan dilimpahkan ke pihak terkait.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
