"use client";

import { AlertTriangle, Clock, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTierBadgeClass, getStageBadgeClass, getContactStatusStyle } from "@/lib/utils/table-display-utils";
import type { ContactStatusRow, ContactStatus } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Status label / icon mapping
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  Exclude<ContactStatus, "excluded" | "ok">,
  { label: string; icon: typeof AlertTriangle }
> = {
  overdue: { label: "초과", icon: AlertTriangle },
  urgent: { label: "긴급", icon: Clock },
  upcoming: { label: "도래", icon: CalendarClock },
};

// ---------------------------------------------------------------------------
// Summary counts
// ---------------------------------------------------------------------------

function StatusSummary({ clients }: { clients: ContactStatusRow[] }) {
  const counts = { overdue: 0, urgent: 0, upcoming: 0 };
  for (const c of clients) {
    if (c.contact_status in counts) {
      counts[c.contact_status as keyof typeof counts]++;
    }
  }

  const items: { status: Exclude<ContactStatus, "excluded" | "ok">; count: number }[] = [
    { status: "overdue", count: counts.overdue },
    { status: "urgent", count: counts.urgent },
    { status: "upcoming", count: counts.upcoming },
  ];

  return (
    <div className="flex items-center gap-3 px-5 pb-3">
      {items.map(({ status, count }) => {
        const style = getContactStatusStyle(status);
        const config = STATUS_CONFIG[status];
        const Icon = config.icon;
        return (
          <div
            key={status}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold",
              style.bg,
              style.text,
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{config.label}</span>
            <span className="tabular-nums">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage label helper
// ---------------------------------------------------------------------------

function formatStageLabel(stage: string): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

// ---------------------------------------------------------------------------
// Client row
// ---------------------------------------------------------------------------

function ClientRow({ client }: { client: ContactStatusRow }) {
  const style = getContactStatusStyle(client.contact_status);
  const config = STATUS_CONFIG[client.contact_status as keyof typeof STATUS_CONFIG];
  const daysText =
    client.days_remaining !== null
      ? client.days_remaining < 0
        ? `${Math.abs(client.days_remaining)}일 초과`
        : `${client.days_remaining}일 남음`
      : "—";

  return (
    <div
      className={cn(
        "group flex items-center gap-3 mx-3 px-3 py-2.5 rounded-xl transition-colors",
        style.bg,
        "hover:brightness-[0.97]",
      )}
    >
      {/* Status dot */}
      <div className={cn("w-2 h-2 rounded-full shrink-0", style.dot)} />

      {/* Client info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {client.client_name}
          </span>
          {client.tier && (
            <span className={getTierBadgeClass(client.tier)}>
              {client.tier}
            </span>
          )}
          {client.last_stage && (
            <span className={getStageBadgeClass(client.last_stage)}>
              {formatStageLabel(client.last_stage)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {client.last_action_date && (
            <span className="text-[11px] text-gray-400">
              {client.last_action_date.slice(5).replace("-", "/")}
            </span>
          )}
          {client.manager_name && (
            <span className="text-[11px] text-gray-400">
              · {client.manager_name}
            </span>
          )}
        </div>
      </div>

      {/* Days remaining */}
      <div className="flex items-center gap-1.5 shrink-0">
        {config && (
          <config.icon className={cn("w-3.5 h-3.5", style.text)} />
        )}
        <span
          className={cn(
            "text-xs font-semibold tabular-nums whitespace-nowrap",
            style.text,
          )}
        >
          {daysText}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ContactDueListProps {
  clients: ContactStatusRow[];
}

/**
 * Sales Cycle panel — displays clients whose contact cycle is due
 * (overdue, urgent, upcoming), with last stage and manager info.
 */
export default function ContactDueList({ clients }: ContactDueListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-800">Sales Cycle</h2>
          <span className="text-[11px] font-medium text-gray-400 tabular-nums">
            {clients.length}
          </span>
        </div>
      </div>

      {/* Status summary */}
      <StatusSummary clients={clients} />

      {/* Client list */}
      <div className="flex-1 overflow-y-auto">
        {clients.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            컨택 도래 매체사가 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {clients.map((client) => (
              <ClientRow key={client.client_id} client={client} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
