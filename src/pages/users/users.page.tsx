import { Loader2, Pencil, Search, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { ErpUserSummary } from "../../modules/users/services/erp-users.service";
import type { ManagedUser, UserRole } from "../../modules/users/services/users.service";
import { useErpUserSearch } from "../../queries/users/use-erp-user-search";
import { notifier } from "../../shared/notifications/notifier";
import { useAuthStore } from "../../store/auth/auth.store";
import {
  useBranches,
  useCreateUser,
  useDeactivateUser,
  useUpdateUser,
  useUsers,
} from "../../queries/users/use-users";

const PAGE_SIZE = 20;

interface UserFormState {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  branchCode: string;
  phone: string;
  erpUserCode: string;
}

const EMPTY_FORM: UserFormState = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  password: "",
  role: "SELLER",
  branchCode: "",
  phone: "",
  erpUserCode: "",
};

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrador",
  MANAGER: "Manager",
  SELLER: "Vendedor",
};

const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  ADMIN: "bg-indigo-100 text-indigo-700",
  MANAGER: "bg-sky-100 text-sky-700",
  SELLER: "bg-emerald-100 text-emerald-700",
};

const normalizeBranchCode = (value?: string): string => {
  const raw = (value || "").trim().toUpperCase();
  if (!raw) return "";
  if (/^\d{1,2}$/.test(raw)) return raw.padStart(2, "0");
  return raw;
};

const toTitleCase = (value: string): string =>
  value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");

const mapUserToForm = (user: ManagedUser): UserFormState => ({
  firstName: user.firstName,
  lastName: user.lastName,
  username: user.username,
  email: user.email,
  password: "",
  role: user.role,
  branchCode: normalizeBranchCode(user.branch.code),
  phone: user.phone || "",
  erpUserCode: user.erpUserCode || "",
});

