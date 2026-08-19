export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  jobTitle: string | null;
  label: string | null;
  email: string | null;
  phone: string | null;
  phoneExtension: string | null;
  mobile: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerContactInput {
  id?: string;
  createdAt?: string;
  name: string;
  jobTitle?: string | null;
  label?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneExtension?: string | null;
  mobile?: string | null;
  isPrimary?: boolean;
}
