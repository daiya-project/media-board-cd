/**
 * AddClientModal — pure async submit handlers.
 *
 * Each handler validates, calls APIs, and returns a result.
 * The calling hook is responsible for UI state transitions (setSubmitting, toast, etc.).
 */

import {
  checkClientExists,
  checkServiceExists,
  checkWidgetExists,
  registerClient,
  registerService,
  registerWidget,
  createWidgetContract,
  updateClient,
  renameClientId,
} from "@/lib/api/registrationService";
import { createAction } from "@/lib/api/actionService";
import type { ActionStage } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubmitResult {
  ok: boolean;
  error?: string;
  /** If widget contract failed but widget itself was created */
  contractWarning?: boolean;
}

import { getTodayString } from "@/lib/utils/date-utils";

// ---------------------------------------------------------------------------
// Client: new
// ---------------------------------------------------------------------------

export interface ClientNewParams {
  clientId: string;
  clientName: string;
  managerId: number;
  tier: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  stage: ActionStage;
  memo: string;
}

export async function submitClientNew(p: ClientNewParams): Promise<SubmitResult> {
  const exists = await checkClientExists(p.clientId);
  if (exists) {
    return { ok: false, error: `Client ID "${p.clientId}"는 이미 등록되어 있습니다.` };
  }

  await registerClient({
    client_id: p.clientId,
    client_name: p.clientName,
    manager_id: p.managerId,
    tier: p.tier || null,
    contact_name: p.contactName || null,
    contact_phone: p.contactPhone || null,
    contact_email: p.contactEmail || null,
  });

  const memoContent = p.memo
    ? [{ type: "paragraph", content: [{ type: "text", text: p.memo }] }]
    : null;

  await createAction({
    client_id: p.clientId,
    action_date: getTodayString(),
    stage: p.stage,
    memo: memoContent,
    has_followup: false,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Client: edit
// ---------------------------------------------------------------------------

export interface ClientEditParams {
  clientId: string;
  /** Original client_id before editing (used to detect rename) */
  originalClientId: string;
  managerId: number;
  tier: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

export async function submitClientEdit(p: ClientEditParams): Promise<SubmitResult> {
  const newClientId = p.clientId.trim();
  const oldClientId = p.originalClientId;
  const isRenamed = newClientId !== oldClientId;

  // If client_id changed, rename first (cascades to all child tables)
  if (isRenamed) {
    if (!newClientId) {
      return { ok: false, error: "Client ID는 비어있을 수 없습니다." };
    }

    const exists = await checkClientExists(newClientId);
    if (exists) {
      return { ok: false, error: `Client ID "${newClientId}"는 이미 등록되어 있습니다.` };
    }

    await renameClientId(oldClientId, newClientId);
  }

  // Update other fields using the (possibly new) client_id
  await updateClient({
    client_id: newClientId,
    manager_id: p.managerId,
    tier: p.tier || null,
    contact_name: p.contactName || null,
    contact_phone: p.contactPhone || null,
    contact_email: p.contactEmail || null,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface ServiceParams {
  clientId: string;
  serviceId: string;
  serviceName: string;
}

export async function submitService(p: ServiceParams): Promise<SubmitResult> {
  const exists = await checkServiceExists(p.serviceId);
  if (exists) {
    return { ok: false, error: `Service ID "${p.serviceId}"는 이미 등록되어 있습니다.` };
  }

  await registerService({
    service_id: p.serviceId,
    client_id: p.clientId,
    service_name: p.serviceName,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

export interface WidgetParams {
  clientId: string;
  serviceId: string;
  widgetId: string;
  widgetName: string;
  contractStart: string;
  contractEnd: string;
  contractType: string;
  contractValue: string;
}

export async function submitWidget(p: WidgetParams): Promise<SubmitResult> {
  const exists = await checkWidgetExists(p.widgetId);
  if (exists) {
    return { ok: false, error: `Widget ID "${p.widgetId}"는 이미 등록되어 있습니다.` };
  }

  await registerWidget({
    widget_id: p.widgetId,
    client_id: p.clientId,
    service_id: p.serviceId,
    widget_name: p.widgetName,
  });

  let contractWarning = false;
  try {
    await createWidgetContract({
      client_id: p.clientId,
      service_id: p.serviceId,
      widget_id: p.widgetId,
      contract_type: p.contractType,
      contract_value: p.contractValue ? Number(p.contractValue) : null,
      date_start: p.contractStart || null,
      date_end: p.contractEnd || null,
    });
  } catch {
    contractWarning = true;
  }

  return { ok: true, contractWarning };
}
