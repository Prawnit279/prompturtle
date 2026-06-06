import { describe, expect, it } from 'vitest';

import type { AirWaybill, OceanBol, TruckBol } from '@prompturtle/shared';
import {
  flagAirWaybillCompliance,
  validateAirportCode,
  validateAwbFormat,
} from '../parsers/air-waybill.js';
import {
  flagOceanBolCompliance,
  validateContainerNumber,
  validateLocode,
} from '../parsers/ocean-bol.js';
import {
  flagTruckBolCompliance,
  validateProNumber,
  validateScacCode,
} from '../parsers/truck-bol.js';

// ---- Helpers ----

function makeAwb(overrides: Partial<AirWaybill> = {}): AirWaybill {
  return {
    bolType:            'AIR_WAYBILL',
    awbNumber:          '020-12345678',
    airlineCode:        'LH',
    originAirport:      'FRA',
    destinationAirport: 'JFK',
    pieces:             1,
    grossWeightKg:      100,
    chargeableWeightKg: 100,
    commodity:          'Electronics',
    freightCharges:     'prepaid',
    shipper:            { name: 'Shipper GmbH', address: 'Frankfurt' },
    consignee:          { name: 'Consignee Inc', address: 'New York' },
    ...overrides,
  };
}

function makeOceanBol(overrides: Partial<OceanBol> = {}): OceanBol {
  return {
    bolType:         'OCEAN_BOL',
    bolNumber:       'OBL-001',
    vesselName:      'MAERSK EVER GIVEN',
    voyageNumber:    'V001W',
    portOfLoading:   'CNSHA',
    portOfDischarge: 'USLAX',
    containers: [
      { containerNumber: 'CSCU1234567', type: '20GP', weightKg: 10_000 },
    ],
    commodity:     'General Cargo',
    grossWeightKg: 10_000,
    freightTerms:  'prepaid',
    shipper:       { name: 'Shipper Co', address: 'Shanghai' },
    consignee:     { name: 'Consignee Co', address: 'Los Angeles' },
    ...overrides,
  };
}

// ================================================================
// AWB format validators
// ================================================================

describe('validateAwbFormat', () => {
  it('accepts valid IATA format XXX-XXXXXXXX', () => {
    expect(validateAwbFormat('020-12345678')).toBe(true);
    expect(validateAwbFormat('125-99999999')).toBe(true);
  });

  it('rejects missing dash', () => {
    expect(validateAwbFormat('02012345678')).toBe(false);
  });

  it('rejects wrong prefix length', () => {
    expect(validateAwbFormat('20-12345678')).toBe(false);
    expect(validateAwbFormat('0200-12345678')).toBe(false);
  });

  it('rejects wrong suffix length', () => {
    expect(validateAwbFormat('020-1234567')).toBe(false);
    expect(validateAwbFormat('020-123456789')).toBe(false);
  });

  it('rejects letters in numeric sections', () => {
    expect(validateAwbFormat('LH-12345678')).toBe(false);
  });
});

describe('validateAirportCode', () => {
  it('accepts valid 3-letter IATA codes', () => {
    expect(validateAirportCode('FRA')).toBe(true);
    expect(validateAirportCode('JFK')).toBe(true);
    expect(validateAirportCode('SYD')).toBe(true);
  });

  it('rejects codes with wrong length', () => {
    expect(validateAirportCode('FR')).toBe(false);
    expect(validateAirportCode('FRAK')).toBe(false);
  });

  it('rejects lowercase codes', () => {
    expect(validateAirportCode('fra')).toBe(false);
    expect(validateAirportCode('Fra')).toBe(false);
  });
});

// ================================================================
// AWB compliance flags
// ================================================================

describe('flagAirWaybillCompliance — valid AWB', () => {
  it('returns no flags for a fully valid AWB', () => {
    const flags = flagAirWaybillCompliance(makeAwb());
    expect(flags).toHaveLength(0);
  });
});

describe('flagAirWaybillCompliance — INVALID_AWB_NUMBER', () => {
  it('flags when awbNumber is not IATA format', () => {
    const flags = flagAirWaybillCompliance(makeAwb({ awbNumber: 'LH-BADNUMBER' }));
    expect(flags.some((f) => f.code === 'INVALID_AWB_NUMBER')).toBe(true);
    expect(flags.find((f) => f.code === 'INVALID_AWB_NUMBER')?.severity).toBe('critical');
  });
});

