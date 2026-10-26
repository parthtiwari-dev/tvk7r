import type { ReactNode } from 'react'
import type { DayDetail, DaySummary } from '../api'
import { dateLabel, gw, mw, riskNumber, signedMw, ukDay, ukTime, weekday } from '../format'
import { chartRows, headline, hoursBeyondCover, leadRange } from '../story'
import { HeroChart } from './HeroChart'

/** The top half of the screen: one delivery day, using only what you could know that morning. */
export function DayView({ day, summary, risk }: { day: DayDetail; summary: DaySummary | undefined; risk: string }) {
  const story = headline(day.that_morning, risk)
  const cover = story.kind === 'ok' ? story.cover : null
  const rows = chartRows(day, cover ? cover.cover_mw : null)
  const leads = leadRange(day.hours)
  const deliveryWeekday = weekday(day.delivery_day)
  const pastDays = day.that_morning.past_days
  const decided = `${dateLabel(day.decision_day)} at ${day.cutoff}`

  return (
    <section aria-label="The day you chose">
      <p className="eyebrow">
        Decide {dateLabel(day.decision_day)} {day.cutoff} · Delivery {dateLabel(day.delivery_day)}
      </p>

      <h1 className="headline">
        On {decided}, the forecast said about <span className="num">{summary?.avg_forecast_mw != null ? `${gw(summary.avg_forecast_mw)} GW` : '…'}</span> of wind
        for {deliveryWeekday}.{' '}
        {story.kind === 'ok' ? (
          <>
            Forecasts like that missed by <span className="num">{gw(story.typicalMissMw)} GW</span> on average. One hour
            in {riskNumber(story.cover.risk)}, wind came in more than <span className="num">{gw(story.cover.cover_mw)} GW</span> below.{' '}
            <strong>Keep about <span className="num">{gw(story.cover.cover_mw)} GW</span> of cover.</strong>
          </>
        ) : (
          <>No delivery day had finished yet, so there was nothing to measure its miss against. <strong>No honest cover number this morning.</strong></>
        )}
      </h1>
      {story.kind === 'ok' && story.fewDays && (
        <p className="warning">Based on only {story.pastDays} finished {story.pastDays === 1 ? 'day' : 'days'} so far. Treat these numbers as rough.</p>
      )}

      <div className="cards">
        <Card label="Forecast you had" value={summary?.avg_forecast_mw != null ? mw(summary.avg_forecast_mw) : '…'} unit="MW avg">
          {publishText(day.publishes_used)}{leads && `, ${leads[0]} to ${leads[1]} h ahead`}
        </Card>
        <Card label="Typical miss" value={story.kind === 'ok' ? mw(story.typicalMissMw) : '—'} unit="MW">
          {pastDays === 0
            ? 'No delivery day had finished yet'
            : `Average size of the miss over the ${pastDays} delivery ${pastDays === 1 ? 'day' : 'days'} already over`}
        </Card>
        <Card label={`Cover · 1 hour in ${riskNumber(risk)}`} value={cover ? mw(cover.cover_mw) : '—'} unit="MW" hero>
          {cover
            ? `With this cover, short in ${cover.still_short_pct}% of past hours. On average ${mw(cover.unneeded_cover_mw)} MW of it was not needed.`
            : 'Needs at least one finished day.'}
        </Card>
        <Card label="Bias" value={day.that_morning.bias_mw !== null ? signedMw(day.that_morning.bias_mw) : '—'} unit="MW">
          The forecast has run high. We don't know why; one possibility is that the two Elexon datasets don't count exactly the same wind farms.
        </Card>
      </div>

      <HeroChart rows={rows} coverLabel={cover ? `${mw(cover.cover_mw)} MW` : null} />

      <TurnedOut day={day} summary={summary} coverMw={cover?.cover_mw ?? null} />
    </section>
  )
}

function Card({ label, value, unit, hero, children }: { label: string; value: string; unit: string; hero?: boolean; children: ReactNode }) {
  return (
    <div className={hero ? 'card hero' : 'card'}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}{value !== '—' && <small>{unit}</small>}</div>
      <div className="card-note">{children}</div>
    </div>
  )
}

function publishText(publishes: string[]) {
  if (publishes.length === 0) return 'No forecast published before the cutoff'
  const newest = publishes[publishes.length - 1]
  const when = `${ukTime(newest)} forecast on ${ukDay(newest)}`
  return publishes.length === 1 ? `From the ${when}` : `From ${publishes.length} forecasts, newest the ${when}`
}

/** After the fact: how the day really went. */
function TurnedOut({ day, summary, coverMw }: { day: DayDetail; summary: DaySummary | undefined; coverMw: number | null }) {
  const result = day.how_it_turned_out
  const beyond = coverMw === null ? null : hoursBeyondCover(day.hours, coverMw)
  return (
    <div className="turned">
      <span className="control-label">How it turned out</span>
      {result.typical_miss_mw !== null && <span>Typical miss <b>{mw(result.typical_miss_mw)} MW</b></span>}
      <span>Short in <b>{result.short_hours} of {result.hours}</b> hours</span>
      {summary?.worst_short_mw != null && summary.worst_short_mw > 0 && <span>Worst hour <b>{mw(summary.worst_short_mw)} MW</b> short</span>}
      {beyond !== null && (beyond === 0
        ? <span>Cover was enough <b>every hour</b></span>
        : <span>Short beyond the cover in <b>{beyond} of {result.hours}</b> hours</span>)}
    </div>
  )
}
