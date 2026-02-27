import { NavLink } from "react-router";

export const NotFoundPage = () => {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-2xl font-semibold">404</h2>
      <p className="text-sm text-slate-500">No encontramos la pantalla que buscas.</p>
      <NavLink to="/home" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        Ir al dashboard
      </NavLink>
    </div>
  );
};
