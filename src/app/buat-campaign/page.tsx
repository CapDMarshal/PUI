import React, { Suspense } from 'react';
import { requireAdmin } from '@/lib/adminGuard';
import CreateCampaignForm from './CreateCampaignForm';

export default async function CreateCampaignPage() {
  await requireAdmin();

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Memuat...</div>
      </div>
    }>
      <CreateCampaignForm />
    </Suspense>
  );
}
