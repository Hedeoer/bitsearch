import { KeyRound } from "lucide-react";

type LoginViewProps = {
  authKey: string;
  message: string;
  onAuthKeyChange: (value: string) => void;
  onLogin: () => void;
};

export function LoginView(props: LoginViewProps) {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="eyebrow">BitSearch Control</div>
        <h1>Operations Console</h1>
        <p className="supporting">
          输入后台授权密钥后管理 Grok、Tavily、Firecrawl 与对外 Streamable HTTP MCP 服务。
        </p>
        <label className="field" style={{ marginTop: "1.25rem" }}>
          <span>Authorization Key</span>
          <input
            type="password"
            value={props.authKey}
            onChange={(event) => props.onAuthKeyChange(event.target.value)}
            placeholder="Paste admin authorization key"
            onKeyDown={(e) => e.key === "Enter" && props.onLogin()}
          />
        </label>
        <div className="action-row" style={{ marginTop: "1rem" }}>
          <button className="primary-button" style={{ width: "100%", justifyContent: "center" }} onClick={props.onLogin}>
            <KeyRound size={15} />
            Enter Console
          </button>
        </div>
        <div className="login-foot">
          <span className="chip neutral-chip">Remote MCP</span>
          <span className="chip neutral-chip">Provider Pools</span>
          <span className="chip neutral-chip">Observability</span>
        </div>
        {props.message ? <p className="warning-banner">{props.message}</p> : null}
      </section>
    </main>
  );
}
