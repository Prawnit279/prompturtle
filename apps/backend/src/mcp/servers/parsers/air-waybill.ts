import type { AirWaybill, ComplianceFlag } from '@prompturtle/shared';

/** IATA AWB number: 3-digit prefix, dash, 8 digits (e.g. 123-12345678) */
const AWB_FORMAT = /^\d{3}-\d{8}$/;

/** 3-character uppercase IATA airport code */
const AIRPORT_CODE_FORMAT = /^[A-Z]{3}$/;

/** Keywords that indicate potential dangerous goods */
const DANGEROUS_KEYWORDS =
  /\b(battery|lithium|flammable|aerosol|explosive|radioactive|corrosive|toxic|oxidizer|peroxide|gas)\b/i;

export function validateAwbFormat(awbNumber: string): boolean {
  return AWB_FORMAT.test(awbNumber);
}

export function validateAirportCode(code: string): boolean {
  return AIRPORT_CODE_FORMAT.test(code);
}

export function flagAirWaybillCompliance(bol: AirWaybill): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];

  if (!validateAwbFormat(bol.awbNumber)) {
    flags.push({
      code: 'INVALID_AWB_NUMBER',
      severity: 'critical',
      message: `AWB number '${bol.awbNumber}' does not match IATA 11-digit format (XXX-XXXXXXXX)`,
      field: 'awbNumber',
    });
  }

  if (!validateAirportCode(bol.originAirport)) {
    flags.push({
      code: 'INVALID_AIRPORT_CODE',
      severity: 'warning',
      message: `Origin airport code '${bol.originAirport}' is not a valid 3-character IATA code`,
      field: 'originAirport',
    });
  }

  if (!validateAirportCode(bol.destinationAirport)) {
    flags.push({
      code: 'INVALID_AIRPORT_CODE',
      severity: 'warning',
      message: `Destination airport code '${bol.destinationAirport}' is not a valid 3-character IATA code`,
      field: 'destinationAirport',
    });
  }

  if (bol.pieces > 1 && !bol.hawbNumber) {
    flags.push({
      code: 'MISSING_HAWB',
      severity: 'warning',
      message: 'Multi-piece AWB has no House AWB (HAWB) number',
      field: 'hawbNumber',
    });
  }

  if (DANGEROUS_KEYWORDS.test(bol.commodity)) {
    const hasDgr = bol.specialHandling?.includes('DGR') ?? false;
    if (!hasDgr) {
      flags.push({
        code: 'DANGEROUS_GOODS_UNDECLARED',
        severity: 'critical',
        message:
          'Commodity description contains potential dangerous goods keywords but DGR special handling code is absent',
        field: 'specialHandling',
      });
    }
  }

  if (bol.chargeableWeightKg > bol.grossWeightKg * 1.1) {
    flags.push({
      code: 'WEIGHT_DISCREPANCY',
      severity: 'warning',
      message: `Chargeable weight (${bol.chargeableWeightKg} kg) exceeds gross weight (${bol.grossWeightKg} kg) by more than 10%`,
      field: 'chargeableWeightKg',
    });
  }

  return flags;
}
