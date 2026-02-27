import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Client, ClientActor, ClientInput } from "../../modules/clients/types/client.types";

interface ClientsState {
  clients: Client[];
  seedClients: () => void;
  addClient: (input: ClientInput, actor: ClientActor) => void;
  updateClient: (clientId: string, input: ClientInput, actor: ClientActor) => void;
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
    createdByUserId: "system",
    createdByName: "Sistema",
    updatedByUserId: "system",
    updatedByName: "Sistema",
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
    createdByUserId: "system",
    createdByName: "Sistema",
    updatedByUserId: "system",
    updatedByName: "Sistema",
  },
];

const normalizeClient = (client: Client): Client => ({
  ...client,
  createdByUserId: client.createdByUserId ?? "system",
  createdByName: client.createdByName?.trim() || "Sistema",
  updatedByUserId: client.updatedByUserId ?? client.createdByUserId ?? "system",
  updatedByName: client.updatedByName?.trim() || client.createdByName?.trim() || "Sistema",
});

export const useClientsStore = create<ClientsState>()(
  persist(
    (set, get) => ({
      clients: [],

      seedClients: () =>
        set((state) => {
          if (state.clients.length > 0) {
            return { clients: state.clients.map((client) => normalizeClient(client)) };
          }
          return { clients: defaultClients() };
        }),

      addClient: (input, actor) =>
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
              createdByUserId: actor.userId,
              createdByName: actor.fullName,
              updatedByUserId: actor.userId,
              updatedByName: actor.fullName,
            },
            ...state.clients,
          ],
        })),

      updateClient: (clientId, input, actor) =>
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
              updatedByUserId: actor.userId,
              updatedByName: actor.fullName,
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
