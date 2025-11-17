import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { z } from 'zod'
import pptxgen from 'pptxgenjs'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

export function exportPptx(app: FastifyZodTypedInstance) {
  app.post(
    '/covabra/exportPptx',
    {
      schema: {
        body: z.object({
          titulo: z.string(),
          legendaPrimaria: z.string().optional(),
          metricaPrimaria: z.array(z.number()).optional(),
          legendaSecundaria: z.string().optional(),
          metricaSecundaria: z.array(z.number()).optional(),
          labels: z.array(z.string()).optional(),
          tipoGrafico: z.enum(['line', 'bar', 'bar-line', 'table'])
        }),
      },
    },
    async (request, reply) => {
      const { titulo, legendaPrimaria, metricaPrimaria, labels, legendaSecundaria, metricaSecundaria, tipoGrafico } = request.body

      try {
        if (!existsSync(`./uploads`)) {
            mkdirSync(`./uploads`, { recursive: true })
          }

        const pptx = new pptxgen()

        const slide = pptx.addSlide()

        if (tipoGrafico === 'bar-line') {
          slide.addChart(
            [
              {
                type: 'bar',
                data: [
                  {
                    labels,
                    name: legendaPrimaria,
                    values: metricaPrimaria,
                  },
                ],
                options: {
                  chartColors: ['44BE7B'],
                  barGapWidthPct: 80,
                  barOverlapPct: 0,
                  showValue: true,
                  dataLabelFormatCode: '#,##0.0', // sem decimais
                  valLabelFormatCode: '#,##0.0',
                },
              },
              {
                type: 'line',
                data: [
                  {
                    labels,
                    name: legendaSecundaria,
                    values: metricaSecundaria,
                  },
                ],
                options: {
                  chartColors: ['9DC3E6'],
                  lineSmooth: true,
                  lineSize: 2,
                  lineDataSymbol: 'circle',
                  lineDataSymbolSize: 8,
                  showValue: true,
                  dataLabelFormatCode: '#,##0.0', // ex: 93,4
                  secondaryValAxis: true, // eixo direito
                },
              },
            ],
            [metricaPrimaria, metricaSecundaria],
            { // 3º ARG: Opções Globais (Você já tem)
              x: 0.5,
              y: 0.25,
              w: '90%',
              h: '90%',

              // ... Suas outras opções globais ...
              catAxisLabelFontSize: 10,
              catAxisLabelFontFace: 'Montserrat',
              valAxisLabelFontFace: 'Montserrat',
              legendFontFace: 'Montserrat',
              titleFontFace: 'Montserrat',

              showLegend: false,
              legendPos: 't',
              title: titulo,
              showTitle: true,
              titleFontSize: 14,
              titleBold: true,

              lineSmooth: true,

              showValue: true,
              dataLabelFontFace: 'Montserrat',
              dataLabelFontSize: 10,
              dataLabelColor: '000000',
              dataLabelFormatCode: '#,##0',

              valGridLine: { style: 'solid' },
            }
          )
        } else if (tipoGrafico !== 'table') {
          if (titulo === 'Estoque do fornecedor em quantidade' || titulo === 'Estoque do fornecedor em valor') {
            slide.addChart(
              tipoGrafico,
              [
                {
                  name: legendaPrimaria,
                  labels,
                  values: metricaPrimaria,
                },
              ],
              {
                x: 0.5,
                y: 0.25,
                w: "90%",
                h: "90%",

                chartColors: titulo === 'Estoque do fornecedor em quantidade' ? ['ED0000'] : ['FFC000'],

                // Fontes
                catAxisLabelFontSize: 10,
                catAxisLabelFontFace: "Montserrat",
                valAxisLabelFontFace: "Montserrat",
                legendFontFace: "Montserrat",
                titleFontFace: "Montserrat",

                // Legenda e título
                showLegend: false,
                legendPos: "t",
                title: titulo,
                showTitle: true,
                titleFontSize: 14,
                titleBold: true,

                lineSmooth: true,

                showValue: true,
                dataLabelFontFace: "Montserrat",
                dataLabelFontSize: 10,
                dataLabelColor: "000000",
                dataLabelFormatCode: '#,##0',

                // pequenas melhorias visuais
                valGridLine: { style: "solid" },
              } 
            )
          } else if (titulo === 'Estoque do fornecedor em valor') {

          } else {
            slide.addChart(
              tipoGrafico,
              [
                {
                  name: legendaPrimaria,
                  labels,
                  values: metricaPrimaria,
                },
                {
                  name: legendaSecundaria,
                  labels,
                  values: metricaSecundaria,
                }
              ],
              {
                x: 0.5,
                y: 0.25,
                w: "90%",
                h: "90%",

                chartColors: ["4CC884", "D68B58"],

                // Fontes
                catAxisLabelFontSize: 10,
                catAxisLabelFontFace: "Montserrat",
                valAxisLabelFontFace: "Montserrat",
                legendFontFace: "Montserrat",
                titleFontFace: "Montserrat",

                // Legenda e título
                showLegend: true,
                legendPos: "t",
                title: titulo,
                showTitle: true,
                titleFontSize: 14,
                titleBold: true,

                lineSmooth: true,

                showValue: true,
                dataLabelFontFace: "Montserrat",
                dataLabelFontSize: 10,
                dataLabelColor: "000000",
                dataLabelFormatCode: '#,##0.0"%"',

                // pequenas melhorias visuais
                valGridLine: { style: "solid" },
              } 
            )
          }
        } else {

        }

        const filePath = `./uploads/${titulo}-${tipoGrafico}.pptx`

        pptx.writeFile({ fileName: filePath })

        const pptxBuffer = await readFile(filePath)

        reply
          .header(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          )
          .header(
            "Content-Disposition",
            `attachment; filename="${titulo}-${tipoGrafico}.pptx"`
          )
          .send(Buffer.from(pptxBuffer));
      } catch (error) {
        console.warn(error)
      }
    },
  )
}
