// Extend fetch with the bearer token
export function fetchSmp(url: string, options: {useTestNetwork?: boolean} & RequestInit) {
  const endpoint = options.useTestNetwork ? "https://test-smp.net.recommand.com" : "https://smp.net.recommand.com";
  const token = options.useTestNetwork ? process.env.PHOSS_SMP_TEST_TOKEN : process.env.PHOSS_SMP_TOKEN;
  return fetch(endpoint + "/" + url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}