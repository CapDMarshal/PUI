'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface AiValidation {
  isWaste: boolean;
  confidence: string;
  reason?: string;
  waste_type?: 'organik' | 'anorganik' | 'campuran';
  hazard_risk?: 'tidak_ada' | 'rendah' | 'menengah' | 'tinggi';
  waste_volume?: string;
  location_category?: string;
}

export interface ReportData {
  location: Location | null;
  photos: string[]; // Base64 encoded images
  wasteType: 'organik' | 'anorganik' | 'campuran' | null;
  hazardRisk: 'tidak_ada' | 'rendah' | 'menengah' | 'tinggi' | null;
  wasteVolume: 'kurang_dari_1kg' | '1_5kg' | '6_10kg' | 'lebih_dari_10kg' | null;
  locationCategory: 'sungai' | 'pinggir_jalan' | 'area_publik' | 'tanah_kosong' | 'lainnya' | null;
  notes?: string;
  // Store AI validation result after upload
  aiValidation?: AiValidation;
}

interface ReportContextType {
  reportData: ReportData;
  setLocation: (location: Location) => void;
  addPhoto: (photo: string) => void;
  removePhoto: (index: number) => void;
  setWasteType: (type: ReportData['wasteType']) => void;
  setWasteVolume: (volume: ReportData['wasteVolume']) => void;
  setLocationCategory: (category: ReportData['locationCategory']) => void;
  setNotes: (notes: string) => void;
  setAiValidation: (validation: ReportData['aiValidation']) => void;
  resetReport: () => void;
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);

const initialReportData: ReportData = {
  location: null,
  photos: [],
  wasteType: null,
  hazardRisk: null,
  wasteVolume: null,
  locationCategory: null,
  notes: '',
};

export function ReportProvider({ children }: { children: ReactNode }) {
  const [reportData, setReportData] = useState<ReportData>(initialReportData);

  const setLocation = (location: Location) => {
    setReportData(prev => ({ ...prev, location }));
  };

  const addPhoto = (photo: string) => {
    setReportData(prev => ({ ...prev, photos: [...prev.photos, photo] }));
  };

  const removePhoto = (index: number) => {
    setReportData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const setWasteType = (wasteType: ReportData['wasteType']) => {
    setReportData(prev => ({ ...prev, wasteType }));
  };

  const setWasteVolume = (wasteVolume: ReportData['wasteVolume']) => {
    setReportData(prev => ({ ...prev, wasteVolume }));
  };

  const setLocationCategory = (locationCategory: ReportData['locationCategory']) => {
    setReportData(prev => ({ ...prev, locationCategory }));
  };

  const setNotes = (notes: string) => {
    setReportData(prev => ({ ...prev, notes }));
  };

  const setAiValidation = (validation: AiValidation | undefined) => {
    setReportData(prev => ({ ...prev, aiValidation: validation }));
  };

  const resetReport = () => {
    setReportData(initialReportData);
  };

  return (
    <ReportContext.Provider
      value={{
        reportData,
        setLocation,
        addPhoto,
        removePhoto,
        setWasteType,
        setWasteVolume,
        setLocationCategory,
        setNotes,
        setAiValidation,
        resetReport,
      }}
    >
      {children}
    </ReportContext.Provider>
  );
}

export function useReport() {
  const context = useContext(ReportContext);
  if (context === undefined) {
    throw new Error('useReport must be used within a ReportProvider');
  }
  return context;
}
