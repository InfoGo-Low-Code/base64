import { TecnoJurisSchema } from '@/schemas/eckermann/tecnoJurisSchema'

const BANCO = '001'
const AGENCIA = '0001'
const CONTA = '000000000001'
const DV_CONTA = ' '
const CONVENIO = '000000000'
const NOME_EMPRESA = 'ECKERMANN E SANTOS SOCIEDADE DE ADVOGADOS'
const CNPJ_EMPRESA = '11252148000130'

function pad(
  value: any,
  length: number,
  char: string = ' ',
  alignLeft: boolean = true,
) {
  const str = String(value ?? '')
  if (str.length > length) return str.slice(0, length)
  return alignLeft ? str.padEnd(length, char) : str.padStart(length, char)
}

function num(value: number, length: number) {
  const v = Math.round(Number(value ?? 0) * 100)
  return pad(v, length, '0', false)
}

function dateCNAB(date: Date) {
  const d = new Date(date)
  return (
    String(d.getDate()).padStart(2, '0') +
    String(d.getMonth() + 1).padStart(2, '0') +
    d.getFullYear()
  )
}

function assert240(line: string, label: string) {
  if (line.length !== 240) {
    throw new Error(
      `${label} inválido: ${line.length} caracteres (esperado 240)`
    )
  }
}

export class CNAB240PagamentoBoletoGenerator {
  private lines: string[] = []
  private lote = 1
  private seq = 0
  private total = 0

  // =========================
  // HEADER DE ARQUIVO (0)
  // =========================
  headerArquivo() {
  const line =
    BANCO +                          // 001
    '0000' +                         // lote
    '0' +                            // tipo registro
    pad('', 9) +                     // uso FEBRABAN
    '2' +                            // tipo inscrição
    pad(CNPJ_EMPRESA, 14, '0', false) +
    pad(AGENCIA, 4, '0', false) +
    pad('', 1) +                     // DV agência
    pad(CONTA, 12, '0', false) +
    pad(DV_CONTA, 1) +
    pad(CONVENIO, 9, '0', false) +
    pad(NOME_EMPRESA, 30) +
    pad('BANCO DO BRASIL', 30) +
    pad('', 10) +                    // uso FEBRABAN
    '1' +                            // remessa
    dateCNAB(new Date()) +           // data geração
    pad('', 6) +                     // hora
    '081' +                          // versão layout
    '01600' +                        // densidade gravação
    pad('', 79) +                    // uso FEBRABAN
    pad('', 9)                       // complemento

  assert240(line, 'Header Arquivo')
  this.lines.push(line)
}


  // =========================
  // HEADER DE LOTE (1)
  // =========================
  headerLote() {
    const line =
      BANCO +
      pad(this.lote, 4, '0', false) +
      '1' +
      'P' +
      '20' +                          // pagamento de títulos
      '030' +                         // forma lançamento
      '045' +                         // layout
      pad('', 1) +
      '2' +
      pad(CNPJ_EMPRESA, 14, '0', false) +
      pad(CONVENIO, 20) +
      pad(AGENCIA, 5, '0', false) +
      pad(CONTA, 12, '0', false) +
      pad(DV_CONTA, 1) +
      pad(NOME_EMPRESA, 30) +
      pad('', 40) +
      pad('', 40) +
      pad('', 59)

    assert240(line, 'Header Lote')
    this.lines.push(line)
  }

  // =========================
  // SEGMENTO J
  // =========================
  segmentoJ(r: TecnoJurisSchema) {
    this.seq++
    this.total += Number(r.valor ?? 0)

    const line =
      BANCO +
      pad(this.lote, 4, '0', false) +
      '3' +
      pad(this.seq, 5, '0', false) +
      'J' +
      '0' +                              // tipo movimento
      '01' +                             // código instrução
      '09' +                             // ✅ código da moeda (REAL)
      pad(r.codigoBarras.replace(/\D/g, ''), 44, '0', false) +
      pad(r.nomeBeneficiario ?? '', 30) +
      dateCNAB(new Date(r.dataVencimentoBoleto)) +
      num(r.valor, 15) +                 // valor título
      num(0, 15) +                       // desconto
      num(0, 15) +                       // acréscimo
      dateCNAB(new Date(r.dataPagamento)) +
      num(r.valor, 15) +                 // valor pago
      pad('', 20) +      // ✅ Nosso Número do boleto
      pad(r.id ?? '', 20) +               // seuNumero (controle interno)
      pad('', 21) +                      // uso FEBRABAN
      pad('', 10)                        // ocorrências

    assert240(line, 'Segmento J')
    this.lines.push(line)
  }



  // =========================
  // TRAILER DE LOTE (5)
  // =========================
  trailerLote() {
    const qtdRegistros = this.seq + 2        // header + segmentos + trailer
    const qtdTitulos = this.seq              // quantidade de Segmento J

    const line =
      BANCO +
      pad(this.lote, 4, '0', false) +
      '5' +
      pad('', 9) +
      pad(qtdRegistros, 6, '0', false) +
      pad(qtdTitulos, 6, '0', false) +       // ✅ QUANTIDADE DE TÍTULOS
      num(this.total, 18) +
      pad('', 193)                           // 🔥 ajustado

    assert240(line, 'Trailer Lote')
    this.lines.push(line)
  }

  // =========================
  // TRAILER DE ARQUIVO (9)
  // =========================
  trailerArquivo() {
    const qtdLotes = 1
    const qtdRegistros = this.lines.length + 1
    const qtdContas = 0

    const line =
      BANCO +
      '9999' +
      '9' +
      pad('', 9) +
      pad(qtdLotes, 6, '0', false) +      // quantidade de lotes
      pad(qtdRegistros, 6, '0', false) +  // quantidade de registros
      pad(qtdContas, 6, '0', false) +     // ✅ quantidade de contas
      pad('', 205)                        // 🔥 complemento correto

    assert240(line, 'Trailer Arquivo')
    this.lines.push(line)
  }


  // =========================
  // GERAÇÃO FINAL
  // =========================
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

    return this.lines.join('\r\n')
  }
}
