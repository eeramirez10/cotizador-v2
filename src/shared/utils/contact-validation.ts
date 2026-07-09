export const isValidEmail = (value: string): boolean => {
  return /^\S+@\S+\.\S+$/.test(value.trim());
};

export const isValidPhoneNumber = (value: string): boolean => {
  const trimmed = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return false;

  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
};