describe('flagAirWaybillCompliance — INVALID_AIRPORT_CODE', () => {
  it('flags when originAirport is invalid', () => {
    const flags = flagAirWaybillCompliance(makeAwb({ originAirport: 'FRANKFURT' }));
    const airportFlags = flags.filter((f) => f.code === 'INVALID_AIRPORT_CODE');
    expect(airportFlags.length).toBeGreaterThan(0);
    expect(airportFlags[0]?.field).toBe('originAirport');
  });

  it('flags when destinationAirport is invalid', () => {
    const flags = flagAirWaybillCompliance(makeAwb({ destinationAirport: 'ny' }));
    const airportFlags = flags.filter((f) => f.code === 'INVALID_AIRPORT_CODE');
    expect(airportFlags.some((f) => f.field === 'destinationAirport')).toBe(true);
  });
});

describe('flagAirWaybillCompliance — MISSING_HAWB', () => {
  it('flags multi-piece AWB with no HAWB', () => {
    const { hawbNumber: _h, ...base } = makeAwb();
    const flags = flagAirWaybillCompliance({ ...base, pieces: 5 });
    expect(flags.some((f) => f.code === 'MISSING_HAWB')).toBe(true);
  });

  it('does not flag single-piece AWB without HAWB', () => {
    const { hawbNumber: _h, ...base } = makeAwb();
    const flags = flagAirWaybillCompliance({ ...base, pieces: 1 });
    expect(flags.some((f) => f.code === 'MISSING_HAWB')).toBe(false);
  });

  it('does not flag multi-piece AWB that has a HAWB', () => {
    const flags = flagAirWaybillCompliance(makeAwb({ pieces: 10, hawbNumber: 'HAWB-001' }));
    expect(flags.some((f) => f.code === 'MISSING_HAWB')).toBe(false);
  });
});

describe('flagAirWaybillCompliance — DANGEROUS_GOODS_UNDECLARED', () => {
  it('flags lithium battery commodity with no DGR code', () => {
    const flags = flagAirWaybillCompliance(
      makeAwb({ commodity: 'Lithium battery packs', specialHandling: [] }),
    );
    expect(flags.some((f) => f.code === 'DANGEROUS_GOODS_UNDECLARED')).toBe(true);
    expect(flags.find((f) => f.code === 'DANGEROUS_GOODS_UNDECLARED')?.severity).toBe('critical');
  });

  it('does not flag dangerous commodity when DGR is declared', () => {
    const flags = flagAirWaybillCompliance(
      makeAwb({ commodity: 'Lithium battery packs', specialHandling: ['DGR'] }),
    );
    expect(flags.some((f) => f.code === 'DANGEROUS_GOODS_UNDECLARED')).toBe(false);
  });

  it('does not flag non-dangerous commodity', () => {
    const flags = flagAirWaybillCompliance(
      makeAwb({ commodity: 'Clothing and apparel', specialHandling: [] }),
    );
    expect(flags.some((f) => f.code === 'DANGEROUS_GOODS_UNDECLARED')).toBe(false);
  });

  it('detects flammable keyword', () => {
    const { specialHandling: _sh, ...base } = makeAwb();
    const flags = flagAirWaybillCompliance({ ...base, commodity: 'Flammable paint thinner' });
    expect(flags.some((f) => f.code === 'DANGEROUS_GOODS_UNDECLARED')).toBe(true);
  });
});

describe('flagAirWaybillCompliance — WEIGHT_DISCREPANCY', () => {
  it('flags when chargeableWeight > grossWeight * 1.1', () => {
    const flags = flagAirWaybillCompliance(
      makeAwb({ grossWeightKg: 100, chargeableWeightKg: 120 }),
    );
    expect(flags.some((f) => f.code === 'WEIGHT_DISCREPANCY')).toBe(true);
  });

  it('does not flag when chargeableWeight is within 10% tolerance', () => {
    const flags = flagAirWaybillCompliance(
      makeAwb({ grossWeightKg: 100, chargeableWeightKg: 110 }),
    );
    expect(flags.some((f) => f.code === 'WEIGHT_DISCREPANCY')).toBe(false);
  });
});

// ================================================================
// Ocean BOL format validators
// ================================================================

describe('validateLocode', () => {
  it('accepts valid UN/LOCODE', () => {
    expect(validateLocode('CNSHA')).toBe(true);
    expect(validateLocode('USLAX')).toBe(true);
    expect(validateLocode('DEHAM')).toBe(true);
  });

  it('rejects codes with wrong length', () => {
    expect(validateLocode('SHA')).toBe(false);
    expect(validateLocode('CNSHANGH')).toBe(false);
  });

  it('rejects lowercase codes', () => {
    expect(validateLocode('cnsha')).toBe(false);
  });
});

