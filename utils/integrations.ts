export type BuiltInIntegration = {
    url: string;
    name: string;
    description: string;
    documentationUrl: string;
}

export type IntegrationEventDescription = {
    event: string;
    title: string;
    description: string;
}

export const BUILT_IN_INTEGRATIONS = [
    {
        url: "https://harvest.integrations.recommand.dev",
        name: "Harvest",
        description: "Automatically send invoices made in Harvest to your customers via Peppol.",
        documentationUrl: "https://recommand.eu/docs/integrations/harvest",
    },
]

export function getBuiltInIntegration(url: string): BuiltInIntegration | undefined {
    return BUILT_IN_INTEGRATIONS.find((integration) => integration.url === url);
}

export const CONFIGURABLE_INTEGRATION_EVENTS: IntegrationEventDescription[] = [
    {
        event: "document.received",
        title: "Document Received",
        description: "A document has been received for your company. If enabled, the integration will be notified and can process the document.",
    },
    {
        event: "document.label.assigned",
        title: "Document Label Assigned",
        description: "A document label has been assigned to the document. If enabled, the integration will be notified and can process the document.",
    },
    {
        event: "document.label.unassigned",
        title: "Document Label Unassigned",
        description: "A document label has been unassigned from the document. If enabled, the integration will be notified and can process the document.",
    },
    {
        event: "integration.incoming-webhook",
        title: "External Service Notification",
        description: "An notification has been received from the external service. If enabled, the integration will be notified and can process the notification.",
    },
    {
        event: "integration.cron.short",
        title: "Frequent Sync",
        description: "The integration will be notified every few minutes to synchronize documents or perform other tasks.",
    },
    {
        event: "integration.cron.medium",
        title: "Hourly Sync",
        description: "The integration will be notified every few hours to synchronize documents or perform other tasks.",
    },
    {
        event: "integration.cron.long",
        title: "Daily Sync",
        description: "The integration will be notified every day to synchronize documents or perform other tasks.",
    },
]

export const BUILT_IN_INTEGRATION_EVENTS: IntegrationEventDescription[] = [
    {
        event: "integration.setup",
        title: "Integration Setup",
        description: "",
    },
    {
        event: "integration.teardown",
        title: "Integration Teardown",
        description: "",
    },
    {
        event: "integration.task.retry",
        title: "Task Retry",
        description: "",
    },
]

export const ALL_INTEGRATION_EVENTS = [
    ...CONFIGURABLE_INTEGRATION_EVENTS,
    ...BUILT_IN_INTEGRATION_EVENTS,
]

export function getConfigurableIntegrationEventDescription(event: string): IntegrationEventDescription | undefined {
    return CONFIGURABLE_INTEGRATION_EVENTS.find((eventDescription) => eventDescription.event === event);
}

export function getIntegrationEventDescription(event: string): IntegrationEventDescription | undefined {
    return ALL_INTEGRATION_EVENTS.find((eventDescription) => eventDescription.event === event);
}