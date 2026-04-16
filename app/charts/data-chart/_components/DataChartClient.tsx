"use client";

import type { MaChartQuickPayload } from "@/lib/api/maChartService";
import DataChartSection from "./DataChartSection";

interface DataChartClientProps {
  quickPayload: MaChartQuickPayload;
}

/**
 * Root client component for the Data Chart page.
 * Passes quick payload to DataChartSection.
 */
export default function DataChartClient({
  quickPayload,
}: DataChartClientProps) {
  return (
    <div className="flex flex-col gap-6 px-6 pb-8 pt-2">
      <DataChartSection quickPayload={quickPayload} />
    </div>
  );
}
