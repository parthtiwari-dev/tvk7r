// The shapes the FastAPI app returns, and one function per endpoint.
// Times are UTC ISO strings ending in Z. MW are rounded to one decimal. Missing numbers are null.

export type Summary = {
  hours: number
  typical_miss_mw: number | null
  bias_mw: number | null
  short_hours: number
}

export type CoverLevel = {
  risk: string // "1 in 5", "1 in 10", "1 in 20"
  covered_pct: number
  cover_mw: number
  still_short_pct: number
  unneeded_cover_mw: number
}

export type ExtraSide = { hours: number; pct_of_hours: number; typical_extra_mw: number | null }

export type DayLabels = { delivery_day: string; decision_day: string; label: string }

export type DaySummary = DayLabels & Summary & {
  avg_forecast_mw: number | null
  avg_actual_mw: number | null
  worst_short_mw: number | null
}

export type Hour = {
  start_time: string
  forecast_mw: number | null
  publish_time: string | null
  lead_hours: number | null
  actual_mw: number | null
  error_mw: number | null
}

export type HalfHour = { start_time: string; actual_mw: number }

export type ThatMorning = Summary & { past_days: number; cover: CoverLevel[] }

export type DayDetail = DayLabels & {
  cutoff: string
  cutoff_utc: string
  publishes_used: string[]
  hours: Hour[]
  half_hourly_actuals: HalfHour[]
  how_it_turned_out: Summary & { extra_side: ExtraSide }
  that_morning: ThatMorning
}

export type LeadBand = {
  from_hours: number
  to_hours: number
  forecasts: number
  typical_miss_mw: number
  bias_mw: number
  cover_1_in_10_mw: number
}

export type Accuracy = Summary & {
  cutoff: string
  delivery_days: [string, string]
  cover: CoverLevel[]
  extra_side: ExtraSide
  worst_days: (DayLabels & { typical_miss_mw: number; bias_mw: number })[]
  by_lead_time: LeadBand[]
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail ?? `The server answered ${response.status}`)
  }
  return response.json()
}

export const fetchDays = (cutoff: string) =>
  get<{ cutoff: string; days: DaySummary[] }>(`/api/days?cutoff=${cutoff}`)

export const fetchDay = (deliveryDay: string, cutoff: string) =>
  get<DayDetail>(`/api/day/${deliveryDay}?cutoff=${cutoff}`)

export const fetchAccuracy = (cutoff: string) => get<Accuracy>(`/api/accuracy?cutoff=${cutoff}`)
