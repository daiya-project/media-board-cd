"use client";

/**
 * AddClientModal — shared state management hook.
 *
 * Encapsulates all form state, data loading effects, validation,
 * combobox adapters, reset helpers, and submit orchestration.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useModalStore } from "@/stores/useModalStore";
import { useToastStore } from "@/stores/useToastStore";
import {
  getActiveClients,
  getManagers,
  getServicesByClient,
} from "@/lib/api/actionService";
import type { ClientOption, ServiceOption, ManagerOption } from "@/lib/api/actionService";
import { getClientContactInfo } from "@/lib/api/registrationService";
import type { ClientContactInfo } from "@/lib/api/registrationService";
import type { ComboboxOption } from "@/components/common/Combobox";
import type { ActionStage } from "@/types/app-db.types";

import type { AddClientModalMode } from "./AddClientModal";
import {
  submitClientNew,
  submitClientEdit,
  submitService,
  submitWidget,
} from "./submitHandlers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PipelineTab = "client" | "service" | "widget";

import { getTodayString } from "@/lib/utils/date-utils";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAddClientForm() {
  const { openModal, payload, close } = useModalStore();
  const addToast = useToastStore((s) => s.add);
  const router = useRouter();

  const isOpen = openModal === "newPipeline";
  const mode = (payload.mode as AddClientModalMode) || "new";

  // -------------------------------------------------------------------------
  // Shared state
  // -------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<PipelineTab>("client");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared dropdown data
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);

  // -------------------------------------------------------------------------
  // Client tab state
  // -------------------------------------------------------------------------
  const [clientTabClientId, setClientTabClientId] = useState("");
  /** Tracks the original client_id in edit mode to detect renames */
  const [clientTabOriginalClientId, setClientTabOriginalClientId] = useState("");
  const [clientTabClientName, setClientTabClientName] = useState("");
  const [clientTabManagerId, setClientTabManagerId] = useState<number | "">("");
  const [clientTabTier, setClientTabTier] = useState("상");
  const [clientTabContactName, setClientTabContactName] = useState("");
  const [clientTabContactPhone, setClientTabContactPhone] = useState("");
  const [clientTabContactEmail, setClientTabContactEmail] = useState("");
  const [clientTabStage, setClientTabStage] = useState<ActionStage>("contact");
  const [clientTabMemo, setClientTabMemo] = useState("");

  // -------------------------------------------------------------------------
  // Service tab state
  // -------------------------------------------------------------------------
  const [svcClientId, setSvcClientId] = useState<string | null>(null);
  const [svcServiceId, setSvcServiceId] = useState("");
  const [svcServiceName, setSvcServiceName] = useState("");
  const [svcContact, setSvcContact] = useState<ClientContactInfo>({
    contact_name: null,
    contact_phone: null,
    contact_email: null,
  });

  // -------------------------------------------------------------------------
  // Widget tab state
  // -------------------------------------------------------------------------
  const [wgtClientId, setWgtClientId] = useState<string | null>(null);
  const [wgtServiceId, setWgtServiceId] = useState<string | null>(null);
  const [wgtServices, setWgtServices] = useState<ServiceOption[]>([]);
  const [wgtLoadingServices, setWgtLoadingServices] = useState(false);
  const [wgtWidgetId, setWgtWidgetId] = useState("");
  const [wgtWidgetName, setWgtWidgetName] = useState("");
  const [wgtContractStart, setWgtContractStart] = useState(getTodayString);
  const [wgtContractEnd, setWgtContractEnd] = useState("");
  const [wgtContractType, setWgtContractType] = useState("CPM");
  const [wgtContractValue, setWgtContractValue] = useState("");

  // -------------------------------------------------------------------------
  // Load shared data when modal opens
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    setLoadingManagers(true);
    getManagers()
      .then((data) => { if (!cancelled) setManagers(data); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoadingManagers(false); });

    setLoadingClients(true);
    getActiveClients()
      .then((data) => { if (!cancelled) setClients(data); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoadingClients(false); });

    return () => { cancelled = true; };
  }, [isOpen]);

  // -------------------------------------------------------------------------
  // Pre-fill state from payload based on mode
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit") {
      setActiveTab("client");
      const editClientId = (payload.clientId as string) || "";
      setClientTabClientId(editClientId);
      setClientTabOriginalClientId(editClientId);
      setClientTabClientName((payload.clientName as string) || "");
      setClientTabManagerId(payload.managerId != null ? Number(payload.managerId) : "");
      setClientTabTier((payload.tier as string) || "상");
      setClientTabContactName((payload.contactName as string) || "");
      setClientTabContactPhone((payload.contactPhone as string) || "");
      setClientTabContactEmail((payload.contactEmail as string) || "");
    } else if (mode === "add") {
      setActiveTab("service");
      const prefillClientId = (payload.clientId as string) || null;
      setSvcClientId(prefillClientId);
      setWgtClientId(prefillClientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Load contact info when service-tab client changes
  useEffect(() => {
    if (!svcClientId) {
      setSvcContact({ contact_name: null, contact_phone: null, contact_email: null });
      return;
    }
    let cancelled = false;
    getClientContactInfo(svcClientId)
      .then((data) => { if (!cancelled) setSvcContact(data); })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [svcClientId]);

  // Load services when widget-tab client changes
  useEffect(() => {
    if (!wgtClientId) {
      setWgtServices([]);
      setWgtServiceId(null);
      return;
    }
    let cancelled = false;
    setWgtLoadingServices(true);
    getServicesByClient(wgtClientId)
      .then((data) => {
        if (!cancelled) {
          setWgtServices(data);
          setWgtServiceId(null);
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setWgtLoadingServices(false); });
    return () => { cancelled = true; };
  }, [wgtClientId]);

  // -------------------------------------------------------------------------
  // Combobox options adapters
  // -------------------------------------------------------------------------
  const clientOptions: ComboboxOption[] = useMemo(
    () => clients.map((c) => ({ id: c.client_id, name: c.client_name })),
    [clients],
  );

  const wgtServiceOptions: ComboboxOption[] = useMemo(
    () => wgtServices.map((s) => ({ id: s.service_id, name: s.service_name })),
    [wgtServices],
  );

  // -------------------------------------------------------------------------
  // Validation (derived)
  // -------------------------------------------------------------------------
  const isClientValid = mode === "edit"
    ? !!(clientTabClientId.trim() && clientTabManagerId !== "")
    : !!(
        clientTabClientId.trim() &&
        clientTabClientName.trim() &&
        clientTabManagerId !== ""
      );

  const isServiceValid = !!(
    svcClientId &&
    svcServiceId.trim() &&
    svcServiceName.trim()
  );
  const isWidgetValid = !!(
    wgtClientId &&
    wgtServiceId &&
    wgtWidgetId.trim() &&
    wgtWidgetName.trim()
  );

  // -------------------------------------------------------------------------
  // Reset helpers
  // -------------------------------------------------------------------------
  const resetClientForm = useCallback(() => {
    setClientTabClientId("");
    setClientTabOriginalClientId("");
    setClientTabClientName("");
    setClientTabManagerId("");
    setClientTabTier("상");
    setClientTabContactName("");
    setClientTabContactPhone("");
    setClientTabContactEmail("");
    setClientTabStage("contact");
    setClientTabMemo("");
  }, []);

  const resetServiceForm = useCallback(() => {
    setSvcClientId(null);
    setSvcServiceId("");
    setSvcServiceName("");
    setSvcContact({ contact_name: null, contact_phone: null, contact_email: null });
  }, []);

  const resetWidgetForm = useCallback(() => {
    setWgtClientId(null);
    setWgtServiceId(null);
    setWgtServices([]);
    setWgtWidgetId("");
    setWgtWidgetName("");
    setWgtContractStart(getTodayString());
    setWgtContractEnd("");
    setWgtContractType("CPM");
    setWgtContractValue("");
  }, []);

  // -------------------------------------------------------------------------
  // Close handler
  // -------------------------------------------------------------------------
  const handleClose = useCallback(() => {
    if (submitting) return;
    resetClientForm();
    resetServiceForm();
    resetWidgetForm();
    setActiveTab("client");
    setError(null);
    close();
  }, [submitting, resetClientForm, resetServiceForm, resetWidgetForm, close]);

  // -------------------------------------------------------------------------
  // Submit handlers (delegate to pure async functions)
  // -------------------------------------------------------------------------
  async function handleClientSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isClientValid) return;

    setSubmitting(true);
    try {
      const result = await submitClientNew({
        clientId: clientTabClientId.trim(),
        clientName: clientTabClientName.trim(),
        managerId: clientTabManagerId as number,
        tier: clientTabTier,
        contactName: clientTabContactName.trim(),
        contactPhone: clientTabContactPhone.trim(),
        contactEmail: clientTabContactEmail.trim(),
        stage: clientTabStage,
        memo: clientTabMemo.trim(),
      });
      if (!result.ok) { setError(result.error!); return; }

      addToast({ type: "success", message: "매체가 성공적으로 등록되었습니다." });
      handleClose();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "매체 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClientEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isClientValid) return;

    setSubmitting(true);
    try {
      const result = await submitClientEdit({
        clientId: clientTabClientId.trim(),
        originalClientId: clientTabOriginalClientId,
        managerId: clientTabManagerId as number,
        tier: clientTabTier,
        contactName: clientTabContactName.trim(),
        contactPhone: clientTabContactPhone.trim(),
        contactEmail: clientTabContactEmail.trim(),
      });
      if (!result.ok) { setError(result.error!); return; }

      addToast({ type: "success", message: "매체 정보가 수정되었습니다." });
      handleClose();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "매체 정보 수정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleServiceSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isServiceValid) return;

    setSubmitting(true);
    try {
      const result = await submitService({
        clientId: svcClientId!,
        serviceId: svcServiceId.trim(),
        serviceName: svcServiceName.trim(),
      });
      if (!result.ok) { setError(result.error!); return; }

      addToast({ type: "success", message: "서비스가 성공적으로 등록되었습니다." });
      handleClose();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "서비스 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWidgetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isWidgetValid) return;

    setSubmitting(true);
    try {
      const result = await submitWidget({
        clientId: wgtClientId!,
        serviceId: wgtServiceId!,
        widgetId: wgtWidgetId.trim(),
        widgetName: wgtWidgetName.trim(),
        contractStart: wgtContractStart,
        contractEnd: wgtContractEnd,
        contractType: wgtContractType,
        contractValue: wgtContractValue,
      });
      if (!result.ok) { setError(result.error!); return; }
      if (result.contractWarning) {
        addToast({ type: "warning", message: "위젯은 등록되었으나 계약 정보 등록에 실패했습니다." });
      }

      addToast({ type: "success", message: "위젯이 성공적으로 등록되었습니다." });
      handleClose();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "위젯 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // formKey for resetting uncontrolled inputs on modal reopen
  // -------------------------------------------------------------------------
  const formKey = useMemo(
    () => (isOpen ? `addclient-${Date.now()}` : "closed"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen],
  );

  return {
    // Modal state
    isOpen,
    mode,
    activeTab,
    setActiveTab,
    submitting,
    error,
    setError,
    formKey,
    handleClose,

    // Client tab
    clientTabClientId, setClientTabClientId,
    clientTabClientName, setClientTabClientName,
    clientTabManagerId, setClientTabManagerId,
    clientTabTier, setClientTabTier,
    clientTabContactName, setClientTabContactName,
    clientTabContactPhone, setClientTabContactPhone,
    clientTabContactEmail, setClientTabContactEmail,
    clientTabStage, setClientTabStage,
    clientTabMemo, setClientTabMemo,
    managers, loadingManagers,

    // Service tab
    svcClientId, setSvcClientId,
    svcServiceId, setSvcServiceId,
    svcServiceName, setSvcServiceName,
    svcContact,
    clientOptions, loadingClients,

    // Widget tab
    wgtClientId, setWgtClientId,
    wgtServiceId, setWgtServiceId,
    wgtServiceOptions, wgtLoadingServices,
    wgtWidgetId, setWgtWidgetId,
    wgtWidgetName, setWgtWidgetName,
    wgtContractStart, setWgtContractStart,
    wgtContractEnd, setWgtContractEnd,
    wgtContractType, setWgtContractType,
    wgtContractValue, setWgtContractValue,

    // Validation
    isClientValid,
    isServiceValid,
    isWidgetValid,

    // Submit handlers
    handleClientSubmit,
    handleClientEditSubmit,
    handleServiceSubmit,
    handleWidgetSubmit,
  };
}
