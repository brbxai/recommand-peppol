import { Text } from "@react-email/components";
import { EmailLayout, EmailHeading, InfoSection } from "@core/emails/components/shared";

interface DocumentIncomingNotificationProps {
  companyName: string;
  senderName: string;
  documentType: string;
  documentNumber?: string;
  amount?: string;
  currency?: string;
}

export const DocumentIncomingNotification = ({
  companyName,
  senderName,
  documentType,
  documentNumber,
  amount,
  currency,
}: DocumentIncomingNotificationProps) => (
  <EmailLayout
    preview={`New ${documentType.toLowerCase()} received from ${senderName}`}
  >
    <EmailHeading>New {documentType} Received</EmailHeading>
    <Text className="mb-4">
      Your company <strong>{companyName}</strong> has received a new{" "}
      {documentType.toLowerCase()} via the Peppol network.
    </Text>
    <InfoSection>
      <Text className="my-1">
        <strong>From:</strong> {senderName}
      </Text>
      {documentNumber && (
        <Text className="my-1">
          <strong>Document Number:</strong> {documentNumber}
        </Text>
      )}
      {amount && currency && (
        <Text className="my-1">
          <strong>Amount:</strong> {amount} {currency}
        </Text>
      )}
    </InfoSection>
    <Text className="mb-4">
      The document and any attachments are included with this email. Please
      review and take any necessary action.
    </Text>
  </EmailLayout>
);

DocumentIncomingNotification.PreviewProps = {
  companyName: "Acme Corporation",
  senderName: "Supplier Ltd.",
  documentType: "Invoice",
  documentNumber: "INV-2024-001",
  amount: "1,250.00",
  currency: "EUR",
} as DocumentIncomingNotificationProps;

export default DocumentIncomingNotification;
