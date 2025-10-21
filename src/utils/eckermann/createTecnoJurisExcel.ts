import { TecnoJuris } from '@/controllers/eckermann/routes/eckermannExcelTecnoJuris'
import { Workbook } from 'exceljs'

export async function createTecnoJurisExcel(data: TecnoJuris[]) {
  const workbook = new Workbook()
  const worksheet = workbook.addWorksheet('TECNOJURIS')

  worksheet.columns = Object.keys(data[0]).map((key, idx) => ({
    header: key.toUpperCase(),
    key: key.toUpperCase(),
    width:
      idx === 0
        ? 20.57
        : idx === 1
          ? 98.57
          : idx === 2
            ? 16.86
            : idx === 3
              ? 15.14
              : idx === 4 || idx === 8 || idx === 11
                ? 18.71
                : idx === 5
                  ? 62.29
                  : idx === 6 || idx === 16
                    ? 24.43
                    : idx === 7
                      ? 41.86
                      : idx === 8
                        ? 18.43
                        : idx === 9 || idx === 12
                          ? 31.71
                          : idx === 10
                            ? 22.86
                            : idx === 13
                              ? 35.71
                              : idx === 14
                                ? 68.86
                                : 33.43,
  }))

  // ===== Título =====
  const headerRow = worksheet.getRow(1)
  headerRow.values = Object.keys(data[0]).map((key) => key)
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: 'E7E6E6',
      },
    }
    cell.font = {
      name: 'Calibri',
      bold: true,
      size: 10,
      color: {
        argb: '000000',
      },
    }
  })

  // ===== Dados a patir da linha 2 =====
  worksheet.addRows(data)

  // ===== Estilo das células de dados =====
  worksheet.getRows(2, worksheet.rowCount)?.forEach((row) => {
    row.eachCell((cell) => {
      cell.alignment = {
        wrapText: true,
        horizontal: 'left',
        vertical: 'middle',
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: 'FFFFFF',
        },
      }
      cell.font = {
        name: 'Calibri',
        size: 11,
      }
    })
  })

  // ===== Bordas =====
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        left: {
          style: 'thin',
          color: {
            argb: '000000',
          },
        },
        top: {
          style: 'thin',
          color: {
            argb: '000000',
          },
        },
        right: {
          style: 'thin',
          color: {
            argb: '000000',
          },
        },
        bottom: {
          style: 'thin',
          color: {
            argb: '000000',
          },
        },
      }
    })
  })

  // ===== Header com Filtro =====
  worksheet.autoFilter = {
    from: {
      row: 1,
      column: 1,
    },
    to: {
      row: 1,
      column: worksheet.columns.length,
    },
  }

  // ===== Header Fixo =====
  worksheet.views = [
    {
      state: 'frozen',
      ySplit: 1,
    },
  ]

  // ===== COLUNA K (11) - Contabilidade =====
  const colContabilidade = worksheet.getColumn(11)
  colContabilidade.numFmt = 'R$ #,##0.00'
  colContabilidade.eachCell((cell, rowNumber) => {
    if (rowNumber > 1) {
      const value = Number(cell.value)
      if (!isNaN(value)) cell.value = value
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
    }
  })

  // ===== SOMA no Final =====
  const ultimaLinha = worksheet.rowCount
  const formula = `SUM(K2:K${ultimaLinha - 1})`

  const totalRow = worksheet.getRow(ultimaLinha)
  totalRow.getCell(10).value = 'TOTAL'
  totalRow.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' }
  totalRow.getCell(10).font = { bold: true, color: { argb: '000000' } }

  totalRow.getCell(11).value = { formula }
  totalRow.getCell(11).numFmt = 'R$ #,##0.00'
  totalRow.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' }
  totalRow.getCell(11).font = { bold: true }

  // Aplica bordas à linha total
  totalRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: '000000' } },
      left: { style: 'thin', color: { argb: '000000' } },
      bottom: { style: 'thin', color: { argb: '000000' } },
      right: { style: 'thin', color: { argb: '000000' } },
    }
  })

  // ===== Gerar Buffer =====
  const buffer = await workbook.xlsx.writeBuffer()
  workbook.xlsx.writeFile('./uploads/excel.xlsx')

  return Buffer.from(buffer)
}
