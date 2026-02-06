export type SegmentoJ = {
  id: string
  codigoBarras: string | number
  
  nomeBeneficiario: string
  inscricaoBeneficiario: string // O CPF ou CNPJ sem pontos/hífens
  tipoInscricaoBeneficiario: '1' | '2' // 1 para CPF, 2 para CNPJ

  dataVencimentoBoleto: Date
  dataPagamento: Date
  valor: number
}

function formatarNum(valor: string | number, tamanho: number): string {
  // Garante que é número, corta se for maior e preenche com zeros à esquerda
  return String(valor).substring(0, tamanho).padStart(tamanho, '0')
}

function formatarAlfa(texto: string, tamanho: number): string {
  // Remove acentos e caracteres especiais, corta se for grande e preenche com espaços
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9 ]/g, "") // remove tudo que não é letra, número ou espaço
    .toUpperCase()
    .substring(0, tamanho)
    .padEnd(tamanho, ' ')
}

const nomeEmpresa = 'ECKERMANN E SANTOS SOCIEDADE DE ADVOGADOS'

// 01.0 | do 1 ao 3 caracteres ✅
// 01.1 | do 1 ao 3 caracteres ✅
// 01.3J | do 1 ao 3 caracteres ✅
// 01.5 | do 1 ao 3 caracteres ✅
// 01.9 | do 1 ao 3 caracteres ✅
const BANCO = '001'

// 05.0 | do 18 ao 18 caracteres ✅
// 09.1 | do 18 ao 18 caracteres ✅
const TIPO_INSCRICAO = '2'

// 06.0 | do 19 ao 32 caracteres ✅
// 10.1 | do 19 ao 32 caracteres ✅
const INSCRICAO = formatarNum('11252148000130', 14)

// 07.0 BB1 | do 33 ao 41 caracteres
// 11.1 BB1 | do 33 ao 41 caracteres
const NUMERO_CONVENIO = formatarNum('000408652', 9)

// 07.0 BB2 | do 42 ao 45 caracteres ✅
// 11.1 BB2 | do 42 ao 45 caracteres ✅
const CODIGO_CONVENIO = '0126'

// 07.0 BB3 | do 46 ao 50 caracteres ✅
// 11.1 BB3 | do 46 ao 50 caracteres ✅
const USO_BANCO_CONVENIO = formatarAlfa('', 5)

// 07.0 BB4 | do 51 ao 52 caracteres ✅
// 11.1 BB4 | do 51 ao 52 caracteres ✅
const ARQUITO_TESTE_CONVENIO = formatarAlfa('', 2)

// 08.0 | do 53 ao 57 caracteres ✅
// 12.1 | do 53 ao 57 caracteres ✅
const AGENCIA = formatarNum('3131', 5)

// 09.0 | do 58 ao 58 caracteres ✅
// 13.1 | do 58 ao 58 caracteres ✅
const DV_AGENCIA = '3'

// 10.0 | do 59 ao 70 caracteres ✅
// 14.1 | do 59 ao 70 caracteres ✅
const CONTA_CORRENTE = formatarNum('23818', 12)

// 11.0 | do 71 ao 71 caracteres ✅
// 15.1 | do 71 ao 71 caracteres ✅
const DV_CONTA_CORRENTE = 'X'

// 12.0 | do 72 ao 72 caracteres ✅
// 16.1 | do 72 ao 72 caracteres ✅
const DV_AGENCIA_CONTA = '0'

// 13.0 | do 73 ao 102 caracteres ✅
// 17.1 | do 73 ao 102 caracteres ✅
const NOME_EMPRESA = formatarAlfa(nomeEmpresa, 30)

export class MyCNABGenerator {
  private lines: string[] = []
  private sequencia = 0

  private gerarData(data: Date) {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0'); // Ajuste aqui
    const ano = String(data.getFullYear());
    return `${dia}${mes}${ano}`;
  }

  private gerarHora(data: Date) {
    const horas = String(data.getHours()).padStart(2, '0')
    const minutos = String(data.getMinutes()).padStart(2, '0')
    const segundos = String(data.getSeconds()).padStart(2, '0')

    return `${horas}${minutos}${segundos}`
  }

  private formatarValorFinanceiro(valor: number, tamanho: number): string {
    // Exemplo: 2445.37 -> 244537
    const valorLimpo = Math.round(valor * 100).toString(); 
    return valorLimpo.padStart(tamanho, '0');
  }

