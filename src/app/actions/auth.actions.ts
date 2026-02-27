import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { performLogin, performLogout } from "../../store/auth/auth.store";

export type LoginActionData = {
  error?: string;
};

export const loginAction = async ({ request }: ActionFunctionArgs): Promise<Response | LoginActionData> => {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await performLogin(email, password);
    return redirect("/home");
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible iniciar sesión";
    return { error: message };
  }
};

export const logoutAction = async (): Promise<Response> => {
  performLogout();
  return redirect("/login");
};