export const UsersPage = () => {
  const actor = useAuthStore((state) => state.user);
  const actorRole = (actor?.role || "").trim().toLowerCase();
  const isAdmin = actorRole === "admin";
  const isManager = actorRole === "manager";

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [openModal, setOpenModal] = useState(false);
  const [openErpUserModal, setOpenErpUserModal] = useState(false);
  const [erpUserTerm, setErpUserTerm] = useState("");
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [lastChangedBy, setLastChangedBy] = useState<Record<string, string>>({});

  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedErpUserTerm = useDebouncedValue(erpUserTerm, 300);
  const actorBranchCode = useMemo(
    () => normalizeBranchCode(actor?.branch?.code || actor?.erpBranchCode),
    [actor?.branch?.code, actor?.erpBranchCode]
  );
  const actorName = `${actor?.name ?? ""} ${actor?.lastname ?? ""}`.trim() || "Usuario";
  const actorLabel = `${isAdmin ? "Administrador" : "Manager"}: ${actorName}`;

  const usersQuery = useUsers({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch.trim() || undefined,
    branchCode: isAdmin && branchFilter !== "ALL" ? branchFilter : undefined,
  });
  const branchesQuery = useBranches(isAdmin);
  const erpUsersQuery = useErpUserSearch(
    debouncedErpUserTerm,
    openErpUserModal && debouncedErpUserTerm.trim().length >= 2
  );

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deactivateMutation = useDeactivateUser();

  const users = usersQuery.data?.items || [];
  const total = usersQuery.data?.total || 0;
  const totalPages = usersQuery.data?.totalPages || 1;
  const branches = branchesQuery.data || [];
  const erpUsers = erpUsersQuery.data || [];

  const savePending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, branchFilter]);

  const canAccess = isAdmin || isManager;
  if (!canAccess) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        Esta vista es solo para usuarios con rol Administrador o Manager.
      </div>
    );
  }

  const resetForm = () => setForm(EMPTY_FORM);

  const closeModal = () => {
    if (savePending) return;
    setOpenModal(false);
    setOpenErpUserModal(false);
    setErpUserTerm("");
    setEditingUser(null);
    resetForm();
  };

  const closeErpUserModal = () => {
    setOpenErpUserModal(false);
    setErpUserTerm("");
  };

  const handlePickErpUser = (erpUser: ErpUserSummary) => {
    setForm((prev) => ({ ...prev, erpUserCode: erpUser.code }));
    closeErpUserModal();
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setForm({
      ...EMPTY_FORM,
      role: isAdmin ? "SELLER" : "SELLER",
      branchCode: actorBranchCode,
    });
    setOpenModal(true);
  };

  const openEditModal = (user: ManagedUser) => {
    setEditingUser(user);
    setForm(mapUserToForm(user));
    setOpenModal(true);
  };

  const validate = (): string | null => {
    if (!form.firstName.trim()) return "El nombre es obligatorio.";
    if (!form.lastName.trim()) return "El apellido es obligatorio.";
    if (!form.username.trim()) return "El usuario es obligatorio.";
    if (!form.email.trim()) return "El correo es obligatorio.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Correo invalido.";
    if (!editingUser && form.password.trim().length < 8) return "La contraseña debe tener al menos 8 caracteres.";

    const branchCodeToUse = isAdmin ? form.branchCode : actorBranchCode;
    if (!normalizeBranchCode(branchCodeToUse)) return "La sucursal es obligatoria.";

    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const error = validate();
    if (error) {
      notifier.warning(error);
      return;
    }

    const roleToUse = editingUser ? form.role : isAdmin ? form.role : "SELLER";
    const branchCodeToUse = normalizeBranchCode(isAdmin ? form.branchCode : actorBranchCode);

    try {
      if (editingUser) {
        await updateMutation.mutateAsync({
          userId: editingUser.id,
          input: {
            firstName: form.firstName,
            lastName: form.lastName,
            username: form.username,
            email: form.email,
            role: roleToUse,
            branchCode: branchCodeToUse,
            phone: form.phone || null,
            erpUserCode: form.erpUserCode || null,
            password: form.password.trim() || undefined,
          },
        });

        setLastChangedBy((state) => ({
          ...state,
          [editingUser.id]: actorLabel,
        }));
        notifier.success(`Usuario actualizado por ${actorLabel}.`);
      } else {
        const created = await createMutation.mutateAsync({
          firstName: form.firstName,
          lastName: form.lastName,
          username: form.username,
          email: form.email,
          password: form.password,
          role: roleToUse,
          branchCode: branchCodeToUse,
          phone: form.phone || null,
          erpUserCode: form.erpUserCode || null,
        });

        setLastChangedBy((state) => ({
          ...state,
          [created.id]: actorLabel,
        }));
        notifier.success(`Usuario creado por ${actorLabel}.`);
      }

      closeModal();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "No se pudo guardar el usuario.";
      notifier.error(message);
    }
  };

  const handleDeactivate = async (user: ManagedUser) => {
    if (!isAdmin) return;

    if (actor?.id === user.id) {
      notifier.warning("No puedes desactivar tu propio usuario.");
      return;
    }

    const confirmed = window.confirm(`¿Desactivar usuario?\n\n${user.fullName}\n${user.email}`);
    if (!confirmed) return;

    try {
      await deactivateMutation.mutateAsync(user.id);
      setLastChangedBy((state) => ({
        ...state,
        [user.id]: actorLabel,
      }));
      notifier.success(`Usuario desactivado por ${actorLabel}.`);

      if (editingUser?.id === user.id) {
        closeModal();
      }
    } catch (deactivateError) {
      const message =
        deactivateError instanceof Error ? deactivateError.message : "No se pudo desactivar el usuario.";
      notifier.error(message);
    }
  };

  const roleOptions: UserRole[] = isAdmin ? ["SELLER", "MANAGER", "ADMIN"] : ["SELLER"];

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-[280px] flex-1 items-center gap-2">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, usuario o correo..."
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-700"
              />
            </div>

            {isAdmin && (
              <select
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                className="w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
              >
                <option value="ALL">Todas las sucursales</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.code}>
                    {branch.code} - {toTitleCase(branch.name)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:from-sky-600 hover:to-indigo-600"
          >
            <UserPlus className="h-4 w-4" />
            Crear usuario
          </button>
        </div>

        <div className="overflow-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Nombre</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Usuario</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Correo</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Rol</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Sucursal</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Estado</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Ultimo cambio por</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {usersQuery.isFetching && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-gray-500">
                    Cargando usuarios...
                  </td>
                </tr>
              )}

              {!usersQuery.isFetching && users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-gray-500">
                    No hay usuarios para mostrar.
                  </td>
                </tr>
              )}

              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-700">{user.fullName}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{user.username}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{user.email}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${ROLE_BADGE_CLASS[user.role]}`}>
                      {ROLE_LABEL[user.role]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {user.branch.code} - {user.branch.name}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {user.isActive ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">Activo</span>
                    ) : (
                      <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700">Desactivado</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">{lastChangedBy[user.id] || "-"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(user)}
                        className="rounded-md border border-gray-300 p-1 text-gray-600 hover:bg-gray-100"
                        aria-label="Editar usuario"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      {isAdmin && user.isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeactivate(user);
                          }}
                          disabled={deactivateMutation.isPending}
                          className="rounded-md border border-rose-300 p-1 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label="Desactivar usuario"
                        >
                          {deactivateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserMinus className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
          <span>
            Pagina {page} de {Math.max(1, totalPages)} - Total {total} usuarios
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded-md border border-gray-300 px-2 py-1 font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-gray-300 px-2 py-1 font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={closeModal}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar modal de usuarios"
          />

          <div className="relative w-full max-w-xl rounded-md border border-gray-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {editingUser ? "Editar usuario" : "Crear usuario"}
                </h2>
                <p className="text-xs text-gray-500">
                  {editingUser ? "Actualiza los datos del usuario." : "Captura los datos del nuevo usuario."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={savePending}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-4 py-3">
              <div className="max-h-[68vh] space-y-3 overflow-y-auto pr-1">
                <Input
                  label="Nombre"
                  value={form.firstName}
                  onChange={(value) => setForm((prev) => ({ ...prev, firstName: value }))}
                />
                <Input
                  label="Apellido"
                  value={form.lastName}
                  onChange={(value) => setForm((prev) => ({ ...prev, lastName: value }))}
                />
                <Input
                  label="Usuario"
                  value={form.username}
                  onChange={(value) => setForm((prev) => ({ ...prev, username: value }))}
                />
                <Input
                  label="Correo"
                  value={form.email}
                  onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
                />
                <Input
                  label={editingUser ? "Contraseña (opcional)" : "Contraseña"}
                  value={form.password}
                  onChange={(value) => setForm((prev) => ({ ...prev, password: value }))}
                  type="password"
                />
                <Input
                  label="Telefono"
                  value={form.phone}
                  onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
                />
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                    Codigo ERP usuario
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      value={form.erpUserCode}
                      readOnly
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
                      placeholder="Selecciona un usuario ERP"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setErpUserTerm(form.erpUserCode || "");
                        setOpenErpUserModal(true);
                      }}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Buscar
                    </button>
                    {form.erpUserCode && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, erpUserCode: "" }))}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Rol</label>
                  <select
                    value={form.role}
                    onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserRole }))}
                    disabled={!isAdmin}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700 disabled:bg-gray-100"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                    {!isAdmin && !roleOptions.includes(form.role) && (
                      <option value={form.role}>{ROLE_LABEL[form.role]}</option>
                    )}
                  </select>
                </div>

                {isAdmin ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Sucursal</label>
                    <select
                      value={form.branchCode}
                      onChange={(event) => setForm((prev) => ({ ...prev, branchCode: event.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
                    >
                      <option value="">Selecciona sucursal</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.code}>
                          {branch.code} - {toTitleCase(branch.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    Sucursal asignada: <strong>{actorBranchCode || "-"}</strong>
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-gray-200 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={savePending}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savePending}
                  className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:from-sky-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {savePending ? "Guardando..." : editingUser ? "Guardar cambios" : "Crear usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {openErpUserModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            onClick={closeErpUserModal}
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar modal de usuarios ERP"
          />

          <div className="relative w-full max-w-3xl rounded-md border border-gray-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Buscar usuario ERP</h2>
                <p className="text-xs text-gray-500">
                  Busca por codigo o descripcion y selecciona para asignar el codigo ERP.
                </p>
              </div>

              <button
                type="button"
                onClick={closeErpUserModal}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  value={erpUserTerm}
                  onChange={(event) => setErpUserTerm(event.target.value)}
                  placeholder="Buscar por codigo o descripcion..."
                  className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-700"
                />
              </div>

              <div className="max-h-[50vh] overflow-auto rounded-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Codigo</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                        Descripcion
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Accion</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 bg-white">
                    {debouncedErpUserTerm.trim().length < 2 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-8 text-center text-sm text-gray-500">
                          Captura al menos 2 caracteres para buscar.
                        </td>
                      </tr>
                    )}

                    {debouncedErpUserTerm.trim().length >= 2 && erpUsersQuery.isFetching && (
                      <tr>
                        <td colSpan={3} className="px-3 py-8 text-center text-sm text-gray-500">
                          Cargando usuarios ERP...
                        </td>
                      </tr>
                    )}

                    {debouncedErpUserTerm.trim().length >= 2 && erpUsersQuery.isError && !erpUsersQuery.isFetching && (
                      <tr>
                        <td colSpan={3} className="px-3 py-8 text-center text-sm text-rose-600">
                          No se pudieron cargar usuarios ERP.
                        </td>
                      </tr>
                    )}

                    {debouncedErpUserTerm.trim().length >= 2 &&
                      !erpUsersQuery.isFetching &&
                      !erpUsersQuery.isError &&
                      erpUsers.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-8 text-center text-sm text-gray-500">
                            Sin resultados.
                          </td>
                        </tr>
                      )}

                    {erpUsers.map((erpUser) => (
                      <tr key={erpUser.code}>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-700">{erpUser.code}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{erpUser.description}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handlePickErpUser(erpUser)}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            Seleccionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password";
}

const Input = ({ label, value, onChange, type = "text" }: InputProps) => {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
      />
    </div>
  );
};
