import { TecnoJurisSchema } from '@/schemas/eckermann/tecnoJurisSchema'

// Configurações do Convênio e Banco (mock/hardcoded para começar)
const BANCO_BB_CODIGO = '001'
const BANCO_BB_NOME = 'BANCO DO BRASIL S.A.'
const CODIGO_CONVENIO = '000408652' // Seu número de convênio BB (9 dígitos)
const NOME_EMPRESA = 'ECKERMANN YAEGASHI E SANTOS' // CORREÇÃO: Truncado para 30 posições
const AGENCIA = '0001' // Exemplo de Agência
const CONTA_CORRENTE = '0000000001' // Exemplo de Conta (10 posições)
const DIGITO_VERIFICADOR = 'X' // Exemplo de DV (necessário verificar no BB)

// --- Funções de Utilitário para CNAB ---

/**
 * Preenche o valor para o tamanho fixo, usando o caractere e alinhamento corretos.
 * @param value Valor a ser preenchido (string, number, Date).
 * @param length Comprimento total esperado.
 * @param paddingChar Caractere de preenchimento ('0' para números, ' ' para alfanuméricos).
 * @param align Alinhamento ('R' para direita/números, 'L' para esquerda/alfanuméricos).
 * @returns String formatada com o comprimento exato.
 */
function pad(
  value: string | number,
  length: number,
  paddingChar: string,
  align: 'L' | 'R',
): string {
  const strValue = String(value)
  if (strValue.length > length) {
    // Esta mensagem de erro indica que o valor de entrada AINDA precisa de pré-processamento/truncamento.
    console.error(`CNAB Error: Value "${strValue}" exceeds length ${length}`)
    // A função retorna o valor truncado, mas o erro será logado.
    return strValue.substring(0, length)
  }

  return align === 'R'
    ? strValue.padStart(length, paddingChar) // Alinha à direita (padrão para números)
    : strValue.padEnd(length, paddingChar) // Alinha à esquerda (padrão para strings)
}

/**
 * Formata um valor numérico para o CNAB (direita, preenchido com '0', sem separadores).
 * Ex: 1234.56 -> 0000123456 (length 10)
 * @param value O número.
 * @param totalLength Comprimento total esperado (incluindo centavos).
 * @param decimals Número de casas decimais (padrão 2).
 */
function formatCNABNumber(
  value: number,
  totalLength: number,
  decimals: number = 2,
): string {
  // Converte para string com o número correto de decimais e remove o ponto
  const multiplier = Math.pow(10, decimals)
  const integerValue = Math.round(value * multiplier)
  return pad(integerValue, totalLength, '0', 'R')
}

/**
 * Formata a data atual no formato DDMMAAAA.
 */
function formatDate(date: Date = new Date()): string {
  const day = pad(date.getDate(), 2, '0', 'R')
  const month = pad(date.getMonth() + 1, 2, '0', 'R')
  const year = date.getFullYear().toString()
  return `${day}${month}${year}`
}

/**
 * Formata a hora atual no formato HHMMSS.
 */
function formatTime(date: Date = new Date()): string {
  const hour = pad(date.getHours(), 2, '0', 'R')
  const minute = pad(date.getMinutes(), 2, '0', 'R')
  const second = pad(date.getSeconds(), 2, '0', 'R')
  return `${hour}${minute}${second}`
}

// --- CLASSE PRINCIPAL ---

export class CNAB240Generator {
  private fileRecords: string[] = []
  private batchCount = 0
  private recordCount = 0
  private batchDetailCount = 0
  private totalValueInBatch = 0
  private today: Date

  constructor() {
    this.today = new Date()
  }

