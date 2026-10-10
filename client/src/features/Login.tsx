import { ArrowRight, ChefHat, Cookie, ShieldCheck, Wheat } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../api";

import { ErrorBox, Field } from "../components/ui";
export default function Login({
  configured,
  done,
}: {
  configured: boolean;
  done: () => void;
}) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!configured && repeat !== password) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(configured ? "/auth/login" : "/auth/setup", { password });
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login">
      <div className="login-story">
        <span className="brand-icon">
          <ChefHat size={32} />
        </span>
        <span className="eyebrow">DESSERT KITCHEN MANAGER</span>
        <h1>
          Good things
          <br />
          start in
          <br />
          <em>your kitchen.</em>
        </h1>
        <p>
          A little creativity. A little clarity.
          <br />A home for the business you’re building.
        </p>
        <div className="login-decoration">
          <Cookie size={100} strokeWidth={1} />
          <Wheat size={130} strokeWidth={1} />
        </div>
      </div>
      <div className="login-form">
        <span className="eyebrow">YOUR PRIVATE WORKSPACE</span>
        <h2>{configured ? "Welcome back." : "Let’s open your kitchen."}</h2>
        <p>
          {configured
            ? "Unlock your recipes, costs and plans."
            : "Create an owner password to keep your business private. Setup is available only on this computer."}
        </p>
        <form onSubmit={submit}>
          <Field
            label={configured ? "Password" : "Choose a password"}
            hint={
              !configured
                ? "At least 12 characters. Keep it somewhere safe."
                : undefined
            }
          >
            <input
              autoFocus
              type="password"
              minLength={configured ? 1 : 12}
              maxLength={200}
              autoComplete={configured ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {!configured && (
            <Field label="Confirm password">
              <input
                type="password"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                required
              />
            </Field>
          )}
          <ErrorBox error={error} />
          <button className="primary full" disabled={busy}>
            {busy
              ? "Opening…"
              : configured
                ? "Unlock kitchen"
                : "Create my workspace"}
            <ArrowRight size={18} />
          </button>
        </form>
        <small>
          <ShieldCheck size={15} /> Stored in your local SQLite database.
        </small>
      </div>
    </div>
  );
}
