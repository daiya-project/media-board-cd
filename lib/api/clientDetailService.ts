/**
 * Client detail data-fetching service.
 *
 * Reads from the `media` schema:
 *   - media.client          — client master data
 *   - media.service         — services owned by the client
 *   - media.widget          — widgets under client's services
 *   - media.widget_contract — widget contract terms
 *   - media.daily           — daily data (to determine active widgets)
 *
 * Pure data-fetching only; aggregation logic lives here
 * as it is tightly coupled to the query strategy.
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import { getAllManagers, buildManagerMap } from "@/lib/api/managerService";
import { getLatestDataDate } from "@/lib/api/dateService";
import { addDays } from "@/lib/utils/date-utils";
import type {
  ClientDetailFull,
  ServiceWithWidgets,
  WidgetContractRow,
  WidgetWithContract,
} from "@/types/app-db.types";

/**
 * Fetches full client detail with services, widgets, contracts, and active status.
 *
 * @param clientId - Client identifier (TEXT)
 * @returns Aggregated client detail with nested services and widgets
 * @throws Supabase/network error if any query fails
 */
export async function getClientDetailFull(
  clientId: string,
): Promise<ClientDetailFull> {
  const supabase = await createMediaClient();

  // ---------------------------------------------------------------------------
  // 1. First batch: client, services, widgets, manager
  // ---------------------------------------------------------------------------
  const [clientResult, servicesResult, widgetsResult, managersRaw] = await Promise.all([
    // Client master data
    supabase
      .from("client")
      .select("client_id, client_name, tier, manager_id, contact_name, contact_phone, contact_email")
      .eq("client_id", clientId)
      .single(),

    // Services owned by this client
    supabase
      .from("service")
      .select("service_id, service_name")
      .eq("client_id", clientId)
      .order("service_id", { ascending: true }),

    // Widgets under this client
    supabase
      .from("widget")
      .select("widget_id, widget_name, service_id")
      .eq("client_id", clientId)
      .order("widget_id", { ascending: true }),

    // Manager names (for header display)
    getAllManagers(),
  ]);

  // ---------------------------------------------------------------------------
  // 2. Error handling
  // ---------------------------------------------------------------------------
  if (clientResult.error) throw clientResult.error;
  if (!clientResult.data) throw new Error(`Client not found: ${clientId}`);
  if (servicesResult.error) throw servicesResult.error;
  if (widgetsResult.error) throw widgetsResult.error;

  const client = clientResult.data;
  const services = servicesResult.data ?? [];
  const widgets = widgetsResult.data ?? [];
  const managerMap = buildManagerMap(managersRaw);

  if (widgets.length === 0) {
    return {
      client_id: client.client_id,
      client_name: client.client_name,
      tier: client.tier,
      manager_id: client.manager_id,
      manager_name: client.manager_id ? (managerMap.get(client.manager_id) ?? null) : null,
      contact_name: client.contact_name,
      contact_phone: client.contact_phone,
      contact_email: client.contact_email,
      services: [],
      totalServices: services.length,
      totalWidgets: 0,
      activeWidgets: 0,
    };
  }

  const widgetIds = widgets.map((w: { widget_id: string }) => w.widget_id);

  // ---------------------------------------------------------------------------
  // 3. Second batch: contracts and active widgets (filtered by widget_id list)
  // ---------------------------------------------------------------------------
  // Use DB latest data date (not system clock) for "last 30 days" window
  const latestDate = await getLatestDataDate();
  const thirtyDaysAgo = latestDate ? addDays(latestDate, -30) : "1970-01-01";

  const [contractsResult, dailyResult] = await Promise.all([
    // Widget contracts for this client's widgets
    supabase
      .from("widget_contract")
      .select("id, widget_id, contract_type, contract_value, date_start, date_end")
      .in("widget_id", widgetIds)
      .order("widget_id", { ascending: true })
      .order("date_start", { ascending: false }),

    // Active widgets: widgets with daily data in last 30 days
    supabase
      .from("daily")
      .select("widget_id")
      .eq("client_id", clientId)
      .gte("date", thirtyDaysAgo),
  ]);

  if (contractsResult.error) throw contractsResult.error;
  if (dailyResult.error) throw dailyResult.error;

  const contracts = contractsResult.data ?? [];
  const dailyData = dailyResult.data ?? [];

  // ---------------------------------------------------------------------------
  // 4. Build active widget set (widgets with data in last 30 days)
  // ---------------------------------------------------------------------------
  const activeWidgetIds = new Set<string>(
    dailyData.map((d: { widget_id: string | null }) => d.widget_id).filter((id: string | null): id is string => id !== null),
  );

  // ---------------------------------------------------------------------------
  // 5. Build per-widget contract lists + determine active contract
  // ---------------------------------------------------------------------------
  type RawContract = {
    id: number;
    widget_id: string;
    contract_type: string | null;
    contract_value: number | null;
    date_start: string | null;
    date_end: string | null;
  };

  const today = latestDate ?? "9999-12-31";

  // Group all contracts by widget_id
  const contractsPerWidget = new Map<string, RawContract[]>();
  contracts.forEach((c: RawContract) => {
    const list = contractsPerWidget.get(c.widget_id) || [];
    list.push(c);
    contractsPerWidget.set(c.widget_id, list);
  });

  // Find currently active contract: date_start <= today AND (date_end IS NULL OR date_end >= today)
  function findActiveContract(list: RawContract[]): RawContract | undefined {
    const active = list.find(
      (c) =>
        c.date_start &&
        c.date_start <= today &&
        (!c.date_end || c.date_end >= today),
    );
    // Fallback to latest by date_start DESC (already sorted)
    return active || list[0];
  }

  // ---------------------------------------------------------------------------
  // 6. Group widgets by service (pre-index to avoid O(n×m) nested filter)
  // ---------------------------------------------------------------------------
  const widgetsByService = new Map<string, { widget_id: string; widget_name: string | null }[]>();
  for (const w of widgets) {
    const list = widgetsByService.get(w.service_id) ?? [];
    list.push(w);
    widgetsByService.set(w.service_id, list);
  }

  const serviceWithWidgets: ServiceWithWidgets[] = services.map(
    (service: { service_id: string; service_name: string }) => {
      const serviceWidgets = (widgetsByService.get(service.service_id) ?? [])
        .map((w: { widget_id: string; widget_name: string | null }): WidgetWithContract => {
          const widgetContracts = contractsPerWidget.get(w.widget_id) || [];
          const activeContract = findActiveContract(widgetContracts);
          const isActive = activeWidgetIds.has(w.widget_id);

          return {
            widget_id: w.widget_id,
            widget_name: w.widget_name,
            contract_type: activeContract?.contract_type ?? null,
            contract_value: activeContract?.contract_value ?? null,
            start_date: activeContract?.date_start ?? null,
            end_date: activeContract?.date_end ?? null,
            is_active: isActive,
            contracts: widgetContracts.map((c): WidgetContractRow => ({
              id: c.id,
              widget_id: c.widget_id,
              contract_type: c.contract_type,
              contract_value: c.contract_value,
              date_start: c.date_start,
              date_end: c.date_end,
            })),
          };
        });

      const activeCount = serviceWidgets.filter((w: WidgetWithContract) => w.is_active).length;

      return {
        service_id: service.service_id,
        service_name: service.service_name,
        widgets: serviceWidgets,
        activeWidgetCount: activeCount,
      };
    },
  );

  const totalActiveWidgets = serviceWithWidgets.reduce((sum, s) => sum + s.activeWidgetCount, 0);

  // ---------------------------------------------------------------------------
  // 7. Build final result
  // ---------------------------------------------------------------------------
  const result: ClientDetailFull = {
    client_id: client.client_id,
    client_name: client.client_name,
    tier: client.tier,
    manager_id: client.manager_id,
    manager_name: client.manager_id ? (managerMap.get(client.manager_id) ?? null) : null,
    contact_name: client.contact_name,
    contact_phone: client.contact_phone,
    contact_email: client.contact_email,
    services: serviceWithWidgets,
    totalServices: services.length,
    totalWidgets: widgets.length,
    activeWidgets: totalActiveWidgets,
  };

  return result;
}
