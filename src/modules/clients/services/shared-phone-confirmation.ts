import { isAxiosError } from "axios";

type ConfirmationPresenter = (phones: string[]) => Promise<boolean>;

let presenter: ConfirmationPresenter | null = null;

export class SharedPhoneConfirmationCancelled extends Error {
  constructor() {
    super("Se canceló el uso del número compartido.");
  }
}

export const registerSharedPhoneConfirmation = (next: ConfirmationPresenter): (() => void) => {
  presenter = next;
  return () => {
    if (presenter === next) presenter = null;
  };
};

export const withSharedPhoneConfirmation = async <T>(
  save: (allowSharedPhone: boolean) => Promise<T>,
): Promise<T> => {
  try {
    return await save(false);
  } catch (error) {
    if (!isAxiosError(error) || error.response?.status !== 409
      || error.response.data?.code !== "SHARED_CUSTOMER_PHONE") throw error;

    const phones = Array.isArray(error.response.data.phones)
      ? error.response.data.phones.filter((phone: unknown): phone is string => typeof phone === "string")
      : [];
    if (!presenter) throw new Error("No se pudo abrir la confirmación del número compartido.");
    const confirmed = await presenter(phones);
    if (!confirmed) throw new SharedPhoneConfirmationCancelled();
    return save(true);
  }
};
