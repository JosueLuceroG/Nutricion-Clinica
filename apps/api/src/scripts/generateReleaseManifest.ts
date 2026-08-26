import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildDeploymentManifest } from '../modules/deployment/deploymentManifest.js';

/**
 * Genera release-manifest.json (Release Foundation Step 01 §17/§40).
 * Manifiesto de compatibilidad de release máquina-legible, construido con el
 * mismo builder del módulo de despliegue (Build 09.5A) extendido con los
 * contratos de release: desktop/tauri, Dexie, sync, API, web.
 * Nunca contiene secretos ni PHI (§18).
 */
const manifest = buildDeploymentManifest(process.env);
const outPath = fileURLToPath(new URL('../../../../release-manifest.json', import.meta.url));
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(
  `release-manifest.json generado: ${manifest.gitCommit} @ ${manifest.releaseVersion}`,
);
