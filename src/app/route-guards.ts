import { redirect } from "react-router";
import { hasActiveSession } from "../store/auth/auth.store";

export const requireAuthLoader = async (): Promise<null> => {
  if (!hasActiveSession()) {
    throw redirect("/login");
  }

  return null;
};

export const guestOnlyLoader = async (): Promise<null> => {
  if (hasActiveSession()) {
    throw redirect("/home");
  }

  return null;
};

export const indexRedirectLoader = async (): Promise<Response> => {
  return redirect("/home");
};
