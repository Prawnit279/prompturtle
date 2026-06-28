import { z } from 'zod';

import { registerToolSchema } from '../../../guardrails/rules/InputSchemaRule.js';

// ---- Shared sub-schemas ----

export const ReturnReasonSchema = z.enum([
  'DAMAGED_IN_TRANSIT',
  'WRONG_ITEM_SHIPPED',
  'QUALITY_ISSUE',
  'ORDER_CANCELLED',
  'EXCESS_INVENTORY',
  'SPECIFICATION_MISMATCH',
]);

export const ReturnUrgencySchema = z.enum(['standard', 'expedited', 'critical']);

export const ReturnLineItemSchema = z.object({
  sku:         z.string().min(1),
  description: z.string().min(1),
  quantity:    z.number().int(),
  unitValue:   z.number().nonnegative(),
  weight:      z.number().nonnegative().optional(),
  condition:   z.enum(['new', 'used', 'damaged', 'defective']).optional(),
});

export const ShipmentAddressSchema = z.object({
  name:       z.string().min(1),
  street:     z.string().min(1),
  city:       z.string().min(1),
  region:     z.string().optional(),
  postalCode: z.string().min(1),
  country:    z.string().length(2),
});

// ---- create_return ----

export const CreateReturnInput = z.object({
  originalBolNumber:  z.string().optional(),
  returnReason:       ReturnReasonSchema,
  items:              z.array(ReturnLineItemSchema),
  declaredValue:      z.number(),
  currency:           z.string().optional(),
  urgency:            ReturnUrgencySchema.optional(),
  originAddress:      ShipmentAddressSchema,
  destinationAddress: ShipmentAddressSchema,
});

export type CreateReturnInput = z.infer<typeof CreateReturnInput>;

// ---- validate_return_eligibility ----

export const ReturnEligibilityInput = z.object({
  originalBolNumber: z.string().optional(),
  returnReason:      ReturnReasonSchema,
  declaredValue:     z.number(),
  items:             z.array(ReturnLineItemSchema),
});

export type ReturnEligibilityInput = z.infer<typeof ReturnEligibilityInput>;

// ---- route_return ----

export const RouteReturnInput = z.object({
  declaredValue: z.number().nonnegative(),
  urgency:       ReturnUrgencySchema.optional(),
  items:         z.array(ReturnLineItemSchema).optional(),
});

export type RouteReturnInput = z.infer<typeof RouteReturnInput>;

// ---- get_return_status / cancel_return ----

export const RmaLookupInput = z.object({
  rmaNumber: z.string().min(1),
});

export type RmaLookupInput = z.infer<typeof RmaLookupInput>;

export function registerReverseLogisticsSchemas(): void {
  registerToolSchema('reverse-logistics', 'create_return', CreateReturnInput);
  registerToolSchema('reverse-logistics', 'validate_return_eligibility', ReturnEligibilityInput);
  registerToolSchema('reverse-logistics', 'route_return', RouteReturnInput);
  registerToolSchema('reverse-logistics', 'get_return_status', RmaLookupInput);
  registerToolSchema('reverse-logistics', 'cancel_return', RmaLookupInput);
}
