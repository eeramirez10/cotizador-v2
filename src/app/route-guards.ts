import { redirect } from "react-router";
import { useAuthStore } from "../store/auth/auth.store";

export const requireAuthLoader = async (): Promise<null> => {
  try {
    await useAuthStore.getState().checkStatus();
  } catch {
    throw redirect("/login");
  }

  return null;
};

export const guestOnlyLoader = async (): Promise<null> => {
  try {
    await useAuthStore.getState().checkStatus();
    throw redirect("/home");
  } catch {
    return null;
  }
};

export const indexRedirectLoader = async (): Promise<Response> => {
  return redirect("/home");
};

export const requireRolesLoader =
  (allowedRoles: string[]) =>
  async (): Promise<null> => {
    try {
      await useAuthStore.getState().checkStatus();
    } catch {
      throw redirect("/login");
    }

    const role = (useAuthStore.getState().user?.role || "").trim().toLowerCase();
    const allowed = allowedRoles.map((item) => item.trim().toLowerCase());

    if (!allowed.includes(role)) {
      throw redirect("/home");
    }

    return null;
  };
