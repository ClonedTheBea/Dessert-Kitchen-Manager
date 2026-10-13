import { useId, useState } from "react";
export const terms: Record<string, { text: string; example: string }> = {
  Contribution: {
    text: "Net sales less variable production and channel costs, before fixed overheads and separate owner compensation.",
    example: "£5 net sales less £2 variable costs leaves £3 contribution.",
  },
  "Contribution margin": {
    text: "Contribution divided by net sales, expressed as a percentage.",
    example: "£3 contribution on £5 net sales is 60%.",
  },
  "Allocated overheads": {
    text: "A share of forecast fixed business costs assigned using the selected allocation method and monthly sales mix. This is an estimate, not a realised product cost.",
    example:
      "£600 monthly overheads across 300 forecast units allocates £2 per unit using units allocation.",
  },
  "Estimated operating profit": {
    text: "Forecast contribution less fixed operating costs. It is before separate owner compensation and tax, and is not recorded trading profit.",
    example:
      "£900 monthly contribution less £600 fixed costs gives £300 estimated monthly operating profit.",
  },
  "Profit margin": {
    text: "Estimated operating profit divided by net sales. Allocated product margins depend on the sales forecast.",
    example:
      "£1 allocated operating profit on £5 net sales is a 20% estimated profit margin.",
  },
  "Actual batch cost": {
    text: "Costs recorded by inventory production from actual allocated lots, labour and other entered batch costs. Unknown inputs stay unknown. A production cost is not sales profit.",
    example:
      "A recorded £20 batch yielding 10 pots costs £2 per pot; selling costs and revenue are separate.",
  },
  "Estimated recipe cost": {
    text: "A forecast using published recipe quantities and supplier prices effective on the costing date. It is independent of the cost of a particular stock lot.",
    example:
      "A new supplier price may change the estimate without rewriting last week's production cost.",
  },
  "Owner compensation": {
    text: "A separate allowance for the owner's time. The model shows the result after this allowance separately from operating profit.",
    example:
      "£300 operating profit less £200 owner compensation leaves £100 before tax.",
  },
  "Input VAT": {
    text: "VAT on purchases. Only the configured recoverable proportion is excluded from estimated costs; recovery assumptions must reflect your circumstances.",
    example:
      "A £12 VAT-inclusive purchase at 20% contains £2 VAT. With 50% recovery its modelled cost is £11.",
  },
  "Output VAT": {
    text: "VAT included in customer prices under the configured product treatment when VAT registered. It is separated from net sales.",
    example:
      "A £6 VAT-inclusive sale at 20% gives £5 net sales and £1 output VAT.",
  },
  "Break-even": {
    text: "Forecast monthly sales units needed to cover operating costs at the selected product/channel mix. Separate owner compensation and tax are excluded. Non-positive contribution cannot fund fixed costs.",
    example:
      "£600 fixed costs with £3 contribution per unit requires 200 units per month, assuming no staffing-budget transition.",
  },
  Energy: {
    text: "Equipment kW × hours × load percentage × tariff, plus configured batch water usage. Standing charges are fixed overheads.",
    example:
      "A 2 kW oven running for 30 minutes at 50% load uses 0.5 kWh; at 30p/kWh that is 15p.",
  },
  "Fixed-cost allocation": {
    text: "Choose forecast units, net sales revenue or direct labour minutes. Product weights are multiplied by monthly volume; overheads are divided across those weights. A zero basis leaves overheads unallocated.",
    example:
      "A product earning 25% of forecast net sales receives 25% of overheads under revenue allocation.",
  },
  "Actual recorded operating profit": {
    text: "Revenue less actual recognised operating expenses for a reporting period. This app does not yet record the sales and expense ledger needed to calculate it.",
    example:
      "Producing stock alone creates neither sales revenue nor realised profit.",
  },
  "Profit after tax": {
    text: "Profit after the applicable tax calculation. Tax modelling is not supported here, so this result is unavailable.",
    example:
      "Do not subtract an assumed tax percentage from a product estimate and label it actual after-tax profit.",
  },
};
export function Term({ name }: { name: string }) {
  const id = useId();
  const t = terms[name];
  const [open, setOpen] = useState(false);
  return (
    <span className="financial-term" tabIndex={0} aria-describedby={id} data-open={open} onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onKeyDown={e=>{if(e.key==="Escape")setOpen(false)}}>
      <span>{name}</span>
      <span id={id} role="tooltip">
        {t.text} {t.example}
      </span>
    </span>
  );
}
export default function FinancialGlossary() {
  const [q, setQ] = useState("");
  return (
    <section className="panel">
      <h1>Financial glossary</h1>
      <label>
        Search financial terms
        <input value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <dl className="glossary">
        {Object.entries(terms)
          .filter(([k, v]) =>
            (k + v.text + v.example).toLowerCase().includes(q.toLowerCase()),
          )
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>
                {v.text}
                <p className="help">{v.example}</p>
              </dd>
            </div>
          ))}
      </dl>
      <p className="help">
        VAT treatments and recovery are assumptions, not automatic product
        classifications. Reference:{" "}
        <a
          href="https://www.gov.uk/charge-reclaim-record-vat"
          target="_blank"
          rel="noreferrer"
        >
          HMRC — charge and reclaim VAT
        </a>
        .
      </p>
    </section>
  );
}
