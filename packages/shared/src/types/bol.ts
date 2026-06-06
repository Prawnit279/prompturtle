export type BolType = 'TRUCK_BOL' | 'AIR_WAYBILL' | 'OCEAN_BOL';

export interface BolLineItem {
  description: string;
  quantity: number;
  unit: string;
  weightKg?: number;
  hsCode?: string;
  declaredValue?: number;
}

export interface TruckBol {
  bolType: 'TRUCK_BOL';
  bolNumber: string;
  scacCode: string;
  carrier: string;
  shipper: { name: string; address: string };
  consignee: { name: string; address: string };
  origin: string;
  destination: string;
  lineItems: BolLineItem[];
  totals: { weightKg: number; pieces: number; declaredValue?: number; currency?: string };
  freightTerms: 'prepaid' | 'collect' | 'third_party';
  proNumber?: string;
  poNumber?: string;
}

export interface AirWaybill {
  bolType: 'AIR_WAYBILL';
  /** 11-digit IATA format: XXX-XXXXXXXX */
  awbNumber: string;
  /** Master AWB (when this is a house AWB) */
  mawbNumber?: string;
  /** House AWB number */
  hawbNumber?: string;
  /** 2-char IATA carrier code */
  airlineCode: string;
  flightNumber?: string;
  /** 3-char IATA airport code */
  originAirport: string;
  /** 3-char IATA airport code */
  destinationAirport: string;
  shipper: { name: string; address: string };
  consignee: { name: string; address: string };
  notifyParty?: { name: string; address: string };
  pieces: number;
  grossWeightKg: number;
  chargeableWeightKg: number;
  commodity: string;
  declaredValue?: number;
  currency?: string;
  freightCharges: 'prepaid' | 'collect';
  incoterms?: string;
  /** e.g. ['DGR', 'PER', 'ICE'] */
  specialHandling?: string[];
}

export interface OceanBol {
  bolType: 'OCEAN_BOL';
  bolNumber: string;
  /** Master BOL */
  mblNumber?: string;
  /** House BOL */
  hblNumber?: string;
  vesselName: string;
  voyageNumber: string;
  /** UN/LOCODE (2-char country + 3-char location) */
  portOfLoading: string;
  /** UN/LOCODE */
  portOfDischarge: string;
  placeOfReceipt?: string;
  placeOfDelivery?: string;
  shipper: { name: string; address: string };
  consignee: { name: string; address: string };
  notifyParty?: { name: string; address: string };
  containers: Array<{
    /** ISO 6346 format: 4-letter owner code + 6 digits + check digit */
    containerNumber: string;
    sealNumber?: string;
    /** e.g. '20GP' | '40GP' | '40HC' | '45HC' | 'LCL' */
    type: string;
    weightKg: number;
    cbm?: number;
  }>;
  commodity: string;
  grossWeightKg: number;
  cbm?: number;
  freightTerms: 'prepaid' | 'collect';
  incoterms?: string;
  hsCode?: string;
  customsBroker?: { name: string; licenseNumber?: string; verified: boolean };
}

export type ParsedBol = TruckBol | AirWaybill | OceanBol;

export type ComplianceFlagCode =
  // Truck BOL flags
  | 'MISSING_SCAC'
  | 'INVALID_PRO_NUMBER'
  | 'MISSING_DELIVERY_ADDRESS'
  // Air Waybill flags
  | 'INVALID_AWB_NUMBER'
  | 'MISSING_HAWB'
  | 'INVALID_AIRPORT_CODE'
  | 'DANGEROUS_GOODS_UNDECLARED'
  | 'WEIGHT_DISCREPANCY'
  // Ocean BOL flags
  | 'MISSING_CONTAINER_NUMBERS'
  | 'CONTAINER_FORMAT_INVALID'
  | 'MISSING_PORT_CODES'
  | 'HBL_WITHOUT_MBL'
  | 'CUSTOMS_BROKER_UNVERIFIED';

export type ComplianceFlagSeverity = 'info' | 'warning' | 'critical';

export interface ComplianceFlag {
  code: ComplianceFlagCode;
  severity: ComplianceFlagSeverity;
  message: string;
  field?: string;
}
