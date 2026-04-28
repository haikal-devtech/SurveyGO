export type UserRole = 'client' | 'surveyor' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: any; // Allow serverTimestamp
  status: 'active' | 'suspended';
  isOnline?: boolean;
  surveyInterest?: string;
  onboardingCompleted?: boolean;
}

export interface Notification {
  id?: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: any;
  orderId?: string;
}

export interface Order {
  id?: string;
  clientId: string;
  surveyorId?: string;
  surveyTypeId: string;
  status: 'pending' | 'assigned' | 'on_site' | 'completed' | 'cancelled';
  location: {
    address: string;
    lat: number;
    lng: number;
  };
  area?: number;
  complexity?: number;
  price: number;
  rating?: number;
  review?: string;
  createdAt: string;
  updatedAt: string;
  reportUrl?: string;
  details?: string;
  notes?: string;
  referenceImages?: string[];
}

export interface SurveyorProfile extends UserProfile {
  licenseNumber?: string;
  certificationUrl?: string;
  isVerified: boolean;
  yearsOfExperience?: number;
}

export interface SurveyType {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  icon: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface Message {
  id?: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}
