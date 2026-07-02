"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef } from "react";
import { Course } from "@/lib/types";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

let optionsInitialized = false;

function loadMapLibraries() {
  if (!optionsInitialized) {
    setOptions({ key: API_KEY ?? "", v: "weekly" });
    optionsInitialized = true;
  }
  return Promise.all([importLibrary("maps"), importLibrary("marker")]);
}

export function CourseMap({ course }: { course: Course }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!API_KEY || !containerRef.current) return;
    let cancelled = false;

    loadMapLibraries().then(([{ Map }, { Marker }]) => {
      if (cancelled || !containerRef.current) return;

      const map = new Map(containerRef.current, {
        center: course.origin,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
      });

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(course.origin);

      new Marker({
        position: course.origin,
        map,
        label: "S",
        title: "出発地点",
      });

      course.stops.forEach((stop, index) => {
        const position = { lat: stop.spot.lat, lng: stop.spot.lng };
        bounds.extend(position);
        new Marker({
          position,
          map,
          label: String(index + 1),
          title: stop.spot.name,
        });
      });

      new google.maps.Polyline({
        path: [course.origin, ...course.stops.map((s) => ({ lat: s.spot.lat, lng: s.spot.lng }))],
        map,
        strokeColor: "#059669",
        strokeWeight: 3,
      });

      map.fitBounds(bounds, 48);
    });

    return () => {
      cancelled = true;
    };
  }, [course]);

  if (!API_KEY) {
    return (
      <div className="rounded-2xl border border-dashed border-black/20 bg-black/[0.02] p-6">
        <p className="text-sm font-medium text-black/60">
          🗺️ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY が未設定のため地図を表示できません
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className="h-72 w-full rounded-2xl border border-black/10" />;
}
