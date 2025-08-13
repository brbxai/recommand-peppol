
export type CountryInfo = {
    code: string;
    name: string;
    flag: string;
    defaultVatScheme?: string | null;
    defaultEnterpriseNumberScheme?: string | null;
}

export const COUNTRIES: CountryInfo[] = [
    {
        code: "AT",
        name: "Austria",
        flag: "🇦🇹",
    },
    {
        code: "BE",
        name: "Belgium",
        flag: "🇧🇪",
        defaultVatScheme: "9925",
        defaultEnterpriseNumberScheme: "0208",
    },
    {
        code: "CY",
        name: "Cyprus",
        flag: "🇨🇾",
    },
    {
        code: "DK",
        name: "Denmark",
        flag: "🇩🇰",
    },
    {
        code: "FI",
        name: "Finland",
        flag: "🇫🇮",
    },
    {
        code: "FR",
        name: "France",
        flag: "🇫🇷",
        defaultEnterpriseNumberScheme: "0002",
    },
    {
        code: "DE",
        name: "Germany",
        flag: "🇩🇪",
        defaultVatScheme: "9930",
        defaultEnterpriseNumberScheme: "0204",
    },
    {
        code: "GR",
        name: "Greece",
        flag: "🇬🇷",
    },
    {
        code: "IS",
        name: "Iceland",
        flag: "🇮🇸",
    },
    {
        code: "IE",
        name: "Ireland",
        flag: "🇮🇪",
    },
    {
        code: "IT",
        name: "Italy",
        flag: "🇮🇹",
    },
    {
        code: "NL",
        name: "Netherlands",
        flag: "🇳🇱",
        defaultVatScheme: "9944",
        defaultEnterpriseNumberScheme: "0106",
    },
    {
        code: "NO",
        name: "Norway",
        flag: "🇳🇴",
    },
    {
        code: "PL",
        name: "Poland",
        flag: "🇵🇱",
    },
    {
        code: "SE",
        name: "Sweden",
        flag: "🇸🇪",
    },
    {
        code: "GB",
        name: "United Kingdom",
        flag: "🇬🇧",
    },
    {
        code: "AU",
        name: "Australia",
        flag: "🇦🇺",
    },
    {
        code: "CN",
        name: "China",
        flag: "🇨🇳",
    },
    {
        code: "IN",
        name: "India",
        flag: "🇮🇳",
    },
    {
        code: "JP",
        name: "Japan",
        flag: "🇯🇵",
    },
    {
        code: "MY",
        name: "Malaysia",
        flag: "🇲🇾",
    },
    {
        code: "NZ",
        name: "New Zealand",
        flag: "🇳🇿",
    },
    {
        code: "SG",
        name: "Singapore",
        flag: "🇸🇬",
    },
    {
        code: "CA",
        name: "Canada",
        flag: "🇨🇦",
    },
    {
        code: "MX",
        name: "Mexico",
        flag: "🇲🇽",
    },
    {
        code: "US",
        name: "United States",
        flag: "🇺🇸",
    },

    {
        code: "AM",
        name: "Armenia",
        flag: "🇦🇲",
    },
    {
        code: "ZA",
        name: "South Africa",
        flag: "🇿🇦",
    },
    {
        code: "AE",
        name: "United Arab Emirates",
        flag: "🇦🇪",
    },
].sort((a, b) => a.name.localeCompare(b.name));