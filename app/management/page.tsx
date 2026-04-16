/**
 * Management page (MGMT section) — Server Component.
 *
 * Reads filter values from URL search params, fetches aggregated
 * client + action data from the media schema, and passes the result
 * to the client-side MgmtTable for column sorting.
 *
 * No <Suspense> wrapper needed here — data is fully awaited before render,
 * and adding Suspense around a synchronous Client Component can inject
 * React streaming markers that cause hydration mismatches.
 */

export const dynamic = "force-dynamic";

import { getMgmtTableData } from "@/lib/api/mgmtService";
import { ErrorFallback } from "@/components/common/ErrorFallback";
import MgmtTable from "./_components/MgmtTable";
import ClientOverviewSheet from "@/components/modals/ClientOverviewSheet";

interface SearchParams {
  search?: string;
  tier?: string;
  owner?: string;
  stage?: string;
  followup?: string;
  contactStatus?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function ManagementPage({ searchParams }: Props) {
  const params = await searchParams;

  const rows = await getMgmtTableData({
    search: params.search,
    tier: params.tier,
    owner: params.owner,
    stage: params.stage,
    followup: params.followup === "1",
    contactStatus: params.contactStatus,
  }).catch((err: unknown) => {
    console.error("[ManagementPage] getMgmtTableData error:", err);
    return null;
  });

  if (!rows) {
    return (
      <ErrorFallback className="flex-col h-full max-w-[1920px] mx-auto font-pretendard" />
    );
  }

  return (
    <div className="flex flex-col h-full max-w-[1920px] mx-auto font-pretendard">
      <MgmtTable initialData={rows} />
      <ClientOverviewSheet />
    </div>
  );
}
