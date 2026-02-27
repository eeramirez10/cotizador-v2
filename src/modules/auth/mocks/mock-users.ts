import type { User } from "../../../interfaces/user.interface";

const FIXED_DATE = "2026-01-01T00:00:00.000Z";

const BRANCHES: Record<string, User["branch"]> = {
  mx: {
    id: "01",
    name: "Mexico",
    address: "CDMX",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  mty: {
    id: "02",
    name: "Monterrey",
    address: "Monterrey, NL",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  ver: {
    id: "03",
    name: "Veracruz",
    address: "Veracruz, VER",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  mex: {
    id: "04",
    name: "Mexicali",
    address: "Mexicali, BC",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  qro: {
    id: "05",
    name: "Queretaro",
    address: "Queretaro, QRO",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
};

export const MOCK_USERS: User[] = [
  {
    id: "usr_mx_001",
    name: "Mariana",
    lastname: "Sanchez",
    username: "msanchez",
    email: "mariana.sanchez@tuvansa.com",
    phone: "5512345678",
    role: "seller",
    isActive: true,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    branchId: BRANCHES.mx.id,
    branch: BRANCHES.mx,
  },
  {
    id: "usr_mty_001",
    name: "Carlos",
    lastname: "Garcia",
    username: "cgarcia",
    email: "carlos.garcia@tuvansa.com",
    phone: "8112345678",
    role: "seller",
    isActive: true,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    branchId: BRANCHES.mty.id,
    branch: BRANCHES.mty,
  },
  {
    id: "usr_ver_001",
    name: "Fernanda",
    lastname: "Lopez",
    username: "flopez",
    email: "fernanda.lopez@tuvansa.com",
    phone: "2291234567",
    role: "seller",
    isActive: true,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    branchId: BRANCHES.ver.id,
    branch: BRANCHES.ver,
  },
  {
    id: "usr_mex_001",
    name: "Diana",
    lastname: "Ramirez",
    username: "dramirez",
    email: "diana.ramirez@tuvansa.com",
    phone: "6861234567",
    role: "seller",
    isActive: true,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    branchId: BRANCHES.mex.id,
    branch: BRANCHES.mex,
  },
  {
    id: "usr_qro_001",
    name: "Alan",
    lastname: "Torres",
    username: "atorres",
    email: "alan.torres@tuvansa.com",
    phone: "4421234567",
    role: "seller",
    isActive: true,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    branchId: BRANCHES.qro.id,
    branch: BRANCHES.qro,
  },
];

export const MOCK_LOGIN_PASSWORD = "Tuvansa123!";

export const findMockUserByCredentials = (email: string, password: string): User | null => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  if (normalizedPassword !== MOCK_LOGIN_PASSWORD) {
    return null;
  }

  const user = MOCK_USERS.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);
  return user ?? null;
};
