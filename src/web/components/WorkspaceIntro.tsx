import type { ReactNode } from "react";

type WorkspaceMetric = Readonly<{
  label: string;
  tone?: "danger" | "live" | "warning";
  value: string;
}>;

export interface WorkspaceIntroProps {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  metrics?: WorkspaceMetric[];
  title: string;
}

export function WorkspaceIntro(props: Readonly<WorkspaceIntroProps>) {
  return (
    <section className="workspace-hero surface-card">
      <div className="workspace-hero-main">
        <div>
          <div className="eyebrow">{props.eyebrow}</div>
          <h2>{props.title}</h2>
          <p className="supporting">{props.description}</p>
        </div>
        {props.actions ? (
          <div className="workspace-hero-actions">{props.actions}</div>
        ) : null}
      </div>
      {props.metrics?.length ? (
        <div className="workspace-hero-metrics">
          {props.metrics.map((metric) => (
            <div
              key={`${metric.label}-${metric.value}`}
              className={`intro-metric${metric.tone ? ` intro-metric--${metric.tone}` : ""}`}
            >
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
