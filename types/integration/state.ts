import { z } from "zod";

// **********************************************************
// * Integration State Schema
// **********************************************************

export const stateSchema = z.record(z.string(), z.string());

export type IntegrationState = z.infer<typeof stateSchema>;