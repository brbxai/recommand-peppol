import { Section, Text } from "@react-email/components";
import { EmailLayout, EmailHeading } from "@core/emails/components/shared";
import { DATA, ERROR, SHEET_LIGHT } from "@core/lib/config/colors";

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
}: EmailToPeppolErrorProps) => (
  <EmailLayout preview="Error processing your Peppol document">
    <EmailHeading>
      {hasXmlAttachment ? "Error Processing Document" : "No XML Attachment Found"}
    </EmailHeading>

    {!hasXmlAttachment ? (
      <>
        <Text className="mb-4">
          Your email was received, but no XML attachment was found.
        </Text>
        <Section
          className={`my-4 p-4 rounded-lg border border-solid bg-[${SHEET_LIGHT}] border-[${DATA}]`}
        >
          <Text className="my-1 font-semibold">What to do:</Text>
          <Text className="my-1">
            • Attach an XML document (invoice, credit note, or self-billing)
          </Text>
          <Text className="my-1">• Ensure the file has a .xml extension</Text>
          <Text className="my-1">• Send your email again to the same address</Text>
        </Section>
      </>
    ) : (
      <>
        <Text className="mb-4">
          We encountered an error while processing your document
          {companyName ? ` for company ${companyName}` : ""}.
        </Text>
        <Section
          className={`my-4 p-4 rounded-lg border border-solid bg-[${SHEET_LIGHT}] border-[${ERROR}]`}
        >
          <Text className="my-1 font-semibold">Error:</Text>
          <Text className="my-1">{error}</Text>
          {details && (
            <>
              <Text className="my-1 font-semibold">Details:</Text>
              <Text className="my-1 text-sm">{details}</Text>
            </>
          )}
        </Section>
        <Text className="mb-4">
          Please check your XML document and try again. If the problem persists,
          contact our support team for assistance.
        </Text>
      </>
    )}
  </EmailLayout>
);

EmailToPeppolError.PreviewProps = {
  error: "Invalid XML format",
  details: "Missing required field: buyer party name",
  companyName: "Acme Corporation",
  hasXmlAttachment: true,
} as EmailToPeppolErrorProps;

export default EmailToPeppolError;
