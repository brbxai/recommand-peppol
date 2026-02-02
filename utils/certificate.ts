import { X509Certificate, createHash } from "crypto";

const cache = new Map<string, string | null>();

function fingerprint(base64Cert: string): string {
    const der = Buffer.from(base64Cert, "base64");
    return createHash("sha256").update(der).digest("hex");
}

/**
 * Parse a Base64-encoded X.509 certificate and return the notAfter date as ISO string.
 * Results are cached by certificate fingerprint — many companies share the same AP certificate.
 */
export function parseCertificateExpiry(base64Cert: string): string | null {
    const fp = fingerprint(base64Cert);

    if (cache.has(fp)) {
        return cache.get(fp) ?? null;
    }

    try {
        const pem = `-----BEGIN CERTIFICATE-----\n${base64Cert}\n-----END CERTIFICATE-----`;
        const cert = new X509Certificate(pem);
        const notAfter = new Date(cert.validTo).toISOString();
        cache.set(fp, notAfter);
        return notAfter;
    } catch {
        cache.set(fp, null);
        return null;
    }
}

export function clearCertificateCache(): void {
    cache.clear();
}
