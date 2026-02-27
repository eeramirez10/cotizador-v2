import { create } from "zustand";
import type { User } from "../../interfaces/user.interface";
import { findMockUserByCredentials } from "../../modules/auth/mocks/mock-users";

export type AuthStatus = "authorized" | "unauthorized" | "pending";

interface AuthState {
  fetching: boolean;
  status: AuthStatus;
  token?: string;
  user?: User;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkStatus: () => Promise<void>;
}

const STORAGE_KEY = "auth-storage-wa";

type PersistedAuth = {
  token: string;
  user: User;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readStorage = (): PersistedAuth | null => {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedAuth;
    if (!parsed.token || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeStorage = (value: PersistedAuth): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

const clearStorage = (): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
};

const initialPersisted = readStorage();

export const useAuthStore = create<AuthState>((set) => ({
  fetching: false,
  status: initialPersisted ? "authorized" : "unauthorized",
  token: initialPersisted?.token,
  user: initialPersisted?.user,

  login: async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedEmail || !normalizedPassword) {
      throw new Error("Email y contraseña son obligatorios");
    }

    set({ fetching: true });

    await sleep(500);

    const user = findMockUserByCredentials(normalizedEmail, normalizedPassword);
    if (!user) {
      set({ fetching: false });
      throw new Error("Credenciales invalidas para entorno mock.");
    }

    const token = `mock_${Date.now()}`;

    writeStorage({ token, user });

    set({
      fetching: false,
      status: "authorized",
      token,
      user,
    });
  },

  checkStatus: async () => {
    set({ fetching: true });

    await sleep(100);

    const persisted = readStorage();

    if (!persisted) {
      set({
        fetching: false,
        status: "unauthorized",
        token: undefined,
        user: undefined,
      });
      throw new Error("unauthorized");
    }

    set({
      fetching: false,
      status: "authorized",
      token: persisted.token,
      user: persisted.user,
    });
  },

  logout: () => {
    clearStorage();
    set({ status: "unauthorized", token: undefined, user: undefined });
  },
}));

export const hasActiveSession = (): boolean => {
  const state = useAuthStore.getState();

  if (state.status === "authorized" && state.token && state.user) {
    return true;
  }

  const persisted = readStorage();

  if (!persisted) return false;

  useAuthStore.setState({
    status: "authorized",
    token: persisted.token,
    user: persisted.user,
    fetching: false,
  });

  return true;
};

export const performLogin = async (email: string, password: string): Promise<void> => {
  await useAuthStore.getState().login(email, password);
};

export const performLogout = (): void => {
  useAuthStore.getState().logout();
};
