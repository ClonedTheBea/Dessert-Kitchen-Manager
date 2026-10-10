import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
export default function MethodEditor({
  steps,
  onChange,
}: {
  steps: string[];
  onChange: (steps: string[]) => void;
}) {
  const move = (i: number, delta: number) => {
    const next = [...steps];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    onChange(next);
  };
  return (
    <section className="method-editor">
      <div className="section-heading compact">
        <h3>Preparation method</h3>
        <button
          type="button"
          className="text-button"
          onClick={() => onChange([...steps, ""])}
        >
          <Plus size={16} />
          Add step
        </button>
      </div>
      {steps.length === 0 && (
        <p className="help">
          Add numbered instructions. Existing combined text has been kept in
          Description so you can separate it manually.
        </p>
      )}
      <ol>
        {steps.map((step, i) => (
          <li key={i}>
            <label>
              <span className="sr-only">Preparation step {i + 1}</span>
              <textarea
                  aria-label={`Preparation step ${i + 1}`}
                rows={3}
                maxLength={20000}
                value={step}
                onChange={(e) =>
                  onChange(steps.map((s, j) => (i === j ? e.target.value : s)))
                }
              />
            </label>
            <div className="actions">
              <button
                type="button"
                className="icon-button"
                aria-label={`Move step ${i + 1} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={17} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Move step ${i + 1} down`}
                disabled={i === steps.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={17} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove step ${i + 1}`}
                onClick={() => {
                  if (!step || confirm(`Remove preparation step ${i + 1}?`))
                    onChange(steps.filter((_, j) => i !== j));
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {steps.length > 0 && (
        <details>
          <summary>Read preparation method</summary>
          <ol className="method-read">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
