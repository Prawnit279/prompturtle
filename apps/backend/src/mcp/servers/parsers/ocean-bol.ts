import type { OceanBol, ComplianceFlag } from '@prompturtle/shared';

/**
 * UN/LOCODE: 2-char ISO country code + 3-char alphanumeric location identifier.
 * e.g. CNSHA, USLAX, DEHAM
 */
const LOCODE_FORMAT = /^[A-Z]{2}[A-Z0-9]{3}$/;

/**
 * ISO 6346 container number: 4-letter owner/operator prefix code + 6 digits + 1 check digit.
 * e.g. CSCU1234567, MAEU9876543
 */
const CONTAINER_FORMAT = /^[A-Z]{4}\d{7}$/;

export function validateLocode(code: string): boolean {
  return LOCODE_FORMAT.test(code);
}

export function validateContainerNumber(containerNumber: string): boolean {
  return CONTAINER_FORMAT.test(containerNumber);
}

export function flagOceanBolCompliance(bol: OceanBol): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];

  if (!bol.containers || bol.containers.length === 0) {
    flags.push({
      code: 'MISSING_CONTAINER_NUMBERS',
      severity: 'critical',
      message: 'Ocean BOL has no container numbers — at least one container is required',
      field: 'containers',
    });
  } else {
    for (const container of bol.containers) {
      if (!validateContainerNumber(container.containerNumber)) {
        flags.push({
          code: 'CONTAINER_FORMAT_INVALID',
          severity: 'warning',
          message: `Container number '${container.containerNumber}' does not match ISO 6346 format (4 letters + 7 digits)`,
          field: 'containers',
        });
      }
    }
  }

  if (!bol.portOfLoading || !validateLocode(bol.portOfLoading)) {
    flags.push({
      code: 'MISSING_PORT_CODES',
      severity: 'critical',
      message: `Port of loading '${bol.portOfLoading ?? ''}' is absent or not a valid UN/LOCODE`,
      field: 'portOfLoading',
    });
  }

  if (!bol.portOfDischarge || !validateLocode(bol.portOfDischarge)) {
    flags.push({
      code: 'MISSING_PORT_CODES',
      severity: 'critical',
      message: `Port of discharge '${bol.portOfDischarge ?? ''}' is absent or not a valid UN/LOCODE`,
      field: 'portOfDischarge',
    });
  }

  if (bol.hblNumber && !bol.mblNumber) {
    flags.push({
      code: 'HBL_WITHOUT_MBL',
      severity: 'warning',
      message: 'House BOL is present but Master BOL (MBL) number is absent',
      field: 'mblNumber',
    });
  }

  // Critical — triggers customs_flag guardrail
  if (bol.customsBroker && !bol.customsBroker.verified) {
    flags.push({
      code: 'CUSTOMS_BROKER_UNVERIFIED',
      severity: 'critical',
      message:
        'Customs broker is present but has not been verified — shipment clearance may be blocked',
      field: 'customsBroker',
    });
  }

  return flags;
}
