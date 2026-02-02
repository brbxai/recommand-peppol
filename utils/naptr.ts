import { promises as dns } from "dns";
import type { NaptrRecord } from "dns";

export function parseNaptrRegexp(regexpField: string) {
    if (!regexpField || regexpField.length < 3) {
        throw new Error("Invalid NAPTR regexp field");
    }

    const delim = regexpField[0];
    const parts = regexpField.split(delim);

    if (parts.length < 3) {
        throw new Error("NAPTR regexp has too few parts");
    }

    const pattern = parts[1] ?? "";
    const replacement = parts[2] ?? "";
    const flags = parts[3] ?? "";

    const regex = new RegExp(pattern, flags);

    return { regex, replacement, flags };
}

export function applyNaptrRegexp(record: NaptrRecord, input: string): string {
    const { regex, replacement } = parseNaptrRegexp(record.regexp);
    return input.replace(regex, replacement);
}

export async function resolveNaptr(hostname: string): Promise<string | null> {
    try {
        const records = await dns.resolveNaptr(hostname);

        if (records && records.length > 0) {
            // Filter for SMP service records and sort by order/preference (lower = better)
            const smpRecords = records
                .filter(r => r.service && r.service.toLowerCase().includes("meta:smp"))
                .sort((a, b) => (a.order - b.order) || (a.preference - b.preference));

            const record = smpRecords[0] ?? records[0];

            let smpUrl: string | null = null;

            if (record.regexp) {
                try {
                    smpUrl = applyNaptrRegexp(record, record.replacement);
                } catch (error) { }
            }

            if (!smpUrl && record.replacement && record.replacement.trim() !== "") {
                smpUrl = record.replacement.trim();
            }

            if (!smpUrl) {
                return null;
            }

            if (!smpUrl.startsWith("http://") && !smpUrl.startsWith("https://")) {
                smpUrl = `https://${smpUrl}`;
            }

            return smpUrl;
        }
    } catch (error) {}

    return null;
}