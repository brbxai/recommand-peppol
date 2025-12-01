import { z } from "zod";

export const validationError = z.object({
    ruleCode: z.string(),
    errorMessage: z.string(),
    errorLevel: z.string(),
    fieldName: z.string(),
}).strict();

export const validationResult = z.enum(["valid", "invalid", "not_supported", "error"]);

export const validationResponse = z.object({
  result: validationResult,
  errors: z.array(validationError),
}).strict();

export type ValidationResponse = z.infer<typeof validationResponse>;