import { UserFacingError } from "@peppol/utils/util";
import { fetchSmp } from "./client";
import { XMLBuilder } from "fast-xml-parser";

export const PARTICIPANT_SCHEME = "iso6523-actorid-upis";
export const DOCUMENT_SCHEME = "busdox-docid-qns";
export const PROCESS_SCHEME = "cenbii-procid-ubl";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  suppressBooleanAttributes: true,
});

// fixNewlines replaces spaces that are actually newlines in the certificate format
function fixNewlines(content: string): string {
  // Split by "-----" to handle certificate boundaries
  const parts = content.split("-----");
  for (let i = 0; i < parts.length; i++) {
    // Only process the parts that are between the BEGIN and END markers
    if (i > 0 && i < parts.length - 1 && !parts[i].includes("BEGIN") && !parts[i].includes("END")) {
      parts[i] = parts[i].replace(/ /g, "\n");
    }
  }
  return parts.join("-----");
}

export async function registerServiceMetadata(
  peppolIdentifierEas: string,
  peppolIdentifierAddress: string,
  documentTypeCode: string,
  documentProcessIdCode: string,
) {
  const serviceGroupId = `${peppolIdentifierEas}:${peppolIdentifierAddress}`;
  const documentTypeId = `${DOCUMENT_SCHEME}::${documentTypeCode}`;
  
  // Encode the document type id
  const encodedDocumentTypeId = encodeURIComponent(documentTypeId);

  if (!process.env.AP_CERT) {
    throw new Error("AP_CERT environment variable is not set");
  }

  // Fix newlines in certificate content
  const fixedCert = fixNewlines(process.env.AP_CERT);

  // Create the XML body according to the Peppol style
  const serviceMetadataXml = {
    "smp:ServiceMetadata": {
      "@_xmlns:wsa": "http://www.w3.org/2005/08/addressing",
      "@_xmlns:smp": "http://busdox.org/serviceMetadata/publishing/1.0/",
      "@_xmlns:id": "http://busdox.org/transport/identifiers/1.0/",
      "smp:ServiceInformation": {
        "id:ParticipantIdentifier": {
          "@_scheme": PARTICIPANT_SCHEME,
          "#text": serviceGroupId
        },
        "id:DocumentIdentifier": {
          "@_scheme": DOCUMENT_SCHEME,
          "#text": documentTypeCode
        },
        "smp:ProcessList": {
          "smp:Process": {
            "id:ProcessIdentifier": {
              "@_scheme": PROCESS_SCHEME,
              "#text": documentProcessIdCode
            },
            "smp:ServiceEndpointList": {
              "smp:Endpoint": {
                "@_transportProfile": "peppol-transport-as4-v2_0",
                "wsa:EndpointReference": {
                  "wsa:Address": "https://ap.net.recommand.com/as4"
                },
                "smp:RequireBusinessLevelSignature": false,
                "smp:Certificate": fixedCert,
                "smp:ServiceDescription": "Recommand AS4 Service",
                "smp:TechnicalContactUrl": "https://recommand.com"
              }
            }
          }
        }
      }
    }
  };

  const response = await fetchSmp(
    `${PARTICIPANT_SCHEME}::${serviceGroupId}/services/${encodedDocumentTypeId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/xml"
      },
      body: builder.build(serviceMetadataXml)
    }
  );

  if (!response.ok) {
    console.error(await response.text());
    throw new UserFacingError("Failed to register service metadata in SMP");
  }

  return true;
}

export async function deleteServiceMetadata(
  peppolIdentifierEas: string,
  peppolIdentifierAddress: string,
  documentTypeCode: string,
) {
  const serviceGroupId = `${peppolIdentifierEas}:${peppolIdentifierAddress}`;
  const documentTypeId = `${DOCUMENT_SCHEME}::${documentTypeCode}`;
  const encodedDocumentTypeId = encodeURIComponent(documentTypeId);

  const response = await fetchSmp(
    `${PARTICIPANT_SCHEME}::${serviceGroupId}/services/${encodedDocumentTypeId}`,
    {
      method: "DELETE"
    }
  );

  if (!response.ok) {
    throw new UserFacingError("Failed to delete service metadata in SMP");
  }

  return true;
}