/**
 * Goal Setting page (Server Component).
 *
 * Displays a 12-month × (3 + N managers) editable table for setting
 * team and individual manager vIMP goals.
 *
 * force-dynamic: required because Supabase SSR client reads cookies.
 */

import { Suspense } from "react";
import {
  getTeamGoalsForYear,
  getManagerGoalsForYear,
} from "@/lib/api/goalSettingService";
import { getAllManagers } from "@/lib/api/managerService";
import { getLatestDataDate } from "@/lib/api/dateService";
import { TableSkeleton } from "@/components/common/PageSkeleton";
import { ErrorFallback } from "@/components/common/ErrorFallback";
import GoalSettingTable from "./_components/GoalSettingTable";

export const dynamic = "force-dynamic";

export default async function GoalSettingPage() {
  const latestDate = await getLatestDataDate();
  const year = latestDate
    ? Number(latestDate.split("-")[0])
    : new Date().getFullYear();

  const result = await Promise.all([
    getTeamGoalsForYear(year),
    getManagerGoalsForYear(year),
    getAllManagers(),
  ]).catch((err: unknown) => {
    console.error("[GoalSettingPage] data fetch error:", err);
    return null;
  });

  if (!result) {
    return (
      <ErrorFallback className="flex-col h-full max-w-[1920px] mx-auto" />
    );
  }

  const [teamGoals, managerGoals, managers] = result;

  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto">
      <Suspense fallback={<TableSkeleton cols={8} rows={12} />}>
        <GoalSettingTable
          year={year}
          teamGoals={teamGoals}
          managerGoals={managerGoals}
          managers={managers}
        />
      </Suspense>
    </div>
  );
}
