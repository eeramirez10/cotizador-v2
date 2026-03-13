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
