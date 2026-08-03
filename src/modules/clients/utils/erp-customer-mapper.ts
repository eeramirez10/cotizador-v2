import type { ClientInput } from "../types/client.types";
import type { ErpCustomer } from "../types/erp-customer.types";

const splitDisplayName = (displayName: string): { name: string; lastname: string } => {
  const safe = displayName.trim();
  if (!safe) return { name: "", lastname: "." };
  const [first, ...rest] = safe.split(/\s+/);
  return { name: first, lastname: rest.join(" ") || "." };
};

export const erpCustomerHasDeliveryChannel = (customer: ErpCustomer): boolean =>
  Boolean(customer.email.trim() || customer.whatsapp.trim());

export const erpCustomerToClientInput = (
  customer: ErpCustomer,
  contactOverride?: { name: string; email: string; whatsapp: string }
): ClientInput => {
  const split = splitDisplayName(customer.displayName);
  const contactName = contactOverride?.name.trim() || customer.displayName;
  const email = contactOverride?.email.trim().toLowerCase() || customer.email.trim().toLowerCase();
  const whatsapp = contactOverride?.whatsapp.trim() || customer.whatsapp.trim();
  const phone = customer.phone.trim();

  return {
    source: "ERP",
    externalId: customer.externalId,
    externalSystem: "ERP",
    code: customer.code || null,
    name: customer.firstName || split.name,
    lastname: customer.lastName || split.lastname,
    whatsappPhone: whatsapp,
    email,
    rfc: customer.taxId || "",
    companyName: customer.companyName || customer.displayName,
    phone,
    billingStreet: customer.billingStreet || "",
    billingCity: customer.billingCity || "",
    billingState: customer.billingState || "",
    billingPostalCode: customer.billingPostalCode || "",
    billingCountry: customer.billingCountry || "MÉXICO",
    contacts: email || whatsapp || phone
      ? [{
          name: contactName,
          jobTitle: "",
          label: "Contacto ERP",
          email,
          phone,
          phoneExtension: "",
          mobile: whatsapp,
          isPrimary: true,
        }]
      : undefined,
  };
};
