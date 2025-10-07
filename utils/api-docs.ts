import { zodResolver } from "@recommand/lib/zod-validator";
import type { OpenAPIV3 } from "openapi-types";
import z from "zod";

export function describeSuccessResponse<T>(
  description: string,
  bodySchema: any = {}
): {
  [key: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject;
} {
  return {
    [200]: {
      description: description,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              ...bodySchema,
            },
          },
        },
      },
    },
  };
}

export function describeSuccessResponseWithZod(
  description: string,
  bodySchema: z.ZodObject<any>
) {
  return {
    200: {
      description: description,
      content: {
        "application/json": {
          schema: zodResolver(
            z
              .object({
                success: z.literal(true),
              })
              .extend(bodySchema.shape)
          ),
        },
      },
    },
  };
}

export function describeErrorResponse(
  status: number,
  description: string,
  bodySchema: any = {}
): {
  [key: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject;
} {
  return {
    [status]: {
      description: description,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", example: false },
              errors: {
                type: "object",
                additionalProperties: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              ...bodySchema,
            },
          },
        },
      },
    },
  };
}
