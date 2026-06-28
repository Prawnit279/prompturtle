/**
 * Reverse Logistics module types (Phase 2). Covers inbound returns: RMA
 * generation, eligibility validation, carrier routing, and high-value approval.
 *
 * ReturnReason / ReturnStatus are string-literal unions that mirror the Prisma
 * enums of the same name — the shared package never imports from @prisma/client.
 */

export type ReturnReason =
  | 'DAMAGED_IN_TRANSIT'
  | 'WRONG_ITEM_SHIPPED'
  | 'QUALITY_ISSUE'
  | 'ORDER_CANCELLED'
  | 'EXCESS_INVENTORY'
  | 'SPECIFICATION_MISMATCH';

export type ReturnStatus =
  | 'INITIATED'
  | 'APPROVED'
  | 'CARRIER_ASSIGNED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'PROCESSED'
  | 'CANCELLED';

export type ReturnUrgency = 'standard' | 'expedited' | 'critical';

export type ReturnItemCondition = 'new' | 'used' | 'damaged' | 'defective';

/**
 * Structured postal address for a return leg. The BOL processor previously used
 * an inline `{ name, address }` shape; this module introduces a richer address
 * so origin/destination are unambiguous for carrier routing.
 */
export interface ShipmentAddress {
  name: string;
  street: string;
  city: string;
  region?: string;        // state / province
  postalCode: string;
  country: string;        // ISO 3166-1 alpha-2
}

export interface ReturnLineItem {
  sku: string;
  description: string;
  quantity: number;
  unitValue: number;
  weight?: number;        // per-unit weight in lb (optional)
  condition?: ReturnItemCondition;
}

export interface CreateReturnInput {
  originalBolNumber?: string;
  returnReason: ReturnReason;
  items: ReturnLineItem[];
  declaredValue: number;
  currency?: string;
  urgency?: ReturnUrgency;
  originAddress: ShipmentAddress;       // where the return is coming from
  destinationAddress: ShipmentAddress;  // warehouse receiving the return
}

export interface ReturnEligibilityInput {
  originalBolNumber?: string;
  returnReason: ReturnReason;
  declaredValue: number;
  items: ReturnLineItem[];
}

export interface ReturnEligibilityResult {
  eligible: boolean;
  reason?: string;            // only present when not eligible
  requiresApproval: boolean;  // true if declaredValue > guardrail costThreshold
  approvalNote?: string;
}

export interface RouteReturnInput {
  declaredValue: number;
  urgency?: ReturnUrgency;
  items?: ReturnLineItem[];   // used to derive total weight for cost
}

export interface ReturnCarrierOption {
  carrier: string;
  serviceLevel: string;
  estimatedDays: number;
  estimatedCost: number;
  currency: string;
  recommended: boolean;
}

export interface ReturnRequestResult {
  rmaNumber: string;
  status: ReturnStatus;
  returnBolNumber?: string;
  approvalId?: string;
  requiresApproval: boolean;
  carrierOptions?: ReturnCarrierOption[];
  auditId: string;
  createdAt: string;
}

/** Full record returned by get_return_status. */
export interface ReturnRecord {
  rmaNumber: string;
  status: ReturnStatus;
  returnReason: ReturnReason;
  originalBolNumber?: string;
  items: ReturnLineItem[];
  declaredValue: number;
  currency: string;
  urgency: ReturnUrgency;
  returnCarrier?: string;
  returnBolNumber?: string;
  approvalId?: string;
  createdAt: string;
  updatedAt: string;
}
