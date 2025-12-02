export function fetchPeppolDirectory(url: string, options?: { useTestNetwork: boolean } & RequestInit) {
  const endpoint = options?.useTestNetwork ? "https://test-directory.peppol.eu" : "https://directory.peppol.eu";
  return fetch(endpoint + "/" + url, options);
}