export interface Product {
  id: string; // SKU or Barcode matching /^[a-zA-Z0-9_\-]+$/
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  price: number;
  resalePrice?: number;
  location?: string;
  description?: string;
  imageUrl?: string;
  updatedAt: any; // Firestore Timestamp
  updatedBy: string;
  updatedByEmail: string;
  isKit?: boolean;
  kitItems?: Array<{ productId: string; name: string; qty: number }>;
  brand?: string;
  packaging?: string;
}

export interface Transaction {
  id: string;
  productId: string;
  productName: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  quantityChanged: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  timestamp: any; // Firestore Timestamp
  userId: string;
  userEmail: string;
  userDisplayName: string;
  discountPercent?: number;
  originalPrice?: number;
  discountedPrice?: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface TeamMember {
  id: string; // Document ID (UUID or generated)
  email: string;
  role: 'Administrador' | 'Editor' | 'Visualizador';
  status: 'Pendente' | 'Ativo';
  invitedBy: string;
  invitedByEmail: string;
  invitedAt: any; // Firestore Timestamp
  name?: string;
  avatarUrl?: string;
}

