import { Outlet } from "react-router";
import { NavBar } from "../../shared/ui/NavBar";
import { SideBar } from "../../shared/ui/SideBar";

export const AppShellLayout = () => {
  return (
    <div className="flex h-screen overflow-hidden">
      <SideBar />

      <div className="flex flex-1 flex-col overflow-hidden md:ml-64">
        <NavBar />

        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
