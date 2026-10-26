import { useEffect, useState } from 'react'
import { fetchAccuracy, fetchDay, fetchDays } from './api'
import { DayStrip, Segmented } from './components/Controls'
import { DayView } from './components/DayView'
import { JanuaryReview } from './components/JanuaryReview'
import { leadRange } from './story'

const CUTOFFS = [
  { value: '09:20', text: '09:20 EPEX' },
  { value: '09:50', text: '09:50 N2EX' },
]
const RISKS = [
  { value: '1 in 5', text: '1 in 5' },
  { value: '1 in 10', text: '1 in 10' },
  { value: '1 in 20', text: '1 in 20' },
]

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
        <div className="brand">Wind cover <small>UK national wind · day-ahead · January 2026</small></div>
        <div className="controls">
          <Segmented label="Cutoff" options={CUTOFFS} value={cutoff} onChange={setCutoff} />
          <Segmented label="Risk" options={RISKS} value={risk} onChange={setRisk} />
        </div>
      </header>
      {days.data && <DayStrip days={days.data.days} value={deliveryDay} onChange={setDeliveryDay} />}

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
