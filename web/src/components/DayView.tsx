import type { ReactNode } from 'react'
import type { DayDetail, DaySummary } from '../api'
import { dateLabel, gw, mw, riskNumber, ukDay, ukTime, weekday } from '../format'
import { chartRows, countOn, headline, leadRange } from '../story'
import { HeroChart } from './HeroChart'

/**
 * The top half of the screen: one delivery day, using only what you could know that morning.
 * Said in the client's words: the forecast you had, and how much of it you can count on
 * (the forecast minus a safety margin, which the API calls the cover).
 */
export function DayView({ day, summary, risk }: { day: DayDetail; summary: DaySummary | undefined; risk: string }) {
  const story = headline(day.that_morning, risk)
  const cover = story.kind === 'ok' ? story.cover : null
  const avgForecast = summary?.avg_forecast_mw
  const countOnMw = countOn(avgForecast, cover ? cover.cover_mw : null)
  const rows = chartRows(day, cover ? cover.cover_mw : null)
  const leads = leadRange(day.hours)
  const pastDays = day.that_morning.past_days
  const bias = day.that_morning.bias_mw
  const forecastGw = avgForecast != null ? `${gw(avgForecast)} GW` : '…'

  return (
    <section aria-label="The day you chose">
      <p className="eyebrow">
        Decide {dateLabel(day.decision_day)} {day.cutoff} · Delivery {dateLabel(day.delivery_day)}
      </p>

      <h1 className="headline">
        The forecast you had for {weekday(day.delivery_day)}: <span className="num">{forecastGw}</span> of wind.<br />
        {story.kind === 'ok' ? (
          <strong>Count on about <span className="num">{countOnMw !== null ? `${gw(countOnMw)} GW` : '…'}</span>.</strong>
        ) : (
          <strong>No track record yet to say how much to count on.</strong>
        )}
      </h1>
      <p className="explain">
        {story.kind === 'ok' ? (
          <>
            Over the {pastDays} {pastDays === 1 ? 'day' : 'days'} already finished, wind came in no more
            than <b>{gw(story.cover.cover_mw)} GW</b> below the forecast in about {riskNumber(risk) - 1} of
            every {riskNumber(risk)} hours. So keep
            a {gw(story.cover.cover_mw)} GW safety margin, and plan to buy the rest of your demand.
          </>
        ) : (
          <>
            No delivery day had finished by that morning, so there was nothing to measure the forecast's miss against.
            The app doesn't guess. January in review, below, gives a rough guide in hindsight.
          </>
        )}
      </p>
      {story.kind === 'ok' && story.fewDays && (
        <p className="warning">Based on only {story.pastDays} finished {story.pastDays === 1 ? 'day' : 'days'} so far. Treat these numbers as rough.</p>
      )}

      <div className="cards">
        <Card label="Forecast you had" value={avgForecast != null ? mw(avgForecast) : '…'} unit="MW avg">
          {publishText(day.publishes_used)}{leads && `, made ${leads[0]} to ${leads[1]} hours before delivery`}
        </Card>
        <Card label="Wind you can count on" value={countOnMw !== null ? mw(countOnMw) : '—'} unit="MW avg" hero>
          {cover
            ? `Forecast minus a ${mw(cover.cover_mw)} MW safety margin. On average ${mw(cover.unneeded_cover_mw)} MW of the margin wasn't needed.`
            : 'Needs at least one finished day.'}
        </Card>
        <Card label="Average miss" value={story.kind === 'ok' ? mw(story.typicalMissMw) : '—'} unit="MW">
          {pastDays === 0
            ? 'No delivery day had finished yet'
            : `Average gap between forecast and actual over the ${pastDays} delivery ${pastDays === 1 ? 'day' : 'days'} already finished`}
        </Card>
        <Card label={bias !== null && bias < 0 ? 'Forecast ran low by' : 'Forecast ran high by'} value={bias !== null ? mw(Math.abs(bias)) : '—'} unit="MW">
          On average, over the same days. We don't know why; one possibility is that the two Elexon datasets don't count exactly the same wind farms.
        </Card>
      </div>

      <HeroChart rows={rows} marginLabel={cover ? `${mw(cover.cover_mw)} MW` : null} />

      <TurnedOut day={day} summary={summary} risk={risk} />
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
  if (publishes.length === 0) return 'No forecast published before the auction closed'
  const newest = publishes[publishes.length - 1]
  const when = `${ukTime(newest)} forecast on ${ukDay(newest)}`
  return publishes.length === 1 ? `The ${when}` : `From ${publishes.length} forecasts, newest the ${when}`
}

/** After the fact: how the day really went. */
function TurnedOut({ day, summary, risk }: { day: DayDetail; summary: DaySummary | undefined; risk: string }) {
  const result = day.how_it_turned_out
  const beyond = summary?.hours_beyond_cover[risk]
  return (
    <div className="turned">
      <span className="control-label">How it turned out</span>
      {result.typical_miss_mw !== null && <span>Average miss <b>{mw(result.typical_miss_mw)} MW</b></span>}
      <span>Below forecast in <b>{result.short_hours} of {result.hours}</b> hours</span>
      {summary?.worst_short_mw != null && summary.worst_short_mw > 0 && <span>Worst hour <b>{mw(summary.worst_short_mw)} MW</b> below</span>}
      {beyond !== undefined && (beyond === 0
        ? <span>Wind stayed above what you counted on <b>every hour</b></span>
        : <span>Wind fell below what you counted on in <b>{beyond} of {result.hours}</b> hours</span>)}
    </div>
  )
}
