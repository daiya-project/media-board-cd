"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

import { ClientTabForm } from "./ClientTabForm";
import { ServiceTabForm } from "./ServiceTabForm";
import { WidgetTabForm } from "./WidgetTabForm";
import { useAddClientForm } from "./useAddClientForm";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type PipelineTab = "client" | "service" | "widget";

/** Modal open mode: new (default), edit (update client info), add (add service/widget to client) */
export type AddClientModalMode = "new" | "edit" | "add";

const TABS: { value: PipelineTab; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "service", label: "Service" },
  { value: "widget", label: "Widget" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal for registering/editing Client, Service, or Widget entities.
 * Opens when useModalStore.openModal === "newPipeline".
 * Contains 3 tabs: Client, Service, Widget.
 *
 * Supports 3 modes via payload.mode:
 * - "new" (default): All tabs available, create new client/service/widget
 * - "edit": Only Client tab, pre-filled + client_id/name disabled, update existing client info
 * - "add": Client tab disabled, Service/Widget tabs available with pre-filled client
 */
export function AddClientModal() {
  const f = useAddClientForm();

  if (!f.isOpen) return null;

  // -------------------------------------------------------------------------
  // Derived display values
  // -------------------------------------------------------------------------
  const currentIsValid =
    f.activeTab === "client" ? f.isClientValid :
    f.activeTab === "service" ? f.isServiceValid :
    f.isWidgetValid;

  const currentFormId =
    f.activeTab === "client" ? "client-form" :
    f.activeTab === "service" ? "service-form" :
    "widget-form";

  const headerTitle =
    f.mode === "edit" ? "Client 정보 수정" :
    f.mode === "add" ? "서비스/위젯 추가" :
    "Client MGMT Console";

  const submitLabel =
    f.mode === "edit"
      ? (f.submitting ? "수정 중..." : "수정하기")
      : (f.submitting ? "등록 중..." : "등록하기");

  function isTabDisabled(tab: PipelineTab): boolean {
    if (f.mode === "edit") return tab !== "client";
    if (f.mode === "add") return tab === "client";
    return false;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
        onClick={f.handleClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={headerTitle}
        className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-border w-full max-w-2xl max-h-[70vh] flex flex-col text-[12px]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-border shrink-0">
            <h2 className="text-sm font-bold text-foreground">
              {headerTitle}
            </h2>
            <button
              type="button"
              onClick={f.handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-2 px-6 py-3 shrink-0">
            {TABS.map((tab) => {
              const disabled = isTabDisabled(tab.value);
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    f.setActiveTab(tab.value);
                    f.setError(null);
                  }}
                  disabled={disabled}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-lg border border-gray-200 transition-colors",
                    f.activeTab === tab.value
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50",
                    disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="border-t border-border shrink-0" />

          {/* Tab content */}
          <div className="px-6 py-4" key={f.formKey}>
            {f.activeTab === "client" && (
              <ClientTabForm
                clientId={f.clientTabClientId}
                onClientIdChange={f.setClientTabClientId}
                clientName={f.clientTabClientName}
                onClientNameChange={f.setClientTabClientName}
                managerId={f.clientTabManagerId}
                onManagerIdChange={f.setClientTabManagerId}
                tier={f.clientTabTier}
                onTierChange={f.setClientTabTier}
                contactName={f.clientTabContactName}
                onContactNameChange={f.setClientTabContactName}
                contactPhone={f.clientTabContactPhone}
                onContactPhoneChange={f.setClientTabContactPhone}
                contactEmail={f.clientTabContactEmail}
                onContactEmailChange={f.setClientTabContactEmail}
                stage={f.clientTabStage}
                onStageChange={f.setClientTabStage}
                memo={f.clientTabMemo}
                onMemoChange={f.setClientTabMemo}
                managers={f.managers}
                loadingManagers={f.loadingManagers}
                onSubmit={f.mode === "edit" ? f.handleClientEditSubmit : f.handleClientSubmit}
                editMode={f.mode === "edit"}
              />
            )}
            {f.activeTab === "service" && (
              <ServiceTabForm
                clientId={f.svcClientId}
                onClientIdChange={f.setSvcClientId}
                serviceId={f.svcServiceId}
                onServiceIdChange={f.setSvcServiceId}
                serviceName={f.svcServiceName}
                onServiceNameChange={f.setSvcServiceName}
                contact={f.svcContact}
                clientOptions={f.clientOptions}
                loadingClients={f.loadingClients}
                onSubmit={f.handleServiceSubmit}
                clientLocked={f.mode === "add"}
              />
            )}
            {f.activeTab === "widget" && (
              <WidgetTabForm
                clientId={f.wgtClientId}
                onClientIdChange={f.setWgtClientId}
                serviceId={f.wgtServiceId}
                onServiceIdChange={f.setWgtServiceId}
                serviceOptions={f.wgtServiceOptions}
                loadingServices={f.wgtLoadingServices}
                widgetId={f.wgtWidgetId}
                onWidgetIdChange={f.setWgtWidgetId}
                widgetName={f.wgtWidgetName}
                onWidgetNameChange={f.setWgtWidgetName}
                contractStart={f.wgtContractStart}
                onContractStartChange={f.setWgtContractStart}
                contractEnd={f.wgtContractEnd}
                onContractEndChange={f.setWgtContractEnd}
                contractType={f.wgtContractType}
                onContractTypeChange={f.setWgtContractType}
                contractValue={f.wgtContractValue}
                onContractValueChange={f.setWgtContractValue}
                clientOptions={f.clientOptions}
                loadingClients={f.loadingClients}
                onSubmit={f.handleWidgetSubmit}
                clientLocked={f.mode === "add"}
              />
            )}

            {/* Error */}
            {f.error && (
              <p className="text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-1.5 mt-4">
                {f.error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-6 py-3 flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={f.handleClose}
              disabled={f.submitting}
              className="px-6 py-2 text-[12px] rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              form={currentFormId}
              disabled={!currentIsValid || f.submitting}
              className="px-6 py-2 text-[12px] rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md shadow-blue-500/30 transition-colors disabled:opacity-50"
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
