import type { FormEvent } from "react";
import { Activity, KeyRound, Server } from "lucide-react";
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
      <div className="login-grid">
        <section className="login-story surface-card">
          <div className="eyebrow">BitSearch Control</div>
          <h1>Operations Console</h1>
          <p className="supporting">
            Operate Grok, Tavily, Firecrawl, and the public Streamable HTTP MCP
            surface from one dense control room for routing, key pools, and request
            visibility.
          </p>
          <div className="login-trust-row">
            <div className="intro-metric intro-metric--live">
              <span>Surface</span>
              <strong>Remote MCP</strong>
            </div>
            <div className="intro-metric">
              <span>Control</span>
              <strong>Provider Pools</strong>
            </div>
            <div className="intro-metric">
              <span>Signals</span>
              <strong>Observability</strong>
            </div>
          </div>
          <div className="workspace-feed">
            <div className="workspace-feed-item">
              <div className="workspace-feed-top">
                <strong>Search Providers</strong>
                <Server size={15} />
              </div>
              <p className="supporting compact">
                Inspect provider enablement, base URLs, timeouts, and secret posture
                without leaving the login context.
              </p>
            </div>
            <div className="workspace-feed-item">
              <div className="workspace-feed-top">
                <strong>Key Operations</strong>
                <KeyRound size={15} />
              </div>
              <p className="supporting compact">
                Import, test, sync quota, and annotate every provider key from a single
                workspace.
              </p>
            </div>
            <div className="workspace-feed-item">
              <div className="workspace-feed-top">
                <strong>Request Trace</strong>
                <Activity size={15} />
              </div>
              <p className="supporting compact">
                Search request logs and inspect inputs, outputs, attempts, and provider
                decisions in detail.
              </p>
            </div>
          </div>
        </section>

        <section className="login-panel surface-card">
          <div className="eyebrow">Access Gate</div>
          <h2>Authenticate Operator Session</h2>
          <p className="supporting">
            Enter the admin authorization key to unlock the console. All behavior
            continues to use the current backend authentication and API contract.
          </p>
          <form className="login-form" onSubmit={handleSubmit}>
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
            <p className="login-field-note mono">
              Bearer-backed access for console administration and provider control.
            </p>
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
          <div className="login-foot">
            <span className="chip primary-chip">Persistent workspace rail</span>
            <span className="chip neutral-chip">Live request feed</span>
            <span className="chip neutral-chip">Dense operator surfaces</span>
          </div>
          {props.message ? <p className="warning-banner">{props.message}</p> : null}
        </section>
      </div>
    </main>
  );
}
