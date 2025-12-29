import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { fastifyErrorResponseSchema } from '@/schemas/errors/fastifyErrorResponseSchema'
import { zodErrorBadRequestResponseSchema } from '@/schemas/errors/zodErrorBadRequestResponseSchema'
import { createBiogenExcel } from '@/utils/biogen/createBiogenExcel'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { readFile, utils } from 'xlsx'
import { z } from 'zod'

const poSchema = z.object({
  allAlerte: z.string(),
  orgName: z.string(),
  poNumber: z.string(),
  releaseNumber: z.union([z.string(), z.number()]).optional(),
  poCreationDate: z.number(),
  costCenterCode: z.string(),
  geoCode: z.string(),
  accountCode: z.string(),
  productCode: z.string(),
  localAccountCode: z.string(),
  poShipmentClosedCode: z.string(),
  vendorNumber: z.string(),
  vendorName: z.string(),
  buyer: z.string().optional(),
  requisitionPreparer: z.union([z.string(), z.number()]).optional(),
  requestorName: z.union([z.string(), z.number()]).optional(),
  deliverToPerson: z.string(),
  lNumber: z.number(),
  sNumber: z.number(),
  dNumber: z.number(),
  rNumber: z.union([z.string(), z.number()]).optional(),
  lineItemDescription: z.string(),
  shipmentPromisedDate: z.number().optional(),
  poAuthorizationStatus: z.string(),
  projectNumber: z.union([z.string(), z.number()]).optional(),
  projectTaskNumber: z.union([z.string(), z.number()]).optional(),
  expenditureType: z.union([z.string(), z.number()]).optional(),
  expenditureOrg: z.union([z.string(), z.number()]).optional(),
  poLineUnitPrice: z.number(),
  quantityOrdered: z.number(),
  quantityDelivered: z.number(),
  quantityBilled: z.number(),
  quantityCancelled: z.number(),
  released: z.number(),
  openCommitment: z.number(),
  accrual: z.number(),
  curr: z.string(),
  poCurrencyRate: z.union([z.string(), z.number()]).optional(),
  poCurrencyRateDate: z.number(),
  accrualAmtInFunctionalCur: z.number(),
  lastPaymentDate: z.number(),
})

type PoSchema = z.infer<typeof poSchema>

const poFormattedSchema = z.object({
  'Chave': z.string(),
  'PO#': z.string(),
  'Cost Center Code': z.string(),
  'Account Code': z.string(),
  'PROJ': z.string(),
  'Product Code': z.string(),
  'Geo Code': z.string(),
  'TERR': z.string(),
  'Local Account Code': z.string(),
  'I/C': z.string(),
  'L #': z.number(),
  'Line Item Description': z.string(),
  'Open Commitment': z.number(),
})

export type PoFormattedSchema = z.infer<typeof poFormattedSchema>

export async function formatExcel(app: FastifyZodTypedInstance) {
  app.post(
    '/biogen/formatExcel',
    {
      schema: {
        body: z.object({
          url: z.string().url(),
        }),
        response: {
          200: z.object({
            base64: z.string(),
            formattedData: z.array(poFormattedSchema),
          }),
          400: zodErrorBadRequestResponseSchema,
          500: fastifyErrorResponseSchema,
        }
      }
    },
    async (request, reply) => {
      const { url } = request.body

      let filePath = ''

      if (!existsSync('./uploads')) {
        mkdirSync('./uploads', { recursive: true })
      }

      try {
        const { data } = await app.axios.get(url, {
          responseType: 'arraybuffer',
        })

        const filename = basename(new URL(url).pathname)
        filePath = `./uploads/${filename}`

        const extension = extname(filename).slice(1)
        
        const allowedExtensions = ['xls', 'xlsx']

        if (!allowedExtensions.includes(extension)) {
          throw new Error('Extensão de arquivo inválida')
        }

        writeFileSync(filePath, data)

        const workbook = readFile(filePath)
        const worksheet = workbook.Sheets['Summary']
        const dataXlsx: PoSchema[] = utils.sheet_to_json(worksheet, {
          header: [
            'allAlerte',
            'orgName',
            'poNumber',
            'releaseNumber',
            'poCreationDate',
            'costCenterCode',
            'geoCode',
            'accountCode',
            'productCode',
            'localAccountCode',
            'poShipmentClosedCode',
            'vendorNumber',
            'vendorName',
            'buyer',
            'requisitionPreparer',
            'requestorName',
            'deliverToPerson',
            'lNumber',
            'sNumber',
            'dNumber',
            'rNumber',
            'lineItemDescription',
            'shipmentPromisedDate',
            'poAuthorizationStatus',
            'projectNumber',
            'projectTaskNumber',
            'expenditureType',
            'expenditureOrg',
            'poLineUnitPrice',
            'quantityOrdered',
            'quantityDelivered',
            'quantityBilled',
            'quantityCancelled',
            'released',
            'openCommitment',
            'accrual',
            'curr',
            'poCurrencyRate',
            'poCurrencyRateDate',
            'accrualAmtInFunctionalCur',
            'lastPaymentDate',
          ],
          range: 2,
        })

        const dataWithoutLastLine = dataXlsx.slice(0, -1)

        const formattedData: PoFormattedSchema[] = dataWithoutLastLine.map((register, idx) => {
          const {
            poNumber,
            costCenterCode,
            accountCode,
            productCode,
            geoCode,
            localAccountCode,
            lNumber,
            lineItemDescription,
            openCommitment,
          } = register

          return {
            'Chave': '',
            'PO#': poNumber,
            'Cost Center Code': costCenterCode,
            'Account Code': accountCode,
            'PROJ': '0000',
            'Product Code': productCode,
            'Geo Code': geoCode,
            'TERR': '0000',
            'Local Account Code': localAccountCode,
            'I/C': '0000',
            'L #': lNumber,
            'Line Item Description': lineItemDescription,
            'Open Commitment': openCommitment,
          }
        })

        const buffer = await createBiogenExcel(formattedData)

        const base64 = buffer.toString('base64')

        unlinkSync(filePath)

        return reply.send({
          base64,
          formattedData,
        })
      } catch (e: any) {
        console.error(e)

        unlinkSync(filePath)

        return reply.internalServerError(e.message)
      }
    }
  )
}