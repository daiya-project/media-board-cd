"use client";

import { useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ExternalValueRow, UnitPriceValue } from "@/types/external";
import { PASSBACK_VENDORS } from "@/lib/logic/external-fc-vendors";

interface Props {
  widgetId: string;
  rows: ExternalValueRow[];
}

const FIELDS = [
  { key: "internal" as const, label: "데이블 매체사 CPM (S)" },
  ...PASSBACK_VENDORS.map((v) => ({
    key: v.slug as keyof UnitPriceValue,
    label: `${v.label} CPM (T)`,
  })),
  { key: "fc" as const, label: "FC 금액" },
];

export default function UnitPriceEditor({ widgetId, rows }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{
    start_date: string;
    value: UnitPriceValue;
  }>({
    start_date: new Date().toISOString().slice(0, 10),
    value: {},
  });
  const [busy, setBusy] = useState(false);

  async function submitNew() {
    setBusy(true);
    try {
      const res = await fetch("/api/fc/value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widget_id: widgetId,
          value: draft.value,
          start_date: draft.start_date,
        }),
      });
      if (!res.ok) {
        alert(`저장 실패: ${res.status}`);
      } else {
        setCreating(false);
        setDraft({
          start_date: new Date().toISOString().slice(0, 10),
          value: {},
        });
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/fc/value?id=${id}`, { method: "DELETE" });
      if (!res.ok) alert(`삭제 실패: ${res.status}`);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{widgetId} 이력</h3>
        <button
          onClick={() => setCreating((v) => !v)}
          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          새 기간 추가
        </button>
      </div>

      {creating && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium w-24">Start Date</span>
            <input
              type="date"
              value={draft.start_date}
              onChange={(e) =>
                setDraft((d) => ({ ...d, start_date: e.target.value }))
              }
              className="h-8 px-2 text-xs border border-slate-200 rounded"
            />
          </div>
          {FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <span className="text-xs font-medium w-40">{f.label}</span>
              <input
                type="number"
                placeholder="—"
                value={draft.value[f.key] ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    value: {
                      ...d.value,
                      [f.key]: e.target.value ? Number(e.target.value) : undefined,
                    },
                  }))
                }
                className="h-8 px-2 text-xs border border-slate-200 rounded flex-1 tabular-nums"
              />
              <span className="text-[10px] text-slate-400">원</span>
            </div>
          ))}
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={() => setCreating(false)}
              className="h-7 px-3 text-xs text-slate-500"
              disabled={busy}
            >
              취소
            </button>
            <button
              onClick={submitNew}
              disabled={busy}
              className="h-7 px-3 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 disabled:opacity-60"
            >
              <Save className="w-3 h-3" />
              저장
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="p-2 text-left font-medium">Start</th>
            <th className="p-2 text-left font-medium">End</th>
            {FIELDS.map((f) => (
              <th key={f.key} className="p-2 text-right font-medium">
                {f.label}
              </th>
            ))}
            <th className="p-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={FIELDS.length + 3} className="p-6 text-center text-slate-400">
                이력이 없습니다
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-2 font-mono">{r.start_date}</td>
                <td className="p-2 font-mono text-slate-400">
                  {r.end_date ?? "(active)"}
                </td>
                {FIELDS.map((f) => (
                  <td key={f.key} className="p-2 text-right tabular-nums">
                    {r.value[f.key] != null ? `₩${r.value[f.key]}` : "—"}
                  </td>
                ))}
                <td className="p-2">
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={busy}
                    className="p-1 rounded hover:bg-red-50 text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
