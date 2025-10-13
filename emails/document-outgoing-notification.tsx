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

interface DocumentOutgoingNotificationProps {
  companyName: string;
  recipientName: string;
  documentType: string;
  documentNumber?: string;
  amount?: string;
  currency?: string;
}

export const DocumentOutgoingNotification = ({
  companyName,
  recipientName,
  documentType,
  documentNumber,
  amount,
  currency,
}: DocumentOutgoingNotificationProps) => (
  <Html>
    <Head />
    <Preview>{documentType} sent to {recipientName}</Preview>
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
            {documentType} Sent Successfully
          </Heading>
          <Text className="mb-4">
            Your company <strong>{companyName}</strong> has successfully sent a {documentType.toLowerCase()} via the Peppol network.
          </Text>
          <Section className="mb-4 p-4 bg-gray-50 rounded">
            <Text className="mb-2"><strong>To:</strong> {recipientName}</Text>
            {documentNumber && <Text className="mb-2"><strong>Document Number:</strong> {documentNumber}</Text>}
            {amount && currency && (
              <Text className="mb-2"><strong>Amount:</strong> {amount} {currency}</Text>
            )}
          </Section>
          <Text className="mb-4">
            The {documentType.toLowerCase()} has been delivered to the recipient through the Peppol network. The document and any attachments are included with this email for your records.
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

DocumentOutgoingNotification.PreviewProps = {
  companyName: "Acme Corporation",
  recipientName: "Customer Inc.",
  documentType: "Invoice",
  documentNumber: "INV-2024-001",
  amount: "1,250.00",
  currency: "EUR",
} as DocumentOutgoingNotificationProps;

export default DocumentOutgoingNotification;
