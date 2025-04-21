export function fetchPeppolDirectory(url: string, options?: RequestInit) {
  return fetch("https://directory.peppol.eu/" + url, options);
}