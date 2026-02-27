export interface Branch {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  lastname: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branchId: string;
  branch: Branch;
}
