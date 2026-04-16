"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  getActiveClients,
  getServicesByClient,
  getWidgetsByService,
} from "@/lib/api/actionService";
import type { ClientOption, ServiceOption, WidgetOption } from "@/lib/api/actionService";
import { Combobox } from "@/components/common/Combobox";
import type { ComboboxOption } from "@/components/common/Combobox";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CascadeSelection {
  clientId: string | null;
  clientName: string | null;
  serviceId: string | null;
  widgetId: string | null;
}

interface CascadeSelectorProps {
  /** Pre-selected client ID (loaded on mount) */
  defaultClientId?: string;
  /** Display name for the locked client */
  defaultClientName?: string;
  /** Pre-selected service ID */
  defaultServiceId?: string | null;
  /** Pre-selected widget ID */
  defaultWidgetId?: string | null;
  /** If true, client field is read-only */
  lockClient?: boolean;
  /** Called whenever any selection changes */
  onChange: (selection: CascadeSelection) => void;
  /** Additional className for the wrapper */
  className?: string;
}

const labelClass = "block text-[12px] font-medium text-gray-500 mb-1";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Cascading Client → Service → Widget dropdown selector.
 * Reusable across modals that need entity selection (RecordAction, etc.).
 */
export function CascadeSelector({
  defaultClientId,
  defaultClientName,
  defaultServiceId,
  defaultWidgetId,
  lockClient = false,
  onChange,
  className,
}: CascadeSelectorProps) {
  // Selection state
  const [clientId, setClientId] = useState<string | null>(
    defaultClientId ?? null,
  );
  const [clientName, setClientName] = useState<string | null>(
    defaultClientName ?? null,
  );
  const [serviceId, setServiceId] = useState<string | null>(
    defaultServiceId ?? null,
  );
  const [widgetId, setWidgetId] = useState<string | null>(
    defaultWidgetId ?? null,
  );

  // Options state
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [widgets, setWidgets] = useState<WidgetOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingWidgets, setLoadingWidgets] = useState(false);

  // Notify parent of changes
  const emitChange = useCallback(
    (cId: string | null, cName: string | null, sId: string | null, wId: string | null) => {
      onChange({ clientId: cId, clientName: cName, serviceId: sId, widgetId: wId });
    },
    [onChange],
  );

  // ---------------------------------------------------------------------------
  // Load client options when not locked
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (lockClient) return;

    let cancelled = false;
    setLoadingClients(true);

    getActiveClients()
      .then((data) => {
        if (!cancelled) setClients(data);
      })
      .catch((err) => {
        console.error("[CascadeSelector] Failed to load clients:", err);
        if (!cancelled) setClients([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingClients(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lockClient]);

  // ---------------------------------------------------------------------------
  // Load services when clientId changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!clientId) {
      setServices([]);
      setServiceId(null);
      setWidgets([]);
      setWidgetId(null);
      return;
    }

    let cancelled = false;
    setLoadingServices(true);

    getServicesByClient(clientId)
      .then((data) => {
        if (!cancelled) {
          setServices(data);
          setServiceId(null);
          setWidgets([]);
          setWidgetId(null);
        }
      })
      .catch((err) => {
        console.error("[CascadeSelector] Failed to load services:", err);
        if (!cancelled) setServices([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingServices(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // ---------------------------------------------------------------------------
  // Load widgets when serviceId changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!serviceId) {
      setWidgets([]);
      setWidgetId(null);
      return;
    }

    let cancelled = false;
    setLoadingWidgets(true);

    getWidgetsByService(serviceId)
      .then((data) => {
        if (!cancelled) {
          setWidgets(data);
          setWidgetId(null);
        }
      })
      .catch((err) => {
        console.error("[CascadeSelector] Failed to load widgets:", err);
        if (!cancelled) setWidgets([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingWidgets(false);
      });

    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  // ---------------------------------------------------------------------------
  // Combobox option adapters
  // ---------------------------------------------------------------------------

  const clientOptions: ComboboxOption[] = useMemo(
    () => clients.map((c) => ({ id: c.client_id, name: c.client_name })),
    [clients],
  );

  const serviceOptions: ComboboxOption[] = useMemo(
    () => services.map((s) => ({ id: s.service_id, name: s.service_name })),
    [services],
  );

  const widgetOptions: ComboboxOption[] = useMemo(
    () => widgets.map((w) => ({ id: w.widget_id, name: w.widget_name ?? w.widget_id })),
    [widgets],
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleClientChange(newClientId: string | null) {
    const cId = newClientId || null;
    const cName = cId ? (clients.find((c) => c.client_id === cId)?.client_name ?? null) : null;
    setClientId(cId);
    setClientName(cName);
    setServiceId(null);
    setWidgetId(null);
    emitChange(cId, cName, null, null);
  }

  function handleServiceChange(newServiceId: string | null) {
    const sId = newServiceId || null;
    setServiceId(sId);
    setWidgetId(null);
    emitChange(clientId, clientName, sId, null);
  }

  function handleWidgetChange(newWidgetId: string | null) {
    const wId = newWidgetId || null;
    setWidgetId(wId);
    emitChange(clientId, clientName, serviceId, wId);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={cn("space-y-5", className)}>
      {/* Client */}
      <div>
        <label className={labelClass}>
          Client <span className="text-red-500">*</span>
        </label>
        {lockClient ? (
          <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-[12px] text-gray-600">
            <span className="font-mono text-gray-400 mr-1">{clientId}.</span>
            {clientName ?? ""}
          </div>
        ) : (
          <Combobox
            options={clientOptions}
            value={clientId}
            onChange={handleClientChange}
            placeholder="Client 검색..."
            allLabel="선택해주세요"
            loading={loadingClients}
          />
        )}
      </div>

      {/* Service */}
      <div>
        <label className={labelClass}>Service</label>
        <Combobox
          options={serviceOptions}
          value={serviceId}
          onChange={handleServiceChange}
          placeholder="Service 검색..."
          allLabel="선택 안 함"
          loading={loadingServices}
          disabled={!clientId}
        />
      </div>

      {/* Widget */}
      <div>
        <label className={labelClass}>Widget</label>
        <Combobox
          options={widgetOptions}
          value={widgetId}
          onChange={handleWidgetChange}
          placeholder="Widget 검색..."
          allLabel={!serviceId ? "Service를 먼저 선택하세요" : "선택 안 함"}
          loading={loadingWidgets}
          disabled={!serviceId}
        />
      </div>
    </div>
  );
}
