"use client";

import { useState } from "react";
import {
  AGE_BRACKETS,
  BUDGETS,
  CUISINES,
  DURATION_OPTIONS,
  INDOOR_OUTDOOR_OPTIONS,
  MEAL_TIMINGS,
  MOODS,
  PACES,
  PARTY_SIZE_OPTIONS,
  PURPOSES,
  SPECIAL_CONDITIONS,
  TRANSPORTS,
  VIBES,
} from "@/lib/moods";
import { SearchParams, SpecialCondition } from "@/lib/types";

const DEFAULT_PARAMS: SearchParams = {
  mood: "mattari",
  budget: "under5000",
  areaLabel: "渋谷駅周辺",
  transport: "walk",
  durationMinutes: 120,
  partySize: 2,
  ageBracket: "30s",
  purpose: "sightseeing",
  vibe: "calm",
  pace: "relaxed",
  mealTiming: "any",
  indoorOutdoor: "either",
  specialConditions: [],
  cuisine: "any",
};

export function InputForm({ onSubmit }: { onSubmit: (params: SearchParams) => void | Promise<void> }) {
  const [params, setParams] = useState<SearchParams>(DEFAULT_PARAMS);
  const [showDetails, setShowDetails] = useState(false);

  const toggleSpecialCondition = (condition: SpecialCondition) => {
    setParams((p) => ({
      ...p,
      specialConditions: p.specialConditions.includes(condition)
        ? p.specialConditions.filter((c) => c !== condition)
        : [...p.specialConditions, condition],
    }));
  };

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

        {params.mood === "gourmet" && (
          <div className="mt-3">
            <label className="mb-2 block text-sm font-medium text-black/70">料理ジャンル</label>
            <div className="flex flex-wrap gap-2">
              {CUISINES.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setParams((p) => ({ ...p, cuisine: c.id }))}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    params.cuisine === c.id
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-black/10 hover:border-black/30"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
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
          <label className="mb-2 block text-sm font-medium text-black/70">使える時間（滞在込み合計）</label>
          <select
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            value={params.durationMinutes}
            onChange={(e) => setParams((p) => ({ ...p, durationMinutes: Number(e.target.value) }))}
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d.minutes} value={d.minutes}>
                {d.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-black/40">移動時間＋各スポットの滞在時間を合わせた合計時間です</p>
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
          MVPでは東京23区内のみ対応しています。
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-black/70 hover:border-black/30"
      >
        詳しく指定する（年代・目的・雰囲気など）
        <span className="text-xs text-black/40">{showDetails ? "閉じる ▲" : "開く ▼"}</span>
      </button>

      {showDetails && (
        <div className="flex flex-col gap-4 rounded-xl border border-black/10 bg-black/[0.02] p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-black/70">年代</label>
              <select
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                value={params.ageBracket}
                onChange={(e) => setParams((p) => ({ ...p, ageBracket: e.target.value as SearchParams["ageBracket"] }))}
              >
                {AGE_BRACKETS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-black/70">目的</label>
              <select
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                value={params.purpose}
                onChange={(e) => setParams((p) => ({ ...p, purpose: e.target.value as SearchParams["purpose"] }))}
              >
                {PURPOSES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-black/40">
                {PURPOSES.find((p) => p.id === params.purpose)?.description}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-black/70">雰囲気の好み</label>
              <select
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                value={params.vibe}
                onChange={(e) => setParams((p) => ({ ...p, vibe: e.target.value as SearchParams["vibe"] }))}
              >
                {VIBES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-black/70">体力・移動ペース</label>
              <select
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                value={params.pace}
                onChange={(e) => setParams((p) => ({ ...p, pace: e.target.value as SearchParams["pace"] }))}
              >
                {PACES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-black/70">食事を挟むタイミング</label>
              <select
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                value={params.mealTiming}
                onChange={(e) => setParams((p) => ({ ...p, mealTiming: e.target.value as SearchParams["mealTiming"] }))}
              >
                {MEAL_TIMINGS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-black/70">屋内外の希望</label>
              <select
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                value={params.indoorOutdoor}
                onChange={(e) => setParams((p) => ({ ...p, indoorOutdoor: e.target.value as SearchParams["indoorOutdoor"] }))}
              >
                {INDOOR_OUTDOOR_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-black/70">こだわり条件（複数選択可）</label>
            <div className="flex flex-wrap gap-2">
              {SPECIAL_CONDITIONS.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleSpecialCondition(c.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    params.specialConditions.includes(c.id)
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-black/10 hover:border-black/30"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-black/40">
              ※ Google Places側の情報の限界により、これらの条件は検索の重み付けに使うベストエフォート対応です（完全な保証はできません）
            </p>
          </div>
        </div>
      )}

      <button
        type="submit"
        className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        周回コースを探す
      </button>
    </form>
  );
}
