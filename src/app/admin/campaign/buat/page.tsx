import { requireAdmin } from '@/lib/adminGuard'
import CreateCampaignForm from '@/app/buat-campaign/CreateCampaignForm'

export const metadata = {
  title: 'Buat Campaign - Admin',
}

export default async function AdminCreateCampaignPage() {
  await requireAdmin()

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-sm font-medium text-green-600 mb-1">Manajemen Program</h2>
        <h1 className="text-3xl font-bold text-gray-900">Buat Campaign Kebersihan</h1>
        <p className="text-gray-500 mt-1">
          Buat program gotong royong berdasarkan laporan masyarakat yang telah disetujui.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        {/* We reuse the existing public component but since it's wrapped in admin guard, it's safe */}
        <CreateCampaignForm />
      </div>
    </div>
  )
}
