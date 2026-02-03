import { Link, Text } from "@react-email/components";
import { EmailLayout, EmailHeading, InfoSection } from "@core/emails/components/shared";

interface FailedPaymentRetryEmailProps {
  companyName: string;
  invoiceReference: number;
  totalAmountIncl: number;
  billingDate: string;
}

export const FailedPaymentRetryEmail = ({
  companyName,
  invoiceReference,
  totalAmountIncl,
  billingDate,
}: FailedPaymentRetryEmailProps) => (
  <EmailLayout preview={`Payment retry failed for invoice ${invoiceReference}`}>
    <EmailHeading>Payment Failed</EmailHeading>
    <Text className="mb-4">Dear {companyName},</Text>
    <Text className="mb-4">
      We attempted to process the payment for your recent invoice, but this was unsuccessful. Your payment method may need to be updated.
    </Text>
    <InfoSection>
      <Text className="my-1 text-sm">
        <strong>Invoice Reference:</strong> {invoiceReference}
      </Text>
      <Text className="my-1 text-sm">
        <strong>Billing Date:</strong> {billingDate}
      </Text>
      <Text className="my-1 text-sm">
        <strong>Amount:</strong> € {totalAmountIncl.toFixed(2)}
      </Text>
    </InfoSection>
    <Text className="mb-4">
      Please update your payment method in your account settings or contact us at billing@recommand.eu to resolve this issue.
      You can update your payment method in your <Link href="https://app.recommand.eu/billing/subscription">billing settings</Link>.
    </Text>
    <Text className="mb-4">
      Thank you for your understanding.
    </Text>
  </EmailLayout>
);

FailedPaymentRetryEmail.PreviewProps = {
  companyName: "Acme Corporation",
  invoiceReference: 5001,
  totalAmountIncl: 1210.0,
  billingDate: "2024-01-31",
} as FailedPaymentRetryEmailProps;

export default FailedPaymentRetryEmail;
