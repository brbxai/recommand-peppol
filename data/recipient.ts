import { createHash } from "crypto";
import { PARTICIPANT_SCHEME, DOCUMENT_SCHEME } from "./phoss-smp/service-metadata";

const SML_ZONE = "edelivery.tech.ec.europa.eu";

function getSmpUrl(recipientAddress: string) {
  // Create MD5 hash of lowercase identifier
  const hash = createHash("md5")
    .update(recipientAddress.toLowerCase())
    .digest("hex");

  // Encode the recipient address for URL safety
  const encodedAddress = encodeURIComponent(recipientAddress);

  // Construct SMP URL according to Peppol spec with proper encoding
  return `http://B-${hash}.${PARTICIPANT_SCHEME}.${SML_ZONE}/${PARTICIPANT_SCHEME}::${encodedAddress}`;
}

export async function verifyRecipient(recipientAddress: string) {
  const smpUrl = getSmpUrl(recipientAddress);

  try {
    const response = await fetch(smpUrl);
    if (!response.ok) {
      throw new Error(`Failed to verify recipient: ${response.statusText}`);
    }
    const data = await response.text();
    return {
      smpUrl,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to verify recipient: ${error.message}`);
    }
    throw new Error("Failed to verify recipient: Unknown error occurred");
  }
}

export async function verifyDocumentSupport(
  recipientAddress: string,
  documentType: string
) {
  const smpUrl = getSmpUrl(recipientAddress);

  // Encode the document type for URL safety
  const encodedDocumentType = encodeURIComponent(documentType);

  // Construct SMP URL according to Peppol spec with proper encoding
  const smpUrlWithDocumentType = `${smpUrl}/services/${DOCUMENT_SCHEME}::${encodedDocumentType}`;

  try {
    const response = await fetch(smpUrlWithDocumentType);
    if (!response.ok) {
      throw new Error(
        `Failed to verify document type capabilities: ${response.statusText}`
      );
    }
    const data = await response.text();
    return {
      smpUrl: smpUrlWithDocumentType,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to verify document type capabilities: ${error.message}`
      );
    }
    throw new Error(
      "Failed to verify document type capabilities: Unknown error occurred"
    );
  }
}
