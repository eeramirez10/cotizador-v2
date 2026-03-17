import { create } from "zustand";
import { CustomersService } from "../../modules/clients/services/customers.service";
import type { Client, ClientInput } from "../../modules/clients/types/client.types";

interface ClientsState {
  clients: Client[];
  loading: boolean;
  loadClients: (params?: { search?: string }) => Promise<void>;
  addClient: (input: ClientInput) => Promise<Client>;
  updateClient: (clientId: string, input: ClientInput) => Promise<Client>;
  deleteClient: (clientId: string) => Promise<void>;
  getById: (clientId: string) => Client | undefined;
}

export const useClientsStore = create<ClientsState>((set, get) => ({
  clients: [],
  loading: false,

  loadClients: async (params) => {
    set({ loading: true });

    try {
      const clients = await CustomersService.list({
        search: params?.search,
        page: 1,
        pageSize: 10,
        source: "LOCAL",
      });
      set({ clients, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  addClient: async (input) => {
    const created = await CustomersService.create(input);
    set((state) => ({
      clients: [created, ...state.clients.filter((client) => client.id !== created.id)],
    }));
    return created;
  },

  updateClient: async (clientId, input) => {
    const updated = await CustomersService.update(clientId, input);
    set((state) => ({
      clients: state.clients.map((client) => (client.id === clientId ? updated : client)),
    }));
    return updated;
  },

  deleteClient: async (clientId) => {
    await CustomersService.remove(clientId);
    set((state) => ({
      clients: state.clients.filter((client) => client.id !== clientId),
    }));
  },

  getById: (clientId) => get().clients.find((client) => client.id === clientId),
}));
