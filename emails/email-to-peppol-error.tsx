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

interface EmailToPeppolErrorProps {
  error: string;
  details?: string;
  companyName?: string;
  hasXmlAttachment: boolean;
}

export const EmailToPeppolError = ({
  error,
  details,
  companyName,
  hasXmlAttachment,
}: EmailToPeppolErrorProps) => {
  return (
    <Html>
      <Head />
      <Preview>Error processing your Peppol document</Preview>
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
              {hasXmlAttachment
                ? "Error Processing Document"
                : "No XML Attachment Found"}
            </Heading>

            {!hasXmlAttachment ? (
              <>
                <Text className="mb-4">
                  Your email was received, but no XML attachment was found.
                </Text>
                <Section className="mb-4 p-4 bg-yellow-50 rounded border border-yellow-200">
                  <Text className="mb-2 font-semibold text-yellow-800">
                    What to do:
                  </Text>
                  <Text className="mb-1">
                    • Attach an XML document (invoice, credit note, or
                    self-billing)
                  </Text>
                  <Text className="mb-1">
                    • Ensure the file has a .xml extension
                  </Text>
                  <Text>• Send your email again to the same address</Text>
                </Section>
              </>
            ) : (
              <>
                <Text className="mb-4">
                  We encountered an error while processing your document
                  {companyName ? ` for company ${companyName}` : ""}.
                </Text>
                <Section className="mb-4 p-4 bg-red-50 rounded border border-red-200">
                  <Text className="mb-2 font-semibold text-red-800">
                    Error:
                  </Text>
                  <Text className="mb-0">{error}</Text>
                  {details && (
                    <>
                      <Text className="mt-3 mb-1 font-semibold text-red-800">
                        Details:
                      </Text>
                      <Text className="mb-0 text-sm">{details}</Text>
                    </>
                  )}
                </Section>
                <Text className="mb-4">
                  Please check your XML document and try again. If the problem
                  persists, contact our support team for assistance.
                </Text>
              </>
            )}

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

EmailToPeppolError.PreviewProps = {
  error: "Invalid XML format",
  details: "Missing required field: buyer party name",
  companyName: "Acme Corporation",
  hasXmlAttachment: true,
} as EmailToPeppolErrorProps;

export default EmailToPeppolError;
