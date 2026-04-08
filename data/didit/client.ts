export function fetchDidit(url: string, options: { apiKey: string } & RequestInit) {
  const { apiKey, ...fetchOptions } = options;
  return fetch(`https://verification.didit.me${url}`, {
    ...fetchOptions,
    headers: {
      ...fetchOptions.headers,
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
  });
}

export type CreateVerificationSessionResponse = {
  session_id: string;
  session_number: number;
  vendor_data?: string;
  metadata?: Record<string, unknown>;
  status: string;
  workflow_id: string;
  callback?: string;
  url: string;
};

export type VerificationExpectedDetails = {
  firstName?: string | null;
  lastName?: string | null;
};

export async function createVerificationSession(options: {
  apiKey: string;
  workflowId: string;
  vendorData?: string;
  callback?: string;
  metadata?: Record<string, unknown> | string;
  expectedDetails?: VerificationExpectedDetails;
}): Promise<CreateVerificationSessionResponse | null> {
  const { apiKey, workflowId, vendorData, callback, metadata, expectedDetails } = options;

  try {
    const result = await fetchDidit("/v2/session/", {
      method: "POST",
      apiKey,
      body: JSON.stringify({
        workflow_id: workflowId,
        ...(vendorData && { vendor_data: vendorData }),
        ...(callback && { callback, callback_method: "initiator" }),
        ...(metadata && { metadata: typeof metadata === "string" ? metadata : JSON.stringify(metadata, null, 2) }),
        ...((expectedDetails?.firstName || expectedDetails?.lastName) && {
          expected_details: {
            ...(expectedDetails.firstName && { first_name: expectedDetails.firstName }),
            ...(expectedDetails.lastName && { last_name: expectedDetails.lastName }),
          },
        }),
      }),
    });

    if (!result.ok) {
      return null;
    }

    return await result.json();
  } catch (e) {
    console.error(e);
    return null;
  }
}
