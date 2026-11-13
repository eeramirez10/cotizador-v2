interface DraftReference {
  customerReference: string;
  detectedCustomerReference: string | null;
}

export function applyExtractedCustomerReference(
  current: DraftReference,
  value?: string | null,
): DraftReference {
  const detected = typeof value === "string" ? value.trim() : "";
  const hasControl = Array.from(detected).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
  if (!detected || detected.length > 120 || hasControl) {
    return { customerReference: current.customerReference, detectedCustomerReference: current.detectedCustomerReference };
  }
  if (current.customerReference.trim() === detected) {
    return { customerReference: current.customerReference, detectedCustomerReference: current.detectedCustomerReference };
  }
  return {
    customerReference: current.customerReference.trim() ? current.customerReference : detected,
    detectedCustomerReference: detected,
  };
}
