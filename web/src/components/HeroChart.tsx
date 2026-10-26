import * as Plot from '@observablehq/plot'
import type { ChartRow } from '../story'
import { mw, ukDay, ukTime } from '../format'
import { colors, plotStyle } from '../theme'
import { PlotFigure } from './PlotFigure'

/**
 * The forecast you had vs what happened, half-hour by half-hour, in UK time.
 * Shaded blue where wind came in short (forecast above actual), grey where it came in above.
 * The dashed line is the forecast minus the cover: only an actual below it would have hurt.
 */
export function HeroChart({ rows, coverLabel }: { rows: ChartRow[]; coverLabel: string | null }) {
  return (
    <figure className="panel hero-chart">
      <figcaption className="legend">
        <span><i className="swatch line" style={{ background: colors.ink }} />Forecast you had</span>
        <span><i className="swatch line" style={{ background: colors.muted }} />Actual</span>
        <span><i className="swatch area" style={{ background: colors.accent }} />Short</span>
        <span><i className="swatch area" style={{ background: colors.extra }} />Wind above forecast</span>
        {coverLabel && <span><i className="swatch dash" style={{ borderColor: colors.accent }} />Forecast minus cover ({coverLabel})</span>}
      </figcaption>
      <PlotFigure deps={[rows]} make={(width) => chart(rows, width)} />
    </figure>
  )
}

function chart(rows: ChartRow[], width: number) {
  // Step lines draw each half-hour as a flat block; one extra point closes the last block.
  const last = rows[rows.length - 1]
  const steps = last ? [...rows, { ...last, time: new Date(+last.time + 30 * 60_000) }] : rows
  const top = Math.max(...rows.map((r) => Math.max(r.forecast, r.actual)), 1000) * 1.08
  const hasCover = rows.some((r) => r.floor !== null)

  return Plot.plot({
    width,
    height: width < 600 ? 280 : 380,
    marginLeft: 52,
    marginTop: 24,
    style: plotStyle,
    x: { type: 'utc', label: null, tickFormat: (d: Date) => ukTime(d.toISOString()), ticks: width < 600 ? 4 : 8 },
    y: { label: 'MW', domain: [0, top], nice: true, grid: true, tickFormat: (d: number) => mw(d) },
    marks: [
      Plot.differenceY(steps, {
        x: 'time', y1: 'actual', y2: 'forecast', curve: 'step-after',
        positiveFill: colors.accent, negativeFill: colors.extra, fillOpacity: 0.2, stroke: null,
      }),
      hasCover ? Plot.line(steps, { x: 'time', y: 'floor', curve: 'step-after', stroke: colors.accent, strokeDasharray: '4 4', strokeWidth: 1.4 }) : null,
      Plot.line(steps, { x: 'time', y: 'actual', curve: 'step-after', stroke: colors.muted, strokeWidth: 1.8 }),
      Plot.line(steps, { x: 'time', y: 'forecast', curve: 'step-after', stroke: colors.ink, strokeWidth: 2.4 }),
      Plot.ruleX(rows, Plot.pointerX({ x: 'time', stroke: colors.muted, strokeOpacity: 0.5 })),
      Plot.tip(rows, Plot.pointerX({ x: 'time', y: 'forecast', fill: colors.panel, stroke: colors.line, title: tipText })),
    ],
  })
}

function tipText(r: ChartRow) {
  const miss = r.forecast - r.actual
  const lines = [
    `${ukTime(r.time.toISOString())} UK`,
    `Forecast you had  ${mw(r.forecast)} MW`,
    `Actual            ${mw(r.actual)} MW`,
    miss >= 0 ? `Short by          ${mw(miss)} MW` : `Wind above by     ${mw(-miss)} MW`,
  ]
  if (r.hour.publish_time) {
    lines.push(`From the ${ukTime(r.hour.publish_time)} ${ukDay(r.hour.publish_time)} forecast, ${r.hour.lead_hours} h ahead`)
  }
  return lines.join('\n')
}
