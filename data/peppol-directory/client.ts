export function fetchPeppolDirectory(url: string, options?: { useTestNetwork: boolean } & RequestInit) {
  const endpoint = options?.useTestNetwork ? "https://test-directory.peppol.eu" : "https://directory.peppol.eu";
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // Abort after 8 seconds
  
  const { useTestNetwork, signal: existingSignal, ...fetchOptions } = options || {};
  
  return fetch(endpoint + "/" + url, {
    ...fetchOptions,
    signal: existingSignal ? (() => {
      const combinedController = new AbortController();
      existingSignal.addEventListener("abort", () => combinedController.abort());
      controller.signal.addEventListener("abort", () => combinedController.abort());
      return combinedController.signal;
    })() : controller.signal,
  }).finally(() => {
    clearTimeout(timeoutId);
  });
}