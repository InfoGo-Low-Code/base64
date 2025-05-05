import { getJsDateFromExcel } from 'excel-date-to-js'

export function excelDateToJSDate(excelDate: string | number): Date {
  const parsedDate = getJsDateFromExcel(excelDate)
  return parsedDate
}
