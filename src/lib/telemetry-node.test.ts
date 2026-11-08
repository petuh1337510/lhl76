import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({register: vi.fn(), write: vi.fn().mockResolvedValue(undefined)}));
vi.mock("@vercel/otel", () => ({registerOTel: mocks.register}));
vi.mock("./telemetry-store", () => ({writeTelemetry: mocks.write}));
import { registerTelemetry } from "./telemetry-node";

it("exports durations and trace relationships without URL, SQL, headers or exceptions", async () => {
  registerTelemetry();
  const exporter = mocks.register.mock.calls[0][0].traceExporter;
  const span = {name:"fetch https://external.example/?token=secret", attributes:{"http.route":"/player/private-name", "db.statement":"SELECT private", "http.request.header.cookie":"secret"}, events:[{name:"private exception"}], duration:[0, 5000000], spanContext:()=>({traceId:"a",spanId:"b"}), parentSpanContext:{spanId:"c"}, status:{code:2}};
  await new Promise<void>(resolve => exporter.export([span, {...span, name:"db.Player.findMany"}], () => resolve()));
  const records = mocks.write.mock.calls[0][0];
  expect(records[0]).toEqual({kind:"trace",route:"/player/[slug]",name:"HTTP external",duration:5,traceId:"a",spanId:"b",parentId:"c",failed:true});
  expect(records[1].name).toBe("db.Player.findMany");
  expect(JSON.stringify(records)).not.toMatch(/private|secret|SELECT|cookie/);
});
