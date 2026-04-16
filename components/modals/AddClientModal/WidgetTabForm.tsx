"use client";

import { CreditCard } from "lucide-react";
import { Combobox } from "@/components/common/Combobox";
import type { ComboboxOption } from "@/components/common/Combobox";

// ---------------------------------------------------------------------------
// Constants (tab-specific)
// ---------------------------------------------------------------------------

const CONTRACT_TYPE_OPTIONS = [
  { value: "CPM", label: "CPM" },
  { value: "R/S", label: "R/S" },
  { value: "CPC", label: "Fixed CPC" },
  { value: "ETC", label: "ETC" },
];

const CONTRACT_PLACEHOLDERS: Record<string, string> = {
  CPM: "계약 CPM (예: 1200)",
  "R/S": "수익 분배율 (예: 70)",
  CPC: "CPC 단가 (예: 50)",
  ETC: "기타 조건",
};

const labelClass = "block text-[12px] font-bold text-gray-500 mb-1 uppercase";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WidgetTabFormProps {
  clientId: string | null;
  onClientIdChange: (v: string | null) => void;
  serviceId: string | null;
  onServiceIdChange: (v: string | null) => void;
  serviceOptions: ComboboxOption[];
  loadingServices: boolean;
  widgetId: string;
  onWidgetIdChange: (v: string) => void;
  widgetName: string;
  onWidgetNameChange: (v: string) => void;
  contractStart: string;
  onContractStartChange: (v: string) => void;
  contractEnd: string;
  onContractEndChange: (v: string) => void;
  contractType: string;
  onContractTypeChange: (v: string) => void;
  contractValue: string;
  onContractValueChange: (v: string) => void;
  clientOptions: ComboboxOption[];
  loadingClients: boolean;
  onSubmit: (e: React.FormEvent) => void;
  /** When true, client selection is locked (pre-filled from sheet) */
  clientLocked?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Widget tab form for registering a widget and its contract.
 * Pure render component — no internal state or hooks.
 */
export function WidgetTabForm({
  clientId, onClientIdChange,
  serviceId, onServiceIdChange,
  serviceOptions, loadingServices,
  widgetId, onWidgetIdChange,
  widgetName, onWidgetNameChange,
  contractStart, onContractStartChange,
  contractEnd, onContractEndChange,
  contractType, onContractTypeChange,
  contractValue, onContractValueChange,
  clientOptions, loadingClients,
  onSubmit,
  clientLocked = false,
}: WidgetTabFormProps) {
  return (
    <form id="widget-form" onSubmit={onSubmit}>
      {/* Client + Service cascade */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelClass}>
            Client 선택 <span className="text-red-500">*</span>
          </label>
          <Combobox
            options={clientOptions}
            value={clientId}
            onChange={(v) => {
              onClientIdChange(v);
              onServiceIdChange(null);
            }}
            placeholder="매체 검색..."
            allLabel="매체를 선택하세요"
            loading={loadingClients}
            disabled={clientLocked}
          />
        </div>
        <div>
          <label className={labelClass}>
            Service 선택 <span className="text-red-500">*</span>
          </label>
          <Combobox
            options={serviceOptions}
            value={serviceId}
            onChange={onServiceIdChange}
            placeholder="서비스 검색..."
            allLabel={!clientId ? "Client를 먼저 선택하세요" : "서비스를 선택하세요"}
            loading={loadingServices}
            disabled={!clientId}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelClass}>
            Widget ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={inputClass}
            placeholder="예: 2o2KbLz7"
            value={widgetId}
            onChange={(e) => onWidgetIdChange(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>
            Widget Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={inputClass}
            placeholder="예: 본문하단_270px"
            value={widgetName}
            onChange={(e) => onWidgetNameChange(e.target.value)}
          />
        </div>
      </div>

      {/* Contract section */}
      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
        <h4 className="text-xs font-bold text-blue-600 mb-3 flex items-center gap-1">
          <CreditCard className="w-4 h-4" /> 정산/계약
        </h4>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className={labelClass}>계약 시작일</label>
            <input
              type="date"
              className={inputClass}
              value={contractStart}
              onChange={(e) => onContractStartChange(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>계약 종료일</label>
            <input
              type="date"
              className={inputClass}
              value={contractEnd}
              onChange={(e) => onContractEndChange(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>정산 조건</label>
            <select
              className={inputClass}
              value={contractType}
              onChange={(e) => onContractTypeChange(e.target.value)}
            >
              {CONTRACT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>계약 Value</label>
            <input
              type="number"
              className={inputClass}
              placeholder={CONTRACT_PLACEHOLDERS[contractType] ?? "계약 Value"}
              value={contractValue}
              onChange={(e) => onContractValueChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </form>
  );
}
