/**
 * Pipeline page — CRM-style activity dashboard.
 *
 * Left: Contact-due clients (overdue / urgent / upcoming)
 * Right: Recent Activities feed
 *
 * Phase 2 (await): getContactDueClients(), getRecentActivities()
 */

import { Suspense } from "react";
import { getRecentActivities, getContactDueClients } from "@/lib/api/pipelineService";
import { getLatestDataDate } from "@/lib/api/dateService";
import {
  PageSkeleton,
  ChartSkeleton,
} from "@/components/common/PageSkeleton";
import ContactDueList from "./_components/ContactDueList";
import RecentActivities from "./_components/RecentActivities";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PipelineSkeleton() {
  return (
    <PageSkeleton>
      <div className="flex gap-6 flex-1">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </PageSkeleton>
  );
}

// ---------------------------------------------------------------------------
// Inner async component
// ---------------------------------------------------------------------------

async function PipelineContent() {
  const latestDate = await getLatestDataDate();
  const todayDate = latestDate ?? "";

  const [dueClients, activities] = await Promise.all([
    getContactDueClients(todayDate),
    getRecentActivities(100),
  ]);

  return (
    <div className="flex-1 min-h-0 p-6">
      <div className="flex gap-6 h-full">
        {/* Left: Contact-due clients */}
        <div className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <ContactDueList clients={dueClients} />
        </div>

        {/* Right: Recent Activities */}
        <div className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <RecentActivities activities={activities} todayDate={todayDate} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PipelinePage() {
  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <Suspense fallback={<PipelineSkeleton />}>
        <PipelineContent />
      </Suspense>
    </div>
  );
}
