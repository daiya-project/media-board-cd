"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatContractValue,
  formatContractPeriod,
} from "@/lib/utils/contract-utils";
import type { ServiceWithWidgets, WidgetWithContract } from "@/types/app-db.types";
import { EmptyState } from "@/components/common/EmptyState";
import { ShareTypeBadge, ContractHistoryPanel } from "./ContractPanel";

// ---------------------------------------------------------------------------
// ServiceCard
// ---------------------------------------------------------------------------

interface ServiceCardProps {
  service: ServiceWithWidgets;
  clientId: string;
  showActiveOnly: boolean;
  onRefresh: () => void;
}

/**
 * Displays a service header with its widget rows.
 * Filters widgets based on showActiveOnly flag.
 */
export function ServiceCard({ service, clientId, showActiveOnly, onRefresh }: ServiceCardProps) {
  const widgets = showActiveOnly
    ? service.widgets.filter((w) => w.is_active)
    : service.widgets;

  const totalCount = service.widgets.length;
  const activeCount = service.widgets.filter((w) => w.is_active).length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      {/* Service Header - Compact with Bullet Points */}
      <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-900">
            {service.service_id}. {service.service_name}
          </h3>
          <div className="flex items-center gap-3 text-xs font-medium">
            {/* Total Widgets - Blue Bullet */}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-gray-700">{totalCount}</span>
            </div>
            {/* Active Widgets - Green Bullet */}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-gray-700">{activeCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Widget Rows */}
      {widgets.length > 0 ? (
        <div>
          {widgets.map((widget, index) => (
            <WidgetRow
              key={widget.widget_id}
              widget={widget}
              clientId={clientId}
              serviceId={service.service_id}
              index={index}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : (
        <EmptyState className="px-4 py-6" message="표시할 위젯이 없습니다" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WidgetRow (with expand/collapse for contract history)
// ---------------------------------------------------------------------------

interface WidgetRowProps {
  widget: WidgetWithContract;
  clientId: string;
  serviceId: string;
  index: number;
  onRefresh: () => void;
}

function WidgetRow({ widget, clientId, serviceId, onRefresh }: WidgetRowProps) {
  const [expanded, setExpanded] = useState(false);

  const normalizedType = widget.contract_type
    ? widget.contract_type.toUpperCase()
    : null;

  const shareTypeBadge = normalizedType ? (
    <ShareTypeBadge type={normalizedType} />
  ) : (
    <span className="text-gray-400">-</span>
  );

  const grtValue = widget.contract_value
    ? formatContractValue(normalizedType, widget.contract_value)
    : "-";
  const grtValueClass = widget.contract_value ? "text-gray-900 font-medium" : "text-gray-400";

  const dateRange = formatContractPeriod(widget.start_date, widget.end_date);
  const dateRangeClass =
    widget.start_date || widget.end_date ? "text-gray-700" : "text-gray-400";

  // Status Bullet - Green for active, Gray for inactive
  const statusBullet = widget.is_active ? (
    <span className="w-2 h-2 rounded-full bg-green-500"></span>
  ) : (
    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
  );

  const hasContracts = widget.contracts && widget.contracts.length > 0;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {/* Main row */}
      <div
        className={cn(
          "flex items-center hover:bg-blue-50/30 transition-colors",
          hasContracts && "cursor-pointer",
        )}
        onClick={() => hasContracts && setExpanded(!expanded)}
      >
        <div className="w-[120px] px-4 py-2.5 text-left flex items-center gap-1.5">
          {hasContracts ? (
            expanded ? (
              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
            )
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <code className="px-2 py-1 bg-gray-100 rounded text-[11px] font-mono text-gray-700">
            {widget.widget_id}
          </code>
        </div>
        <div className="flex-1 px-4 py-2.5 text-left text-xs text-gray-800 font-medium truncate">
          {widget.widget_name || <span className="text-gray-400">-</span>}
        </div>
        <div className="w-[100px] px-4 py-2.5 text-center">{shareTypeBadge}</div>
        <div className={cn("w-[110px] px-4 py-2.5 text-right text-xs tabular-nums", grtValueClass)}>
          {grtValue}
        </div>
        <div className={cn("w-[180px] px-4 py-2.5 text-center text-[11px] tabular-nums", dateRangeClass)}>
          {dateRange}
        </div>
        <div className="w-[80px] px-4 py-2.5 flex justify-center">{statusBullet}</div>
      </div>

      {/* Expanded: Contract history panel */}
      {expanded && hasContracts && (
        <ContractHistoryPanel
          contracts={widget.contracts}
          clientId={clientId}
          serviceId={serviceId}
          widgetId={widget.widget_id}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
