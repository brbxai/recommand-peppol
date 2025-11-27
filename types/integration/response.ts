import { z } from "zod";
import { stateSchema } from "./state";

// **********************************************************
// * Integration Response Schema
// **********************************************************

export const taskSchema = z.object({
    task: z.string().min(1),
    success: z.boolean(),
    message: z.string().optional(),
    context: z.string().optional(),
}).strict();

export const taskLogSchema = z.object({
    event: z.string(),
    task: z.string(),
    success: z.boolean(),
    message: z.string(),
    context: z.string().default(""),
}).strict();

export const successResponseSchema = z.object({
    version: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
    state: stateSchema.optional(),
    tasks: z.array(taskSchema).optional(),
}).strict();

export const errorResponseSchema = z.object({
    version: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
    error: z.object({
        task: z.string(),
        message: z.string(),
        context: z.string().optional(),
    }).strict(),
}).strict();

export type IntegrationSuccessResponse = z.infer<typeof successResponseSchema>;
export type IntegrationErrorResponse = z.infer<typeof errorResponseSchema>;