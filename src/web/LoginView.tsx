type LoginViewProps = {
  username: string;
  password: string;
  message: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: () => void;
};

export function LoginView(props: LoginViewProps) {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="eyebrow">BitSearch Control</div>
        <h1>Operations Control Center</h1>
        <p className="supporting">
          登录后管理 Grok、Tavily、Firecrawl 与对外 `Streamable HTTP` MCP 服务。
        </p>
        <label className="field">
          <span>Username</span>
          <input
            value={props.username}
            onChange={(event) => props.onUsernameChange(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={props.password}
            onChange={(event) => props.onPasswordChange(event.target.value)}
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
