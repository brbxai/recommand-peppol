import { z } from "zod";
import { integrationEventSchema, integrationAuthTypeSchema } from "./manifest";

// **********************************************************
// * Integration Configuration Schema
// **********************************************************

export const configurationAuthSchema = z.object({
    type: integrationAuthTypeSchema,
    token: z.string().min(1),
  }).strict();
  
  export const configurationFieldSchema = z.object({
    id: z.string().min(1).regex(/^[a-zA-Z0-9_]+$/),
    type: z.enum(["string"]),
    value: z.string().min(1),
  }).strict();
  
  export const configurationCapabilitySchema = z.object({
    event: integrationEventSchema,
    enabled: z.boolean(),
  }).strict();
  
  export const configurationSchema = z.object({
    auth: configurationAuthSchema,
    fields: z.array(configurationFieldSchema),
    capabilities: z.array(configurationCapabilitySchema),
  }).strict();
  
  export type IntegrationConfiguration = z.infer<typeof configurationSchema>;