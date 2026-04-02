import { Text } from "@react-email/components";
import {
  EmailLayout,
  EmailHeading,
  InfoSection,
  baseUrl,
  Button,
} from "@core/emails/components/shared";
import { Section } from "@react-email/components";

interface CompanyVerifiedNotificationProps {
  companyName: string;
}

export const CompanyVerifiedNotification = ({
  companyName = "Acme Corp",
}: CompanyVerifiedNotificationProps) => (
  <EmailLayout preview={`${companyName} has been verified on the Peppol network`}>
    <EmailHeading>Company verified</EmailHeading>
    <Text className="mb-4">Hello,</Text>
    <Text className="mb-4">
      Great news! <strong>{companyName}</strong> has been manually verified and
      is now active on the Peppol network.
    </Text>
    <Text className="mb-4">
      You can now send and receive electronic documents through Peppol.
    </Text>
    <Section className="my-6 text-center">
      <Button variant="primary" href={`${baseUrl}/companies`}>
        Go to your companies
      </Button>
    </Section>
    <InfoSection>
      <Text className="my-1 text-sm">
        If you have any questions, contact{" "}
        <a href="mailto:support@recommand.eu">support@recommand.eu</a>.
      </Text>
    </InfoSection>
  </EmailLayout>
);

CompanyVerifiedNotification.PreviewProps = {
  companyName: "Acme Corp",
} as CompanyVerifiedNotificationProps;

export default CompanyVerifiedNotification;

export const subject = (props: { companyName: string }) =>
  `${props.companyName} has been verified on the Peppol network`;
