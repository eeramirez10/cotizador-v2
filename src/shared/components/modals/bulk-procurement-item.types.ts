import type { TechnicalDataFormValue } from "../procurement/technical-data-editor";
import type { QuoteCurrency } from "../../../store/quote/manual-quote.store";

export interface BulkProcurementItemForm extends TechnicalDataFormValue {
  technicalRequiresReview: boolean;
  supplierProductCode: string;
  supplierDescription: string;
  unitCost: string;
  currency: QuoteCurrency;
  exchangeRate: string;
  brand: string;
  origin: string;
  deliveryTime: string;
  validUntil: string;
  externalReference: string;
  notes: string;
  originRestrictions: string[];
}