describe('validateContainerNumber', () => {
  it('accepts valid ISO 6346 container numbers', () => {
    expect(validateContainerNumber('CSCU1234567')).toBe(true);
    expect(validateContainerNumber('MAEU9876543')).toBe(true);
  });

  it('rejects containers with wrong prefix length', () => {
    expect(validateContainerNumber('CSC1234567')).toBe(false);
    expect(validateContainerNumber('CSCUX1234567')).toBe(false);
  });

  it('rejects containers with wrong digit count', () => {
    expect(validateContainerNumber('CSCU123456')).toBe(false);
    expect(validateContainerNumber('CSCU12345678')).toBe(false);
  });

  it('rejects lowercase prefix', () => {
    expect(validateContainerNumber('cscu1234567')).toBe(false);
  });
});

// ================================================================
// Ocean BOL compliance flags
// ================================================================

describe('flagOceanBolCompliance — valid OBL', () => {
  it('returns no flags for a fully valid Ocean BOL', () => {
    const flags = flagOceanBolCompliance(makeOceanBol());
    expect(flags).toHaveLength(0);
  });
});

describe('flagOceanBolCompliance — MISSING_CONTAINER_NUMBERS', () => {
  it('flags when containers array is empty', () => {
    const flags = flagOceanBolCompliance(makeOceanBol({ containers: [] }));
    expect(flags.some((f) => f.code === 'MISSING_CONTAINER_NUMBERS')).toBe(true);
    expect(flags.find((f) => f.code === 'MISSING_CONTAINER_NUMBERS')?.severity).toBe('critical');
  });
});

describe('flagOceanBolCompliance — CONTAINER_FORMAT_INVALID', () => {
  it('flags container with invalid ISO 6346 number', () => {
    const flags = flagOceanBolCompliance(
      makeOceanBol({ containers: [{ containerNumber: 'INVALID-001', type: '20GP', weightKg: 5_000 }] }),
    );
    expect(flags.some((f) => f.code === 'CONTAINER_FORMAT_INVALID')).toBe(true);
  });

  it('does not flag a valid container number', () => {
    const flags = flagOceanBolCompliance(
      makeOceanBol({ containers: [{ containerNumber: 'CSCU1234567', type: '20GP', weightKg: 5_000 }] }),
    );
    expect(flags.some((f) => f.code === 'CONTAINER_FORMAT_INVALID')).toBe(false);
  });
});

describe('flagOceanBolCompliance — MISSING_PORT_CODES', () => {
  it('flags missing portOfLoading', () => {
    const flags = flagOceanBolCompliance(makeOceanBol({ portOfLoading: '' }));
    expect(flags.some((f) => f.code === 'MISSING_PORT_CODES' && f.field === 'portOfLoading')).toBe(true);
  });

  it('flags invalid portOfDischarge LOCODE', () => {
    const flags = flagOceanBolCompliance(makeOceanBol({ portOfDischarge: 'LosAngeles' }));
    expect(flags.some((f) => f.code === 'MISSING_PORT_CODES' && f.field === 'portOfDischarge')).toBe(true);
  });
});

describe('flagOceanBolCompliance — HBL_WITHOUT_MBL', () => {
  it('flags HBL present without MBL', () => {
    const { mblNumber: _m, ...base } = makeOceanBol();
    const flags = flagOceanBolCompliance({ ...base, hblNumber: 'HBL-001' });
    expect(flags.some((f) => f.code === 'HBL_WITHOUT_MBL')).toBe(true);
  });

  it('does not flag when both HBL and MBL are present', () => {
    const flags = flagOceanBolCompliance(makeOceanBol({ hblNumber: 'HBL-001', mblNumber: 'MBL-001' }));
    expect(flags.some((f) => f.code === 'HBL_WITHOUT_MBL')).toBe(false);
  });

  it('does not flag when neither HBL nor MBL is set', () => {
    const { hblNumber: _h, mblNumber: _m, ...base } = makeOceanBol();
    const flags = flagOceanBolCompliance(base);
    expect(flags.some((f) => f.code === 'HBL_WITHOUT_MBL')).toBe(false);
  });
});

describe('flagOceanBolCompliance — CUSTOMS_BROKER_UNVERIFIED', () => {
  it('flags unverified customs broker with critical severity', () => {
    const flags = flagOceanBolCompliance(
      makeOceanBol({ customsBroker: { name: 'FastBroker LLC', verified: false } }),
    );
    const flag = flags.find((f) => f.code === 'CUSTOMS_BROKER_UNVERIFIED');
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe('critical');
  });

  it('does not flag verified customs broker', () => {
    const flags = flagOceanBolCompliance(
      makeOceanBol({ customsBroker: { name: 'TrustedBroker Inc', verified: true } }),
    );
    expect(flags.some((f) => f.code === 'CUSTOMS_BROKER_UNVERIFIED')).toBe(false);
  });

  it('does not flag when customsBroker is absent', () => {
    const { customsBroker: _cb, ...base } = makeOceanBol();
    const flags = flagOceanBolCompliance(base);
    expect(flags.some((f) => f.code === 'CUSTOMS_BROKER_UNVERIFIED')).toBe(false);
  });
});

