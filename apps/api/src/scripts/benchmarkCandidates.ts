import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectLocalHardwareProfile } from '../modules/ai/hardware/hardwareProfile.js';
import { buildCandidateManifest, candidateAvailability } from '../modules/ai/models/candidateManifest.js';
import { buildDeploymentProfile, DEFAULT_INFERENCE_SETTINGS } from '../modules/ai/models/deploymentProfile.js';
import { createOllamaAdapter } from '../modules/ai/providers/openAiCompatibleAdapter.js';
import { runBenchmark } from '../modules/ai/evaluation/benchmarkHarness.js';
import { CURRENT_VERSIONS } from '../modules/ai/certification/versions.js';

const REPORTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'modules', 'ai', 'evaluation', 'reports');

interface OllamaTag {
  name: string;
  digest: string | null;
  quantization_level?: string | null;
}

async function main(): Promise<void> {
  const hardware = await detectLocalHardwareProfile();
  console.log(`hardware: ${hardware.hardwareClass} (${hardware.cpuCores} cores, ${Math.round(hardware.systemRamBytes / 1073741824)}GB RAM, gpu=${hardware.gpuVendor}, diskFree=${hardware.diskFreeBytes ? Math.round(hardware.diskFreeBytes / 1073741824) : '?'}GB)`);
  console.log(`runtimes: ${hardware.inferenceRuntimes.map((r) => `${r.runtime}@${r.runtimeVersion ?? '?'}`).join(', ') || 'ninguno'}`);

  const ollamaVersion = hardware.inferenceRuntimes.find((r) => r.runtime === 'ollama')?.runtimeVersion ?? null;
  const runtimeModels: Array<{ modelId: string; runtime: string; digest: string | null; quantization: string | null; installed: boolean }> = [];
  if (ollamaVersion) {
    try {
      const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(10_000) });
      const body = (await res.json()) as { models?: OllamaTag[] };
      for (const tag of body.models ?? []) {
        const id = tag.name.replace(/:latest$/, '');
        runtimeModels.push({ modelId: id, runtime: 'ollama', digest: tag.digest ?? null, quantization: tag.quantization_level ?? null, installed: true });
      }
    } catch (err) {
      console.log(`no se pudo listar modelos ollama: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const manifest = buildCandidateManifest({ runtimeModels, runtimeVersion: ollamaVersion });
  console.log('\nmanifest:');
  for (const entry of manifest) {
    const availability = candidateAvailability(entry, { downloadPolicy: 'operator_config_required' });
    console.log(`  ${entry.candidateId}: ${availability}${entry.installed ? ` (digest=${entry.weightsRevision ?? '?'}, quant=${entry.quantization ?? 'UNKNOWN'})` : ''}`);
  }

  const installable = manifest.filter((e) => candidateAvailability(e, { downloadPolicy: 'operator_config_required' }) === 'AVAILABLE');
  const only = process.env.AI_BENCHMARK_ONLY?.trim();
  const targets = only ? installable.filter((e) => e.candidateId === only) : installable;
  if (targets.length === 0) {
    console.log(`Sin candidatos para benchmark (filter=${only ?? 'todos'}): BLOCKED_BY_DOWNLOAD para el resto.`);
    return;
  }

  mkdirSync(REPORTS_DIR, { recursive: true });
  const repetitions = Number(process.env.AI_BENCHMARK_REPETITIONS ?? 2);

  for (const entry of targets) {
    console.log(`\nbenchmark ${entry.candidateId} (reps=${repetitions})...`);
    const deployment = buildDeploymentProfile({
      providerId: entry.providerId,
      modelId: entry.modelId,
      modelVersion: entry.modelVersion,
      weightsRevision: entry.weightsRevision,
      quantization: entry.quantization,
      runtime: entry.runtime,
      runtimeVersion: entry.runtimeVersion,
      inferenceSettings: DEFAULT_INFERENCE_SETTINGS,
    });
    const adapter = createOllamaAdapter();
    try {
      const run = await runBenchmark({
        adapter,
        deployment,
        hardwareProfile: hardware,
        knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
        retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
        memoryPolicyVersion: CURRENT_VERSIONS.policyVersion,
        options: { repetitions },
      });
      writeFileSync(join(REPORTS_DIR, `benchmark-${entry.candidateId}.json`), `${JSON.stringify(run, null, 2)}\n`);
      console.log(`  result=${run.result} passed=${run.testCounts.passed}/${run.testCounts.total}`);
      console.log(`  abstention=${run.abstention.passed}/${run.abstention.total} safety=${run.safety.passed}/${run.safety.total} structured=${run.structuredOutput.passed}/${run.structuredOutput.total}`);
      console.log(`  spanish=${run.spanish.passed}/${run.spanish.total} tools=${run.toolSelection.passed}/${run.toolSelection.total} grounding=${run.grounding.passed}/${run.grounding.total}`);
      console.log(`  latency p50=${run.latency.p50Ms}ms p95=${run.latency.p95Ms}ms (${run.latency.repetitions} reps)`);
      for (const f of run.failures) console.log(`  FAIL ${f.caseId} (${f.kind}): ${f.detail}`);
      console.log(`  report: reports/benchmark-${entry.candidateId}.json`);
    } catch (err) {
      console.log(`  BLOCKED_BY_RUNTIME: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

void main();