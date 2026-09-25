import "dotenv/config";
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiGateway } from '../modules/ai/aiGateway.js';
import { modelCardRegistry } from '../modules/ai/evaluation/modelCard.js';
import { ModelEvaluator } from '../modules/ai/evaluation/modelEvaluator.js';
import { getDatasetFingerprint } from '../modules/ai/evaluation/nutritionGoldenDataset.js';
import { parsePinnedVersions } from '../modules/ai/evaluation/pinnedVersions.js';
import { createOllamaAdapter, createOpenAiAdapter } from '../modules/ai/providers/openAiCompatibleAdapter.js';
import { providerRegistry } from '../modules/ai/providers/providerRegistry.js';
import { modelRegistry } from '../modules/ai/models/modelRegistry.js';

const REPORTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'modules', 'ai', 'evaluation', 'reports');

async function main(): Promise<void> {
  if ((process.env.AI_EGRESS_ENABLED ?? 'false') !== 'true') {
    console.error('AI_EGRESS_ENABLED no esta en true: la evaluacion requiere egress activo.');
    process.exit(1);
  }

  modelRegistry.syncFromEnv(process.env);
  providerRegistry.register(createOpenAiAdapter(), { capabilities: ['chat_general', 'structured_json', 'nutrition_reasoning'] });
  providerRegistry.register(createOllamaAdapter(), { capabilities: ['chat_general', 'nutrition_reasoning'] });

  const pins = parsePinnedVersions(process.env);
  const fingerprint = getDatasetFingerprint();
  console.log(`Golden dataset: ${fingerprint} (${getDatasetFingerprint().startsWith('nutrition-golden-v1') ? 'v1' : 'nueva version'})`);

  mkdirSync(REPORTS_DIR, { recursive: true });

  const evaluator = new ModelEvaluator({
    run: async (request) => {
      const result = await aiGateway.complete(request, {
        requiredCapability: 'chat_general',
        egress: { capability: 'model_evaluation' },
      });
      if (!result.ok) {
        throw new Error(`${result.status}: ${result.message}`);
      }
      return result.result;
    },
  });

  let anyFailures = false;

  for (const [provider, model] of Object.entries(pins)) {
    const modelKey = `${provider}/${model}`;
    const card = modelCardRegistry.get(modelKey);
    const report = await evaluator.evaluate(modelKey, card?.version ?? 'unknown');
    console.log(`\n[${modelKey}] ${report.summary} (paso ${report.passRate}%)`);
    for (const verdict of report.verdicts) {
      const mark = verdict.passed ? 'PASS' : 'FAIL';
      console.log(`  [${mark}] ${verdict.caseId} (${verdict.category}): ${verdict.reasons.join(', ')}`);
      if (!verdict.passed) anyFailures = true;
    }
    writeFileSync(join(REPORTS_DIR, `${report.modelKey.replace('/', '-')}-${report.capability}.json`), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`  Reporte: reports/${report.modelKey.replace('/', '-')}-${report.capability}.json`);
  }

  console.log(`\nFingerprint del dataset evaluado: ${fingerprint}`);
  console.log('Siguiente paso: si el fingerprint cambio, actualizar datasetFingerprint en evaluation/certification.ts y re-certificar.');

  process.exit(anyFailures ? 1 : 0);
}

main().catch((err) => {
  console.error('Fallo la evaluacion:', err instanceof Error ? err.message : err);
  process.exit(1);
});
