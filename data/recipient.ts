import { createHash } from "crypto";
import { PARTICIPANT_SCHEME, DOCUMENT_SCHEME } from "./phoss-smp/service-metadata";
import { XMLParser } from "fast-xml-parser";
import { base32Encode } from "@peppol/utils/base32";
import { resolveNaptr } from "@peppol/utils/naptr";

const SML_ZONE = "edelivery.tech.ec.europa.eu";
const SML_TEST_ZONE = "acc.edelivery.tech.ec.europa.eu";

function stripTrailingEquals(str: string): string {
  return str.replace(/=+$/, "");
}

async function getSmpUrlNaptr({recipientAddress, useTestNetwork}: {recipientAddress: string, useTestNetwork: boolean}): Promise<string | null> {
  const dnsZone = useTestNetwork ? SML_TEST_ZONE : SML_ZONE;
  
  const sha256Hash = createHash("sha256")
    .update(recipientAddress.toLowerCase())
    .digest();
  
  const base32Hash = stripTrailingEquals(base32Encode(sha256Hash));
  const naptrDomain = `${base32Hash}.${PARTICIPANT_SCHEME}.${dnsZone}`.toLowerCase();
  
  const smpUrl = await resolveNaptr(naptrDomain);
  if (smpUrl) {
    const encodedAddress = encodeURIComponent(recipientAddress);
    const baseUrl = smpUrl.endsWith("/") ? smpUrl.slice(0, -1) : smpUrl;
    return `${baseUrl}/${PARTICIPANT_SCHEME}::${encodedAddress}`;
  }
  return null;
}

function getSmpUrlCname({recipientAddress, useTestNetwork}: {recipientAddress: string, useTestNetwork: boolean}): string {
  const dnsZone = useTestNetwork ? SML_TEST_ZONE : SML_ZONE;
  
  const md5Hash = createHash("md5")
    .update(recipientAddress.toLowerCase())
    .digest("hex");
  
  const encodedAddress = encodeURIComponent(recipientAddress);
  
  return `http://B-${md5Hash}.${PARTICIPANT_SCHEME}.${dnsZone}/${PARTICIPANT_SCHEME}::${encodedAddress}`;
}

async function getSmpUrl({recipientAddress, useTestNetwork}: {recipientAddress: string, useTestNetwork: boolean}): Promise<string> {  
  const naptrUrl = await getSmpUrlNaptr({recipientAddress, useTestNetwork});
  if (naptrUrl) {
    return naptrUrl;
  }
  
  return getSmpUrlCname({recipientAddress, useTestNetwork});
}

export async function verifyRecipient({recipientAddress, useTestNetwork}: {recipientAddress: string, useTestNetwork: boolean}) {
  const smpUrl = await getSmpUrl({recipientAddress, useTestNetwork});

  try {
    const response = await fetch(smpUrl);
    if (!response.ok) {
      throw new Error(`Failed to verify recipient: ${response.statusText}`);
    }
    const data = await response.text();
    
    // Extract service metadata references
    const serviceMetadataRefs: string[] = [];
    // Extract SMP hostnames
    const smpHostnames: Set<string> = new Set();
    
    // Navigate through the XML structure to find ServiceMetadataReference elements
    try {
      // Parse the XML response using fast-xml-parser
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        parseAttributeValue: true,
        parseTagValue: false,
        trimValues: true,
        removeNSPrefix: true,
      });
      
      const xmlDoc = parser.parse(data);
      // Handle different possible XML structures
      const serviceGroup = xmlDoc.ServiceGroup || xmlDoc["smp:ServiceGroup"];

      if (serviceGroup) {
        // Extract participant identifier
        const participantId = serviceGroup.ParticipantIdentifier || 
                            serviceGroup["id:ParticipantIdentifier"];
        
        const refCollection = serviceGroup.ServiceMetadataReferenceCollection || 
                            serviceGroup["smp:ServiceMetadataReferenceCollection"];
        
        if (refCollection) {
          const references = refCollection.ServiceMetadataReference || 
                           refCollection["smp:ServiceMetadataReference"];
          
          if (references) {
            // Handle both single reference and array of references
            const refArray = Array.isArray(references) ? references : [references];
            
            for (const ref of refArray) {
              if (ref && ref["@_href"]) {
                serviceMetadataRefs.push(ref["@_href"]);
                const url = new URL(ref["@_href"]);
                smpHostnames.add(url.hostname);
              }
            }
          }
        }
      }
    } catch (parseError) {
    }
    
    return {
      smpUrl,
      serviceMetadataReferences: serviceMetadataRefs,
      smpHostnames: Array.from(smpHostnames),
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to verify recipient: ${error.message}`);
    }
    throw new Error("Failed to verify recipient: Unknown error occurred");
  }
}

export async function verifyDocumentSupport({recipientAddress, documentType, useTestNetwork}: {recipientAddress: string, documentType: string, useTestNetwork: boolean}) {
  const smpUrl = await getSmpUrl({recipientAddress, useTestNetwork});

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
