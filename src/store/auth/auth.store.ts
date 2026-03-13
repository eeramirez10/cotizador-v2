import { create } from "zustand";
import type { User } from "../../interfaces/user.interface";
import { AuthService } from "../../modules/auth/services/auth.service";

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

    try {
      const backendSession = await AuthService.login(normalizedEmail, normalizedPassword);

      writeStorage({ token: backendSession.token, user: backendSession.user });

      set({
        fetching: false,
        status: "authorized",
        token: backendSession.token,
        user: backendSession.user,
      });
    } catch (error) {
      set({
        fetching: false,
        status: "unauthorized",
        token: undefined,
        user: undefined,
      });
      clearStorage();
      throw error;
    }
  },

  checkStatus: async () => {
    set({ fetching: true });

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

    try {
      const user = await AuthService.me(persisted.token);
      writeStorage({ token: persisted.token, user });

      set({
        fetching: false,
        status: "authorized",
        token: persisted.token,
        user,
      });
    } catch {
      clearStorage();
      set({
        fetching: false,
        status: "unauthorized",
        token: undefined,
        user: undefined,
      });
      throw new Error("unauthorized");
    }
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

export const getAuthToken = (): string | undefined => useAuthStore.getState().token;