  /**
   * 1. Geração do HEADER DE ARQUIVO (Registro Tipo 0)
   */
  private generateHeaderArquivo(): string {
    let line = ''
    line += pad(BANCO_BB_CODIGO, 3, '0', 'R') // P.001-003: Cód. Banco (001)
    line += pad('0000', 4, '0', 'R') // P.004-007: Lote de Serviço (0000)
    line += pad('0', 1, '0', 'R') // P.008-008: Tipo de Registro (0)
    line += pad('', 9, ' ', 'L') // P.009-017: FEBRABAN/CNAB (Brancos)

    // P.018-018: Tipo de Inscrição da Empresa (1-CPF, 2-CNPJ)
    line += pad('2', 1, '0', 'R') 
    // P.019-033: Número de Inscrição da Empresa (CNPJ) - 15 posições
    line += pad('999999999999999', 15, '0', 'R') // Exemplo de CNPJ
    
    // P.034-037: Agência Mantenedora (4 pos)
    line += pad(AGENCIA, 4, '0', 'R') 
    
    // P.038-046: Código do Convênio no Banco (9 pos)
    line += pad(CODIGO_CONVENIO, 9, '0', 'R') 
    
    // P.047-047: Tipo de Conta Corrente (1 pos: 1 - Corrente)
    line += pad('1', 1, '0', 'R') 

    // P.048-059: Nro. Conta Corrente (12 pos)
    line += pad(CONTA_CORRENTE, 12, '0', 'R') 
    
    // P.060-060: Código DV Conta (1 pos)
    line += pad(DIGITO_VERIFICADOR, 1, ' ', 'L') 

    // P.061-090: Nome da Empresa (30 pos)
    line += pad(NOME_EMPRESA, 30, ' ', 'L') 
    
    // P.091-120: Nome do Banco (30 pos)
    line += pad(BANCO_BB_NOME, 30, ' ', 'L') 
    
    // P.121-130: Uso Exclusivo FEBRABAN/CNAB (Brancos) (10 pos)
    line += pad('', 10, ' ', 'L') 

    // P.131-131: Arquivo Código (1-Remessa) (1 pos)
    line += pad('1', 1, '0', 'R')
    
    // P.132-139: Data de Geração (8 pos)
    line += formatDate(this.today) 
    
    // P.140-145: Hora de Geração (6 pos)
    line += formatTime(this.today) 
    
    // P.146-151: Nro Sequencial do Arquivo (6 pos)
    line += pad('000001', 6, '0', 'R') 
    
    // P.152-154: Nro da Versão do Layout do Arquivo (087 - Pagamentos) (3 pos)
    line += pad('087', 3, '0', 'R') 

    // P.155-234: Uso Exclusivo FEBRABAN/CNAB (Brancos) (80 pos)
    line += pad('', 80, ' ', 'L') 
    
    // P.235-240: Densidade de Gravação (6 pos)
    line += pad('000001', 6, '0', 'R') 

    // A linha final do registro deve ter exatamente 240 caracteres.
    if (line.length !== 240) {
        throw new Error(`Header de Arquivo: Tamanho incorreto (${line.length})`)
    }

    this.fileRecords.push(line)
    this.recordCount++
    return line
  }

