import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

const algorithm = "aes-256-cbc"
const key = randomBytes(32) // salvar isso!
const iv = randomBytes(16)

export function encryptTecnoJuris(text: string) {
  const cipher = createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  return { encrypted, iv: iv.toString("hex") }
}

export function decryptTecnoJuris(encrypted: string, ivHex: string) {
  const decipher = createDecipheriv(
    algorithm,
    key,
    Buffer.from(ivHex, "hex")
  )

  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}
