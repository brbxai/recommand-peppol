import { fetchSmp } from "./client";
import { XMLBuilder } from "fast-xml-parser";

const PARTICIPANT_SCHEME = "iso6523-actorid-upis";
const DOCUMENT_SCHEME = "busdox-docid-qns";
const PROCESS_SCHEME = "cenbii-procid-ubl";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  suppressBooleanAttributes: true,
});

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
                  "wsa:Address": "https://ap.net.recommand.com"
                },
                "smp:RequireBusinessLevelSignature": false,
                "smp:Certificate": process.env.AP_CERT,
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
    throw new Error("Failed to register service metadata");
  }

  return true;
}