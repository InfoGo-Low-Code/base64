export function normalize(str: string) {
  return String(str)
    .normalize('NFD') // separa acentos
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toUpperCase()
    .trim()
}