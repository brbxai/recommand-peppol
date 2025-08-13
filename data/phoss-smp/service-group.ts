import { UserFacingError } from "@peppol/utils/util";
import { fetchSmp } from "./client";
import { XMLBuilder } from "fast-xml-parser";

const SCHEME = "iso6523-actorid-upis";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  suppressBooleanAttributes: true,
});

export async function registerServiceGroup(
  peppolIdentifierEas: string,
  peppolIdentifierAddress: string
) {
  const serviceGroupId = `${peppolIdentifierEas}:${peppolIdentifierAddress}`;
  
  // Create the XML body according to the Peppol style
  const serviceGroupXml = {
    "smp:ServiceGroup": {
      "@_xmlns:smp": "http://busdox.org/serviceMetadata/publishing/1.0/",
      "@_xmlns:id": "http://busdox.org/transport/identifiers/1.0/",
      "id:ParticipantIdentifier": {
        "@_scheme": SCHEME,
        "#text": serviceGroupId
      },
      "smp:ServiceMetadataReferenceCollection": {}
    }
  };

  const response = await fetchSmp(
    `${SCHEME}::${serviceGroupId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/xml"
      },
      body: builder.build(serviceGroupXml)
    }
  );

  if (!response.ok) {
    console.error(await response.text());
    throw new UserFacingError("Failed to register service group in SMP");
  }

  const data = await response.json();
  return data;
}

export async function deleteServiceGroup(
  peppolIdentifierEas: string,
  peppolIdentifierAddress: string
) {
  const serviceGroupId = `${peppolIdentifierEas}:${peppolIdentifierAddress}`;
  
  const response = await fetchSmp(
    `${SCHEME}::${serviceGroupId}`,
    {
      method: "DELETE"
    }
  );

  if (!response.ok) {
    console.error("Failed to delete service group in SMP");
    console.error(await response.text());
    throw new UserFacingError("Failed to delete service group in SMP");
  }

  return true;
}

export async function migrateParticipantToOurSMP(
  peppolIdentifierEas: string,
  peppolIdentifierAddress: string,
  migrationKey: string
) {
  const serviceGroupId = `${peppolIdentifierEas}:${peppolIdentifierAddress}`;
  
  const response = await fetchSmp(
    `migration/inbound/${SCHEME}::${serviceGroupId}/${migrationKey}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  if (!response.ok) {
    console.error(await response.text());
    throw new UserFacingError("Failed to migrate participant to our SMP");
  }

  return true;
}
