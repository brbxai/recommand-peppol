export function removeAttachmentsFromParsedDocument(
  parsed: unknown
): unknown {
  if (!parsed || typeof parsed !== "object") {
    return parsed;
  }

  if ("attachments" in parsed && Array.isArray(parsed.attachments)) {
    return {
      ...parsed,
      attachments: null,
    };
  }

  return parsed;
}
