import { z } from "zod";
import { stateSchema } from "./state";

// **********************************************************
// * Integration Response Schema
// **********************************************************

export const taskSchema = z.object({
    task: z.string().min(1),
    success: z.boolean(),
    message: z.string(),
    context: z.string(),
}).strict();

export const responseSchema = z.object({
    version: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
    state: stateSchema.optional(),
    tasks: z.array(taskSchema).optional(),
}).strict();

export type IntegrationResponse = z.infer<typeof responseSchema>;