  private headerArquivo(data: Date, ultimoGerado: number) {
    const LOTE = '0000' // 02.0 | do 4 ao 7 caracteres ✅
    const REGISTRO = '0' // 03.0 | do 8 ao 8 caracteres ✅
    const CNAB04 = formatarAlfa('', 9) // 04.0 | do 9 ao 17 caracteres ✅

    const NOME_BANCO = formatarAlfa('BANCO DO BRASIL', 30) // 14.0 | do 103 ao 132 ✅
    const CNAB15 = formatarAlfa('', 10) // 15.0 | do 133 ao 142 caracteres ✅
    const CODIGO = '1' // 16.0 | do 143 ao 143 caracteres ✅
    const DATA_GERACAO = this.gerarData(data) // 17.0 | do 144 ao 151 caracteres ✅
    const HORA_GERACAO = this.gerarHora(data) // 18.0 | do 152 ao 157 caracteres ✅
    const SEQUENCIA = formatarNum(ultimoGerado + 1, 6) // 19.0 | do 158 ao 163 caracteres ✅
    const LAYOUT_ARQUIVO = '103' // 20.0 | do 164 ao 166 caracteres ✅
    const DENSIDADE = '00000' // 21.0 | do 167 ao 171 caracteres ✅

    const RESERVADO_BANCO = formatarAlfa('', 20) // 22.0 | do 172 ao 191 caracteres ✅
    const RESERVADO_EMPRESA = formatarAlfa('', 20) // 23.0 | do 192 ao 211 caracteres
    const RESERVADO_CNAB = formatarAlfa('', 11) // 24.0 | do 212 ao 222 caracteres
    const IDENTIFICACAO = formatarAlfa('', 3) // 25.0 | do 223 ao 225 caracteres ✅
    const CONTROLE_VANS = '000' // 26.0 | do 226 ao 228 caracteres ✅
    const SERVICO = '00' // 27.0 | do 229 ao 230 caracteres ✅
    const OCORRENCIAS = formatarAlfa('0000000000', 10) // 28.0 | do 231 ao 240 caracteres ✅

    const linha = [
      BANCO,
      LOTE,
      REGISTRO,
      CNAB04,
      TIPO_INSCRICAO,
      INSCRICAO,
      NUMERO_CONVENIO,
      CODIGO_CONVENIO,
      USO_BANCO_CONVENIO,
      ARQUITO_TESTE_CONVENIO,
      AGENCIA,
      DV_AGENCIA,
      CONTA_CORRENTE,
      DV_CONTA_CORRENTE,
      DV_AGENCIA_CONTA,
      NOME_EMPRESA,
      NOME_BANCO,
      CNAB15,
      CODIGO,
      DATA_GERACAO,
      HORA_GERACAO,
      SEQUENCIA,
      LAYOUT_ARQUIVO,
      DENSIDADE,
      RESERVADO_BANCO,
      RESERVADO_EMPRESA,
      RESERVADO_CNAB,
      IDENTIFICACAO,
      CONTROLE_VANS,
      SERVICO,
      OCORRENCIAS
    ].join('')

    if (linha.length !== 240) {
      throw new Error(`Linha Header Arquivo com tamanho inválido: ${linha.length}`)
    }
    
    this.lines.push(linha)
  }

