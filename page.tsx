"use client";

import { useState } from "react";
import { CourseCard } from "@/components/CourseCard";
import { CourseMap } from "@/components/CourseMap";
import { InputForm } from "@/components/InputForm";
import { buildCourses } from "@/lib/course-builder";
import { Course, SearchParams } from "@/lib/types";

type Status = "idle" | "loading" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [lastParams, setLastParams] = useState<SearchParams | null>(null);

  const handleSubmit = async (params: SearchParams) => {
    setLastParams(params);
    setStatus("loading");
    setErrorMessage(null);
    setCourses(null);

    try {
      const result = await buildCourses(params);
      setCourses(result);
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "コース生成に失敗しました");
      setStatus("error");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
      <header className="text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">MeguruNavi（メグルナビ）</h1>
        <p className="mt-2 text-sm text-black/60">
          今の気分・予算・移動手段・時間を入れるだけで、時間内に周れる散策コースを提案します。
        </p>
        <p className="mt-1 text-xs text-amber-600">
          ※ MVP版です（東京23区の一部エリアのみ対応・Google Placesのデータをそのまま利用しています）
        </p>
      </header>

      <InputForm onSubmit={handleSubmit} />

      {status === "loading" && (
        <p className="text-center text-sm text-black/50">コースを検索しています…</p>
      )}

      {status === "error" && (
        <p className="text-center text-sm text-red-600">{errorMessage}</p>
      )}

      {status === "idle" && courses && courses.length === 0 && (
        <p className="text-center text-sm text-black/50">
          条件に合うコースが見つかりませんでした。移動時間や予算を変えて試してください。
        </p>
      )}

      {status === "idle" && courses && courses.length > 0 && (
        <div className="flex flex-col gap-6">
          <h2 className="text-lg font-semibold">
            {lastParams?.areaLabel} を起点にした提案コース
          </h2>
          {courses.map((course) => (
            <div key={course.id} className="flex flex-col gap-3">
              <CourseCard course={course} />
              <CourseMap course={course} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
