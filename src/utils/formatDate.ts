import { formatInTimeZone } from "date-fns-tz"

export function formatDate(date: Date | string) {
  const formattedDate = formatInTimeZone(date, 'UTC', 'yyyy-MM-dd')

  return formattedDate
}
