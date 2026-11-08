import { registerOTel, type Configuration } from "@vercel/otel";
import { telemetryRoute } from "./telemetry-policy";
import { writeTelemetry } from "./telemetry-store";

export function registerTelemetry() {
  const exporter: Exclude<Configuration["traceExporter"], string | undefined> = {
    export(spans, done) {
      const records = spans.filter(span => !["/api/ready", "/api/health", "/api/telemetry"].includes(String(span.attributes["http.route"] ?? span.attributes["next.route"] ?? ""))).map(span => {
        // Never export raw span names/attributes: these can contain URLs, SQL,
        // credentials, exception messages, headers or identifiers.
        const route = telemetryRoute(String(span.attributes["http.route"] ?? span.attributes["next.route"] ?? "/other"));
        const name = /^db\.[A-Za-z]+\.[A-Za-z]+$/.test(span.name) ? span.name : span.name.startsWith("fetch") || span.name.startsWith("HTTP") ? "HTTP external" : "request";
        return {kind: "trace" as const, route, name, duration: Math.round((span.duration[0] * 1000 + span.duration[1] / 1e6) * 100) / 100, traceId: span.spanContext().traceId, spanId: span.spanContext().spanId, parentId: span.parentSpanContext?.spanId, failed: span.status.code === 2};
      });
      void writeTelemetry(records).then(() => done({code: 0}), () => done({code: 1}));
    },
    async shutdown() {},
    async forceFlush() {},
  };
  registerOTel({serviceName: process.env.OTEL_SERVICE_NAME || "lhl76", traceExporter: exporter, propagators: ["none"], autoDetectResources: false, resourceDetectors: [], traceSampler: "auto", spanLimits: {attributeCountLimit: 16, eventCountLimit: 0}});
}
