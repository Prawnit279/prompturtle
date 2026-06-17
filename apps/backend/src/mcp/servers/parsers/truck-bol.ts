import type { ComplianceFlag, TruckBol } from '@prompturtle/shared';

/** Standard 5–10 digit carrier PRO number */
const PRO_NUMBER_FORMAT = /^\d{5,10}$/;

/** Standard 2–4 character SCAC code (uppercase alpha) */
const SCAC_FORMAT = /^[A-Z]{2,4}$/;

export function validateScacCode(scac: string): boolean {
  return SCAC_FORMAT.test(scac);
}

export function validateProNumber(proNumber: string): boolean {
  return PRO_NUMBER_FORMAT.test(proNumber);
}

export function flagTruckBolCompliance(bol: TruckBol): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];

  if (!bol.scacCode || !validateScacCode(bol.scacCode)) {
    flags.push({
      code: 'MISSING_SCAC',
      severity: 'warning',
      message: `SCAC code '${bol.scacCode ?? ''}' is absent or does not match the 2–4 character carrier code format`,
      field: 'scacCode',
    });
  }

  if (bol.proNumber && !validateProNumber(bol.proNumber)) {
    flags.push({
      code: 'INVALID_PRO_NUMBER',
      severity: 'warning',
      message: `PRO number '${bol.proNumber}' does not match expected 5–10 digit format`,
      field: 'proNumber',
    });
  }

  if (!bol.consignee?.address) {
    flags.push({
      code: 'MISSING_DELIVERY_ADDRESS',
      severity: 'warning',
      message: 'Consignee delivery address is absent',
      field: 'consignee.address',
    });
  }

  return flags;
}