  private headerLoteJ(ultimoLote: number, formaLancamento: '31' | '30') {
    const LOTE = formatarNum(ultimoLote + 1, 4) // 02.1 | do 4 ao 7 caracteres ✅
    const TIPO_REGISTRO = '1' // 03.1 | do 8 ao 8 caracteres ✅
    const TIPO_OPERACAO = 'C' // 04.1 | do 9 ao 9 caracteres ✅
    const TIPO_SERVICO = '98' // 05.1 | do 10 ao 11 caracteres ✅
    const FORMA_LANCAMENTO = formaLancamento // 06.1 | do 12 ao 13 caracteres ✅
    const LAYOUT_LOTE = '046' // 07.1 | do 14 ao 16 caracteres ✅
    const CNAB08 = formatarAlfa('', 1) // 08.1 | do 17 ao 17 caracteres ✅
    const MENSAGEM = formatarAlfa('', 40) // 18.1 | do 103 ao 142 caracteres ✅
    const LOGRADOURO = formatarAlfa('', 30) // 19.1 | do 143 ao 172 caracteres ✅
    const NUMERO = formatarNum('00000', 5) // 20.1 | do 173 ao 177 caracteres ✅
    const COMPLEMENTO = formatarAlfa('', 15) // 21.1 | do 178 ao 192 caracteres ✅
    const CIDADE = formatarAlfa('', 20) // 22.1 | do 193 ao 212 caracteres ✅
    const CEP = formatarNum('00000', 5) // 23.1 | do 213 ao 217 caracteres ✅
    const COMPLEMENTO_CEP = formatarAlfa('', 3) // 24.1 | do 218 ao 220 caracteres ✅
    const ESTADO = formatarAlfa('', 2) // 25.1 | do 221 ao 222 caracteres ✅
    const CNAB26 = formatarAlfa('', 8) // 26.1 | do 223 ao 230 caracteres ✅
    const OCORRENCIAS = formatarNum('0000000000', 10) // 27.1 | do 231 ao 240 caracteres ✅

    const linha = [
      BANCO,
      LOTE,
      TIPO_REGISTRO,
      TIPO_OPERACAO,
      TIPO_SERVICO,
      FORMA_LANCAMENTO,
      LAYOUT_LOTE,
      CNAB08,
      TIPO_INSCRICAO,
      INSCRICAO,
      NUMERO_CONVENIO,
      CODIGO_CONVENIO,
      USO_BANCO_CONVENIO,
      ARQUITO_TESTE_CONVENIO,
      AGENCIA,
      DV_AGENCIA,
      CONTA_CORRENTE,
      DV_CONTA_CORRENTE,
      DV_AGENCIA_CONTA,
      NOME_EMPRESA,
      MENSAGEM,
      LOGRADOURO,
      NUMERO,
      COMPLEMENTO,
      CIDADE,
      CEP,
      COMPLEMENTO_CEP,
      ESTADO,
      CNAB26,
      OCORRENCIAS,
    ].join('')

    if (linha.length !== 240) {
      throw new Error(`Linha Header do Lote J com tamanho inválido: ${linha.length}`)
    }

    this.lines.push(linha)
  }

  private segmentoJ(ultimoLote: number, recordset: SegmentoJ) {
    this.sequencia++

    const LOTE = formatarNum(ultimoLote + 1, 4) // 02.3J | do 4 ao 7 caracteres ✅
    const REGISTRO = '3' // 03.3J | do 8 ao 8 caracteres ✅
    const NUMERO_REGISTRO = formatarNum(this.sequencia, 5) // 04.3J | do 9 ao 13 caracteres ✅
    const SEGMENTO = 'J' // 05.3J | do 14 ao 14 caracteres ✅
    const TIPO_MOVIMENTO = '0' // 06.3J | do 15 ao 15 caracteres
    const CODIGO_INSTRUCAO_MOVIMENTO = '00' // 07.3J | do 16 ao 17 caracteres
    const CODIGO_BARRAS = formatarNum(String(recordset.codigoBarras).replace(/\D/g, ''), 44) // 08.3J | do 18 ao 61 caracteres ✅
    const NOME_BENEFICIARIO = formatarAlfa(recordset.nomeBeneficiario, 30) // 09.3J | do 62 ao 91 caracteres ✅
    const DATA_VENCIMENTO = this.gerarData(recordset.dataVencimentoBoleto) // 10.3J | do 92 ao 99 caracteres ✅
    const VALOR_TITULO = this.formatarValorFinanceiro(recordset.valor, 15) // 11.3J | do 100 ao 114 caracteres ✅
    const DESCONTO = formatarNum(0, 15) // 12.3J | do 115 a 129 caracteres ✅
    const ACRESCIMOS = formatarNum(0, 15) // 13.3J | do 130 a 144 caracteres ✅
    const DATA_PAGAMENTO = this.gerarData(recordset.dataPagamento) // 14.3J | do 145 a 152 caracteres ✅
    const VALOR_PAGAMENTO = this.formatarValorFinanceiro(recordset.valor, 15) // 15.3J | do 153 a 167 caracteres ✅
    const QUANTIDADE_MOEDA = formatarNum('000000000000000', 15) // 16.3J | do 168 a 182 caracteres ✅
    const REFERENCIA_PAGADOR = formatarAlfa(recordset.id.replace(/-/g, ''), 20) // 17.3J | do 183 a 202 caracteres ✅
    const NOSSO_NUMERO = formatarAlfa('', 20) // 18.3J | do 203 a 222 caracteres
    const CODIGO_MOEDA = '09' // 19.3J | do 223 a 224 caracteres ✅
    const CNAB20 = formatarAlfa('', 6) // 20.3J | do 225 a 230 caracteres ✅
    const OCORRENCIAS = '0000000000' // 21.3J | do 231 a 240 caracteres ✅

    const linha = [
      BANCO,
      LOTE,
      REGISTRO,
      NUMERO_REGISTRO,
      SEGMENTO,
      TIPO_MOVIMENTO,
      CODIGO_INSTRUCAO_MOVIMENTO,
      CODIGO_BARRAS,
      NOME_BENEFICIARIO,
      DATA_VENCIMENTO,
      VALOR_TITULO,
      DESCONTO,
      ACRESCIMOS,
      DATA_PAGAMENTO,
      VALOR_PAGAMENTO,
      QUANTIDADE_MOEDA,
      REFERENCIA_PAGADOR,
      NOSSO_NUMERO,
      CODIGO_MOEDA,
      CNAB20,
      OCORRENCIAS,
    ].join('')

    if (linha.length !== 240) {
      throw new Error(`Linha Segmento J (sequência ${this.sequencia}) com tamanho inválido: ${linha.length}`)
    }

    this.lines.push(linha)
  }

