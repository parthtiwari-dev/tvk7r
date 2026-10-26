import type { Accuracy } from '../api'
import { mw, riskNumber, signedMw } from '../format'
import { LeadChart } from './LeadChart'

/** The bottom half: the whole month, as a report card. Uses days after each decision, so it is labelled as such. */
export function JanuaryReview({ accuracy, risk, decisionLeads, onPickDay }: {
  accuracy: Accuracy
  risk: string
  decisionLeads: [number, number] | null
  onPickDay: (day: string) => void
}) {
  const extra = accuracy.extra_side
  return (
    <section className="review" aria-label="January in review">
      <h2>January in review</h2>
      <p className="sub">
        All 31 delivery days, {accuracy.hours} hours, the forecast you had at {accuracy.cutoff}. A report card after the month:
        on any one morning you could not have known these numbers.
      </p>

      <div className="review-grid">
        <LeadChart bands={accuracy.by_lead_time} decisionLeads={decisionLeads} cutoff={accuracy.cutoff} />

        <div className="review-side">
          <div className="cards two">
            <div className="card">
              <div className="card-label">Typical miss</div>
              <div className="card-value">{mw(accuracy.typical_miss_mw!)}<small>MW</small></div>
            </div>
            <div className="card">
              <div className="card-label">Bias</div>
              <div className="card-value">{signedMw(accuracy.bias_mw!)}<small>MW</small></div>
              <div className="card-note">Short in {accuracy.short_hours} of {accuracy.hours} hours</div>
            </div>
          </div>

          <div className="card-label">Cover for the month, at each risk level</div>
          <table className="cover-table">
            <thead>
              <tr><th>Risk</th><th>Cover</th><th>Hours still short</th><th>Not needed, avg</th></tr>
            </thead>
            <tbody>
              {accuracy.cover.map((c) => (
                <tr key={c.risk} className={c.risk === risk ? 'on' : ''}>
                  <td>1 hour in {riskNumber(c.risk)}</td>
                  <td>{mw(c.cover_mw)} MW</td>
                  <td>{c.still_short_pct}%</td>
                  <td>{mw(c.unneeded_cover_mw)} MW</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="note">
            Wind beat the forecast in {extra.hours} hours ({extra.pct_of_hours}%)
            {extra.typical_extra_mw !== null && <>, typically by {mw(extra.typical_extra_mw)} MW</>}.
            Cover is sized from the short side only: being short is paid at the imbalance price.
          </p>

          <div className="worst">
            <div className="card-label">Worst delivery days</div>
            <ol>
              {accuracy.worst_days.map((d) => (
                <li key={d.delivery_day}>
                  <button onClick={() => onPickDay(d.delivery_day)}>{d.label}</button>
                  <span>{mw(d.typical_miss_mw)} MW typical miss</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}
