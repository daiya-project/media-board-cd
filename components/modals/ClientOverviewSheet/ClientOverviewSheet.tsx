"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Pencil, X, Package } from "lucide-react";
import { useModalStore } from "@/stores/useModalStore";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { ClientDetailFull } from "@/types/app-db.types";
import { getTierBadgeClass } from "@/lib/utils/table-display-utils";
import { ErrorFallback } from "@/components/common/ErrorFallback";
import { ServiceCard } from "./ServiceCard";

/**
 * Client overview sheet modal.
 * Displays full client detail with services, widgets, and contracts.
 * Triggered by clicking client name in MGMT table.
 */
export default function ClientOverviewSheet() {
  const { openModal, payload, close, open } = useModalStore();
  const [data, setData] = useState<ClientDetailFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  const isOpen = openModal === "clientOverview";
  const clientId = payload.clientId as string | undefined;

  /**
   * Opens AddClientModal in edit mode with pre-filled client info.
   */
  function handleEditClient() {
    if (!data) return;
    open("newPipeline", {
      mode: "edit",
      clientId: data.client_id,
      clientName: data.client_name,
      managerId: data.manager_id,
      tier: data.tier,
      contactName: data.contact_name,
      contactPhone: data.contact_phone,
      contactEmail: data.contact_email,
    });
  }

  /**
   * Opens AddClientModal in add mode for adding service/widget.
   */
  function handleAddServiceWidget() {
    if (!data) return;
    open("newPipeline", {
      mode: "add",
      clientId: data.client_id,
      clientName: data.client_name,
    });
  }

  /**
   * Fetches client detail data from the API.
   */
  async function loadData() {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/client-detail?clientId=${encodeURIComponent(clientId)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result: ClientDetailFull = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load client detail");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isOpen || !clientId) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      if (!clientId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/client-detail?clientId=${encodeURIComponent(clientId)}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result: ClientDetailFull = await response.json();

        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load client detail");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, clientId]);

  const filteredServices = data?.services.filter((s) =>
    showActiveOnly ? s.activeWidgetCount > 0 : true,
  );

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        className="overflow-y-auto p-0"
        style={{ width: '800px', maxWidth: '800px' }}
        showCloseButton={false}
      >
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {error && (
          <ErrorFallback
            className="h-full"
            message="데이터를 불러올 수 없습니다"
            detail={error}
          />
        )}

        {!loading && !error && data && (
          <>
            {/* Header Section - Single Line */}
            <div className="px-6 py-4 bg-white border-b border-border">
              <div className="flex items-center justify-between gap-4">
                {/* Left: Title and Stats */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Tier Badge */}
                  {data.tier && (
                    <span className={getTierBadgeClass(data.tier)}>
                      {data.tier}
                    </span>
                  )}

                  {/* Client Name */}
                  <h2 className="text-base font-bold text-gray-900 truncate">
                    {data.client_id}. {data.client_name}
                  </h2>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-gray-600">
                    <span>
                      Service: <strong className="text-blue-600">{data.totalServices}</strong>
                    </span>
                    <span>
                      Widget: <strong className="text-gray-700">{data.totalWidgets}</strong>
                    </span>
                    <span>
                      Activate: <strong className="text-green-600">{data.activeWidgets}</strong>
                    </span>
                  </div>

                  {/* Filter Toggle */}
                  <label className="inline-flex items-center gap-1.5 cursor-pointer ml-2">
                    <input
                      type="checkbox"
                      checked={showActiveOnly}
                      onChange={(e) => setShowActiveOnly(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-600 whitespace-nowrap">
                      Only Activate
                    </span>
                  </label>

                  {/* Manager Badge */}
                  {data.manager_name && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-50 text-violet-700 border border-violet-200 whitespace-nowrap">
                      {data.manager_name}
                    </span>
                  )}
                </div>

                {/* Right: Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Add service/widget */}
                  <button
                    type="button"
                    onClick={handleAddServiceWidget}
                    className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    aria-label="서비스/위젯 추가"
                    title="서비스/위젯 추가"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  {/* Edit client info */}
                  <button
                    type="button"
                    onClick={handleEditClient}
                    className="p-1.5 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    aria-label="매체 정보 수정"
                    title="매체 정보 수정"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {/* Close */}
                  <button
                    type="button"
                    onClick={() => close()}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    aria-label="닫기"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div className="bg-gray-50">
              {!filteredServices || filteredServices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Package className="w-12 h-12 mb-4 text-gray-300" />
                  <p className="text-base font-medium text-gray-600">
                    {showActiveOnly ? "활성 위젯이 없습니다" : "등록된 서비스가 없습니다"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {showActiveOnly ? "최근 30일간 데이터가 없습니다" : "새로운 서비스를 등록해주세요"}
                  </p>
                </div>
              ) : (
                <>
                  {/* Sticky Table Header - Only Once */}
                  <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
                    <div className="px-6 py-3">
                      <div className="flex items-center">
                        <div className="w-[120px] px-4 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                          Widget ID
                        </div>
                        <div className="flex-1 px-4 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                          Widget Name
                        </div>
                        <div className="w-[100px] px-4 text-center text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                          Type
                        </div>
                        <div className="w-[110px] px-4 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                          GRT Value
                        </div>
                        <div className="w-[180px] px-4 text-center text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                          Period
                        </div>
                        <div className="w-[80px] px-4 text-center text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                          Activate
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Service Cards */}
                  <div className="px-6 py-4 space-y-3">
                    {filteredServices.map((service) => (
                      <ServiceCard
                        key={service.service_id}
                        service={service}
                        clientId={data.client_id}
                        showActiveOnly={showActiveOnly}
                        onRefresh={loadData}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
