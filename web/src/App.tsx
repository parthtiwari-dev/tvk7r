import { useEffect, useState } from 'react'
import { fetchAccuracy, fetchDay, fetchDays } from './api'
import { DayStrip, Segmented } from './components/Controls'
import { DayView } from './components/DayView'
import { JanuaryReview } from './components/JanuaryReview'
import { sureLabel } from './format'
import { leadRange } from './story'

// The two day-ahead auctions and when they close, UK time.
const CUTOFFS = [
  { value: '09:20', text: '09:20 · EPEX' },
  { value: '09:50', text: '09:50 · N2EX' },
]
// How sure you want to be that wind comes in above what you count on. The values are the API's
// risk levels ("1 in 10" = wind may fall below in 1 hour in 10); the screen says it the positive way.
const RISKS = ['1 in 5', '1 in 10', '1 in 20'].map((value) => ({ value, text: sureLabel(value) }))

/** Loads data for the current inputs. Ignores answers that arrive after the inputs changed. */
function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string }>({})
  useEffect(() => {
    let current = true
    load().then(
      (data) => current && setState({ data }),
      (e: Error) => current && setState({ error: e.message }),
    )
    return () => { current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

export default function App() {
  const [cutoff, setCutoff] = useState('09:20')
  const [risk, setRisk] = useState('1 in 10')
  const [deliveryDay, setDeliveryDay] = useState('2026-01-15')

  const days = useLoad(() => fetchDays(cutoff), [cutoff])
  const day = useLoad(() => fetchDay(deliveryDay, cutoff), [deliveryDay, cutoff])
  const accuracy = useLoad(() => fetchAccuracy(cutoff), [cutoff])

  const pickDay = (d: string) => {
    setDeliveryDay(d)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const error = days.error ?? day.error ?? accuracy.error
  const showingDay = day.data?.delivery_day === deliveryDay && day.data.cutoff === cutoff ? day.data : undefined

  return (
    <div className="app">
      <header className="top">
        <div className="brand">Day-ahead wind <small>UK national wind · January 2026</small></div>
        <div className="controls">
          <Segmented label="Auction closes" options={CUTOFFS} value={cutoff} onChange={setCutoff} />
          <Segmented label="How sure" options={RISKS} value={risk} onChange={setRisk} />
        </div>
      </header>
      <p className="intro">
        For each January morning: the wind forecast you had when the auction closed, how far off forecasts like it
        have been, and how much of it you could count on.
      </p>
      {days.data && <DayStrip days={days.data.days} value={deliveryDay} risk={risk} onChange={setDeliveryDay} />}
      {days.data && <p className="strip-key"><i className="key-bar" /> each day's average miss <i className="key-bar fell" /> wind fell below what you counted on</p>}

      <main>
        {error && <p className="error">Could not load the data: {error}</p>}
        {!error && !showingDay && <p className="loading">Loading…</p>}
        {showingDay && (
          <DayView day={showingDay} summary={days.data?.days.find((d) => d.delivery_day === deliveryDay)} risk={risk} />
        )}
        {accuracy.data && (
          <JanuaryReview accuracy={accuracy.data} risk={risk} decisionLeads={showingDay ? leadRange(showingDay.hours) : null} onPickDay={pickDay} />
        )}
      </main>

      <footer className="foot">
        Data: Elexon BMRS, FUELHH (wind actuals) and WINDFOR (wind forecasts). Times in UK time. Error = forecast minus actual.
      </footer>
    </div>
  )
}
