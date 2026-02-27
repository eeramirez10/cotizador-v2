export interface Client {
  id: string;
  name: string;
  lastname: string;
  whatsappPhone: string;
  email: string;
  rfc: string;
  companyName: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId?: string | null;
  createdByName?: string;
  updatedByUserId?: string | null;
  updatedByName?: string;
}

export interface ClientInput {
  name: string;
  lastname: string;
  whatsappPhone: string;
  email: string;
  rfc: string;
  companyName: string;
  phone?: string;
}

export interface ClientActor {
  userId: string | null;
  fullName: string;
}
