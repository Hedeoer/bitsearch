"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"]
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        data-slot="chart"
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/60 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radix-bar]:transparent [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, item]) => item.theme || item.color,
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, item]) => {
    const color =
      item.theme?.[theme as keyof typeof item.theme] || item.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}
`,
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

type ChartTooltipPayloadItem = {
  name?: string
  value?: number | string | Array<number | string>
  color?: string
  fill?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
}

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideIndicator = false,
  hideLabel = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
}: React.ComponentProps<"div"> & {
  active?: boolean
  payload?: ChartTooltipPayloadItem[]
  label?: React.ReactNode
  hideLabel?: boolean
  hideIndicator?: boolean
  indicator?: "line" | "dot" | "dashed"
  labelFormatter?: (label: React.ReactNode) => React.ReactNode
  labelClassName?: string
  formatter?: (value: number | string | Array<number | string>, name: string, item: ChartTooltipPayloadItem, index: number) => React.ReactNode
  color?: string
}) {
  const { config } = useChart()

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null
    }

    return (
      <div
        className={cn(
          "font-mono text-[11px] text-muted-foreground",
          labelClassName,
        )}
      >
        {labelFormatter ? labelFormatter(label) : label}
      </div>
    )
  }, [label, labelFormatter, hideLabel, payload, labelClassName])

  if (!active || !payload?.length) {
    return null
  }

  const nestLabel = payload.length === 1 && indicator !== "dot"

  return (
    <div
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/70 bg-popover px-3 py-2.5 text-xs shadow-xl",
        className,
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = `${item.dataKey || item.name || "value"}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)
          const indicatorColor = color || item.color

          return (
            <div
              key={item.dataKey ?? index}
              className={cn(
                "flex w-full items-center justify-between gap-3 leading-none",
              )}
            >
              <div className="flex items-center gap-1.5">
                {hideIndicator ? null : (
                  <span
                    className={cn(
                      "shrink-0 rounded-[2px]",
                      indicator === "dot" && "size-2.5",
                      indicator === "line" && "w-1",
                      indicator === "dashed" && "w-0 border-t-2 border-dashed bg-transparent",
                    )}
                    style={{
                      background: indicator === "dashed" ? "transparent" : indicatorColor,
                      borderColor: indicatorColor,
                    }}
                  />
                )}
                <span className="text-muted-foreground">{itemConfig?.label ?? item.name}</span>
              </div>
              {typeof item.value === "number" || typeof item.value === "string" ? (
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {formatter ? formatter(item.value, item.name ?? "", item, index) : item.value}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: React.ComponentProps<"div"> & {
  payload?: ChartTooltipPayloadItem[]
  verticalAlign?: "top" | "bottom"
  hideIcon?: boolean
  nameKey?: string
}) {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className,
      )}
    >
      {payload.map((item, index) => {
        const key = `${nameKey || item.dataKey || "value"}`
        const itemConfig = getPayloadConfigFromPayload(config, item, key)

        return (
          <div
            key={item.dataKey ?? index}
            className={cn(
              "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground",
            )}
          >
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: item.color ?? item.fill }}
              />
            )}
            {itemConfig?.label}
          </div>
        )
      })}
    </div>
  )
}

function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: ChartTooltipPayloadItem | undefined,
  key: string,
) {
  if (typeof payload !== "object" && payload !== null) {
    return undefined
  }

  const item = config[key as keyof typeof config] ?? config[payload?.dataKey as string]

  if (!item) {
    return undefined
  }

  return {
    ...item,
    ...(item.label !== undefined ? { label: item.label } : {}),
  }
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  useChart,
}
