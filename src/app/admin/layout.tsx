import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/adminGuard'
import { LayoutDashboard, FileText, Flag, LogOut, ShieldAlert } from 'lucide-react'

export const metadata = {
  title: 'Admin Dashboard - WasteCare',
  description: 'Panel admin DLHK untuk mengelola laporan dan campaign.',
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Guard the entire /admin/* route
  await requireAdmin()

  return (
    <div className="flex h-screen bg-gray-50 flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="w-full md:w-64 bg-green-800 text-white flex-shrink-0 md:min-h-screen p-4 flex flex-col md:sticky md:top-0">
        <div className="flex items-center gap-3 mb-8 px-2 py-2 border-b border-green-700/50 pb-6">
          <div className="bg-white text-green-800 p-2 rounded-lg">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h1 className="font-bold text-xl leading-tight">Admin DLHK</h1>
            <p className="text-sm text-green-200">WasteCare Panel</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 flex flex-row md:flex-col overflow-x-auto md:overflow-visible pb-2 md:pb-0 hide-scrollbar">
          <Link 
            href="/admin" 
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-700 transition-colors shrink-0"
          >
            <LayoutDashboard size={20} />
            <span className="font-medium hidden md:inline">Dashboard</span>
          </Link>
          
          <Link 
            href="/admin/laporan" 
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-700 transition-colors shrink-0"
          >
            <FileText size={20} />
            <span className="font-medium hidden md:inline">Daftar Laporan</span>
          </Link>
          
          <Link 
            href="/admin/campaign/buat" 
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-700 transition-colors shrink-0"
          >
            <Flag size={20} />
            <span className="font-medium hidden md:inline">Buat Campaign</span>
          </Link>
        </nav>

        <div className="mt-auto hidden md:block pt-4 border-t border-green-700/50">
          <Link 
            href="/" 
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-700 transition-colors text-green-200"
          >
            <LogOut size={20} />
            <span className="font-medium">Kembali ke App</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full">
        {children}
      </main>
    </div>
  )
}
