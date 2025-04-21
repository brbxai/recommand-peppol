import { fetchPeppolDirectory } from "./client";

export type PeppolDirectorySearchResult = {
  peppolAddress: string;
  name: string;
  supportedDocumentTypes: string[];
}

export async function searchPeppolDirectory(query: string): Promise<PeppolDirectorySearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const response = await fetchPeppolDirectory(`search/1.0/json?q=${encodedQuery}`);
  const data = await response.json();
  
  return data.matches.map((match: any) => ({
    peppolAddress: match.participantID.value,
    name: match.entities?.[0]?.name?.[0]?.name ?? '',
    supportedDocumentTypes: match.docTypes?.map((doc: any) => doc.value) ?? []
  }));
}