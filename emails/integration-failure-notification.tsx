import { Section, Text } from "@react-email/components";
import { EmailLayout, EmailHeading, InfoSection } from "@core/emails/components/shared";
import { getIntegrationEventDescription } from "@peppol/utils/integrations";

interface FailedTask {
  task: string;
  message: string;
  context?: string;
}

interface IntegrationFailureNotificationProps {
  integrationName: string;
  companyName: string;
  event: string;
  failedTasks: FailedTask[];
}

export const IntegrationFailureNotification = ({
  integrationName,
  companyName,
  event,
  failedTasks,
}: IntegrationFailureNotificationProps) => {
  const eventDescription = getIntegrationEventDescription(event);
  const eventName = eventDescription?.title || event;

  return (
    <EmailLayout
      preview={`Integration ${integrationName} failed for ${companyName}`}
    >
      <EmailHeading>Integration Failure</EmailHeading>
      <Text className="mb-4">
        The integration <strong>{integrationName}</strong> for company{" "}
        <strong>{companyName}</strong> has failed during{" "}
        <strong>{eventName}</strong>.
      </Text>
      <InfoSection>
        <Text className="my-1 font-semibold">Failed Tasks:</Text>
        {failedTasks.map((failedTask, index) => (
          <Section key={index} className="my-2">
            <Text className="my-1 font-semibold">{failedTask.task}</Text>
            <Text className="my-1">{failedTask.message}</Text>
            {failedTask.context && (
              <Text className="my-1 text-sm opacity-75">
                {failedTask.context}
              </Text>
            )}
          </Section>
        ))}
      </InfoSection>
      <Text className="mb-4">
        Please review the integration configuration and ensure all required
        settings are correct.
      </Text>
    </EmailLayout>
  );
};

IntegrationFailureNotification.PreviewProps = {
  integrationName: "Example Integration",
  companyName: "Acme Corporation",
  event: "document.received",
  failedTasks: [
    {
      task: "Process document",
      message: "Failed to process document: Invalid format",
      context: "Document ID: DOC-123",
    },
  ],
} as IntegrationFailureNotificationProps;

export default IntegrationFailureNotification;