  /**
   * 2. Geração do HEADER DE LOTE (Registro Tipo 1)
   */
  private generateHeaderLote(): string {
    this.batchCount++
    this.batchDetailCount = 0
    this.totalValueInBatch = 0

    let line = ''
    line += pad(BANCO_BB_CODIGO, 3, '0', 'R') // P.001-003: Cód. Banco (001)
    line += pad(this.batchCount, 4, '0', 'R') // P.004-007: Nro do Lote (1)
    line += pad('1', 1, '0', 'R') // P.008-008: Tipo de Registro (1)
    line += pad('P', 1, ' ', 'L') // P.009-009: Tipo de Operação (P - Pagamento)
    
    // P.010-011: Tipo de Serviço (20 - Pagamento Fornecedor)
    line += pad('20', 2, '0', 'R') 
    
    line += pad('040', 3, '0', 'R') // P.012-014: Forma de Lançamento (040 - Crédito em Conta Corrente)
    line += pad('087', 3, '0', 'R') // P.015-017: Nro da Versão do Layout do Lote (087)
    line += pad('', 1, ' ', 'L') // P.018-018: Uso Exclusivo FEBRABAN/CNAB (Brancos)

    // P.019-021: Tipo de Inscrição da Empresa (2 - CNPJ)
    line += pad('2', 1, '0', 'R') 
    line += pad('999999999999999', 15, '0', 'R') // P.022-036: Nro de Inscrição da Empresa (CNPJ)

    // P.037-054: Código do Convênio no Banco (18 posições)
    line += pad(CODIGO_CONVENIO, 18, '0', 'R') 

    line += pad('', 20, ' ', 'L') // P.055-074: Brancos
    line += pad(NOME_EMPRESA, 30, ' ', 'L') // P.075-104: Nome da Empresa
    line += pad('', 80, ' ', 'L') // P.105-184: Brancos (Endereço da Empresa, deve ser preenchido se o serviço exigir)

    line += pad('Referencia', 40, ' ', 'L') // P.185-224: Mensagem (Opcional)
    
    // P.225-232: Uso Exclusivo FEBRABAN/CNAB (Brancos) (8 pos)
    line += pad('', 8, ' ', 'L') 
    
    // P.233-240: Uso Exclusivo FEBRABAN/CNAB (Brancos) (10 pos)
    line += pad('0000000000', 10, '0', 'R') 

    // A linha final do registro deve ter exatamente 240 caracteres.
    if (line.length !== 240) {
        throw new Error(`Header de Lote: Tamanho incorreto (${line.length})`)
    }

    this.fileRecords.push(line)
    this.recordCount++
    return line
  }

