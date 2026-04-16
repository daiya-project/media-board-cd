"use client";

import { useState } from "react";
import { Loader2, Plus, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumberForDisplay } from "@/lib/utils/number-utils";
import { getTodayString } from "@/lib/utils/date-utils";
import { useToastStore } from "@/stores/useToastStore";
import {
  SHARE_TYPE_STYLES,
  formatContractValue,
  formatContractPeriod,
  getContractStatus,
} from "@/lib/utils/contract-utils";
import type { ContractStatus } from "@/lib/utils/contract-utils";
import { closeContract, addContract } from "@/lib/api/contractService";
import type { WidgetContractRow } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTRACT_TYPES = ["CPM", "R/S", "CPC", "ETC"] as const;

const CONTRACT_PLACEHOLDERS: Record<string, string> = {
  CPM: "CPM (예: 1200)",
  "R/S": "분배율 (예: 70)",
  CPC: "CPC (예: 50)",
  ETC: "기타 조건",
};

const STATUS_BADGE: Record<ContractStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-50 text-green-700 border-green-200" },
  expired: { label: "Expired", className: "bg-gray-100 text-gray-500 border-gray-200" },
  future: { label: "Future", className: "bg-blue-50 text-blue-600 border-blue-200" },
  unknown: { label: "-", className: "bg-gray-50 text-gray-400 border-gray-200" },
};

// ---------------------------------------------------------------------------
// ShareTypeBadge
// ---------------------------------------------------------------------------

interface ShareTypeBadgeProps {
  type: string;
}

/**
 * Badge displaying contract type (CPM, R/S, CPC, etc.) with styled colors.
 */
export function ShareTypeBadge({ type }: ShareTypeBadgeProps) {
  const style = SHARE_TYPE_STYLES[type] || {
    bg: "#f9fafb",
    text: "#6b7280",
    border: "#e5e7eb",
  };

  return (
    <span
      className="inline-flex px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
    >
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ContractHistoryPanel
// ---------------------------------------------------------------------------

interface ContractHistoryPanelProps {
  contracts: WidgetContractRow[];
  clientId: string;
  serviceId: string;
  widgetId: string;
  onRefresh: () => void;
}

/**
 * Expandable panel showing contract history for a widget.
 * Includes contract list and a "New Contract" form.
 */
export function ContractHistoryPanel({ contracts, clientId, serviceId, widgetId, onRefresh }: ContractHistoryPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContractId, setEditingContractId] = useState<number | null>(null);

  return (
    <div className="bg-gray-50 border-t border-gray-200">
      {/* Header */}
      <div className="px-6 py-2 flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          Contract History ({contracts.length})
        </span>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-3 h-3" />
          New Contract
        </button>
      </div>

      {/* Add contract form */}
      {showAddForm && (
        <NewContractForm
          clientId={clientId}
          serviceId={serviceId}
          widgetId={widgetId}
          onSaved={() => {
            setShowAddForm(false);
            onRefresh();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Contract rows */}
      <div className="px-6 pb-3 space-y-1">
        {contracts.map((contract) => (
          <ContractHistoryRow
            key={contract.id}
            contract={contract}
            isEditing={editingContractId === contract.id}
            onEdit={() => setEditingContractId(contract.id)}
            onCancelEdit={() => setEditingContractId(null)}
            onSaved={() => {
              setEditingContractId(null);
              onRefresh();
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContractHistoryRow
// ---------------------------------------------------------------------------

interface ContractHistoryRowProps {
  contract: WidgetContractRow;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
}

function ContractHistoryRow({ contract, isEditing, onEdit, onCancelEdit, onSaved }: ContractHistoryRowProps) {
  const [newDateEnd, setNewDateEnd] = useState(contract.date_end || "");
  const [saving, setSaving] = useState(false);
  const { add: addToast } = useToastStore();

  const status = getContractStatus(contract.date_start, contract.date_end);
  const badge = STATUS_BADGE[status];
  const normalizedType = contract.contract_type?.toUpperCase() || null;

  async function handleSaveEndDate() {
    if (!newDateEnd) return;
    setSaving(true);
    try {
      await closeContract(contract.id, newDateEnd);
      addToast({ type: "success", message: "계약 종료일이 수정되었습니다." });
      onSaved();
    } catch {
      addToast({ type: "error", message: "종료일 수정에 실패했습니다." });
    } finally {
      setSaving(false);
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 p-2 bg-white rounded border border-blue-200">
        <span className="text-[11px] text-gray-500 shrink-0">종료일 수정:</span>
        <input
          type="date"
          value={newDateEnd}
          onChange={(e) => setNewDateEnd(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleSaveEndDate}
          disabled={saving || !newDateEnd}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Save
        </button>
        <button
          type="button"
          onClick={onCancelEdit}
          className="px-2 py-1 rounded text-[11px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-2 bg-white rounded border border-gray-150 hover:border-gray-300 transition-colors group">
      {/* Status badge */}
      <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border", badge.className)}>
        {badge.label}
      </span>

      {/* Type */}
      {normalizedType ? (
        <ShareTypeBadge type={normalizedType} />
      ) : (
        <span className="text-[11px] text-gray-400">-</span>
      )}

      {/* Value */}
      <span className="text-xs tabular-nums text-gray-700 min-w-[60px] text-right">
        {contract.contract_value != null && normalizedType
          ? formatContractValue(normalizedType, contract.contract_value)
          : contract.contract_value != null
            ? formatNumberForDisplay(contract.contract_value)
            : "-"}
      </span>

      {/* Period */}
      <span className="text-[11px] tabular-nums text-gray-600 flex-1">
        {formatContractPeriod(contract.date_start, contract.date_end)}
      </span>

      {/* Edit button */}
      <button
        type="button"
        onClick={onEdit}
        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
        title="종료일 수정"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewContractForm
// ---------------------------------------------------------------------------

interface NewContractFormProps {
  clientId: string;
  serviceId: string;
  widgetId: string;
  onSaved: () => void;
  onCancel: () => void;
}

function NewContractForm({ clientId, serviceId, widgetId, onSaved, onCancel }: NewContractFormProps) {
  const [contractType, setContractType] = useState("CPM");
  const [contractValue, setContractValue] = useState("");
  const [dateStart, setDateStart] = useState(getTodayString);
  const [dateEnd, setDateEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const { add: addToast } = useToastStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dateStart) return;

    setSaving(true);
    try {
      await addContract({
        client_id: clientId,
        service_id: serviceId,
        widget_id: widgetId,
        contract_type: contractType,
        contract_value: contractValue ? Number(contractValue) : null,
        date_start: dateStart || null,
        date_end: dateEnd || null,
      });
      addToast({ type: "success", message: "새 계약이 등록되었습니다." });
      onSaved();
    } catch {
      addToast({ type: "error", message: "계약 등록에 실패했습니다." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-6 mb-3 p-3 bg-white rounded-lg border border-blue-200 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Contract type */}
        <select
          value={contractType}
          onChange={(e) => setContractType(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {CONTRACT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Contract value */}
        <input
          type="number"
          value={contractValue}
          onChange={(e) => setContractValue(e.target.value)}
          placeholder={CONTRACT_PLACEHOLDERS[contractType] || "값"}
          className="w-[140px] px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {/* Start date */}
        <input
          type="date"
          value={dateStart}
          onChange={(e) => setDateStart(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          required
        />

        <span className="text-xs text-gray-400">~</span>

        {/* End date */}
        <input
          type="date"
          value={dateEnd}
          onChange={(e) => setDateEnd(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {/* Actions */}
        <button
          type="submit"
          disabled={saving || !dateStart}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
