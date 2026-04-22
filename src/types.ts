export interface Church {
  id: string;
  name: string;
  responsible: string;
  community: string;
  bookQuantity: number;
  phoneNumber: string;
  email?: string;
  status: 'Pendiente' | 'Entregado';
  whatsappSent?: boolean;
  qrCodeUrl?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  deliveredAt?: string;
  extraData?: Record<string, any>;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}
