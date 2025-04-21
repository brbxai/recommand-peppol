export function describeSuccessResponse(description: string, bodySchema: any = {}) {
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

export function describeErrorResponse(
  status: number,
  description: string,
  bodySchema: any = {}
) {
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
