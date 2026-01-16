import { z } from "zod"

export const tecnoJurisSchema = z.object({
  id: z.string(), // Nro Documento (até 20 caracteres)
  descricao: z.string(), // Texto da SUIT e Processo (Será truncado) ✅
  valor: z.number(), // Valor do Pagamento ✅

  // --- Dados de Identificação e Endereço ---
  tipoInscricaoFavorecido: z.number().int().min(1).max(2), // 1=CPF, 2=CNPJ ✅
  inscricaoFavorecido: z.string().max(15), // CPF/CNPJ completo ✅
  nomeFavorecido: z.string().max(40), // Nome completo/Razão Social ✅
  enderecoFavorecido: z.string().max(40), // Rua e Número ✅
  bairroFavorecido: z.string().max(15), // Bairro ✅
  cidadeFavorecido: z.string().max(20), // Cidade ✅
  cepFavorecido: z.string().length(8), // CEP sem hífen ✅
  ufFavorecido: z.string().length(2), // UF (ex: 'SP') ✅

  // --- Outros Campos do CNAB ---
  dataPagamento: z.string().length(8), // Data Efetiva de Pagamento (DDMMAAAA)
  codigoMovimento: z.string().length(2).default('01'), // 01: Inclusão
  
  // Campos originais da sua query (mantidos por compatibilidade, mas sem uso direto no CNAB)
  cliente: z.string().optional(), // ✅
  data_formatada: z.string().optional(), // ✅
  usuario: z.string().optional(), // ✅
  pasta: z.string().optional(), // ✅
  partesContrarias: z.string().optional(), // ✅
  tipo: z.string().optional(), // ✅
  unidade: z.string().optional(), // ✅
  natureza: z.string().optional(), // ✅
  efetivado: z.number().optional(), // ✅
  faturado: z.number().optional(), // ✅
  codigoBarras: z.string(), // ✅
  dataVencimentoBoleto: z.string(), // ✅
  nomeBeneficiario: z.string(), // 
})

export type TecnoJurisSchema = z.infer<typeof tecnoJurisSchema>
