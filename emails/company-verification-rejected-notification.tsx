import { Text } from "@react-email/components";
import {
  EmailLayout,
  EmailHeading,
  InfoSection,
} from "@core/emails/components/shared";

interface CompanyVerificationRejectedNotificationProps {
  companyName: string;
}

export const CompanyVerificationRejectedNotification = ({
  companyName = "Acme Corp",
}: CompanyVerificationRejectedNotificationProps) => (
  <EmailLayout preview={`${companyName} could not be verified on the Peppol network`}>
    <EmailHeading>Company verification declined</EmailHeading>
    <Text className="mb-4">Hello,</Text>
    <Text className="mb-4">
      The manual verification for <strong>{companyName}</strong> was declined.
    </Text>
    <Text className="mb-4">
      This company is not active on the Peppol network yet. Please contact us if
      you believe this decision needs to be reviewed.
    </Text>
    <InfoSection>
      <Text className="my-1 text-sm">
        If you have any questions, contact{" "}
        <a href="mailto:support@recommand.eu">support@recommand.eu</a>.
      </Text>
    </InfoSection>
  </EmailLayout>
);

CompanyVerificationRejectedNotification.PreviewProps = {
  companyName: "Acme Corp",
} as CompanyVerificationRejectedNotificationProps;

export default CompanyVerificationRejectedNotification;

export const subject = (props: { companyName: string }) =>
  `${props.companyName} verification was declined`;
