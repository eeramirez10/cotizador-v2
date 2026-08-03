import type { ClientInput } from "../../clients/types/client.types";
import type { CustomerContactInput } from "../../clients/types/customer-contact.types";
import type { SaveSupplierContactInput, SaveSupplierInput } from "../../procurement/services/purchase-requisitions.service";
import type { ExtractedPartyContact, ExtractedPartyData } from "../types/party-data.types";

const valueOr = (current: string | null | undefined, detected: string | null | undefined): string =>
  current?.trim() ? current : detected?.trim() || "";

const contactSignature = (email?: string | null, phone?: string | null): string =>
  `${email?.trim().toLowerCase() || ""}|${phone?.replace(/\D/g, "") || ""}`;

const customerContact = (contact: ExtractedPartyContact, fallbackName: string): CustomerContactInput => ({
  name: contact.name || fallbackName || "Contacto principal",
  jobTitle: contact.position || "",
  label: contact.label || "",
  email: contact.email || "",
  phone: contact.landlinePhone || "",
  phoneExtension: contact.extension || "",
  mobile: contact.whatsappPhone || "",
  isPrimary: false,
});

const mergeCustomerContacts = (
  current: CustomerContactInput[],
  detected: ExtractedPartyContact[],
  fallbackName: string,
): CustomerContactInput[] => {
  const meaningful = current.filter((contact) =>
    contact.name.trim() || contact.email?.trim() || contact.phone?.trim() || contact.mobile?.trim());
  const signatures = new Set(meaningful.map((contact) => contactSignature(contact.email, contact.mobile || contact.phone)));
  const additions = detected
    .map((contact) => customerContact(contact, fallbackName))
    .filter((contact) => {
      const signature = contactSignature(contact.email, contact.mobile || contact.phone);
      if (signature !== "|" && signatures.has(signature)) return false;
      signatures.add(signature);
      return true;
    });
  const contacts = [...meaningful, ...additions];
  if (contacts.length === 0) return current;
  if (!contacts.some((contact) => contact.isPrimary)) contacts[0] = { ...contacts[0], isPrimary: true };
  return contacts;
};

export const mergePartyIntoCustomer = (current: ClientInput, party: ExtractedPartyData): ClientInput => {
  const contactName = party.contacts.find((contact) => contact.name)?.name || "";
  const split = contactName.trim().split(/\s+/).filter(Boolean);
  const firstName = party.firstName || split[0] || party.businessName || "";
  const lastName = party.lastName || (split.length > 1 ? split.slice(1).join(" ") : party.businessName ? "." : "");
  const contacts = mergeCustomerContacts(current.contacts || [], party.contacts, contactName || party.businessName || firstName);
  const primary = contacts.find((contact) => contact.isPrimary) || contacts[0];
  return {
    ...current,
    name: valueOr(current.name, firstName),
    lastname: valueOr(current.lastname, lastName),
    companyName: valueOr(current.companyName, party.businessName),
    rfc: valueOr(current.rfc, party.taxId).toUpperCase(),
    taxRegime: valueOr(current.taxRegime, party.taxRegime),
    billingStreet: valueOr(current.billingStreet, party.address.street),
    billingExteriorNumber: valueOr(current.billingExteriorNumber, party.address.exteriorNumber),
    billingInteriorNumber: valueOr(current.billingInteriorNumber, party.address.interiorNumber),
    billingNeighborhood: valueOr(current.billingNeighborhood, party.address.neighborhood),
    billingCity: valueOr(current.billingCity, party.address.city),
    billingState: valueOr(current.billingState, party.address.state),
    billingPostalCode: valueOr(current.billingPostalCode, party.address.postalCode),
    billingCountry: current.billingCountry?.trim() && current.billingCountry.trim().toUpperCase() !== "MÉXICO"
      ? current.billingCountry
      : party.address.country || current.billingCountry || "MÉXICO",
    notes: valueOr(current.notes, party.notes),
    email: valueOr(current.email, primary?.email),
    phone: valueOr(current.phone, primary?.phone),
    whatsappPhone: valueOr(current.whatsappPhone, primary?.mobile),
    contacts,
  };
};

export const partyToCustomerInput = (party: ExtractedPartyData): ClientInput => mergePartyIntoCustomer({
  name: "",
  lastname: "",
  companyName: "",
  rfc: "",
  email: "",
  phone: "",
  whatsappPhone: "",
  billingCountry: "MÉXICO",
  contacts: [],
}, party);

const supplierContacts = (contacts: ExtractedPartyContact[]): SaveSupplierContactInput[] => contacts.flatMap((contact, index) => {
  const key = `ai-${Date.now().toString(36)}-${index + 1}`;
  const common = {
    contactKey: key,
    contactName: contact.name,
    contactPosition: contact.position,
    label: contact.label,
    isPrimary: index === 0,
  };
  return [
    ...(contact.email ? [{ ...common, channel: "EMAIL" as const, value: contact.email, phoneKind: null, extension: null, isWhatsApp: false }] : []),
    ...(contact.landlinePhone ? [{ ...common, channel: "PHONE" as const, value: contact.landlinePhone, phoneKind: "LANDLINE" as const, extension: contact.extension, isWhatsApp: false }] : []),
    ...(contact.whatsappPhone ? [{ ...common, channel: "PHONE" as const, value: contact.whatsappPhone, phoneKind: "MOBILE" as const, extension: null, isWhatsApp: true }] : []),
  ];
});

export const partyToSupplierInput = (party: ExtractedPartyData): Partial<SaveSupplierInput> => {
  const contacts = supplierContacts(party.contacts);
  const primaryEmail = contacts.find((contact) => contact.channel === "EMAIL")?.value || null;
  const primaryPhone = contacts.find((contact) => contact.channel === "PHONE")?.value || null;
  const contact = party.contacts.find((item) => item.name) || party.contacts[0];
  return {
    name: party.businessName || [party.firstName, party.lastName].filter(Boolean).join(" "),
    taxId: party.taxId,
    scope: party.scope || (party.address.country && !/mexico|méxico/i.test(party.address.country) ? "INTERNATIONAL" : "NATIONAL"),
    state: party.address.state,
    country: party.address.country || "MÉXICO",
    creditTerms: party.creditTerms,
    currency: party.currency,
    contactName: contact?.name || null,
    contactPosition: contact?.position || null,
    email: primaryEmail,
    phone: primaryPhone,
    contacts,
    notes: party.notes,
  };
};
