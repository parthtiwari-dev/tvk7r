// Formatting only. The API sends UTC; everything the trader sees is UK time.

const UK = 'Europe/London'

const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: UK, hour: '2-digit', minute: '2-digit' })
const shortDayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: UK, weekday: 'short', day: 'numeric', month: 'short' })

/** "2026-01-14T07:30:00Z" -> "07:30" (UK time; one hour later in summer). */
export const ukTime = (iso: string) => timeFormat.format(new Date(iso))

/** "2026-01-14T07:30:00Z" -> "Wed 14 Jan" (UK date). */
export const ukDay = (iso: string) => shortDayFormat.format(new Date(iso)).replace(',', '')

/** A calendar date "2026-01-15" -> "Thu 15 Jan". Read as a UK date, never shifted. */
export const dateLabel = (isoDate: string) => ukDay(`${isoDate}T12:00:00Z`)

/** A calendar date "2026-01-15" -> "Thursday". */
export const weekday = (isoDate: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: UK, weekday: 'long' }).format(new Date(`${isoDate}T12:00:00Z`))

/** 4558.96 -> "4,559" */
export const mw = (value: number) => Math.round(value).toLocaleString('en-GB')

/** 4558.96 -> "4.6" (GW, one decimal) */
export const gw = (value: number) => (value / 1000).toFixed(1)

/** Sign in front, for bias: 1749.7 -> "+1,750" */
export const signedMw = (value: number) => (value > 0 ? '+' : value < 0 ? '−' : '') + mw(Math.abs(value))

/** "1 in 10" -> 10 */
export const riskNumber = (risk: string) => Number(risk.split(' in ')[1])
