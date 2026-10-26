import { useEffect, useRef } from 'react'
import type { DaySummary } from '../api'
import { mw } from '../format'

/** Height of the tallest day bar (the day with the biggest average miss). */
const BAR_PX = 24

/** A row of buttons where exactly one is chosen. */
export function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string
  options: { value: T; text: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="control">
      <span className="control-label">{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
            {o.text}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The 31 delivery days in a row, with arrows to step one day back or forward. Each day has a
 * small bar for its average miss, in the accent colour when wind fell below what you counted on.
 */
export function DayStrip({ days, value, risk, onChange }: { days: DaySummary[]; value: string; risk: string; onChange: (day: string) => void }) {
  const index = days.findIndex((d) => d.delivery_day === value)
  const biggestMiss = Math.max(...days.map((d) => d.typical_miss_mw ?? 0), 1)
  const row = useRef<HTMLDivElement>(null)

  // On a narrow screen the row scrolls sideways: keep the chosen day in the middle of it.
  useEffect(() => {
    const el = row.current
    const chosen = el?.querySelector<HTMLElement>('.day.on')
    if (el && chosen) el.scrollLeft = chosen.offsetLeft - el.offsetLeft - (el.clientWidth - chosen.offsetWidth) / 2
  }, [value, days])

  const step = (by: number) => {
    const next = days[index + by]
    if (next) onChange(next.delivery_day)
  }
  return (
    <nav className="strip" aria-label="Delivery day">
      <span className="control-label">Delivery day</span>
      <button className="arrow" onClick={() => step(-1)} disabled={index <= 0} aria-label="Previous day">‹</button>
      <div className="days" ref={row}>
        {days.map((d) => {
          const [, month, dayOfMonth] = d.delivery_day.split('-')
          const beyond = d.hours_beyond_cover[risk]
          const classes = ['day', d.delivery_day === value && 'on', beyond > 0 && 'fell'].filter(Boolean).join(' ')
          return (
            <button key={d.delivery_day} title={dayTitle(d, beyond)} className={classes} onClick={() => onChange(d.delivery_day)}>
              <span className="bar" style={{ height: `${Math.max(2, (BAR_PX * (d.typical_miss_mw ?? 0)) / biggestMiss)}px` }} />
              {Number(dayOfMonth)}{month === '02' && <small>Feb</small>}
            </button>
          )
        })}
      </div>
      <button className="arrow" onClick={() => step(1)} disabled={index >= days.length - 1} aria-label="Next day">›</button>
    </nav>
  )
}

function dayTitle(d: DaySummary, beyond: number | undefined) {
  const miss = d.typical_miss_mw !== null ? `, average miss ${mw(d.typical_miss_mw)} MW` : ''
  const result = beyond === undefined
    ? 'no track record yet that morning'
    : beyond === 0 ? 'wind stayed above what you counted on' : `wind fell below what you counted on in ${beyond} of ${d.hours} hours`
  return `${d.label}${miss}; ${result}`
}
