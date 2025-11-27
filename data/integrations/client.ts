import { errorResponseSchema, manifestSchema, successResponseSchema, type IntegrationConfigurationField, type IntegrationEvent, type IntegrationManifest } from "@peppol/types/integration";
import { createIntegrationTaskLog, updateIntegrationState, type ActivatedIntegration } from ".";
import { createCleanUrl, UserFacingError } from "@peppol/utils/util";
import { generateIntegrationJwt } from "./auth";

function flattenFieldsToObject(fields: IntegrationConfigurationField[]): Record<string, unknown> {
    return fields.reduce((acc, field) => {
        acc[field.id] = field.value;
        return acc;
    }, {} as Record<string, unknown>);
}

export async function postToIntegration({
    integration,
    event,
    ctx,
}: {
    integration: ActivatedIntegration;
    event: IntegrationEvent;
    ctx?: { documentId?: string }
}) {

    const body = JSON.stringify({
        version: integration.manifest.version,
        jwt: await generateIntegrationJwt(integration),
        auth: integration.configuration.auth,
        fields: flattenFieldsToObject(integration.configuration.fields),
        state: integration.state,
        context: {
            ...ctx,
            companyId: integration.companyId,
            teamId: integration.teamId,
        }
    });
    console.log("Posting to integration", integration.manifest.url, event, JSON.stringify({...JSON.parse(body), jwt: "...", auth: {...integration.configuration.auth, token: "..."}}, null, 2));

    const response = await fetch(createCleanUrl([integration.manifest.url, event]), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body,
    });

    const json = await response.json();

    // Ensure the version is 1.0.0
    if (json.version !== "1.0.0") {
        throw new UserFacingError(`Unsupported response version: ${json.version}. Expected version: 1.0.0`);
    }

    if (response.status !== 200) {
        const result = errorResponseSchema.safeParse(json);
        let message = "Invalid response for unsuccessful integration request";
        if (result.success) {
            const parsedResponse = result.data;
            message = parsedResponse.error.message;
            await createIntegrationTaskLog(integration.id, event, parsedResponse.error.task, false, message, parsedResponse.error.context ?? "");
        }
        console.error("Error response from integration", integration.manifest.url, event, JSON.stringify(json, null, 2));
        throw new UserFacingError(message);
    }

    const result = successResponseSchema.safeParse(json);
    if (!result.success) {
        throw new UserFacingError(`Invalid response for successful integration request: ${JSON.stringify(result.error)}`);
    }
    const parsedResponse = result.data;

    // If the response contains a state, update the integration state
    if (parsedResponse.state !== null && parsedResponse.state !== undefined) {
        await updateIntegrationState(integration.teamId, integration.id, parsedResponse.state);
    }

    // If the response contains tasks, create task logs
    if (parsedResponse.tasks !== null && parsedResponse.tasks !== undefined) {
        for (const task of parsedResponse.tasks) {
            await createIntegrationTaskLog(integration.id, event, task.task, task.success, task.message ?? "", task.context ?? "");
        }
    }


    return parsedResponse;
}

export async function getIntegrationManifestFromUrl(url: string) {
    const response = await fetch(createCleanUrl([url, "manifest"]), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new UserFacingError(`Failed to fetch integration manifest from ${url}: ${response.statusText}`);
    }

    const json = await response.json();

    return validateManifest(json);
}

export async function getIntegrationManifest(integration: ActivatedIntegration) {
    return getIntegrationManifestFromUrl(integration.manifest.url);
}

export function validateManifest(manifest: unknown): IntegrationManifest {
    const result = manifestSchema.safeParse(manifest);
    if (!result.success) {
        throw new UserFacingError(`Invalid manifest: ${JSON.stringify(result.error)}`);
    }
    return result.data;
}