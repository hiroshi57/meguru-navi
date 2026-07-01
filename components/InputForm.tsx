"use client";

import { useState } from "react";
import { BUDGETS, DURATION_OPTIONS, MOODS, PARTY_SIZE_OPTIONS, TRANSPORTS } from "@/lib/moods";
import { SearchParams } from "@/lib/types";

const DEFAULT_PARAMS: SearchParams = {
  mood: "mattari",
  budget: "under5000",
  areaLabel: "渋谷駅周辺",
  transport: "walk",
  durationMinutes: 120,
  partySize: 2,
};

export function InputForm({ onSubmit }: { onSubmit: (params: SearchParams) => void | Promise<void> }) {
  const [params, setParams] = useState<SearchParams>(DEFAULT_PARAMS);

  return (
    <form
      className="flex flex-col gap-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(params);
      }}
    >
      <div>
        <label className="mb-2 block text-sm font-medium text-black/70">今の気分</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MOODS.map((mood) => (
            <button
              type="button"
              key={mood.id}
              onClick={() => setParams((p) => ({ ...p, mood: mood.id }))}
              className={`rounded-xl border px-3 py-3 text-sm transition ${
                params.mood === mood.id
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                  : "border-black/10 hover:border-black/30"
              }`}
            >
              <div className="text-lg">{mood.emoji}</div>
              <div className="mt-1 font-medium">{mood.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-black/70">予算感</label>
          <select
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            value={params.budget}
            onChange={(e) => setParams((p) => ({ ...p, budget: e.target.value as SearchParams["budget"] }))}
          >
            {BUDGETS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-black/70">移動手段</label>
          <select
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            value={params.transport}
            onChange={(e) => setParams((p) => ({ ...p, transport: e.target.value as SearchParams["transport"] }))}
          >
            {TRANSPORTS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-black/70">移動時間</label>
          <select
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            value={params.durationMinutes}
            onChange={(e) => setParams((p) => ({ ...p, durationMinutes: Number(e.target.value) }))}
          >
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes >= 60 ? `${minutes / 60}時間` : `${minutes}分`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-black/70">人数</label>
          <select
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            value={params.partySize}
            onChange={(e) => setParams((p) => ({ ...p, partySize: Number(e.target.value) }))}
          >
            {PARTY_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}人
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-black/70">行動範囲（起点）</label>
        <input
          type="text"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          placeholder="例: 渋谷駅、目黒区、現在地"
          value={params.areaLabel}
          onChange={(e) => setParams((p) => ({ ...p, areaLabel: e.target.value }))}
        />
        <p className="mt-1 text-xs text-black/40">
          MVPでは東京23区内のサンプルデータのみ対応しています。
        </p>
      </div>

      <button
        type="submit"
        className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        周回コースを探す
      </button>
    </form>
  );
}
