import { Outlet } from "react-router";
import { NavBar } from "../../shared/ui/NavBar";
import { SideBar } from "../../shared/ui/SideBar";
import { useUiStore } from "../../store/ui/ui.store";

export const AppShellLayout = () => {
  const open = useUiStore((state) => state.open);
  const setClose = useUiStore((state) => state.setClose);

  return (
    <div className="flex h-screen overflow-hidden">
      {open && (
        <button
          type="button"
          aria-label="Cerrar sidebar"
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={setClose}
        />
      )}
      <SideBar />

      <div className={`flex flex-1 flex-col overflow-hidden transition-[margin] duration-300 ${open ? "md:ml-64" : "md:ml-0"}`}>
        <NavBar />

        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
