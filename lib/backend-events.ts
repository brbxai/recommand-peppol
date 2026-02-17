import { teamExtensions } from "@peppol/db/schema";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { ExtractTablesWithRelations } from "drizzle-orm";

export async function onTeamCreated(_event: string, context: { id: string, tx: PgTransaction<NodePgQueryResultHKT, Record<string, never>, ExtractTablesWithRelations<Record<string, never>>> }) {
  console.log("onTeamCreated", context);
  // This is not triggered for playground teams, as they are created through a non-core API

  // Create a new team extension with verification requirements set to strict
  await context.tx.insert(teamExtensions).values({
    id: context.id,
    isPlayground: false,
    useTestNetwork: false,
    verificationRequirements: "strict",
  });
}