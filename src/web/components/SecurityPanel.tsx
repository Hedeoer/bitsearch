import type { AdminProfile } from "@shared/contracts";

type SecurityPanelProps = {
  profile: AdminProfile | null;
  currentPassword: string;
  nextPassword: string;
  confirmPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  onNextPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: () => void;
};

export function SecurityPanel(props: SecurityPanelProps) {
  return (
    <article className="surface-card" id="security">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Security</div>
          <h3>Admin Account</h3>
        </div>
        <span className="chip neutral-chip mono">
          {props.profile?.username ?? "admin"}
        </span>
      </div>
      <div className="security-meta">
        <div>
          <span>Created</span>
          <strong>{props.profile?.createdAt ?? "-"}</strong>
        </div>
        <div>
          <span>Password Updated</span>
          <strong>{props.profile?.passwordUpdatedAt ?? "-"}</strong>
        </div>
      </div>
      <div className="split-fields">
        <label className="field">
          <span>Current Password</span>
          <input
            type="password"
            value={props.currentPassword}
            onChange={(event) => props.onCurrentPasswordChange(event.target.value)}
          />
        </label>
        <label className="field">
          <span>New Password</span>
          <input
            type="password"
            value={props.nextPassword}
            onChange={(event) => props.onNextPasswordChange(event.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span>Confirm New Password</span>
        <input
          type="password"
          value={props.confirmPassword}
          onChange={(event) => props.onConfirmPasswordChange(event.target.value)}
        />
      </label>
      <button className="primary-button" onClick={props.onSubmit}>
        Update Password
      </button>
    </article>
  );
}
