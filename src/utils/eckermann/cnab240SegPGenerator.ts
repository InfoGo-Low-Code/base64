import { TecnoJurisSchema } from '@/schemas/eckermann/tecnoJurisSchema'

const BANCO = '001'
const NOME_EMPRESA = 'ECKERMANN E SANTOS SOCIEDADE DE ADVOGADOS'
const CNPJ_EMPRESA = '11252148000130'

function pad(v: any, len: number, char = ' ', left = true) {
  const s = String(v ?? '')
  if (s.length > len) return s.slice(0, len)
  return left ? s.padEnd(len, char) : s.padStart(len, char)
}

function num(v: number, len: number) {
  return pad(Math.round(v * 100), len, '0', false)
}

function date(d: Date) {
  return `${d.getDate().toString().padStart(2, '0')}${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}${d.getFullYear()}`
}

export class CNAB240PagamentoBoletoGenerator {
  private lines: string[] = []
  private lote = 1
  private seq = 0
  private total = 0

  headerArquivo() {
    this.lines.push(
      BANCO +
        '0000' +
        '0' +
        pad('', 9) +
        '2' +
        pad(CNPJ_EMPRESA, 14, '0', false) +
        pad('', 20) +
        pad(NOME_EMPRESA, 30) +
        pad('BANCO DO BRASIL', 30) +
        pad('', 10) +
        '1' +
        date(new Date()) +
        pad('', 6) +
        pad('', 74)
    )
  }

  headerLote() {
    this.lines.push(
      BANCO +
        pad(this.lote, 4, '0', false) +
        '1P20' +
        '030' + // Pagamento de títulos
        '045' +
        pad('', 1) +
        '2' +
        pad(CNPJ_EMPRESA, 14, '0', false) +
        pad('', 40) +
        pad(NOME_EMPRESA, 30) +
        pad('', 80) +
        pad('', 40)
    )
  }

  segmentoJ(r: TecnoJurisSchema) {
    this.seq++
    this.total += r.valor

    this.lines.push(
      BANCO +
        pad(this.lote, 4, '0', false) +
        '3' +
        pad(this.seq, 5, '0', false) +
        'J' +
        '01' +
        pad(r.codigoBarras.replace(/\D/g, ''), 44, '0', false) +
        date(new Date(r.dataPagamento)) +
        num(r.valor, 15) +
        pad('', 150)
    )
  }

  trailerLote() {
    this.lines.push(
      BANCO +
        pad(this.lote, 4, '0', false) +
        '5' +
        pad('', 9) +
        pad(this.seq + 2, 6, '0', false) +
        num(this.total, 18) +
        pad('', 193)
    )
  }

  trailerArquivo() {
    this.lines.push(
      BANCO +
        '9999' +
        '9' +
        pad('', 9) +
        pad('1', 6, '0', false) +
        pad(this.lines.length + 1, 6, '0', false) +
        pad('', 205)
    )
  }

  generate(records: TecnoJurisSchema[]) {
    this.lines = []
    this.seq = 0
    this.total = 0

    this.headerArquivo()
    this.headerLote()

    for (const r of records) {
      this.segmentoJ(r)
    }

    this.trailerLote()
    this.trailerArquivo()

    return this.lines.join('\n')
  }
}
