export function validateNIN(nin: string): { valid: boolean; wilayaCode?: number } {
  if (!/^\d{18}$/.test(nin)) {
    return { valid: false };
  }

  const yearPart = parseInt(nin.substring(0, 4));
  const monthPart = parseInt(nin.substring(4, 6));
  const dayPart = parseInt(nin.substring(6, 8));
  const wilayaCode = parseInt(nin.substring(8, 10));

  if (yearPart < 1920 || yearPart > 2010) return { valid: false };
  if (monthPart < 1 || monthPart > 12) return { valid: false };
  if (dayPart < 1 || dayPart > 31) return { valid: false };
  if (wilayaCode < 1 || wilayaCode > 58) return { valid: false };

  return { valid: true, wilayaCode };
}

export function getNINPartial(nin: string): string {
  return nin.substring(0, 10);
}
