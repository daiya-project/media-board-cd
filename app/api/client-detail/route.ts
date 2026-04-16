/**
 * API Route: Get client detail
 * 
 * Fetches full client detail with services, widgets, and contracts.
 * Called from ClientOverviewSheet modal.
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientDetailFull } from "@/lib/api/clientDetailService";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    const data = await getClientDetailFull(clientId);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[API /api/client-detail] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch client detail" },
      { status: 500 }
    );
  }
}
