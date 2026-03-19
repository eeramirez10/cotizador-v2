import { ArrowLeft, Building2, ContactRound, DollarSign, FileUp, LucideLayoutDashboard, Package, Power, UserRound, Users } from "lucide-react";
import { Form, NavLink } from "react-router";
import { useAuthStore } from "../../store/auth/auth.store";
import { useUiStore } from "../../store/ui/ui.store";

export const SideBar = () => {
  const open = useUiStore((state) => state.open);
  const setClose = useUiStore((state) => state.setClose);

  const user = useAuthStore((state) => state.user);
  const role = (user?.role || "").trim().toLowerCase();
  const canAccessUsers = role === "admin" || role === "manager";
  const canAccessBranches = role === "admin";

  const navBase = "flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-gray-100";
  const active = "bg-gray-100 text-gray-900";
  const inactive = "text-gray-700 hover:bg-gray-100 hover:text-gray-900";

  const navClass = ({ isActive }: { isActive: boolean }) => `${navBase} ${isActive ? active : inactive}`;

  const nav = [
    { name: "Dashboard", to: "/home", icon: <LucideLayoutDashboard /> },
    { name: "Cotizador", to: "/cotizador", icon: <FileUp /> },
    { name: "Cotizaciones", to: "/quotes", icon: <DollarSign /> },
    { name: "Clientes", to: "/clients", icon: <ContactRound /> },
    { name: "Productos", to: "/products", icon: <Package /> },
    ...(canAccessBranches ? [{ name: "Sucursales", to: "/branches", icon: <Building2 /> }] : []),
    ...(canAccessUsers ? [{ name: "Usuarios", to: "/users", icon: <Users /> }] : []),
    { name: "Perfil", to: "/user", icon: <UserRound /> },
  ];

  const handleNavClick = () => {
    if (window.innerWidth < 768) {
      setClose();
    }
  };

  return (
    <aside
      id="default-sidebar"
      className={`fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}
      aria-label="Sidebar"
    >
      <div className="flex items-center justify-between bg-linear-to-r from-yellow-200 to-yellow-500 px-2 py-2">
        <img className="h-12" src="/img/logo-tuvansa.png" alt="Logo Tuvansa" />
        <button
          type="button"
          onClick={setClose}
          className="rounded-md p-1 text-gray-700 transition-colors hover:bg-white/30"
          aria-label="Ocultar sidebar"
          title="Ocultar sidebar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="flex h-[calc(100%-64px)] flex-col overflow-y-auto bg-white">
        <ul className="space-y-3 px-3 py-4">
          {nav.map((item) => (
            <li key={item.name}>
              <NavLink onClick={handleNavClick} className={navClass} to={item.to}>
                <div className="h-5 w-5 shrink-0 text-gray-900 transition duration-75 group-hover:text-gray-900">{item.icon}</div>
                {item.name}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-auto w-full border-t border-gray-200 p-4">
          <div className="flex items-center justify-center gap-4">
            <img
              className="h-10 rounded-full"
              src="https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"
              alt="User avatar"
            />

            <div>
              <h3 className="text-md font-bold text-gray-700">
                {user?.name} {user?.lastname}
              </h3>
            </div>

            <Form
              method="post"
              action="/logout"
              className="cursor-pointer p-2 text-gray-500 transition-all ease-in hover:rounded-full hover:bg-amber-300 hover:text-white"
            >
              <button type="submit" aria-label="Cerrar sesión">
                <Power className="h-5 w-5" />
              </button>
            </Form>
          </div>
        </div>
      </div>
    </aside>
  );
};
