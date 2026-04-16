"use client";

import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import { Combobox } from "@/components/common/Combobox";
import type { ComboboxOption } from "@/components/common/Combobox";
import type { ClientContactInfo } from "@/lib/api/registrationService";

// ---------------------------------------------------------------------------
// Constants (tab-specific)
// ---------------------------------------------------------------------------

const labelClass = "block text-[12px] font-bold text-gray-500 mb-1 uppercase";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ServiceTabFormProps {
  clientId: string | null;
  onClientIdChange: (v: string | null) => void;
  serviceId: string;
  onServiceIdChange: (v: string) => void;
  serviceName: string;
  onServiceNameChange: (v: string) => void;
  contact: ClientContactInfo;
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
 * Service tab form for registering a service under a client.
 * Pure render component — no internal state or hooks.
 */
export function ServiceTabForm({
  clientId, onClientIdChange,
  serviceId, onServiceIdChange,
  serviceName, onServiceNameChange,
  contact,
  clientOptions, loadingClients,
  onSubmit,
  clientLocked = false,
}: ServiceTabFormProps) {
  return (
    <form id="service-form" onSubmit={onSubmit}>
      {/* Client selection */}
      <div className="mb-4">
        <label className={labelClass}>
          Client 선택 <span className="text-red-500">*</span>
        </label>
        <Combobox
          options={clientOptions}
          value={clientId}
          onChange={onClientIdChange}
          placeholder="매체 검색..."
          allLabel="매체를 선택하세요"
          loading={loadingClients}
          disabled={clientLocked}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelClass}>
            Service ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={inputClass}
            placeholder="예: 9"
            value={serviceId}
            onChange={(e) => onServiceIdChange(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>
            Service Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={inputClass}
            placeholder="예: news1.kr"
            value={serviceName}
            onChange={(e) => onServiceNameChange(e.target.value)}
          />
        </div>
      </div>

      {/* Contact info (read-only, auto-populated) */}
      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
        <h4 className="text-xs font-bold text-blue-600 mb-3 flex items-center gap-1">
          <User className="w-4 h-4" /> 담당자 정보
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <input
            className={cn(inputClass, "bg-gray-50 text-gray-500")}
            placeholder="이름"
            value={contact.contact_name ?? ""}
            disabled
          />
          <input
            className={cn(inputClass, "bg-gray-50 text-gray-500")}
            placeholder="전화번호"
            value={contact.contact_phone ?? ""}
            disabled
          />
          <input
            className={cn(inputClass, "bg-gray-50 text-gray-500")}
            placeholder="이메일"
            value={contact.contact_email ?? ""}
            disabled
          />
        </div>
      </div>
    </form>
  );
}
