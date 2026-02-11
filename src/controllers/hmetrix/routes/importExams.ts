import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { z } from 'zod'

const mapCampos = new Map([
  ['Massa Magra', '037078d8-0a0c-fe71-2550-3bc3fbf53047'],
  ['Índice de Massa Magra', '777685f2-9dd8-95bc-fcd5-012499fde11d'],
  ['Hemoglobina', '3d5f28d8-047f-1806-fc63-3cef3bea8485'],
  ['Hematócrito', 'ec33eafa-1ba9-338f-7ed5-8198ac2f9cca'],
  ['Leucócitos', '4b179de7-20a1-4a7e-9e90-907d466cfeab'],
  ['Eosinófilos', 'ec34fe55-8ad8-f76e-1c47-9557f27d4aac'],
  ['Plaquetas', 'd695a95b-83e2-ca46-f117-61748a12c2a0'],
  ['Colesterol Total', '02e36b6f-7add-c251-7fb2-07bc3d6455a9'],
  ['Colesterol HDL', 'a547fbb7-b517-39ea-d2e6-0c049e0f6a43'],
  ['Triglicérides', '96c323d9-140f-7d1e-39cd-014891290ef6'],
  ['Apolipo Proteína A', 'ef2ecf74-42fb-eaf6-9d9a-9b27fffdf5ca'],
  ['Apolipo Proteína B', 'a2b1c698-3c63-b39e-f137-49735922ab86'],
  ['Lipo Proteína a', '3056429b-fdf4-6f17-0821-acbb3081c71e'],
  ['Dimero D', 'b510f1f4-b0a0-f7c5-81aa-fafbe1dc795b'],
  ['Fibrinogênio', '73c373a5-7ff4-fb12-5e4d-87d7a3d3a4db'],
  ['PCR ultrasensível', '69f46649-135e-7781-5e0e-1c7fb89992e3'],
  ['Ácido úrico', 'fa74f8c9-7561-d469-2a16-1475f9573b01'],
  ['Homocisteína', 'f7206bef-341f-aa68-3861-c0e7117eef9c'],
  ['Glicemia de Jejum', 'e3557662-6d38-35f0-0107-bcb86d1c3b3c'],
  ['Insulina Jejum', 'e72bd15b-157d-d86f-ebe0-aa9b45ee5288'],
  ['Hemoglobina Glicada', '5c843908-e480-1532-1d5c-579c5b6f3f2f'],
  ['Cortisol Salivar - Manhã', 'ec734051-f51f-08fb-15e0-f41d6d1e3870'],
  ['Cortisol Salivar - Tarde', '6d42b1f1-91c5-f6f7-a1bb-ca3220b88a27'],
  ['Cortisol Salivar - Noite', '794e35a1-1461-4a40-ef46-2c87d1346fb2'],
  ['Gama GT', 'e252a147-0cd9-a9b1-cf54-aed8f48afc78'],
  ['TGO', '9737e290-642e-bb6e-12a0-10a767af8be1'],
  ['TGP', 'adb96fe7-d122-0fa1-b888-516161b43a34'],
  ['TSH Ultrassensível', 'c95a4d33-e378-3776-0eb7-dbf135b4aea1'],
  ['T3 livre', 'ed393cf4-ab9c-4df4-9493-9ad7d0a1b2db'],
  ['T4 Livre', 'a429971b-ecce-bb1b-1dac-c9a028f338f2'],
  ['Ferritina', 'ca661227-4020-efbc-c82e-af7481a5405e'],
  ['Ferro Sérico', '48d9ee63-ccff-ab4f-6d88-bd3497d7d4a8'],
  ['Saturação de transferrina', '5bfa5127-3b58-8b67-d01c-302de1e46658'],
  ['Vita D', '84bf5655-e2b7-dcac-1725-9a05ee7f7ea8'],
  ['Paratormônio', '5c0ebf66-1830-3628-ba70-31b06a2bf0e8'],
  ['Vit B 12', 'd092e262-342b-8782-8326-5d9314dda4ed'],
  ['DHEA Sulfato', '538bdbce-bea0-56e5-e0b0-f05aae061529'],
  ['Testosterona Total', '3ee359ed-761c-dd8a-1d12-6dc764159442'],
  ['Testosterona Livre', 'ff5c38e0-8d8e-fdb9-63ff-c61570144142'],
  ['PSA Total', 'aa9c42da-f27d-2dd3-07bf-09bb68f95966'],
  ['Estradiol', '702ffffd-478d-98b2-c05e-e974fa89263a'],
  ['Linfocito Atipico', '693d75ed-b18a-9a4c-4ecd-d648d72ef01e'],
  ['Percentual de gordura corporal', '28b73ead-3c13-8315-dbe7-ebc2ba62de0e'],
  ['Contagem de Alertas Exames Clínico - Hemoglobina Glicada', 'e6f3047e-b8f3-35ce-f2c6-b82ea2d274bd'],
  ['Contagem de Alertas Exames Clínico - Triglicérides', 'd28e8b13-145c-e7ed-044b-62d7c4c80aec'],
  ['Contagem de Alertas Exames Clínico - Glicemia Jejum', 'e8ebf7e6-f03c-4a98-0b14-24a037f6815c'],
  ['Contagem de Alertas Exames Clínico - Ferritina', '7ebcb736-e824-2114-8ec9-e91dc63c59c5'],
  ['Contagem de Alertas Exames Clínico - Dimero D', '09683b69-ac5a-f094-ca2b-ea1d9c0d620f'],
  ['Contagem de Alertas Exames Clínico - Pacote Dimero Fibrinogenio e Homocisteína', '6aef2f58-ea51-0701-db47-fb6695c5764a'],
  ['Contagem de Alertas Exames Clínico', '4f8f3185-c217-2f69-ff14-92bde9dd689f'],
  ['Alerta >= 1', '16167433-5b7b-12d7-428b-aa4627d4eedb'],
  ['Alerta >= 2', '6ec321fd-16d4-2583-94ce-6d451aeb40e0'],
  ['Linfocitos', 'a86e8b85-b634-833c-49af-ee70b441c387'],
  ['Neutrófilos', '4195b709-80fa-2edc-2ab2-4a32386d3c87'],
  ['Linfócitos Absolutos (/mm³)', '573da754-3d0f-6ec8-46dc-04d9f4bb9477'],
  ['Monócitos', '756759f6-17ae-2f38-b573-a44f062691cc'],
  ['RDW (%)', '0d7ce342-cdbe-8eb4-0da7-4740164b3dd1'],
  ['Razão Neutrófilos / Linfócitos (NLR)', '4900fc99-db60-527d-2953-bbd9e5daef3d'],
  ['Razão Plaquetas/ Linfócitos (PLR)', '8519b4dd-8287-5f46-d441-290ed064da29'],
  ['Razão Neutrófilos / Monócitos (NMR)', 'b9f43180-44d4-7866-f115-d4195b49bb23'],
])

const metricasSchema = z.object({
  idCampo: z.string(),
  metrica: z.string(),
})

type MetricasSchema = z.infer<typeof metricasSchema>

export function importExams(app: FastifyZodTypedInstance) {
  app.post(
    '/hmetrix/importExams',
    {
      schema: {
        body: z.object({
          nome: z.string(),
          metrica: z.string(),
        }),
        response: {
          200: z.object({
            metricas: z.array(metricasSchema)
          })
        }
      }
    },
    async (request, reply) => {
      const { nome, metrica } = request.body

      const nomesVetor = nome.split(';')
      const metricasVetor = metrica.split(';')

      const metricas: MetricasSchema[] = nomesVetor.map((nome, idx) => ({
        idCampo: mapCampos.get(nome) ?? '',
        metrica: metricasVetor[idx] ?? '',
      }))

      return reply.send({
        metricas
      })
    }
  )
}
