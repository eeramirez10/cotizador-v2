import { ArrowLeft, BarChart3, Building2, ChevronDown, ContactRound, DollarSign, FilePlus2, FileSpreadsheet, FileUp, LucideLayoutDashboard, Package, Power, Settings2, ShieldCheck, ShoppingCart, Truck, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { Form, NavLink, useLocation } from "react-router";
import { useAuthStore } from "../../store/auth/auth.store";
import { useUiStore } from "../../store/ui/ui.store";
import { useSystemCapabilities } from "../../queries/system/use-system-capabilities";

export const SideBar = () => {
  const open = useUiStore((state) => state.open);
  const setClose = useUiStore((state) => state.setClose);

  const user = useAuthStore((state) => state.user);
  const capabilities = useSystemCapabilities();
  const location = useLocation();
  const role = (user?.role || "").trim().toLowerCase();
  const canGenerateQuotes = role === "seller";
  const sellerExcelImportEnabled = capabilities.data?.sellerExcelImportEnabled ?? true;
  const isQuotePath = location.pathname.startsWith("/cotizador");
  const [quoteMenuState, setQuoteMenuState] = useState<{ path: string; open: boolean } | null>(null);
  const quoteMenuOpen = quoteMenuState?.path === location.pathname ? quoteMenuState.open : isQuotePath;
  const canAccessUsers = role === "admin" || role === "manager";
  const canAccessCatalogs = canAccessUsers || role === "purchasing";
  const canAccessBranches = role === "admin";
  const quoteInternalApprovalEnabled = capabilities.data?.quoteInternalApprovalEnabled ?? true;
  const canApproveQuotes = quoteInternalApprovalEnabled && (role === "admin" || role === "manager");
  const canAccessProcurement = role === "admin" || role === "manager" || role === "seller" || role === "purchasing";
  const canAccessCommercial = role !== "purchasing";

  const navBase = "flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-gray-100";
  const active = "bg-gray-100 text-gray-900";
  const inactive = "text-gray-700 hover:bg-gray-100 hover:text-gray-900";

  const navClass = ({ isActive }: { isActive: boolean }) => `${navBase} ${isActive ? active : inactive}`;

  const nav = [
    ...(canAccessCommercial ? [{ name: "Cotizaciones", to: "/quotes", icon: <DollarSign /> }] : []),
    ...(canApproveQuotes ? [{ name: "Aprobar cotizaciones", to: "/quote-approvals", icon: <ShieldCheck /> }] : []),
    ...(canAccessCommercial ? [{ name: "Indicadores", to: "/analytics", icon: <BarChart3 /> }] : []),
    ...(canAccessCommercial ? [{ name: "Clientes", to: "/clients", icon: <ContactRound /> }] : []),
    ...(canAccessCommercial ? [{ name: "Productos", to: "/products", icon: <Package /> }] : []),
    ...(canAccessProcurement ? [{ name: "Proveedores", to: "/suppliers", icon: <Truck /> }] : []),
    ...(canAccessProcurement ? [{ name: "Requisiciones", to: "/procurement", icon: <ShoppingCart /> }] : []),
    ...(canAccessBranches ? [{ name: "Sucursales", to: "/branches", icon: <Building2 /> }] : []),
    ...(canAccessUsers ? [{ name: "Usuarios", to: "/users", icon: <Users /> }] : []),
    ...(canAccessCatalogs ? [{ name: "Catálogos", to: "/quote-catalogs", icon: <Settings2 /> }] : []),
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
          <li>
            <NavLink onClick={handleNavClick} className={navClass} to="/home">
              <div className="h-5 w-5 shrink-0 text-gray-900"><LucideLayoutDashboard /></div>
              Dashboard
            </NavLink>
          </li>
          {canGenerateQuotes && (
            <li>
              <button
                type="button"
                onClick={() => setQuoteMenuState({ path: location.pathname, open: !quoteMenuOpen })}
                aria-expanded={quoteMenuOpen}
                className={`${navBase} w-full justify-between ${isQuotePath ? active : inactive}`}
              >
                <span className="flex items-center gap-2"><span className="h-5 w-5 shrink-0 text-gray-900"><FileUp /></span>Cotizador</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${quoteMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {quoteMenuOpen && (
                <ul className="mt-2 space-y-1 border-l border-amber-300 pl-3 ml-4">
                  <li><NavLink onClick={handleNavClick} to="/cotizador/sistema" className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${isActive ? "bg-amber-100 text-amber-900" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}><FilePlus2 className="h-4 w-4" />Cotización en sistema</NavLink></li>
                  {sellerExcelImportEnabled && <li><NavLink onClick={handleNavClick} to="/cotizador/importar-excel" className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${isActive ? "bg-teal-100 text-teal-900" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}><FileSpreadsheet className="h-4 w-4" /><span className="flex-1">Importar formato</span><span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] uppercase text-slate-600">Temporal</span></NavLink></li>}
                </ul>
              )}
            </li>
          )}
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
