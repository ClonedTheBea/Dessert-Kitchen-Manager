import { X } from "lucide-react";
import { flushEdits } from "../autoSave";
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useEffect,
  useRef,
  type ReactNode,
  type ReactElement,
} from "react";

export type Page =
  "Overview" | "Ingredients" | "Recipes" | "Financial planner" | "Settings";
export type Notify = (message: string) => void;
const units = ["g", "kg", "ml", "l", "each"];
export const clone = <T,>(value: T): T => structuredClone(value);
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        <span>{label}</span>
      </label>
      {Children.map(children, (child) =>
        isValidElement(child) && child.type !== "datalist"
          ? cloneElement(
              child as ReactElement<{
                id?: string;
                "aria-describedby"?: string;
              }>,
              { id, "aria-describedby": hint ? id + "-hint" : undefined },
            )
          : child,
      )}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
export function Num({
  value,
  onChange,
  min = 0,
  max,
  step = "any",
  ...props
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: string;
  "aria-label"?: string;
  id?: string;
  "aria-describedby"?: string;
}) {
  return (
    <input
      type="number"
      required
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) =>
        onChange(e.target.value === "" ? 0 : Number(e.target.value))
      }
      {...props}
    />
  );
}
export function Unit({
  value,
  onChange,
  disabled = false,
  ...props
}: {
  value: string;
  onChange: (s: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
}) {
  return (
    <select
      {...props}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {units.map((u) => (
        <option key={u}>{u}</option>
      ))}
    </select>
  );
}
export function Tag({ sample = true }: { sample?: boolean }) {
  return (
    <span className={"tag " + (sample ? "sample" : "real")}>
      {sample ? "Illustrative" : "Entered costs"}
    </span>
  );
}
export function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div className="error" role="alert">
      {error}
    </div>
  ) : null;
}
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={wide ? "modal wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        void flushEdits().then((ok) => {
          if (ok) close();
        });
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={() =>
            void flushEdits().then((ok) => {
              if (ok) close();
            })
          }
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Stat({
  title,
  value,
  note,
  icon,
}: {
  title: string;
  value: string;
  note: string;
  icon: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-label">
        {title}
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
