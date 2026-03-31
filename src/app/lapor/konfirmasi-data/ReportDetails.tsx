import { DetailItem } from '@/components';
import { 
  WASTE_TYPE_LABELS,
  HAZARD_RISK_LABELS,
  WASTE_VOLUME_LABELS, 
  LOCATION_CATEGORY_LABELS 
} from './labels';

interface ReportDetailsProps {
  wasteType: string | null;
  wasteVolume: string | null;
  locationCategory: string | null;
  hazardRisk?: string | null;
  notes?: string;
}

// Badge colour based on risk level
const HAZARD_RISK_COLORS: Record<string, string> = {
  tidak_ada: 'bg-gray-100 text-gray-600',
  rendah:    'bg-yellow-100 text-yellow-700',
  menengah:  'bg-orange-100 text-orange-700',
  tinggi:    'bg-red-100 text-red-700',
};

export default function ReportDetails({ 
  wasteType, 
  wasteVolume, 
  locationCategory,
  hazardRisk,
  notes 
}: ReportDetailsProps) {
  return (
    <div className="space-y-4">
      {/* Waste Type */}
      <DetailItem
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        }
        title="Jenis sampah (dianalisis AI)"
        description={wasteType ? WASTE_TYPE_LABELS[wasteType as keyof typeof WASTE_TYPE_LABELS] : '-'}
      />

      {/* Hazard Risk */}
      <DetailItem
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
        title="Tingkat bahaya (dianalisis AI)"
        description={
          hazardRisk ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${HAZARD_RISK_COLORS[hazardRisk] ?? 'bg-gray-100 text-gray-600'}`}>
              {HAZARD_RISK_LABELS[hazardRisk as keyof typeof HAZARD_RISK_LABELS] ?? hazardRisk}
            </span>
          ) : '-'
        }
      />

      {/* Waste Amount */}
      <DetailItem
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        }
        title="Volume sampah (dianalisis AI)"
        description={wasteVolume ? WASTE_VOLUME_LABELS[wasteVolume as keyof typeof WASTE_VOLUME_LABELS] : '-'}
      />

      {/* Location */}
      <DetailItem
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
        title="Kategori lokasi (dianalisis AI)"
        description={locationCategory ? LOCATION_CATEGORY_LABELS[locationCategory as keyof typeof LOCATION_CATEGORY_LABELS] : '-'}
      />

      {/* Notes if exists */}
      {notes && (
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Catatan tambahan
          </h3>
          <p className="text-sm text-gray-600">
            {notes}
          </p>
        </div>
      )}
    </div>
  );
}