  private segmentoJ52(ultimoLote: number, recordset: SegmentoJ) {
    this.sequencia++

    const regexCNPJ = /^\d{14}$/

    const LOTE = formatarNum(ultimoLote + 1, 4) // 02.4.J52 | do 4 ao 7 caracteres ✅
    const REGISTRO = '3' // 03.4.J52 | do 8 ao 8 caracteres ✅
    const NUMERO_REGISTRO = formatarNum(this.sequencia, 5) // 04.4.J52 | do 9 ao 13 caracteres ✅
    const SEGMENTO = 'J' // 05.4.J52 | do 14 ao 14 caracteres ✅
    const CNAB06 = formatarAlfa('', 1) // 06.4.J52 | do  15 ao 15 caracteres ✅
    const COD_MOVIMENTO_REMESSA = '00' // 07.4.J52 | do 16 a 17 caracteres ✅
    const COD_REG_OPCIONAL = '52' // 08.4.J52 | do 18 a 19 caracteres ✅
    
    const TIPO_INSCRICAO_PAGADOR = regexCNPJ.test(recordset.inscricaoBeneficiario) ? '2' : '1' // 09.4.J52 | do 20 a 20 caracteres ✅
    const NUMERO_INSCRICAO_PAGADOR = formatarNum(recordset.inscricaoBeneficiario, 15) // 10.4.J52 | do 21 a 35 caracteres ✅
    const NOME_PAGADOR = formatarAlfa(recordset.nomeBeneficiario, 40) // 11.4.J52 | do 36 a 75 caracteres ✅

    const TIPO_INSCRICAO_BENEFICIARIO = TIPO_INSCRICAO
    const NUMERO_INSCRICAO_BENEFICIARIO = formatarNum(INSCRICAO, 15)
    const NOME_BENEFICIARIO = formatarAlfa(nomeEmpresa, 40)
    
    const TIPO_INSCRICAO_SACADOR = '0' // 15.4.J52 | do 132 a 132 caracteres ✅
    const NUMERO_INSCRICAO_SACADOR = '000000000000000' // 16.4.J52 | do 133 a 147 caracteres ✅
    const NOME_SACADOR = formatarAlfa('', 40) // 17.4.J52 | do 148 a 187 caracteres ✅

    const CNAB18 = formatarAlfa('', 53) // 18.4.J52 | do 188 a 240 caracteres ✅

    const linha = [
      BANCO,
      LOTE,
      REGISTRO,
      NUMERO_REGISTRO,
      SEGMENTO,
      CNAB06,
      COD_MOVIMENTO_REMESSA,
      COD_REG_OPCIONAL,
      TIPO_INSCRICAO_PAGADOR,
      NUMERO_INSCRICAO_PAGADOR,
      NOME_PAGADOR,
      TIPO_INSCRICAO_BENEFICIARIO,
      NUMERO_INSCRICAO_BENEFICIARIO,
      NOME_BENEFICIARIO,
      TIPO_INSCRICAO_SACADOR,
      NUMERO_INSCRICAO_SACADOR,
      NOME_SACADOR,
      CNAB18,
    ].join('')

    if (linha.length !== 240) {
      throw new Error(`Linha Segmento J52 (sequência ${this.sequencia}) com tamanho inválido: ${linha.length}`)
    }

    this.lines.push(linha)
  }
  
