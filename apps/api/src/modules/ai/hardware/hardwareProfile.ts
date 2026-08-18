import { arch, cpus, freemem, platform, totalmem } from 'node:os';
import { statfsSync } from 'node:fs';
import { execFile } from 'node:child_process';

/**
 * Perfil de hardware local (server-side). No recolecta identificadores unicos
 * (mac/serial/device-id): solo capacidades agregadas necesarias para routing.
 */

export type HardwareClass =
  | 'CPU_ONLY_LOW'
  | 'CPU_ONLY_HIGH'
  | 'GPU_LOW_VRAM'
  | 'GPU_MID_VRAM'
  | 'GPU_HIGH_VRAM'
  | 'APPLE_UNIFIED_MEMORY'
  | 'UNKNOWN';

export const HARDWARE_CLASSES: readonly HardwareClass[] = [
  'CPU_ONLY_LOW',
  'CPU_ONLY_HIGH',
  'GPU_LOW_VRAM',
  'GPU_MID_VRAM',
  'GPU_HIGH_VRAM',
  'APPLE_UNIFIED_MEMORY',
  'UNKNOWN',
];

export interface LocalHardwareProfile {
  detectedAt: string;
  cpuArchitecture: string;
  cpuCores: number;
  cpuModel: string | null;
  systemRamBytes: number;
  freeRamBytes: number;
  diskFreeBytes: number | null;
  gpuVendor: 'nvidia' | 'amd' | 'apple' | 'none' | 'UNKNOWN';
  gpuModel: string | null;
  vramBytes: number | null;
  hardwareClass: HardwareClass;
  inferenceRuntimes: Array<{ runtime: string; runtimeVersion: string | null }>;
}

export interface HardwareProbeOptions {
  readCpu?: () => { count: number; model: string | null };
  readMemory?: () => { total: number; free: number };
  readDisk?: (() => number | null) | null;
  readGpu?: () => Promise<{ vendor: LocalHardwareProfile['gpuVendor']; model: string | null; vramBytes: number | null }>;
  readRuntimes?: () => Promise<Array<{ runtime: string; runtimeVersion: string | null }>>;
}

function nvidiaSmiProbe(): Promise<{ vendor: LocalHardwareProfile['gpuVendor']; model: string | null; vramBytes: number | null }> {
  return new Promise((resolve) => {
    const candidates = ['nvidia-smi', 'C:\\Windows\\System32\\nvidia-smi.exe'];
    const tryProbe = (index: number): void => {
      if (index >= candidates.length) {
        resolve({ vendor: 'none', model: null, vramBytes: null });
        return;
      }
      execFile(
        candidates[index]!,
        ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'],
        { timeout: 5000, windowsHide: true },
        (err, stdout) => {
          if (err) {
            tryProbe(index + 1);
            return;
          }
          const line = stdout.trim().split(/\r?\n/)[0];
          if (!line) {
            resolve({ vendor: 'none', model: null, vramBytes: null });
            return;
          }
          const parts = line.split(',').map((p) => p.trim());
          const miB = Number(parts[1]);
          resolve({
            vendor: 'nvidia',
            model: parts[0] ?? null,
            vramBytes: Number.isFinite(miB) && miB > 0 ? miB * 1024 * 1024 : null,
          });
        },
      );
    };
    tryProbe(0);
  });
}

function runtimeProbe(): Promise<Array<{ runtime: string; runtimeVersion: string | null }>> {
  return new Promise((resolve) => {
    Promise.resolve(fetch('http://localhost:11434/api/version', { signal: AbortSignal.timeout(3000) }))
      .then((res) => res.json() as Promise<{ version?: string }>)
      .then((body) => resolve([{ runtime: 'ollama', runtimeVersion: body.version ?? null }]))
      .catch(() => resolve([]));
  });
}

export function classifyHardware(input: {
  cpuCores: number;
  systemRamBytes: number;
  gpuVendor: LocalHardwareProfile['gpuVendor'];
  vramBytes: number | null;
  platform: string;
}): HardwareClass {
  if (input.platform === 'darwin') return 'APPLE_UNIFIED_MEMORY';
  if (input.gpuVendor === 'nvidia' || input.gpuVendor === 'amd' || input.gpuVendor === 'apple') {
    const vramGb = (input.vramBytes ?? 0) / 1024 / 1024 / 1024;
    if (vramGb >= 24) return 'GPU_HIGH_VRAM';
    if (vramGb >= 12) return 'GPU_MID_VRAM';
    return 'GPU_LOW_VRAM';
  }
  const ramGb = input.systemRamBytes / 1024 / 1024 / 1024;
  if (ramGb >= 15.5 && input.cpuCores >= 8) return 'CPU_ONLY_HIGH';
  if (ramGb >= 8 && input.cpuCores >= 4) return 'CPU_ONLY_LOW';
  return 'CPU_ONLY_LOW';
}

export async function detectLocalHardwareProfile(options: HardwareProbeOptions = {}): Promise<LocalHardwareProfile> {
  const cpu = options.readCpu?.() ?? (() => {
    const list = cpus();
    return { count: list.length, model: list[0]?.model ?? null };
  })();
  const mem = options.readMemory?.() ?? { total: totalmem(), free: freemem() };
  const diskFree = options.readDisk === null ? null : options.readDisk?.() ?? readDiskFree();
  const gpu = options.readGpu ? await options.readGpu() : await nvidiaSmiProbe();
  const runtimes = options.readRuntimes ? await options.readRuntimes() : await runtimeProbe();
  const hardwareClass = classifyHardware({
    cpuCores: cpu.count,
    systemRamBytes: mem.total,
    gpuVendor: gpu.vendor,
    vramBytes: gpu.vramBytes,
    platform: platform(),
  });
  return {
    detectedAt: new Date().toISOString(),
    cpuArchitecture: arch(),
    cpuCores: cpu.count,
    cpuModel: cpu.model,
    systemRamBytes: mem.total,
    freeRamBytes: mem.free,
    diskFreeBytes: diskFree,
    gpuVendor: gpu.vendor,
    gpuModel: gpu.model,
    vramBytes: gpu.vramBytes,
    hardwareClass,
    inferenceRuntimes: runtimes,
  };
}

function readDiskFree(): number | null {
  try {
    return statfsSync(process.cwd()).bavail * statfsSync(process.cwd()).bsize;
  } catch {
    return null;
  }
}

/** UNKNOWN nunca es compatible: un perfil sin detectar no habilita candidatos. */
export function isHardwareCompatible(profile: LocalHardwareProfile, required: { minRamBytes?: number; minVramBytes?: number; gpuRequired?: boolean }): boolean {
  if (profile.hardwareClass === 'UNKNOWN') return false;
  if (required.gpuRequired && (profile.vramBytes ?? 0) <= 0) return false;
  if (required.minVramBytes && (profile.vramBytes ?? 0) < required.minVramBytes) return false;
  if (required.minRamBytes && profile.systemRamBytes < required.minRamBytes) return false;
  return true;
}