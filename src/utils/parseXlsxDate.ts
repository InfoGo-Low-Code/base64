import { getJsDateFromExcel } from 'excel-date-to-js'

export function excelDateToJSDate(excelDate: string | number): Date {
  const serial = typeof excelDate === 'string' ? Number(excelDate) : excelDate

  const parsedDate = getJsDateFromExcel(serial)

  return parsedDate
}
