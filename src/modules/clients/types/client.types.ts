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
