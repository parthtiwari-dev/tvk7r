// Turns API numbers into what the screen says. No new metrics here: every number comes from
// the API; these functions only pick, line up and count.

import type { CoverLevel, DayDetail, HalfHour, Hour, ThatMorning } from './api'

/** Below this many past days, the "that morning" numbers get a warning. */
export const FEW_PAST_DAYS = 5

export type Headline =
  | { kind: 'no-history' }
  | { kind: 'ok'; typicalMissMw: number; cover: CoverLevel; fewDays: boolean; pastDays: number }

/** What the headline can honestly say on the decision morning, at the chosen risk level. */
export function headline(morning: ThatMorning, risk: string): Headline {
  const cover = morning.cover.find((c) => c.risk === risk)
  if (morning.past_days === 0 || !cover || morning.typical_miss_mw === null) return { kind: 'no-history' }
  return {
    kind: 'ok',
    typicalMissMw: morning.typical_miss_mw,
    cover,
    fewDays: morning.past_days < FEW_PAST_DAYS,
    pastDays: morning.past_days,
  }
}

/**
 * Wind you can count on: the forecast minus the cover (the screen calls the cover a safety
 * margin). The day's average forecast minus the margin, since the margin is the same every hour.
 */
export function countOn(avgForecastMw: number | null | undefined, coverMw: number | null) {
  return avgForecastMw == null || coverMw === null ? null : avgForecastMw - coverMw
}

export type ChartRow = {
  time: Date
  forecast: number
  actual: number
  countOn: number | null // forecast minus cover; null when there is no cover number yet
  hour: Hour
}

/**
 * One row per half-hour for the hero chart. The hourly forecast you had applies to both
 * half-hours of its hour (the same rule the engine uses to compare them). Half-hours whose
 * hour has no forecast are left out, never filled in.
 */
export function chartRows(day: Pick<DayDetail, 'hours' | 'half_hourly_actuals'>, coverMw: number | null): ChartRow[] {
  const byHour = new Map(day.hours.map((h) => [Date.parse(h.start_time), h]))
  const rows: ChartRow[] = []
  for (const half of day.half_hourly_actuals as HalfHour[]) {
    const t = Date.parse(half.start_time)
    const hour = byHour.get(t - (t % 3_600_000))
    if (!hour || hour.forecast_mw === null) continue
    rows.push({
      time: new Date(t),
      forecast: hour.forecast_mw,
      actual: half.actual_mw,
      countOn: coverMw === null ? null : hour.forecast_mw - coverMw,
      hour,
    })
  }
  return rows
}

/** Shortest and longest lead time (hours ahead) of the forecasts you had for the day. */
export function leadRange(hours: Hour[]): [number, number] | null {
  const leads = hours.map((h) => h.lead_hours).filter((l): l is number => l !== null)
  return leads.length ? [Math.min(...leads), Math.max(...leads)] : null
}
