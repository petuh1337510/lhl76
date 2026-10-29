import { getDataQualityAudit } from '../src/lib/data-quality-audit';
import { prisma } from '../src/lib/prisma';

async function main() {
  try {
    const result = await getDataQualityAudit({ issue: 'FINAL_IMPORT_REVIEW' });
    const notes = result.items.every(item => Boolean(item.reviewNote));
    console.log(JSON.stringify({ total: result.total, notes, slugs: result.items.map(item => item.slug) }));
    if (result.total !== 7 || !notes) throw new Error('Review queue does not contain all seven protocols');
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => { console.error('Review queue verification failed'); process.exitCode = 1; });
