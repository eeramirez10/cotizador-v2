import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Client, ClientInput } from "../../modules/clients/types/client.types";

interface ClientsState {
  clients: Client[];
  seedClients: () => void;
  addClient: (input: ClientInput) => void;
  updateClient: (clientId: string, input: ClientInput) => void;
  deleteClient: (clientId: string) => void;
  getById: (clientId: string) => Client | undefined;
}

const nowIso = () => new Date().toISOString();

const defaultClients = (): Client[] => [
  {
    id: "cl_001",
    name: "Juan",
    lastname: "Garza",
    whatsappPhone: "8112345678",
    email: "juan.garza@cliente.com",
    rfc: "GAAJ850101AB1",
    companyName: "Constructora del Norte SA de CV",
    phone: "8112345678",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: "cl_002",
    name: "Ana",
    lastname: "Martinez",
    whatsappPhone: "8187654321",
    email: "ana.martinez@cliente.com",
    rfc: "MARA900220CD2",
    companyName: "Aceros Industriales Monterrey",
    phone: "8187654321",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

export const useClientsStore = create<ClientsState>()(
  persist(
    (set, get) => ({
      clients: [],

      seedClients: () =>
        set((state) => {
          if (state.clients.length > 0) return state;
          return { clients: defaultClients() };
        }),

      addClient: (input) =>
        set((state) => ({
          clients: [
            {
              id: `cl_${Math.random().toString(36).slice(2, 10)}`,
              name: input.name.trim(),
              lastname: input.lastname.trim(),
              whatsappPhone: input.whatsappPhone.trim(),
              email: input.email.trim().toLowerCase(),
              rfc: input.rfc.trim().toUpperCase(),
              companyName: input.companyName.trim(),
              phone: input.phone?.trim() ?? "",
              createdAt: nowIso(),
              updatedAt: nowIso(),
            },
            ...state.clients,
          ],
        })),

      updateClient: (clientId, input) =>
        set((state) => ({
          clients: state.clients.map((client) => {
            if (client.id !== clientId) return client;

            return {
              ...client,
              name: input.name.trim(),
              lastname: input.lastname.trim(),
              whatsappPhone: input.whatsappPhone.trim(),
              email: input.email.trim().toLowerCase(),
              rfc: input.rfc.trim().toUpperCase(),
              companyName: input.companyName.trim(),
              phone: input.phone?.trim() ?? "",
              updatedAt: nowIso(),
            };
          }),
        })),

      deleteClient: (clientId) =>
        set((state) => ({
          clients: state.clients.filter((client) => client.id !== clientId),
        })),

      getById: (clientId) => get().clients.find((client) => client.id === clientId),
    }),
    {
      name: "cotizador-v2-clients",
    }
  )
);
