// Extend fetch with the bearer token
export function fetchSmp(url: string, options: RequestInit) {
  return fetch("https://smp.net.recommand.com/" + url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${process.env.PHOSS_SMP_TOKEN}`,
    },
  });
}