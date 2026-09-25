import { evaluateRetrieval } from '../modules/ai/rag/retrievalEvaluation.js';
import { buildGoldenDocs, RETRIEVAL_GOLDEN_QUERIES } from '../modules/ai/rag/retrievalGoldenSet.js';

const threshold = Number(process.env.RAG_RETRIEVAL_MIN_RECALL ?? 0.6);
const topK = Number(process.env.RAG_EVAL_TOP_K ?? 4);
const docs = buildGoldenDocs('nutriologa', true);

const report = evaluateRetrieval({ queries: RETRIEVAL_GOLDEN_QUERIES, docs, topK, threshold });

console.log(`Evaluacion de retrieval (topK=${topK}, umbral recall=${threshold})`);
for (const query of report.queries) {
  console.log(`- ${query.id}: recall=${query.recall} precision=${query.precision} hits=[${query.hits.join(', ')}] missed=[${query.missed.join(', ')}]`);
}
console.log(`Promedio recall: ${report.averageRecall}`);
console.log(`Promedio precision: ${report.averagePrecision}`);
console.log(report.passed ? 'RESULTADO: PASS' : 'RESULTADO: FAIL');

if (!report.passed) process.exitCode = 1;