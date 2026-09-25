import { evaluateGroundness } from '../modules/ai/rag/groundedGeneration.js';
import { buildGoldenDocs, RETRIEVAL_GOLDEN_QUERIES } from '../modules/ai/rag/retrievalGoldenSet.js';

const topK = Number(process.env.RAG_EVAL_TOP_K ?? 4);
const docs = buildGoldenDocs('nutriologa', true);

const report = await evaluateGroundness({
  queries: RETRIEVAL_GOLDEN_QUERIES,
  docs,
  topK,
  generate: async ({ retrieved }) => {
    const lines = retrieved.map((chunk) => `Segun [${chunk.docId}] (${chunk.title}): ${chunk.snippet}`).join('\n');
    return `Recomendacion educativa.\n${lines}`;
  },
});

console.log(`Evaluacion de groundness (topK=${topK})`);
for (const query of report.queries) {
  console.log(
    `- ${query.id}: grounded=${query.grounded} cited=[${query.cited.join(', ')}] missing=[${query.missing.join(', ')}]`,
  );
}
console.log(`Consultas con groundness: ${report.groundedQueries}/${report.totalQueries}`);
console.log(report.passed ? 'RESULTADO: PASS' : 'RESULTADO: FAIL');

if (!report.passed) process.exitCode = 1;