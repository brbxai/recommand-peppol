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
  Hr,
} from "@react-email/components";
import { Head } from "@core/emails/components/head";
import { SHADOW, DARK_SLATE, SHEET } from "@core/lib/config/colors";

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
  <Html>
    <Head />
    <Preview>Recommand invoice {invoiceNumber}</Preview>
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
            Invoice {invoiceNumber}
          </Heading>
          <Text className="mb-4">
            Dear {companyName},
          </Text>
          <Text className="mb-4">
            Thank you for using Recommand. Please find the summary of your invoice below.
          </Text>
          <Section className="mb-6 p-4 bg-gray-50 rounded">
            <Text className="mb-2 text-sm">
              <strong>Subtotal (excl. VAT):</strong> € {totalAmountExcl.toFixed(2)}
            </Text>
            {vatExemptionReason ? (
              <Text className="mb-2 text-sm">
                <strong>VAT:</strong> {vatExemptionReason}
              </Text>
            ) : (
              <Text className="mb-2 text-sm">
                <strong>VAT ({vatPercentage}%):</strong> € {totalVatAmount.toFixed(2)}
              </Text>
            )}
            <Hr className="my-3 border-gray-300" />
            <Text className="mb-2 text-sm font-bold">
              <strong>Total (incl. VAT):</strong> € {totalAmountIncl.toFixed(2)}
            </Text>
          </Section>
          <Text className="mb-4">
            We have tried to deliver the invoice to you via the Peppol network. The PDF and XML documents are attached to this email for your records.
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

InvoiceEmail.PreviewProps = {
  companyName: "Acme Corporation",
  invoiceNumber: "2024-001",
  totalAmountExcl: 1000.00,
  totalVatAmount: 210.00,
  totalAmountIncl: 1210.00,
  vatPercentage: 21,
  vatCategory: "S",
  vatExemptionReason: null,
  lines: [
    {
      name: "Professional Plan",
      description: "Monthly subscription\nIncoming: 100 documents\nOutgoing: 50 documents",
      netPriceAmount: "1000.00",
      vat: {
        category: "S",
        percentage: "21",
      },
    },
  ],
} as InvoiceEmailProps;

export default InvoiceEmail;

