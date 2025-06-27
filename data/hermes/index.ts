import { $ } from "bun";
import { XMLParser } from "fast-xml-parser";

export async function getMigrationToken(peppolAddress: string) {
  // Make the request to Hermes SMP API by running get_migration_key script
  try{
    const response = await $`../../get_migration_key ${peppolAddress}`;
    const responseText = response.stdout.toString();
  
    console.log(responseText);
    const parser = new XMLParser();
    const xmlDoc = parser.parse(responseText);
  
    // Extract the migration token from the response
    const migrationToken = xmlDoc?.MigrationToken;
    if (!migrationToken) {
      throw new Error('No migration token found in response');
    }
  
    return migrationToken;
  }catch(error) {
    console.error(error);
    throw new Error(`Failed to get migration token. The company you are trying to register is probably already registered with a different Peppol Access Point. Please ensure this is not the case. Feel free to contact support@recommand.eu if you are unsure about how to proceed.`);
  }
}