  /**
   * 2.2. Geração de SEGMENTO P e Q (Detalhe da Transação)
   */
  private generateSegmentoPQ(record: TecnoJurisSchema): string[] {
    this.batchDetailCount++
    this.totalValueInBatch += record.valor // Acumula valor

    const detailRecords: string[] = []

    // --- Tratamento de Descrição Longa (Evitando erros de 30 e 40 caracteres) ---
    // Usamos uma descrição resumida para caber nos campos CNAB
    const descricaoResumida = `SUIT:${record.id.substring(0, 10)} - ${record.descricao}`
    const descricao30 = descricaoResumida.substring(0, 30);
    const descricao40 = descricaoResumida.substring(0, 40);


    // --- SEGMENTO P (Registro Tipo 3) ---
    let lineP = ''
    lineP += pad(BANCO_BB_CODIGO, 3, '0', 'R') // P.001-003: Cód. Banco
    lineP += pad(this.batchCount, 4, '0', 'R') // P.004-007: Nro do Lote
    lineP += pad('3', 1, '0', 'R') // P.008-008: Tipo de Registro (3 - Detalhe)
    lineP += pad(this.batchDetailCount, 5, '0', 'R') // P.009-013: Nro Sequencial do Registro no Lote
    lineP += pad('P', 1, ' ', 'L') // P.014-014: Cód Segmento do Registro (P)
    lineP += pad('', 1, ' ', 'L') // P.015-015: Uso Exclusivo FEBRABAN/CNAB (Brancos)

    lineP += pad('01', 2, '0', 'R') // P.016-017: Código de Movimento (01 - Entrada Confirmada)

    // Dados do Favorecido (Banco, Agência, Conta) - Aqui é crucial
    lineP += pad('001', 3, '0', 'R') // P.018-020: Cód. Banco do Favorecido (Ex: 001 - BB)
    lineP += pad('0001', 4, '0', 'R') // P.021-024: Agência do Favorecido (Sem DV)
    lineP += pad('', 1, ' ', 'L') // P.025-025: DV da Agência (Brancos se não houver)

    lineP += pad('0000000001', 12, '0', 'R') // P.026-037: Conta Corrente do Favorecido (12 pos)
    lineP += pad('', 1, ' ', 'L') // P.038-038: DV da Conta

    // P.039-058: Nosso Número / Identificação na Empresa - 20 posições.
    lineP += pad(record.id.substring(0, 20), 20, ' ', 'L') 

    // P.059-082: Identificação do Pagamento (Brancos para começar)
    lineP += pad('', 24, ' ', 'L') 

    lineP += pad('1', 1, '0', 'R') // P.083-083: Tipo de Inscrição do Favorecido (1-CPF, 2-CNPJ)
    lineP += pad('11111111111111', 14, '0', 'R') // P.084-097: Nro Inscrição do Favorecido (CNPJ/CPF)

    // P.098-127: Nome do Favorecido (30 pos) - USANDO TRUNCAMENTO CONTROLADO
    lineP += pad(descricao30, 30, ' ', 'L') 
    lineP += pad('', 10, ' ', 'L') // P.128-137: Vencimento (Brancos)

    // P.138-152: Valor do Pagamento (15 posições, 2 decimais)
    lineP += formatCNABNumber(record.valor, 15, 2) 

    lineP += pad('000001', 6, '0', 'R') // P.153-158: Nro do Documento / Nro da Fatura

    lineP += pad('0', 2, '0', 'R') // P.159-160: Código da Moeda (09 - Real)
    lineP += formatCNABNumber(1.0, 8, 5) // P.161-168: Quantidade da Moeda (1,00000)
    
    // P.169-176: Data de Pagamento (Data Prevista)
    lineP += formatDate(this.today) 
    
    lineP += pad('000000000000000', 15, '0', 'R') // P.177-191: Valor Real da Moeda (0)

    lineP += pad('', 11, ' ', 'L') // P.192-202: Brancos
    lineP += pad('00', 2, '0', 'R') // P.203-204: Finalidade Detalhe
    lineP += pad('00', 2, '0', 'R') // P.205-206: Finalidade DOC/TED (01 - Pagamento Salário)

    lineP += pad('', 4, ' ', 'L') // P.207-210: Brancos
    lineP += pad('01', 2, '0', 'R') // P.211-212: Aviso (01 - Emitir Aviso)

    lineP += pad('', 28, ' ', 'L') // P.213-240: Brancos

    if (lineP.length !== 240) {
        throw new Error(`Segmento P: Tamanho incorreto (${lineP.length})`)
    }
    detailRecords.push(lineP)
    this.recordCount++

    // --- SEGMENTO Q (Registro Tipo 3) ---
    let lineQ = ''
    lineQ += pad(BANCO_BB_CODIGO, 3, '0', 'R') // P.001-003: Cód. Banco
    lineQ += pad(this.batchCount, 4, '0', 'R') // P.004-007: Nro do Lote
    lineQ += pad('3', 1, '0', 'R') // P.008-008: Tipo de Registro (3 - Detalhe)
    lineQ += pad(this.batchDetailCount, 5, '0', 'R') // P.009-013: Nro Sequencial do Registro no Lote
    lineQ += pad('Q', 1, ' ', 'L') // P.014-014: Cód Segmento do Registro (Q)
    lineQ += pad('', 1, ' ', 'L') // P.015-015: Uso Exclusivo FEBRABAN/CNAB (Brancos)

    lineQ += pad('01', 2, '0', 'R') // P.016-017: Código de Movimento (01 - Entrada Confirmada)

    lineQ += pad('1', 1, '0', 'R') // P.018-018: Tipo de Inscrição (1-CPF, 2-CNPJ)
    // CORREÇÃO CRÍTICA: P.019-033 tem 15 posições, estava com 14.
    lineQ += pad('111111111111111', 15, '0', 'R') // P.019-033: Nro Inscrição do Favorecido (CNPJ/CPF)

    // P.034-073: Nome do Favorecido (40 pos) - USANDO TRUNCAMENTO CONTROLADO
    lineQ += pad(descricao40, 40, ' ', 'L') 

    // P.074-113: Endereço (Rua, Número)
    lineQ += pad('Rua Exemplo, 123', 40, ' ', 'L')
    // P.114-128: Bairro
    lineQ += pad('Centro', 15, ' ', 'L')
    // P.129-148: Cidade
    lineQ += pad('Sao Paulo', 20, ' ', 'L')
    // P.149-156: CEP (8 posições: 00000000)
    lineQ += pad('01001000', 8, '0', 'R')
    // P.157-158: UF
    lineQ += pad('SP', 2, ' ', 'L')

    lineQ += pad('', 76, ' ', 'L') // P.159-234: Brancos
    lineQ += pad('000000', 6, '0', 'R') // P.235-240: Uso Exclusivo FEBRABAN/CNAB (Brancos)

    if (lineQ.length !== 240) {
        throw new Error(`Segmento Q: Tamanho incorreto (${lineQ.length})`)
    }
    detailRecords.push(lineQ)
    this.recordCount++

    return detailRecords
  }

