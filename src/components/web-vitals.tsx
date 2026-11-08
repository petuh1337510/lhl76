"use client";
import { useReportWebVitals } from "next/web-vitals";
import { useEffect } from "react";
import { telemetryRoute, vitalNames } from "@/lib/telemetry-policy";

function report(metric: {name: string; value: number}) {
  if (!(vitalNames as readonly string[]).includes(metric.name) && metric.name !== "ERROR") return;
  const body = JSON.stringify({metric: metric.name, value: metric.value, route: telemetryRoute(location.pathname)});
  if (navigator.sendBeacon) navigator.sendBeacon("/api/telemetry", new Blob([body], {type: "application/json"}));
}
export function WebVitals() {
  useReportWebVitals(report);
  useEffect(() => {
    let reported = 0;
    const error = () => { if (reported++ < 3) report({name: "ERROR", value: 1}); };
    window.addEventListener("error", error);
    window.addEventListener("unhandledrejection", error);
    return () => { window.removeEventListener("error", error); window.removeEventListener("unhandledrejection", error); };
  }, []);
  return null;
}
