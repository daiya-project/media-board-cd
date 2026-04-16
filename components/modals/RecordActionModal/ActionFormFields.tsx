"use client";

import { CascadeSelector } from "@/components/common/CascadeSelector";
import type { CascadeSelection } from "@/components/common/CascadeSelector";
import type { ActionStage } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGE_OPTIONS: { value: ActionStage; label: string }[] = [
  { value: "memo", label: "Memo" },
  { value: "contact", label: "Contact" },
  { value: "meeting", label: "Meeting" },
  { value: "propose", label: "Propose" },
  { value: "done", label: "Done" },
];

const labelClass = "block text-[12px] font-medium text-gray-500 mb-1";

const selectClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ActionFormFieldsProps {
  clientId?: string;
  clientName?: string;
  cascade: CascadeSelection;
  onCascadeChange: (sel: CascadeSelection) => void;
  lockClient: boolean;
  stage: ActionStage | "";
  onStageChange: (stage: ActionStage | "") => void;
  actionDate: string;
  onDateChange: (date: string) => void;
  hasFollowup: boolean;
  onFollowupChange: (checked: boolean) => void;
  error: string | null;
}

/**
 * Left column form fields for RecordActionModal.
 * Contains: CascadeSelector, Stage, Date, Follow-up checkbox, and error display.
 */
export function ActionFormFields({
  clientId,
  clientName,
  cascade,
  onCascadeChange,
  lockClient,
  stage,
  onStageChange,
  actionDate,
  onDateChange,
  hasFollowup,
  onFollowupChange,
  error,
}: ActionFormFieldsProps) {
  return (
    <div className="w-[280px] shrink-0 space-y-5">
      <CascadeSelector
        defaultClientId={clientId || cascade.clientId || undefined}
        defaultClientName={clientName}
        defaultServiceId={cascade.serviceId}
        defaultWidgetId={cascade.widgetId}
        lockClient={lockClient}
        onChange={onCascadeChange}
      />

      <div>
        <label className={labelClass}>
          Stage <span className="text-red-500">*</span>
        </label>
        <select
          className={selectClass}
          value={stage}
          onChange={(e) => onStageChange(e.target.value as ActionStage | "")}
          required
        >
          <option value="" disabled>선택해주세요</option>
          {STAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>
          Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          className={selectClass}
          value={actionDate}
          onChange={(e) => onDateChange(e.target.value)}
          required
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <input
          id="followup-checkbox"
          type="checkbox"
          checked={hasFollowup}
          onChange={(e) => onFollowupChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label
          htmlFor="followup-checkbox"
          className="text-[12px] text-gray-700 select-none"
        >
          Follow-up 필요
        </label>
      </div>

      {error && (
        <p className="text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-1.5">
          {error}
        </p>
      )}
    </div>
  );
}