  private trailerLote(ultimoLote: number, quantidadeRegistros: number, valorTotal: number) {
    const LOTE_SERVICO = formatarNum(ultimoLote + 1, 4) // 02.5 | do 4 a 7 caracteres ✅
    const TIPO_REGISTRO = '5' // 03.5 | do 8 a 8 caracteres ✅
    const CNAB04 = formatarAlfa('', 9) // 04.5 | do 9 ao 17 caracteres ✅
    const QUANTIDADE_REGISTROS = formatarNum((quantidadeRegistros * 2) + 2, 6) // 05.5 | do 18 a 23 caracteres ✅
    const SOMATORIA_VALORES = this.formatarValorFinanceiro(valorTotal, 18) // 06.5 | do 24 a 41 caracteres ✅
    const SOMATORIA_QUANTIDADE_MOEDAS = '000000000000000000' // 07.5 | do 42 a 59 caracteres ✅
    const NUMERO_AVISO_DEBITO = '000000' // 08.5 | do 60 a 65 caracteres ✅
    const CNAB09 = formatarAlfa('', 165) // 09.5 | do 66 a 230 caracteres ✅
    const OCORRENCIAS = '0000000000' // 10.5 | do 231 a 240 caracteres ✅

    const linha = [
      BANCO,
      LOTE_SERVICO,
      TIPO_REGISTRO,
      CNAB04,
      QUANTIDADE_REGISTROS,
      SOMATORIA_VALORES,
      SOMATORIA_QUANTIDADE_MOEDAS,
      NUMERO_AVISO_DEBITO,
      CNAB09,
      OCORRENCIAS,
    ].join('')

    if (linha.length !== 240) {
      throw new Error(`Linha Trailer do Lote com tamanho inválido: ${linha.length}`)
    }

    this.lines.push(linha)
  }

  private trailerArquivo(quantidadeLotes: number, quantidadeRegistros: number) {
    const LOTE_SERVICO = '9999' // 02.9 | do 4 a 7 caracteres ✅
    const TIPO_REGISTRO = '9' // 03.9 | do 8 a 8 caracteres ✅
    const CNAB04 = formatarAlfa('', 9) // 04.9 | do 9 a 17 caracteres ✅
    const QUANTIDADE_LOTES = formatarNum(quantidadeLotes, 6) // 05.9 | do 18 a 23 caracteres ✅
    const QUANTIDADE_REGISTROS = formatarNum(quantidadeRegistros, 6) // 06.9 | do 24 a 29 caracteres ✅
    const QUANTIDADE_CONTAS_CONC = '000000' // 07.9 | do 30 a 35 caracteres ✅
    const CNAB08 = formatarAlfa('', 205) // 08.9 | do 36 a 240 caracteres ✅

    const linha = [
      BANCO,
      LOTE_SERVICO,
      TIPO_REGISTRO,
      CNAB04,
      QUANTIDADE_LOTES,
      QUANTIDADE_REGISTROS,
      QUANTIDADE_CONTAS_CONC,
      CNAB08,
    ].join('')

    if (linha.length !== 240) {
      throw new Error(`Linha Trailer do Arquivo com tamanho inválido: ${linha.length}`)
    }

    this.lines.push(linha)
  }

  gerarCnab(ultimoLote: number, formaLancamento: '31' | '30', recordsets: SegmentoJ[]) {
    this.lines = []

    this.headerArquivo(new Date(), ultimoLote)
    this.headerLoteJ(ultimoLote, formaLancamento)

    recordsets.forEach((recordset) => {
      this.segmentoJ(ultimoLote, recordset)
      this.segmentoJ52(ultimoLote, recordset)
    })

    console.log(recordsets.length)

    const quantidadeRegistros = recordsets.length
    const valorTotal = recordsets.reduce((acumulador, objetoAtual) => {
      return acumulador + objetoAtual.valor
    }, 0)

    this.trailerLote(ultimoLote, quantidadeRegistros, valorTotal)

    const totalLinhasArquivo = this.lines.length + 1
    this.trailerArquivo(1, totalLinhasArquivo)

    return this.lines.join('\r\n')
  }
}
