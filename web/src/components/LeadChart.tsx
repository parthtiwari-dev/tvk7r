import * as Plot from '@observablehq/plot'
import type { LeadBand } from '../api'
import { mw } from '../format'
import { colors, plotStyle } from '../theme'
import { PlotFigure } from './PlotFigure'

/** Bands built from fewer forecasts than this are faded and marked "few". */
const THIN_BAND = 1400
/** Bands with almost no forecasts are left off the chart. */
const TOO_THIN = 100

/**
 * Average miss by how far ahead the forecast was made, from every publish in January.
 * The shaded strip is where the forecasts you had at the cutoff sit.
 */
export function LeadChart({ bands, decisionLeads, cutoff }: { bands: LeadBand[]; decisionLeads: [number, number] | null; cutoff: string }) {
  const shown = bands.filter((b) => b.forecasts >= TOO_THIN)
  const dropped = bands.filter((b) => b.forecasts < TOO_THIN)
  return (
    <figure className="panel">
      <figcaption className="panel-title">Average miss by how far ahead the forecast was made</figcaption>
      <PlotFigure deps={[bands, decisionLeads]} make={(width) => chart(shown, decisionLeads, cutoff, width)} />
      <p className="note">
        From every forecast published in January, not only the one you had. Faded bars are built from fewer forecasts.
        {dropped.length > 0 && ` Left off: ${dropped.map((b) => `${b.from_hours} h+ (${b.forecasts} forecasts)`).join(', ')}.`}
      </p>
    </figure>
  )
}

function chart(bands: LeadBand[], leads: [number, number] | null, cutoff: string, width: number) {
  const right = Math.max(...bands.map((b) => b.to_hours))
  const top = Math.max(...bands.map((b) => b.typical_miss_mw)) * 1.15
  return Plot.plot({
    width,
    height: 240,
    marginLeft: 52,
    style: plotStyle,
    x: { label: 'Hours ahead →', domain: [0, right], ticks: bands.map((b) => b.from_hours).filter((h) => h % 12 === 0) },
    y: { label: 'Average miss, MW', domain: [0, top], grid: true, tickFormat: (d: number) => mw(d) },
    marks: [
      leads ? Plot.rectX([leads], { x1: (l) => l[0], x2: (l) => l[1], y1: 0, y2: top, fill: colors.accent, fillOpacity: 0.08 }) : null,
      leads ? Plot.text([leads], { x: (l) => (l[0] + l[1]) / 2, y: top, dy: 10, text: () => `your ${cutoff} decision`, fill: colors.accent, fontWeight: 600 }) : null,
      Plot.rectY(bands, {
        x1: 'from_hours', x2: 'to_hours', y: 'typical_miss_mw', inset: 2,
        fill: colors.ink, fillOpacity: (b: LeadBand) => (b.forecasts < THIN_BAND ? 0.25 : 0.85),
      }),
      Plot.text(bands.filter((b) => b.forecasts < THIN_BAND), {
        x: (b: LeadBand) => (b.from_hours + b.to_hours) / 2, y: 'typical_miss_mw', dy: -8, text: () => 'few', fill: colors.muted,
      }),
      Plot.tip(bands, Plot.pointerX({
        x: (b: LeadBand) => (b.from_hours + b.to_hours) / 2, y: 'typical_miss_mw', fill: colors.panel, stroke: colors.line,
        title: (b: LeadBand) => `${b.from_hours}-${b.to_hours} h ahead\nAverage miss ${mw(b.typical_miss_mw)} MW\nForecast ran ${b.bias_mw < 0 ? 'low' : 'high'} by ${mw(Math.abs(b.bias_mw))} MW\n${mw(b.forecasts)} forecasts`,
      })),
    ],
  })
}
