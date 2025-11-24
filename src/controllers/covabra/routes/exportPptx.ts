import { FastifyZodTypedInstance } from '@/@types/fastifyZodTypedInstance'
import { z } from 'zod'
import pptxgen from 'pptxgenjs'
import { existsSync, mkdirSync, unlinkSync } from 'node:fs'

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
          tipoGrafico: z.enum(['line', 'bar', 'bar-line', 'table']),
          metricasTable: z.array(
              z.record(z.union([z.string(), z.number(), z.null()]))
          ).optional(),
          totalTable: z.array(z.union([z.string(), z.number()])).optional(),
          usuario: z.string(),
          marca: z.string(),
          categorias: z.string(),
          subcategorias: z.string(),
          periodoInicial: z.string(),
          periodoFinal: z.string(),
        }),
        response: {
          200: z.object({
            base64: z.string(),
          })
        }
      },
    },
    async (request, reply) => {
      const {
        titulo,
        legendaPrimaria,
        metricaPrimaria,
        labels,
        legendaSecundaria,
        metricaSecundaria,
        tipoGrafico,
        metricasTable,
        usuario,
        marca,
        categorias,
        subcategorias,
        periodoInicial,
        periodoFinal,
        totalTable,
      } = request.body

      let filePath = ''

      const hoje = new Date()
      const dataConsulta = `${hoje.getDate().toString().padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`

      try {
        if (!existsSync(`./uploads`)) {
          mkdirSync(`./uploads`, { recursive: true })
        }

        const pptx = new pptxgen()

        if (tipoGrafico === 'bar-line') {
          const slide = pptx.addSlide()

          slide.addImage({
            path: './src/images/logoCovabra.png',
            x: '90%',
            y: 0.125,
            w: 0.5,
            h: 0.5,
          })

          slide.addText([
            { text: `Data da Consulta: ${dataConsulta}\n`, options: { fontSize: 9, bold: true, color: "000000" } },
            { text: `Usuário: ${usuario}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
            { text: `Marca: ${marca}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
            { text: `Categorias: ${categorias}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
            { text: `Subcategorias: ${subcategorias}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
            { text: `Período Inicial: ${periodoInicial}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
            { text: `Período Final: ${periodoFinal}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
          ], {
            x: 0.5,
            y: 0.25,
            fontFace: "Montserrat",
            h: "20%",
            valign: "top",
            lineSpacingMultiple: 1.25,
            margin: 0,
          })

          // ======================
          // 📊 GRÁFICO DE BARRAS
          // ======================
          slide.addChart(
            'bar',
            [
              {
                labels,
                name: legendaPrimaria,
                values: metricaPrimaria,
              },
            ],
            {
              x: 0.5,
              y: 1.35,   // ⬅ legenda acima da linha
              w: "90%",
              h: "70%",

              title: titulo,
              showTitle: true,
              titleFontSize: 12,
              titleBold: true,

              showLegend: true,
              legendPos: 't',

              titleFontFace: "Montserrat",
              legendFontFace: "Montserrat",
              legendFontSize: 10,

              catAxisLabelFontFace: "Montserrat",
              catAxisLabelFontSize: 7,

              fontFace: "Montserrat",

              dataLabelColor: '759A5D',

              chartColors: ['44BE7B'],
              showValue: true,
              dataLabelFontFace: 'Montserrat',
              dataLabelFontSize: 10,
              dataLabelFormatCode: '#,##0.0',
              dataLabelFontBold: true,

              valAxisHidden: true,
              valGridLine: { style: "none" },
            }
          )


          // ======================
          // 📈 GRÁFICO DE LINHA
          // ======================
          slide.addChart(
            'line',
            [
              {
                labels,
                name: legendaSecundaria,
                values: metricaSecundaria,   // 👈 linha horizontal
              },
            ],
            {
              x: 0.5,
              y: 1.915,
              w: "90%",
              h: "60%",

              showLegend: true,
              legendPos: 't',

              legendFontFace: "Montserrat",
              legendFontSize: 10,

              dataLabelPosition: 't',

              plotArea: { fill: { color: "FFFFFF", transparency: 100 } },

              valAxisMinVal: 0,
              valAxisMaxVal: 99999999999999,

              // esconde axis para não ficar estranho
              // catAxisHidden: true,
              valAxisHidden: true,

              secondaryValAxis: true,

              catAxisLabelFontFace: "Montserrat",
              catAxisLabelFontSize: 7,

              chartColors: ['9DC3E6'],
              lineSmooth: false,  // garante que não faça ondulação
              // lineSize: 2,
              lineDataSymbol: 'circle',
              lineDataSymbolSize: 7,

              // Mostra os valores reais
              showValue: true,
              dataLabelFontFace: 'Montserrat',
              dataLabelFontSize: 10,
              dataLabelColor: '254A67',
              dataLabelFontBold: true,

              // 💡 Customização do label:
              dataLabelFormatCode: '#,##0.0',
              valGridLine: { style: "none" },
            }
          )

        } else if (tipoGrafico !== 'table') {
          const slide = pptx.addSlide()

          slide.addImage({
            path: './src/images/logoCovabra.png',
            x: '90%',
            y: 0.125,
            w: 0.5,
            h: 0.5,
          })

          slide.addText([
            { text: `Data da Consulta: ${dataConsulta}\n`, options: { fontSize: 9, bold: true, color: "000000" } },
            { text: `Usuário: ${usuario}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
            { text: `Marca: ${marca}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
            { text: `Categorias: ${categorias}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
            { text: `Subcategorias: ${subcategorias}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
            { text: `Período Inicial: ${periodoInicial}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
            { text: `Período Final: ${periodoFinal}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
          ], {
            x: 0.5,
            y: 0.25,
            fontFace: "Montserrat",
            h: "20%",
            valign: "top",
            lineSpacingMultiple: 1.25,
            margin: 0,
          })

          if (titulo === 'Estoque do fornecedor em quantidade' || titulo === 'Estoque do fornecedor em valor' || titulo === 'Preço médio do fornecedor (R$)') {
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
                y: 1.35,
                w: "90%",
                h: "70%",

                chartColors: titulo === 'Estoque do fornecedor em quantidade'
                  ? ['ED0000']
                  : titulo === 'Estoque do fornecedor em valor'
                    ? ['FFC000']
                    : ['00B0F0'],

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
                valGridLine: { style: "none" },
              } 
            )
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
                y: 1.35,
                w: "90%",
                h: "70%",

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
                valGridLine: { style: "none" },
              } 
            )
          }
        } else {
          // ========================
          // ÍCONES (paths locais)
          // ========================

          // Detecta coluna STATUS
          // Detecta coluna STATUS
          const isStatusColumn = (key: string) =>
            key.toUpperCase().includes("STATUS")

          // Função para criar uma célula (texto)
          function makeCell(key: string, value: any, isTotalRow: boolean = false): pptxgen.TableCell {
            // --- COLUNA STATUS → vira POSITIVO / NEGATIVO
            if (isStatusColumn(key)) {
              let statusText = ""

              // if (typeof value === "string") {
              //   const val = value.toLowerCase()
              //   statusText = val.includes("positivo") ? "POSITIVO" : "NEGATIVO"
              // } else {
              //   const num = Number(value)
              //   statusText = num === 0 ? "NEGATIVO" : "POSITIVO"
              // }

              return {
                text: statusText,
                options: {
                  fontFace: "Montserrat",
                  fontSize: 5,
                  bold: true, // sempre bold na coluna STATUS
                  color: statusText === "POSITIVO" ? "00AA00" : "AA0000",
                }
              }
            }

            // --- OUTRAS COLUNAS → texto normal
            let textValue = ""

            if (value == null) {
              textValue = "0"
            } else if (typeof value === "number") {
              if (key.includes("R$")) {
                textValue = new Intl.NumberFormat("pt-BR", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(value)
              } else {
                textValue = new Intl.NumberFormat("pt-BR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1
                }).format(value)
              }
            } else {
              textValue = value.toString()
            }

            return {
              text: textValue,
              options: {
                fontFace: "Montserrat",
                fontSize: 5,
                bold: isTotalRow ? true : false,   // <<< AQUI!
                color: "000000",
              }
            }
          }


          // ========================
          // HEADER
          // ========================
          const header = Object.keys(metricasTable![0]).map((key) => ({
            text: key,
            options: {
              bold: true,
              fontSize: 5,
              fontFace: "Montserrat",
              color: "FFFFFF",
              fill: { type: "solid", color: "2F75B5" } as any,
              hAlign: "center" as any
            }
          }))

          // ========================
          // TOTAL (com ícones)
          // ========================
          let totalLinha: pptxgen.TableRow | undefined = undefined

          if (totalTable && totalTable.length > 0) {
            const keys = Object.keys(metricasTable![0])

            totalLinha = keys.map((key, i) =>
              makeCell(key, totalTable[i], true)   // <<< isTotalRow = true
            )
          }

          // ========================
          // ROWS (linhas normais)
          // ========================
          const rows = metricasTable!.map(row =>
            Object.keys(row).map(key => makeCell(key, row[key], false))
          )

          // ==============================
          //     PAGINAÇÃO DAS TABELAS
          // ==============================
          function chunkRows(rows: any[]) {
            const chunks: any[] = []

            const firstPageSize = 10
            const otherPagesSize = 15

            chunks.push(rows.slice(0, firstPageSize))

            let start = firstPageSize
            while (start < rows.length) {
              chunks.push(rows.slice(start, start + otherPagesSize))
              start += otherPagesSize
            }

            return chunks
          }

          const pages = chunkRows(rows)

          pages.forEach((pageRows, pageIndex) => {
            const pageSlide = pptx.addSlide()

            // LOGO
            pageSlide.addImage({
              path: './src/images/logoCovabra.png',
              x: '90%',
              y: 0.125,
              w: 0.5,
              h: 0.5,
            })

            const isFirstPage = pageIndex === 0

            // HEADER SOMENTE NA PRIMEIRA PÁGINA
            if (isFirstPage) {
              pageSlide.addText([
                { text: `Data da Consulta: ${dataConsulta}\n`, options: { fontSize: 9, bold: true, color: "000000" } },
                { text: `Usuário: ${usuario}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
                { text: `Marca: ${marca}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
                { text: `Categorias: ${categorias}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
                { text: `Subcategorias: ${subcategorias}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
                { text: `Período Inicial: ${periodoInicial}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
                { text: `Período Final: ${periodoFinal}\n`, options: { fontSize: 7, bold: true, color: "3C3C3C" } },
              ], {
                x: 0.5,
                y: 0.25,
                fontFace: "Montserrat",
                h: "20%",
                valign: "top",
                lineSpacingMultiple: 1.25,
                margin: 0,
              })
            }

            // ----------------------------
            //     TABELA POR PÁGINA
            // ----------------------------
            let tableData = [header, ...pageRows]

            if (pageIndex === pages.length - 1 && totalLinha) {
              tableData = [header, ...pageRows, totalLinha]
            }

            const totalLinhas = pageRows.length
            const alturaCalculada = totalLinhas * 10

            const HEADER_HEIGHT = 25
            const FOOTER_MARGIN = 5

            let alturaMaxima
            let yPos: pptxgen.Coord = "15%"

            if (isFirstPage) {
              alturaMaxima = 100 - HEADER_HEIGHT - FOOTER_MARGIN
              yPos = `${HEADER_HEIGHT}%`
            } else {
              alturaMaxima = 100 - 15 - FOOTER_MARGIN
            }

            const TABLE_Y = yPos

            const alturaFinal: pptxgen.Coord = `${Math.min(alturaCalculada, alturaMaxima)}%`

            pageSlide.addTable(tableData, {
              x: 0.5,
              y: TABLE_Y,
              w: "90%",
              h: alturaFinal,
              border: { color: "D0D0D0", pt: 1 },
              autoPage: false,
            })

            // ======================================================
            // PASSO 1 — ADICIONAR ICONES EM CIMA DA COLUNA STATUS
            // ======================================================

            // 1. Descobre qual índice da coluna é STATUS
            const columns = Object.keys(metricasTable![0])
            const statusColIndex = columns.findIndex((key) =>
              key.toUpperCase().includes("STATUS")
            )

            if (statusColIndex >= 0) {
              const POS_IMG_PATH = "./src/images/icon_positivo.png"
              const NEG_IMG_PATH = "./src/images/icon_negativo.png"

              // ======================================================
              // POSICIONAMENTO PRECISO DOS ÍCONES
              // ======================================================

              // Medidas reais da tabela (em inches)
              const TABLE_X_IN = 0.5           // você usou x:0.5 → 0.5" reais
              const TABLE_W_IN = 9.0           // w:"90%" → ~9"
              const TABLE_Y_IN =
                typeof TABLE_Y === "string" && TABLE_Y.includes("%")
                  ? (parseFloat(TABLE_Y) / 100) * 5.625
                  : Number(TABLE_Y)

              const TABLE_H_IN =
                (typeof alturaFinal === "string" && alturaFinal.includes("%"))
                  ? (parseFloat(alturaFinal) / 100) * 5.625
                  : Number(alturaFinal)

              // número total de linhas na tabela renderizada
              const totalRows = tableData.length

              // altura real de cada linha
              const ROW_H_IN = TABLE_H_IN / totalRows

              // largura/altura real das imagens
              const IMG_W_IN = 0.10
              const IMG_H_IN = 0.10

              // largura da coluna do STATUS
              const colCount = columns.length
              const colWidth = TABLE_W_IN / colCount

              // loop das linhas (r = 1 ignora header)
              for (let r = 1; r < tableData.length; r++) {
                const rowIsTotal =
                  pageIndex === pages.length - 1 &&
                  totalLinha &&
                  r === tableData.length - 1

                let cellValue: string | null = null

                if (r - 1 < pageRows.length) {
                  // Linha normal
                  const celula = pageRows[r - 1][statusColIndex]
                  cellValue = celula?.text ?? null
                } else if (rowIsTotal) {
                  // Linha TOTAL (vem em outro formato)
                  cellValue = String(totalTable?.[statusColIndex]) ?? null
                }

                const positive =
                  typeof cellValue === "string"
                    ? cellValue.toLowerCase().includes("positivo")
                    : Number(cellValue) !== 0

                const imgPath = positive ? POS_IMG_PATH : NEG_IMG_PATH

                const PADDING_LEFT_AND_TOP = 0.05

                // --- X perfeito ---
                const xPos =
                  TABLE_X_IN +
                  statusColIndex * colWidth +
                  PADDING_LEFT_AND_TOP
                  // (colWidth - IMG_W_IN) / 2

                // --- Y perfeito ---
                const yPos =
                  TABLE_Y_IN +                     // onde a tabela começa
                  r * ROW_H_IN +                   // pula r linhas
                  PADDING_LEFT_AND_TOP          // só caso queira alinhado tipo texto (à esquerda)
                  // (ROW_H_IN - IMG_H_IN) / 2       // centraliza dentro da linha

                pageSlide.addImage({
                  path: imgPath,
                  x: xPos,
                  y: yPos,
                  w: IMG_W_IN,
                  h: IMG_H_IN,
                })
              }
            }
          })
        }

        filePath = `./uploads/${titulo}-${tipoGrafico}.pptx`

        await pptx.writeFile({ fileName: filePath })

        const base64 = await pptx.write({ outputType: 'base64' })
        const base64String = base64.toString()

        reply.send({ base64: base64String })
      } catch (error: any) {
        console.warn(error)

        return reply.internalServerError(error.message)
      } finally {
        // unlinkSync(filePath)
      }
    },
  )
}
