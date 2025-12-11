import {
  Body,
  Container,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
  Img,
} from "@react-email/components";
import { Head } from "@core/emails/components/head";
import { SHADOW, DARK_SLATE, SHEET } from "@core/lib/config/colors";
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
    <Html>
      <Head />
      <Preview>Integration {integrationName} failed for {companyName}</Preview>
      <Tailwind>
        <Body className={`font-sans text-[${DARK_SLATE}]`}>
          <Container
            className={`mx-auto my-8 max-w-xl border bg-[${SHEET}] p-6 border-[${SHADOW}] border-solid`}
          >
            <Img
              src={`${process.env.BASE_URL}/icon.png`}
              alt="Recommand Logo"
              className="mx-auto mb-6 w-16"
            />
            <Heading className="mb-6 text-center text-2xl font-bold">
              Integration Failure
            </Heading>
            <Text className="mb-4">
              The integration <strong>{integrationName}</strong> for company <strong>{companyName}</strong> has failed during <strong>{eventName}</strong>.
            </Text>
            <Section className="mb-4 p-4 bg-red-50 rounded border border-red-200">
              <Text className="mb-2 font-semibold text-red-800">Failed Tasks:</Text>
              {failedTasks.map((failedTask, index) => (
                <Section key={index} className="mb-3 p-3 bg-white rounded border border-red-100">
                  <Text className="mb-1 font-semibold">{failedTask.task}</Text>
                  <Text className="mb-1">{failedTask.message}</Text>
                  {failedTask.context && (
                    <Text className="text-sm text-gray-600">{failedTask.context}</Text>
                  )}
                </Section>
              ))}
            </Section>
            <Text className="mb-4">
              Please review the integration configuration and ensure all required settings are correct.
            </Text>
            <Text>
              Best regards,
              <br />
              The Recommand Team
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
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

