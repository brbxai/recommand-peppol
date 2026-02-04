import { Hr, Text } from "@react-email/components";
import { EmailLayout, EmailHeading, InfoSection } from "@core/emails/components/shared";

interface InvoiceEmailProps {
  companyName: string;
  invoiceNumber: string;
  totalAmountExcl: number;
  totalVatAmount: number;
  totalAmountIncl: number;
  vatPercentage: number;
  vatCategory: string;
  vatExemptionReason: string | null;
  lines: {
    name: string;
    description: string;
    netPriceAmount: string;
    vat: {
      category: string;
      percentage: string;
    };
  }[];
}

export const InvoiceEmail = ({
  companyName,
  invoiceNumber,
  totalAmountExcl,
  totalVatAmount,
  totalAmountIncl,
  vatPercentage,
  vatCategory,
  vatExemptionReason,
  lines,
}: InvoiceEmailProps) => (
  <EmailLayout preview={`Recommand invoice ${invoiceNumber}`}>
    <EmailHeading>Invoice {invoiceNumber}</EmailHeading>
    <Text className="mb-4">Dear {companyName},</Text>
    <Text className="mb-4">
      Thank you for using Recommand. Please find the summary of your invoice
      below.
    </Text>
    <InfoSection>
      <Text className="my-1 text-sm">
        <strong>Subtotal (excl. VAT):</strong> € {totalAmountExcl.toFixed(2)}
      </Text>
      {vatExemptionReason ? (
        <Text className="my-1 text-sm">
          <strong>VAT:</strong> {vatExemptionReason}
        </Text>
      ) : (
        <Text className="my-1 text-sm">
          <strong>VAT ({vatPercentage}%):</strong> €{" "}
          {totalVatAmount.toFixed(2)}
        </Text>
      )}
      <Hr className="my-3 border-[#BFBDAE]" />
      <Text className="my-1 text-sm font-bold">
        <strong>Total (incl. VAT):</strong> € {totalAmountIncl.toFixed(2)}
      </Text>
    </InfoSection>
    <Text className="mb-4">
      We have tried to deliver the invoice to you via the Peppol network.
      It is attached to this email for your records.
    </Text>
  </EmailLayout>
);

InvoiceEmail.PreviewProps = {
  companyName: "Acme Corporation",
  invoiceNumber: "2024-001",
  totalAmountExcl: 1000.0,
  totalVatAmount: 210.0,
  totalAmountIncl: 1210.0,
  vatPercentage: 21,
  vatCategory: "S",
  vatExemptionReason: null,
  lines: [
    {
      name: "Professional Plan",
      description:
        "Monthly subscription\nIncoming: 100 documents\nOutgoing: 50 documents",
      netPriceAmount: "1000.00",
      vat: {
        category: "S",
        percentage: "21",
      },
    },
  ],
} as InvoiceEmailProps;

export default InvoiceEmail;
