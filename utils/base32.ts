const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
    let result = "";
    let bits = 0;
    let value = 0;

    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;

        while (bits >= 5) {
            result += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
            bits -= 5;
        }
    }

    if (bits > 0) {
        result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
    }

    return result;
}