import type { FormEvent } from "react";
import { KeyRound, Search } from "lucide-react";
import { InlineSpinner } from "./components/Feedback";

type LoginViewProps = {
  authKey: string;
  message: string;
  onAuthKeyChange: (value: string) => void;
  onLogin: () => void;
  pending: boolean;
};

export function LoginView(props: LoginViewProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onLogin();
  }

  return (
    <main className="login-shell">
      <section className="login-card surface-card">
        <div className="login-brand">
          <div className="console-brand-mark">
            <Search size={16} />
          </div>
          <div className="login-brand-copy">
            <span className="eyebrow">BitSearch</span>
            <strong>Operations Console</strong>
          </div>
        </div>
        <p className="supporting">
          Enter the admin authorization key to access the operator console.
        </p>
        <form className="login-form" onSubmit={handleSubmit} style={{ display: "grid", gap: "0.85rem", marginTop: "1rem" }}>
          <label className="field" htmlFor="auth-key-input">
            <span>Authorization Key</span>
            <input
              id="auth-key-input"
              name="authKey"
              type="password"
              value={props.authKey}
              onChange={(event) => props.onAuthKeyChange(event.target.value)}
              placeholder="Paste admin authorization key"
            />
          </label>
          <div className="action-row">
            <button
              type="submit"
              className="primary-button login-submit"
              disabled={props.pending}
            >
              {props.pending ? (
                <InlineSpinner label="Verifying" />
              ) : (
                <>
                  <KeyRound size={15} />
                  Enter Console
                </>
              )}
            </button>
          </div>
        </form>
        {props.message ? <p className="warning-banner">{props.message}</p> : null}
      </section>
    </main>
  );
}
