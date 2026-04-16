"use client";

import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import type { ManagerOption } from "@/lib/api/actionService";
import type { ActionStage } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Constants (tab-specific, not shared)
// ---------------------------------------------------------------------------

const TIER_OPTIONS = [
  { value: "상", label: "상" },
  { value: "중", label: "중" },
  { value: "하", label: "하" },
  { value: "기타", label: "기타" },
];

const STAGE_OPTIONS: { value: ActionStage; label: string }[] = [
  { value: "contact", label: "Contact" },
  { value: "memo", label: "Memo" },
  { value: "meeting", label: "Meeting" },
  { value: "propose", label: "Propose" },
  { value: "done", label: "Done" },
];

const labelClass = "block text-[12px] font-bold text-gray-500 mb-1 uppercase";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400";

const disabledInputClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-[12px] text-gray-500 outline-none cursor-not-allowed";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ClientTabFormProps {
  clientId: string;
  onClientIdChange: (v: string) => void;
  clientName: string;
  onClientNameChange: (v: string) => void;
  managerId: number | "";
  onManagerIdChange: (v: number | "") => void;
  tier: string;
  onTierChange: (v: string) => void;
  contactName: string;
  onContactNameChange: (v: string) => void;
  contactPhone: string;
  onContactPhoneChange: (v: string) => void;
  contactEmail: string;
  onContactEmailChange: (v: string) => void;
  stage: ActionStage;
  onStageChange: (v: ActionStage) => void;
  memo: string;
  onMemoChange: (v: string) => void;
  managers: ManagerOption[];
  loadingManagers: boolean;
  onSubmit: (e: React.FormEvent) => void;
  /** When true, client_id/name are read-only and stage/memo are hidden */
  editMode?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Client tab form for registering or editing a client.
 * Pure render component — no internal state or hooks.
 */
export function ClientTabForm({
  clientId, onClientIdChange,
  clientName, onClientNameChange,
  managerId, onManagerIdChange,
  tier, onTierChange,
  contactName, onContactNameChange,
  contactPhone, onContactPhoneChange,
  contactEmail, onContactEmailChange,
  stage, onStageChange,
  memo, onMemoChange,
  managers, loadingManagers,
  onSubmit,
  editMode = false,
}: ClientTabFormProps) {
  return (
    <form id="client-form" onSubmit={onSubmit}>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelClass}>
            Client ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={inputClass}
            placeholder="예: 120"
            value={clientId}
            onChange={(e) => onClientIdChange(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>
            Client Name {!editMode && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            className={editMode ? disabledInputClass : inputClass}
            value={clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
            disabled={editMode}
          />
        </div>
        <div>
          <label className={labelClass}>
            Owner <span className="text-red-500">*</span>
          </label>
          <select
            className={inputClass}
            value={managerId}
            onChange={(e) =>
              onManagerIdChange(e.target.value ? Number(e.target.value) : "")
            }
            disabled={loadingManagers}
          >
            <option value="">담당자 선택</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>매중도</label>
          <select
            className={inputClass}
            value={tier}
            onChange={(e) => onTierChange(e.target.value)}
          >
            {TIER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Contact info section */}
      <div className="bg-blue-50/50 p-4 rounded-xl mb-4 border border-blue-100">
        <h4 className="text-xs font-bold text-blue-600 mb-3 flex items-center gap-1">
          <User className="w-4 h-4" /> 담당자 정보
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <input
            className={inputClass}
            placeholder="이름"
            value={contactName}
            onChange={(e) => onContactNameChange(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="전화번호"
            value={contactPhone}
            onChange={(e) => onContactPhoneChange(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="이메일"
            value={contactEmail}
            onChange={(e) => onContactEmailChange(e.target.value)}
          />
        </div>
      </div>

      {/* Stage & Memo — hidden in edit mode */}
      {!editMode && (
        <>
          <div className="mb-4">
            <label className={labelClass}>Stage</label>
            <select
              className={inputClass}
              value={stage}
              onChange={(e) => onStageChange(e.target.value as ActionStage)}
            >
              {STAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Memo</label>
            <textarea
              className={cn(inputClass, "h-20 py-2 resize-none")}
              value={memo}
              onChange={(e) => onMemoChange(e.target.value)}
            />
          </div>
        </>
      )}
    </form>
  );
}
