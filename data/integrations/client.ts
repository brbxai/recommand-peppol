import { manifestSchema, responseSchema, type IntegrationEvent, type IntegrationManifest } from "@peppol/types/integration";
import { createIntegrationTaskLog, updateIntegrationState, type ActivatedIntegration } from ".";
import { createCleanUrl, UserFacingError } from "@peppol/utils/util";

export async function postToIntegration({
    integration,
    event,
    ctx,
}: {
    integration: ActivatedIntegration;
    event: IntegrationEvent;
    ctx?: { documentId?: string }
}) {

    const response = await fetch(createCleanUrl([integration.manifest.url, event]), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            version: integration.manifest.version,
            jwt: "",
            auth: integration.configuration.auth,
            fields: integration.configuration.fields,
            state: integration.state,
            context: {
                ...ctx,
                companyId: integration.companyId,
                teamId: integration.teamId,
            }
        }),
    });

    const json = await response.json();

    // Ensure the version is 1.0.0
    if (json.version !== "1.0.0") {
        throw new UserFacingError(`Unsupported response version: ${json.version}. Expected version: 1.0.0`);
    }

    const parsedResponse = responseSchema.parse(json);

    // If the response contains a state, update the integration state
    if (parsedResponse.state !== null && parsedResponse.state !== undefined) {
        await updateIntegrationState(integration.teamId, integration.id, parsedResponse.state);
    }

    // If the response contains tasks, create task logs
    if (parsedResponse.tasks !== null && parsedResponse.tasks !== undefined) {
        for (const task of parsedResponse.tasks) {
            await createIntegrationTaskLog(integration.id, task.task, task.success, task.message, task.context);
        }
    }


    return parsedResponse;
}

export async function getIntegrationManifestFromUrl(url: string) {
    const response = await fetch(createCleanUrl([url, "integration.manifest"]), {
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