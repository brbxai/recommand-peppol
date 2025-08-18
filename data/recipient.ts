import { createHash } from "crypto";
import { PARTICIPANT_SCHEME, DOCUMENT_SCHEME } from "./phoss-smp/service-metadata";
import { XMLParser } from "fast-xml-parser";

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
