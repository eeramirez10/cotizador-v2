import type { Client } from "../types/client.types";
import type { CustomerContact } from "../types/customer-contact.types";

export const clientWithSelectedContact = (client: Client, contact?: CustomerContact): Client => {
  if (!contact) return client;

  return {
    ...client,
    name: contact.name,
    lastname: "",
    email: contact.email || "",
    phone: contact.phone || "",
    whatsappPhone: contact.mobile || "",
    selectedContactId: contact.id,
    selectedContactName: contact.name,
    contacts: (client.contacts || []).map((entry) => ({
      ...entry,
      isPrimary: entry.id === contact.id,
    })),
  };
};
