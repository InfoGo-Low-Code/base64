export function proximoDiaUtil(data: string): Date {
  const dataSemHorario = data.split('T')[0]
  const [year, month, day] = dataSemHorario.split('-').map(Number)

  // cria data LOCAL
  const d = new Date(year, month - 1, day)

  // normaliza para meio-dia (anti-fuso)
  d.setHours(12, 0, 0, 0)

  // +1 dia
  d.setDate(d.getDate() + 1)

  // pula sábado/domingo
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1)
  }

  return d
}
