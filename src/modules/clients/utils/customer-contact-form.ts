import type { CustomerContactInput } from "../types/customer-contact.types";

export const emptyCustomerContact = (isPrimary = false): CustomerContactInput => ({
  name: "",
  jobTitle: "",
  label: "",
  email: "",
  phone: "",
  phoneExtension: "",
  mobile: "",
  isPrimary,
});
