
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
        code: "DK",
        name: "Denmark",
        flag: "🇩🇰",
        defaultEnterpriseNumberScheme: "0184",
    },
    {
        code: "FI",
        name: "Finland",
        flag: "🇫🇮",
        defaultVatScheme: "0213",
        defaultEnterpriseNumberScheme: "0212",
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
        defaultEnterpriseNumberScheme: "0196",
    },
    {
        code: "IE",
        name: "Ireland",
        flag: "🇮🇪",
        defaultVatScheme: "9935",
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
        defaultVatScheme: "9945",
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
        defaultVatScheme: "9932",
    },
    {
        code: "AU",
        name: "Australia",
        flag: "🇦🇺",
        defaultEnterpriseNumberScheme: "0151",
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
        code: "US",
        name: "United States",
        flag: "🇺🇸",
    },
    {
        code: "AE",
        name: "United Arab Emirates",
        flag: "🇦🇪",
    },
].sort((a, b) => a.name.localeCompare(b.name));