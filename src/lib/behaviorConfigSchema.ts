import { z } from 'zod';

export const behaviorConfigSchema = z.object({
  customer_profile: z.object({
    auto_load: z.boolean().optional(),
    update_name_from_conversation: z.boolean().optional(),
    update_address_on_confirmation: z.boolean().optional(),
    update_payment_on_confirmation: z.boolean().optional()
  }).optional(),
  pending_products: z.object({
    allow_multiple: z.boolean().optional(),
    expiration_minutes: z.number().min(1).max(1440).optional()
  }).optional()
});

export const orchestrationConfigSchema = z.object({
  intents: z.record(
    z.string(),
    z.object({
      allowed_tools: z.array(z.string()),
      decision_hint: z.string()
    })
  ).optional()
});

export type BehaviorConfig = z.infer<typeof behaviorConfigSchema>;
export type OrchestrationConfig = z.infer<typeof orchestrationConfigSchema>;