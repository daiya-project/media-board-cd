"use client";

import { memo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "@/components/common/ChartTooltip";
import {
  MA_METRIC_COLORS,
  MA_METRIC_LABELS,
  MA_METRIC_FORMATTERS,
  type MaMetricType,
} from "@/lib/logic/maChartLogic";
import type { DataMiniCardData } from "@/lib/logic/dataChartLogic";

interface DataMiniCardsProps {
  cards: DataMiniCardData[];
  metric: MaMetricType;
  selectedEntityId: string | null;
  onEntitySelect: (id: string | null) => void;
}

/**
 * 4-column grid of clickable sparkline cards.
 * Each card shows entity name, mini chart (actual line only), and latest value.
 * No MA dashed line, no GAP display.
 */
export default function DataMiniCards({
  cards,
  metric,
  selectedEntityId,
  onEntitySelect,
}: DataMiniCardsProps) {
  const fmtVal = MA_METRIC_FORMATTERS[metric];
  const metricColor = MA_METRIC_COLORS[metric];

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((card) => (
        <MiniCard
          key={card.entityId}
          card={card}
          metric={metric}
          metricColor={metricColor}
          fmtVal={fmtVal}
          isSelected={card.entityId === selectedEntityId}
          onSelect={() =>
            onEntitySelect(
              card.entityId === selectedEntityId ? null : card.entityId,
            )
          }
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single mini card
// ---------------------------------------------------------------------------

interface MiniCardProps {
  card: DataMiniCardData;
  metric: MaMetricType;
  metricColor: string;
  fmtVal: (v: number) => string;
  isSelected: boolean;
  onSelect: () => void;
}

/** Tooltip for mini sparkline — actual value only. */
function MiniTooltipContent({
  active,
  payload,
  metricColor,
  metricLabel,
  fmtVal,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string;
    value: unknown;
    payload?: { label?: string };
  }>;
  metricColor: string;
  metricLabel: string;
  fmtVal: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const actual = payload.find((p) => p.dataKey === "actual");
  const items = [];
  if (actual?.value != null) {
    items.push({
      color: metricColor,
      label: metricLabel,
      value: fmtVal(actual.value as number),
    });
  }
  return <ChartTooltip title={actual?.payload?.label} items={items} />;
}

const MiniCard = memo(function MiniCard({
  card,
  metric,
  metricColor,
  fmtVal,
  isSelected,
  onSelect,
}: MiniCardProps) {
  const metricLabel = MA_METRIC_LABELS[metric];

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex flex-col rounded-lg border p-3 text-left transition-all hover:shadow-sm",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300",
      )}
    >
      {/* Entity name */}
      <div
        className="mb-1.5 truncate text-xs font-semibold text-gray-700"
        title={card.entityName}
      >
        {card.serviceId}. {card.entityName}
      </div>

      {/* Mini sparkline chart — actual line only */}
      <div className="h-16 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={card.chartPoints}>
            <Tooltip
              content={
                <MiniTooltipContent
                  metricColor={metricColor}
                  metricLabel={metricLabel}
                  fmtVal={fmtVal}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke={metricColor}
              strokeWidth={0.75}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Latest value — actual only (no MA/GAP) */}
      <div className="mt-1.5">
        <div className="text-sm font-bold text-gray-800">
          {card.latestActual != null ? fmtVal(card.latestActual) : "-"}
        </div>
      </div>
    </button>
  );
});