// ================================================================
// Truck BOL format validators
// ================================================================

function makeTruckBol(overrides: Partial<TruckBol> = {}): TruckBol {
  return {
    bolType:      'TRUCK_BOL',
    bolNumber:    'BOL-2024-001',
    scacCode:     'MAEU',
    carrier:      'Maersk',
    shipper:      { name: 'Shipper Inc', address: '100 Main St, Chicago IL' },
    consignee:    { name: 'Consignee LLC', address: '200 Oak Ave, Dallas TX' },
    origin:       'Chicago, IL',
    destination:  'Dallas, TX',
    lineItems:    [],
    totals:       { weightKg: 1200, pieces: 10 },
    freightTerms: 'prepaid',
    ...overrides,
  };
}

describe('validateScacCode', () => {
  it('accepts valid 2-4 letter SCAC codes', () => {
    expect(validateScacCode('MAEU')).toBe(true);
    expect(validateScacCode('UP')).toBe(true);
    expect(validateScacCode('FXFE')).toBe(true);
  });

  it('rejects codes with digits', () => {
    expect(validateScacCode('MA3U')).toBe(false);
  });

  it('rejects codes that are too short or too long', () => {
    expect(validateScacCode('M')).toBe(false);
    expect(validateScacCode('MAEUR')).toBe(false);
  });

  it('rejects lowercase codes', () => {
    expect(validateScacCode('maeu')).toBe(false);
  });
});

describe('validateProNumber', () => {
  it('accepts 5–10 digit PRO numbers', () => {
    expect(validateProNumber('12345')).toBe(true);
    expect(validateProNumber('1234567890')).toBe(true);
  });

  it('rejects PRO numbers with non-digits', () => {
    expect(validateProNumber('1234A')).toBe(false);
    expect(validateProNumber('PRO-12345')).toBe(false);
  });

  it('rejects PRO numbers outside length range', () => {
    expect(validateProNumber('1234')).toBe(false);
    expect(validateProNumber('12345678901')).toBe(false);
  });
});

// ================================================================
// Truck BOL compliance flags
// ================================================================

describe('flagTruckBolCompliance — valid BOL', () => {
  it('returns no flags for a fully valid Truck BOL', () => {
    const flags = flagTruckBolCompliance(makeTruckBol({ proNumber: '1234567' }));
    expect(flags).toHaveLength(0);
  });
});

describe('flagTruckBolCompliance — MISSING_SCAC', () => {
  it('flags when scacCode is absent', () => {
    const flags = flagTruckBolCompliance(makeTruckBol({ scacCode: '' }));
    expect(flags.some((f) => f.code === 'MISSING_SCAC')).toBe(true);
  });

  it('flags when scacCode fails format check', () => {
    const flags = flagTruckBolCompliance(makeTruckBol({ scacCode: 'M1EU' }));
    expect(flags.some((f) => f.code === 'MISSING_SCAC')).toBe(true);
  });

  it('does not flag a valid SCAC code', () => {
    const flags = flagTruckBolCompliance(makeTruckBol({ scacCode: 'UPSN' }));
    expect(flags.some((f) => f.code === 'MISSING_SCAC')).toBe(false);
  });
});

describe('flagTruckBolCompliance — INVALID_PRO_NUMBER', () => {
  it('flags when proNumber has wrong format', () => {
    const flags = flagTruckBolCompliance(makeTruckBol({ proNumber: 'PRO-123' }));
    expect(flags.some((f) => f.code === 'INVALID_PRO_NUMBER')).toBe(true);
  });

  it('does not flag when proNumber is absent (optional field)', () => {
    const { proNumber: _p, ...base } = makeTruckBol();
    const flags = flagTruckBolCompliance(base);
    expect(flags.some((f) => f.code === 'INVALID_PRO_NUMBER')).toBe(false);
  });

  it('does not flag a valid 7-digit PRO number', () => {
    const flags = flagTruckBolCompliance(makeTruckBol({ proNumber: '1234567' }));
    expect(flags.some((f) => f.code === 'INVALID_PRO_NUMBER')).toBe(false);
  });
});

describe('flagTruckBolCompliance — MISSING_DELIVERY_ADDRESS', () => {
  it('flags when consignee address is empty', () => {
    const flags = flagTruckBolCompliance(
      makeTruckBol({ consignee: { name: 'Consignee LLC', address: '' } }),
    );
    expect(flags.some((f) => f.code === 'MISSING_DELIVERY_ADDRESS')).toBe(true);
  });

  it('does not flag when consignee address is present', () => {
    const flags = flagTruckBolCompliance(makeTruckBol());
    expect(flags.some((f) => f.code === 'MISSING_DELIVERY_ADDRESS')).toBe(false);
  });
});
