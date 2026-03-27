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
        <h1>Operations Control Center</h1>
        <p className="supporting">
          输入后台授权密钥后管理 Grok、Tavily、Firecrawl 与对外 `Streamable HTTP` MCP 服务。
        </p>
        <label className="field">
          <span>Authorization Key</span>
          <input
            type="password"
            value={props.authKey}
            onChange={(event) => props.onAuthKeyChange(event.target.value)}
            placeholder="Paste admin authorization key"
          />
        </label>
        <div className="action-row">
          <button className="primary-button" onClick={props.onLogin}>
            Enter Console
          </button>
        </div>
        <div className="login-foot">
          <span className="chip neutral">Remote MCP</span>
          <span className="chip neutral">Provider Pools</span>
          <span className="chip neutral">Observability</span>
        </div>
        {props.message ? <p className="warning-banner">{props.message}</p> : null}
      </section>
    </main>
  );
}
