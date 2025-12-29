import { PoFormattedSchema } from '@/controllers/biogen/routes/formatExcel'
import { Workbook } from 'exceljs'

export async function createBiogenExcel(data: PoFormattedSchema[]) {
  const workbook = new Workbook()
  const worksheet = workbook.addWorksheet('Previsões')

  worksheet.columns = Object.keys(data[0]).map((key, idx) => ({
    header: key,
    key: key,
    width:
      idx === 0 || idx === 1 || idx === 4 || idx === 7 || idx === 9 || idx === 10
        ? 8.38
        : idx === 2
          ? 7.5
          : idx === 3
            ? 9.63
            : idx === 5
              ? 8.75
              : idx === 6
                ? 12.5
                : idx === 8
                  ? 16.75
                  : idx === 11
                    ? 139.38
                    : 18.38
  }))

  const headerRow = worksheet.getRow(1)
  headerRow.values = Object.keys(data[0]).map((key) => key)
  headerRow.alignment = {
    vertical: 'bottom',
    horizontal: 'center',
    wrapText: true,
  }

  headerRow.font = {
    name: 'Arial',
    bold: true,
    size: 9,
    color: {
      argb: 'FFFFFF',
    },
  }

  headerRow.height = 36
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: 'D86DCD',
      },
    }
  })

  worksheet.addRows(data)

  worksheet.getRows(2, worksheet.rowCount)?.forEach((row) => {
    row.eachCell((cell) => {
      cell.alignment = {
        horizontal: 'left',
        vertical: 'bottom',
      }

      cell.font = {
        name: 'Aptos Narrow',
        size: 11,
      }
    })
  })

  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        left: {
          style: 'thin',
          color: {
            argb: 'CACAD9',
          },
        },
        top: {
          style: 'thin',
          color: {
            argb: 'D4D4D4',
          },
        },
        right: {
          style: 'thin',
          color: {
            argb: 'D4D4D4',
          },
        },
        bottom: {
          style: 'thin',
          color: {
            argb: 'D4D4D4',
          },
        },
      }
    })
  })

  // ===== Gerar Buffer =====
  const buffer = await workbook.xlsx.writeBuffer()
  workbook.xlsx.writeFile('./uploads/excel.xlsx')

  return Buffer.from(buffer)
}
