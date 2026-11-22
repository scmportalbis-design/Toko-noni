// Aturan password baru + pembuat password acak. Dipakai di sisi browser.
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72; // batas bcrypt, sama dengan fungsi database

// Mengembalikan pesan galat, atau null bila valid.
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return "Password terlalu panjang.";
  if (password !== confirm) return "Konfirmasi password tidak sama.";
  return null;
}

// Tanpa karakter yang mirip (0/O, 1/l/I) supaya mudah dibacakan ke kasir.
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePassword(length = 12): string {
  const limit = 256 - (256 % ALPHABET.length); // buang nilai berlebih agar sebaran merata
  let out = "";
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (b < limit && out.length < length) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}
