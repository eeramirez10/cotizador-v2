import { Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { type ManagedUser, UsersService } from "../../../modules/users/services/users.service";

interface SelectQuoteProviderModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (user: ManagedUser) => void;
}

export const SelectQuoteProviderModal = ({ open, onClose, onSelect }: SelectQuoteProviderModalProps) => {
  const [term, setTerm] = useState("");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedTerm = useDebouncedValue(term, 300);

  useEffect(() => {
    if (!open) {
      setTerm("");
      setUsers([]);
      setError(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await UsersService.listActiveQuoteProviders({
          page: 1,
          pageSize: 20,
          search: debouncedTerm.trim() || undefined,
        });
        if (!cancelled) setUsers(result.items);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los usuarios.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [debouncedTerm, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Proporcionada por</h3>
            <p className="mt-1 text-sm text-gray-500">Busca un usuario activo de cualquier sucursal.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-gray-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar por nombre, usuario o correo..."
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="mt-4 max-h-80 overflow-y-auto rounded-md border border-gray-200">
          {loading && <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Buscando usuarios...</div>}
          {!loading && error && <p className="p-4 text-sm text-rose-700">{error}</p>}
          {!loading && !error && users.length === 0 && <p className="p-4 text-sm text-gray-500">No se encontraron usuarios activos.</p>}
          {!loading && !error && users.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelect(user)}
              className="flex w-full items-center justify-between gap-4 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-indigo-50"
            >
              <span>
                <span className="block text-sm font-semibold text-gray-800">{user.fullName}</span>
                <span className="block text-xs text-gray-500">@{user.username} · {user.role}</span>
              </span>
              <span className="text-right text-xs text-gray-600">{user.branch.name}<br />{user.branch.code}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
