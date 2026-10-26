import { describe, expect, test } from 'vitest'
import type { CoverLevel, Hour, ThatMorning } from './api'
import { chartRows, headline, hoursBeyondCover, leadRange } from './story'

const cover10: CoverLevel = { risk: '1 in 10', covered_pct: 90, cover_mw: 4559, still_short_pct: 10.1, unneeded_cover_mw: 2702.3 }

const morning = (pastDays: number): ThatMorning => ({
  past_days: pastDays,
  hours: pastDays * 24,
  typical_miss_mw: pastDays ? 2185.9 : null,
  bias_mw: pastDays ? 1749.7 : null,
  short_hours: 0,
  cover: pastDays ? [cover10] : [],
})

const hour = (start: string, forecast: number | null, error: number | null): Hour => ({
  start_time: start, forecast_mw: forecast, publish_time: '2026-01-14T07:30:00Z', lead_hours: 28.5, actual_mw: null, error_mw: error,
})

describe('headline', () => {
  test('uses the cover at the chosen risk level', () => {
    const h = headline(morning(12), '1 in 10')
    expect(h).toMatchObject({ kind: 'ok', typicalMissMw: 2185.9, fewDays: false })
    expect(h.kind === 'ok' && h.cover.cover_mw).toBe(4559)
  })

  test('with no finished days there is no cover number, never a made-up one', () => {
    expect(headline(morning(0), '1 in 10')).toEqual({ kind: 'no-history' })
  })

  test('warns when only a few days are behind the numbers', () => {
    expect(headline(morning(3), '1 in 10')).toMatchObject({ kind: 'ok', fewDays: true, pastDays: 3 })
  })
})

describe('chart rows', () => {
  test('the hourly forecast applies to both half-hours of its hour (noon 15 Jan)', () => {
    const day = {
      hours: [hour('2026-01-15T12:00:00Z', 11049, 1258.5)],
      half_hourly_actuals: [
        { start_time: '2026-01-15T12:00:00Z', actual_mw: 9742 },
        { start_time: '2026-01-15T12:30:00Z', actual_mw: 9839 },
      ],
    }
    const rows = chartRows(day, 4559)
    expect(rows.map((r) => [r.forecast, r.actual, r.floor])).toEqual([
      [11049, 9742, 11049 - 4559],
      [11049, 9839, 11049 - 4559],
    ])
  })

  test('a half-hour whose hour has no forecast is left out, not filled in', () => {
    const day = {
      hours: [hour('2026-01-15T12:00:00Z', null, null)],
      half_hourly_actuals: [{ start_time: '2026-01-15T12:00:00Z', actual_mw: 9742 }],
    }
    expect(chartRows(day, 4559)).toEqual([])
  })

  test('no cover number means no cover line', () => {
    const day = { hours: [hour('2026-01-15T12:00:00Z', 11049, 0)], half_hourly_actuals: [{ start_time: '2026-01-15T12:00:00Z', actual_mw: 9742 }] }
    expect(chartRows(day, null)[0].floor).toBeNull()
  })
})

test('hours beyond the cover counts only short hours bigger than the cover', () => {
  const hours = [hour('a', 1, 5000), hour('b', 1, 4559), hour('c', 1, -6000), hour('d', 1, null)]
  expect(hoursBeyondCover(hours, 4559)).toBe(1)
})

test('lead range is the shortest and longest lead of the forecasts you had', () => {
  const hours = [{ ...hour('a', 1, 0), lead_hours: 16.5 }, { ...hour('b', 1, 0), lead_hours: 39.5 }, { ...hour('c', null, null), lead_hours: null }]
  expect(leadRange(hours)).toEqual([16.5, 39.5])
  expect(leadRange([])).toBeNull()
})
