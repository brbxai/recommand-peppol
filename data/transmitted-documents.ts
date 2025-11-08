import { supportedDocumentTypeEnum, transmittedDocuments, transmittedDocumentLabels, labels } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq, and, sql, desc, isNull, inArray, or, ilike, SQL } from "drizzle-orm";
import type { Label } from "./labels";

export type TransmittedDocument = typeof transmittedDocuments.$inferSelect;
export type InsertTransmittedDocument = typeof transmittedDocuments.$inferInsert;

// Create a type that excludes the body field but includes parsed data
export type TransmittedDocumentWithoutBody = Omit<TransmittedDocument, "xml"> & {
  labels?: Omit<Label, "createdAt" | "updatedAt">[];
};

async function getLabelsForDocuments(documentIds: string[]): Promise<Map<string, Omit<Label, "createdAt" | "updatedAt">[]>> {
  const documentLabelsMap = new Map<string, Omit<Label, "createdAt" | "updatedAt">[]>();

  if (documentIds.length === 0) {
    return documentLabelsMap;
  }

  const documentLabels = await db
    .select({
      documentId: transmittedDocumentLabels.transmittedDocumentId,
      id: labels.id,
      teamId: labels.teamId,
      externalId: labels.externalId,
      name: labels.name,
      colorHex: labels.colorHex,
    })
    .from(transmittedDocumentLabels)
    .innerJoin(labels, eq(transmittedDocumentLabels.labelId, labels.id))
    .where(inArray(transmittedDocumentLabels.transmittedDocumentId, documentIds));

  for (const label of documentLabels) {
    const existing = documentLabelsMap.get(label.documentId) || [];
    documentLabelsMap.set(label.documentId, [
      ...existing,
      {
        id: label.id,
        teamId: label.teamId,
        externalId: label.externalId,
        name: label.name,
        colorHex: label.colorHex,
      },
    ]);
  }

  return documentLabelsMap;
}

export async function getTransmittedDocuments(
  teamId: string,
  options: {
    page?: number;
    limit?: number;
    companyId?: string[];
    direction?: "incoming" | "outgoing";
    search?: string;
    type?: (typeof supportedDocumentTypeEnum.enumValues)[number];
  } = {}
): Promise<{ documents: TransmittedDocumentWithoutBody[]; total: number }> {
  const { page = 1, limit = 10, companyId, direction, search, type } = options;
  const offset = (page - 1) * limit;

  // Build the where clause
  const whereClause = [eq(transmittedDocuments.teamId, teamId)];
  if (companyId) {
    whereClause.push(inArray(transmittedDocuments.companyId, companyId));
  }
  if (direction) {
    whereClause.push(eq(transmittedDocuments.direction, direction));
  }
  if (type) {
    whereClause.push(eq(transmittedDocuments.type, type));
  }
  if (search) {
    whereClause.push(
      or(
        ilike(transmittedDocuments.id, `%${search}%`),
        ilike(transmittedDocuments.senderId, `%${search}%`),
        ilike(transmittedDocuments.receiverId, `%${search}%`),
        ilike(transmittedDocuments.docTypeId, `%${search}%`),
        ilike(transmittedDocuments.processId, `%${search}%`),
        ilike(transmittedDocuments.countryC1, `%${search}%`)
      ) as SQL
    );
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
      readAt: transmittedDocuments.readAt,
      createdAt: transmittedDocuments.createdAt,
      updatedAt: transmittedDocuments.updatedAt,
      type: transmittedDocuments.type,
      sentOverPeppol: transmittedDocuments.sentOverPeppol,
      sentOverEmail: transmittedDocuments.sentOverEmail,
      emailRecipients: transmittedDocuments.emailRecipients,
      parsed: transmittedDocuments.parsed,
    })
    .from(transmittedDocuments)
    .where(and(...whereClause))
    .orderBy(desc(transmittedDocuments.createdAt))
    .limit(limit)
    .offset(offset);

  const documentIds = documents.map((doc) => doc.id);
  const documentLabelsMap = await getLabelsForDocuments(documentIds);

  const documentsWithLabels = documents.map((doc) => ({
    ...doc,
    labels: documentLabelsMap.get(doc.id) || [],
  }));

  return { documents: documentsWithLabels, total };
}

export async function deleteTransmittedDocument(
  teamId: string,
  documentId: string
): Promise<void> {
  await db
    .delete(transmittedDocuments)
    .where(and(eq(transmittedDocuments.id, documentId), eq(transmittedDocuments.teamId, teamId)));
}

export async function getInbox(
  teamId: string,
  companyId?: string
): Promise<(Omit<TransmittedDocument, "xml" | "parsed"> & { labels?: Omit<Label, "createdAt" | "updatedAt">[] })[]> {
  // Build the where clause
  const whereClause = [
    eq(transmittedDocuments.teamId, teamId),
    eq(transmittedDocuments.direction, "incoming"),
    isNull(transmittedDocuments.readAt)
  ];

  if (companyId) {
    whereClause.push(eq(transmittedDocuments.companyId, companyId));
  }

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
      readAt: transmittedDocuments.readAt,
      createdAt: transmittedDocuments.createdAt,
      updatedAt: transmittedDocuments.updatedAt,
      type: transmittedDocuments.type,
      sentOverPeppol: transmittedDocuments.sentOverPeppol,
      sentOverEmail: transmittedDocuments.sentOverEmail,
      emailRecipients: transmittedDocuments.emailRecipients,
    })
    .from(transmittedDocuments)
    .where(and(...whereClause))
    .orderBy(desc(transmittedDocuments.createdAt));

  const documentIds = documents.map((doc) => doc.id);
  const documentLabelsMap = await getLabelsForDocuments(documentIds);

  const documentsWithLabels = documents.map((doc) => ({
    ...doc,
    labels: documentLabelsMap.get(doc.id) || [],
  }));

  return documentsWithLabels;
}

export async function markAsRead(teamId: string, documentId: string, read: boolean = true): Promise<void> {
  // First check if the document exists
  const document = await db
    .select({ id: transmittedDocuments.id })
    .from(transmittedDocuments)
    .where(
      and(
        eq(transmittedDocuments.id, documentId),
        eq(transmittedDocuments.teamId, teamId)
      )
    )
    .limit(1);

  if (document.length === 0) {
    throw new Error("Document not found");
  }

  // Update the document
  await db
    .update(transmittedDocuments)
    .set({
      readAt: read ? new Date() : null,
    })
    .where(
      and(
        eq(transmittedDocuments.id, documentId),
        eq(transmittedDocuments.teamId, teamId)
      )
    );
}

export async function getTransmittedDocument(
  teamId: string,
  documentId: string
): Promise<(TransmittedDocument & { labels?: Omit<Label, "createdAt" | "updatedAt">[] }) | null> {
  const document = await db
    .select()
    .from(transmittedDocuments)
    .where(
      and(
        eq(transmittedDocuments.id, documentId),
        eq(transmittedDocuments.teamId, teamId)
      )
    )
    .limit(1);

  if (!document[0]) {
    return null;
  }

  const documentLabelsMap = await getLabelsForDocuments([documentId]);

  return {
    ...document[0],
    labels: documentLabelsMap.get(documentId) || [],
  };
}
