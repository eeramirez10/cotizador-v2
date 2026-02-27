import { useAuthStore } from "../../store/auth/auth.store";

export const UserPage = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-2 text-xl font-semibold text-gray-800">Perfil</h2>
      <p className="text-sm text-gray-600">Nombre: {user?.name} {user?.lastname}</p>
      <p className="text-sm text-gray-600">Email: {user?.email}</p>
      <p className="text-sm text-gray-600">Rol: {user?.role}</p>
      <p className="text-sm text-gray-600">Sucursal: {user?.branch?.name}</p>
    </div>
  );
};
