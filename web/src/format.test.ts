import { describe, expect, test } from 'vitest'
import { dateLabel, gw, mw, riskNumber, signedMw, ukDay, ukTime, weekday } from './format'

describe('UK time', () => {
  test('in winter UK time is UTC', () => {
    expect(ukTime('2026-01-14T07:30:00Z')).toBe('07:30')
    expect(ukDay('2026-01-14T07:30:00Z')).toBe('Wed 14 Jan')
  })

  test('in summer UK time is one hour ahead of UTC', () => {
    expect(ukTime('2026-07-14T08:20:00Z')).toBe('09:20')
  })

  test('late evening UTC in summer is already the next UK day', () => {
    expect(ukDay('2026-07-14T23:30:00Z')).toBe('Wed 15 Jul')
  })

  test('a calendar date is never shifted to another day', () => {
    expect(dateLabel('2026-01-15')).toBe('Thu 15 Jan')
    expect(weekday('2026-01-15')).toBe('Thursday')
  })
})

describe('numbers', () => {
  test('MW with thousands separators, GW with one decimal', () => {
    expect(mw(4558.96)).toBe('4,559')
    expect(gw(4558.96)).toBe('4.6')
  })

  test('bias shows its sign', () => {
    expect(signedMw(1749.7)).toBe('+1,750')
    expect(signedMw(-312)).toBe('−312')
  })

  test('risk level as a number', () => {
    expect(riskNumber('1 in 10')).toBe(10)
  })
})
