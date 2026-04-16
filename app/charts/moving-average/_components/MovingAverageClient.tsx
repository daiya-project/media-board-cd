"use client";

import type { MaChartQuickPayload } from "@/lib/api/maChartService";
import MaChartSection from "./MaChartSection";

interface MovingAverageClientProps {
  quickPayload: MaChartQuickPayload;
}

/**
 * Root client component for the Moving Average chart page.
 * Passes quick payload to MaChartSection.
 */
export default function MovingAverageClient({
  quickPayload,
}: MovingAverageClientProps) {
  return (
    <div className="flex flex-col gap-6 px-6 pb-8 pt-2">
      <MaChartSection quickPayload={quickPayload} />
    </div>
  );
}
