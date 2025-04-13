import { transmittedDocuments } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq, and, sql, desc } from "drizzle-orm";

export type TransmittedDocument = typeof transmittedDocuments.$inferSelect;
export type InsertTransmittedDocument = typeof transmittedDocuments.$inferInsert;

// Create a type that excludes the body field
export type TransmittedDocumentWithoutBody = Omit<TransmittedDocument, 'body'>;

export async function getTransmittedDocuments(
  teamId: string,
  options: {
    page?: number;
    limit?: number;
    companyId?: string;
    direction?: "incoming" | "outgoing";
  } = {}
): Promise<{ documents: TransmittedDocumentWithoutBody[]; total: number }> {
  const { page = 1, limit = 10, companyId, direction } = options;
  const offset = (page - 1) * limit;

  // Build the where clause
  const whereClause = [eq(transmittedDocuments.teamId, teamId)];
  if (companyId) {
    whereClause.push(eq(transmittedDocuments.companyId, companyId));
  }
  if (direction) {
    whereClause.push(eq(transmittedDocuments.direction, direction));
  }

  // Get total count
  const total = await db
    .select({ count: sql<number>`count(*)` })
    .from(transmittedDocuments)
    .where(and(...whereClause))
    .then((rows) => rows[0].count);

  // Get paginated results
  const documents = await db
    .select({
      id: transmittedDocuments.id,
      teamId: transmittedDocuments.teamId,
      companyId: transmittedDocuments.companyId,
      direction: transmittedDocuments.direction,
      senderId: transmittedDocuments.senderId,
      receiverId: transmittedDocuments.receiverId,
      docTypeId: transmittedDocuments.docTypeId,
      processId: transmittedDocuments.processId,
      countryC1: transmittedDocuments.countryC1,
      createdAt: transmittedDocuments.createdAt,
      updatedAt: transmittedDocuments.updatedAt,
    })
    .from(transmittedDocuments)
    .where(and(...whereClause))
    .orderBy(desc(transmittedDocuments.createdAt))
    .limit(limit)
    .offset(offset);

  return { documents, total };
}

export async function deleteTransmittedDocument(
  teamId: string,
  documentId: string
): Promise<void> {
  await db
    .delete(transmittedDocuments)
    .where(and(eq(transmittedDocuments.id, documentId), eq(transmittedDocuments.teamId, teamId)));
}
