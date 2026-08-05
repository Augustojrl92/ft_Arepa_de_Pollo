export function formatMessageTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function getDayKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function formatDayLabel(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (getDayKey(date) === getDayKey(today)) return 'Hoy'
  if (getDayKey(date) === getDayKey(yesterday)) return 'Ayer'

  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}
