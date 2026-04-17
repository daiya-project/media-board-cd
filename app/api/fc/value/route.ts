import { NextRequest, NextResponse } from "next/server";
import { createMediaClient } from "@/lib/supabase/media-server";
import type { UnitPriceValue } from "@/types/external";

interface CreateBody {
  widget_id: string;
  value: UnitPriceValue;
  start_date: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateBody;
  if (!body.widget_id || !body.value || !body.start_date) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const supabase = await createMediaClient();
  const { error } = await supabase
    .from("external_value")
    .insert({
      widget_id: body.widget_id,
      value: body.value,
      start_date: body.start_date,
      end_date: null,
    });
  if (error) {
    console.error("[/api/fc/value] insert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = await createMediaClient();
  const { error } = await supabase
    .from("external_value")
    .delete()
    .eq("id", Number(id));
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
