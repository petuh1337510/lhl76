import { PrismaClient } from "@prisma/client";
import { trace, SpanStatusCode } from "@opentelemetry/api";

function createClient() {
  return new PrismaClient().$extends({query: {$allModels: {async $allOperations({model, operation, args, query}) {
    return trace.getTracer("lhl76-db").startActiveSpan(`db.${model}.${operation}`, async span => {
      try { return await query(args); }
      catch (error) { span.setStatus({code: SpanStatusCode.ERROR}); throw error; }
      finally { span.end(); }
    });
  }}}}) as unknown as PrismaClient; // Query-only tracing preserves the generated client/transaction contract.
}
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };
export const prisma = globalForPrisma.prisma ?? createClient();
globalForPrisma.prisma = prisma;