  /**
   * 2.3. Geração do TRAILER DE LOTE (Registro Tipo 5)
   */
  private generateTrailerLote(): string {
    let line = ''
    line += pad(BANCO_BB_CODIGO, 3, '0', 'R') // P.001-003: Cód. Banco
    line += pad(this.batchCount, 4, '0', 'R') // P.004-007: Nro do Lote
    line += pad('5', 1, '0', 'R') // P.008-008: Tipo de Registro (5)
    line += pad('', 9, ' ', 'L') // P.009-017: Uso Exclusivo FEBRABAN/CNAB (Brancos)

    // P.018-023: Qtde de Registros do Lote (Header Lote + Segmentos Detalhe + Trailer Lote)
    const qtdeRegistrosLote = 2 + this.batchDetailCount * 2 // (1 Header + N*2 Segmentos + 1 Trailer)
    line += pad(qtdeRegistrosLote, 6, '0', 'R') 

    // P.024-041: Somatório dos Valores (18 posições, 2 decimais)
    line += formatCNABNumber(this.totalValueInBatch, 18, 2) 

    line += pad('', 193, ' ', 'L') // P.042-234: Brancos
    line += pad('000000', 6, '0', 'R') // P.235-240: Uso Exclusivo FEBRABAN/CNAB (Brancos)

    if (line.length !== 240) {
        throw new Error(`Trailer de Lote: Tamanho incorreto (${line.length})`)
    }

    this.fileRecords.push(line)
    this.recordCount++
    return line
  }

  /**
   * 3. Geração do TRAILER DE ARQUIVO (Registro Tipo 9)
   */
  private generateTrailerArquivo(): string {
    let line = ''
    line += pad(BANCO_BB_CODIGO, 3, '0', 'R') // P.001-003: Cód. Banco
    line += pad('9999', 4, '0', 'R') // P.004-007: Lote de Serviço (9999 - Trailer de Arquivo)
    line += pad('9', 1, '0', 'R') // P.008-008: Tipo de Registro (9)
    line += pad('', 9, ' ', 'L') // P.009-017: Uso Exclusivo FEBRABAN/CNAB (Brancos)

    line += pad(this.batchCount, 6, '0', 'R') // P.018-023: Qtde de Lotes
    line += pad(this.recordCount + 1, 6, '0', 'R') // P.024-029: Qtde de Registros no Arquivo (Contador de linha + 1)
    line += pad('', 6, '0', 'R') // P.030-035: Qtde de Contas Conciliação (0)

    line += pad('', 205, ' ', 'L') // P.036-240: Brancos

    if (line.length !== 240) {
        throw new Error(`Trailer de Arquivo: Tamanho incorreto (${line.length})`)
    }

    this.fileRecords.push(line)
    this.recordCount++
    return line
  }

  /**
   * Orquestra a geração do arquivo CNAB a partir dos registros.
   * @param records Os registros de pagamento recuperados do banco de dados.
   * @returns A string completa do arquivo CNAB.
   */
  public generate(records: TecnoJurisSchema[]): string {
    if (records.length === 0) {
        return '' // Não gera arquivo se não houver registros
    }

    this.fileRecords = [] // Reinicia o array para cada geração
    this.batchCount = 0
    this.recordCount = 0

    this.generateHeaderArquivo()
    this.generateHeaderLote()

    // Itera sobre os registros e gera os segmentos de detalhe
    for (const record of records) {
        const detailLines = this.generateSegmentoPQ(record)
        this.fileRecords.push(...detailLines)
    }

    this.generateTrailerLote()
    this.generateTrailerArquivo()

    // Junta todas as linhas, separadas por quebra de linha (padrão CNAB)
    return this.fileRecords.join('\n')
  }
}
