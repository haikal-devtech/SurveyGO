import React from 'react';
import { Map, Home, Database, Plane, LucideIcon } from 'lucide-react';

export interface SurveyType {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  pricePerM2: number;
  complexityFactor: number;
  icon: LucideIcon;
  imageUrl: string;
}

export const SURVEY_TYPES: SurveyType[] = [
  {
    id: 'topo',
    name: 'Topography Survey',
    description: 'Detailed mapping of land surface and terrain features.',
    basePrice: 2000000,
    pricePerM2: 500,
    complexityFactor: 1.0,
    icon: Map,
    imageUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&q=80&w=500'
  },
  {
    id: 'insp',
    name: 'Building Inspection',
    description: 'Structural and safety assessment of existing buildings.',
    basePrice: 1500000,
    pricePerM2: 1200,
    complexityFactor: 1.2,
    icon: Home,
    imageUrl: 'https://images.unsplash.com/photo-1503387762-592dea58ef23?auto=format&fit=crop&q=80&w=500'
  },
  {
    id: 'geo',
    name: 'Geotechnical Survey',
    description: 'Soil and rock analysis for construction foundations.',
    basePrice: 5000000,
    pricePerM2: 2000,
    complexityFactor: 1.5,
    icon: Database,
    imageUrl: 'https://images.unsplash.com/photo-1576085898323-21811973f43c?auto=format&fit=crop&q=80&w=500'
  },
  {
    id: 'drone',
    name: 'Drone Aerial Survey',
    description: 'High-resolution aerial photography and 3D modeling.',
    basePrice: 3500000,
    pricePerM2: 800,
    complexityFactor: 1.1,
    icon: Plane,
    imageUrl: 'https://images.unsplash.com/photo-1527977966376-1c841de9d21a?auto=format&fit=crop&q=80&w=500'
  }
];
