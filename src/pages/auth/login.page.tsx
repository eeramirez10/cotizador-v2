import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { Form, useActionData, useNavigation } from "react-router";
import type { LoginActionData } from "../../app/actions/auth.actions";
import { MOCK_LOGIN_PASSWORD, MOCK_USERS } from "../../modules/auth/mocks/mock-users";

export const LoginPage = () => {
  const [show, setShow] = useState(false);

  const actionData = useActionData() as LoginActionData | undefined;
  const navigation = useNavigation();
  const fetching = navigation.state === "submitting";

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center border-2 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="rounded-md bg-gradient-to-l from-yellow-500 to-yellow-300 p-3">
        <img src="/img/logo-tuvansa.png" alt="Logo Tuvansa" />
      </div>

      <div className="mt-2 p-4">
        <h2 className="text-2xl font-bold text-white">Bienvenido a TUVANSA</h2>
        <p className="text-sm text-gray-400">Ingresa tus credenciales para continuar</p>
      </div>

      <div className="w-md rounded-lg border border-gray-700 bg-gray-800 bg-opacity-50 p-6 shadow-xl backdrop-blur-sm">
        <Form className="space-y-6" method="post">
          <div>
            <label className="mb-2 flex text-sm font-medium text-gray-300">Correo Electrónico</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Mail className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type="email"
                name="email"
                className="w-full rounded-lg border border-gray-600 bg-gray-700 py-2 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="ejemplo@tuvansa.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 text-sm text-gray-300">Contraseña</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Lock className="h-5 w-5 text-gray-500" />
              </div>

              <input
                autoComplete="current-password"
                type={show ? "text" : "password"}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 py-2 pl-10 placeholder:text-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="••••••••"
                name="password"
                required
              />

              <button type="button" onClick={() => setShow((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2">
                {!show ? <Eye className="h-5 w-5 text-gray-500" /> : <EyeOff className="h-5 w-5 text-gray-500" />}
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-2">
              <input type="checkbox" />
              <p className="text-sm text-gray-300">Recordarme</p>
            </div>
            <p className="cursor-pointer text-sm text-yellow-500 hover:text-yellow-400">¿Olvidaste tu contraseña?</p>
          </div>

          {actionData?.error && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">{actionData.error}</p>}

          <button
            type="submit"
            disabled={fetching}
            className="mb-5 w-full rounded-md bg-gradient-to-r from-yellow-300 to-yellow-500 py-2 font-semibold text-gray-50 disabled:opacity-70"
          >
            <div className="flex items-center justify-center gap-3">
              {fetching && <Loader />}
              {fetching ? "Procesando" : "Iniciar Sesion"}
            </div>
          </button>
        </Form>

        <div className="mt-4 rounded-md border border-gray-700 bg-gray-900/60 p-3 text-xs text-gray-300">
          <p className="font-semibold text-gray-200">Usuarios mock disponibles</p>
          <p className="mt-1">
            Password para todos: <span className="font-semibold text-yellow-300">{MOCK_LOGIN_PASSWORD}</span>
          </p>
          <ul className="mt-2 space-y-1">
            {MOCK_USERS.map((user) => (
              <li key={user.id} className="flex items-center justify-between gap-2">
                <span>{user.email}</span>
                <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-200">
                  {user.branch.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

const Loader = () => {
  return (
    <div role="status">
      <svg
        aria-hidden="true"
        className="h-7 w-7 animate-spin fill-yellow-600 text-gray-200 dark:text-gray-600"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
    </div>
  );
};
