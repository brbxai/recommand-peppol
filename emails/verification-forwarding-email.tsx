import { Section, Text } from "@react-email/components";
import {
  Button,
  EmailLayout,
  EmailHeading,
  InfoSection,
  baseUrl,
} from "@core/emails/components/shared";

interface VerificationForwardingEmailProps {
  companyName: string;
  verificationLink: string;
  requesterName: string;
  requesterEmail: string;
}

export const VerificationForwardingEmail = ({
  companyName = "Acme Corp",
  verificationLink = "https://example.com/company-verification/cvl_01/verify",
  requesterName = "A colleague",
  requesterEmail = "colleague@example.com",
}: VerificationForwardingEmailProps) => (
  <EmailLayout preview={`Action required: Verify ${companyName} on the Peppol network`}>
    <EmailHeading>Company verification request</EmailHeading>
    <Text className="mb-4">Hello,</Text>
    <Text className="mb-4">
      <strong>{requesterName}</strong> ({requesterEmail}) has asked you to
      complete the identity verification for <strong>{companyName}</strong> on
      the Peppol network.
    </Text>
    <Text className="mb-4">
      As an authorised representative of this company, you need to verify your
      identity to activate <strong>{companyName}</strong> for electronic
      document exchange through Peppol.
    </Text>
    <Section className="my-6 text-center">
      <Button variant="primary" href={verificationLink}>
        Complete verification
      </Button>
    </Section>
    <InfoSection>
      <Text className="my-1 text-sm">
        You will need to provide proof of identity during this process.
      </Text>
      <Text className="my-1 text-sm">
        If you did not expect this request or have questions, contact{" "}
        <a href="mailto:support@recommand.eu">support@recommand.eu</a>.
      </Text>
    </InfoSection>
  </EmailLayout>
);

VerificationForwardingEmail.PreviewProps = {
  companyName: "Acme Corp",
  verificationLink: `${baseUrl}/company-verification/cvl_01/verify`,
  requesterName: "Jane Smith",
  requesterEmail: "jane@acme.com",
} as VerificationForwardingEmailProps;

export default VerificationForwardingEmail;

export const subject = (props: { companyName: string }) =>
  `Action required: Verify ${props.companyName} on the Peppol network`;
