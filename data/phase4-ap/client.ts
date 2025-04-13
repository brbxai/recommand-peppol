// Extend fetch with the Phase4 token
export function fetchPhase4Ap(url: string, options: RequestInit) {
  return fetch("https://ap.net.recommand.com/" + url, {
    ...options,
    headers: {
      ...options.headers,
      "X-Token": process.env.PHASE4_AP_TOKEN!,
    },
  });
}

export function sendAs4(options: {
  senderId: string;
  receiverId: string;
  docTypeId: string;
  processId: string;
  countryC1: string;
  body: string; // XML string
}) {
  const { senderId, receiverId, docTypeId, processId, countryC1, body } = options;

  // Properly encode all the parameters
  const encodedSenderId = encodeURIComponent(senderId);
  const encodedReceiverId = encodeURIComponent(receiverId);
  const encodedDocTypeId = encodeURIComponent(docTypeId);
  const encodedProcessId = encodeURIComponent(processId);
  const encodedCountryC1 = encodeURIComponent(countryC1);
  
  return fetchPhase4Ap(`/sendas4/${encodedSenderId}/${encodedReceiverId}/${encodedDocTypeId}/${encodedProcessId}/${encodedCountryC1}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
    },
    body,
  });
}