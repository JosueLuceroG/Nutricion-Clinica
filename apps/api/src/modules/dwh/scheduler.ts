import cron from 'node-cron';
import { readDwhConfig } from './config.js';
import { runAllPipelines } from './etl/engine.js';

/**
 * Scheduler ETL DWH (Build 08): node-cron, sin Airflow.
 * Activado solo con DWH_SCHEDULED_LOAD_ENABLED=true.
 * El lock por pipeline evita solapamientos; el reinicio es seguro.
 */

let started = false;

export function startDwhScheduler(): void {
  if (started) return;
  const config = readDwhConfig();
  if (!config.scheduledLoadEnabled) {
    console.log('[dwh] scheduler de carga deshabilitado (DWH_SCHEDULED_LOAD_ENABLED=false)');
    return;
  }
  console.log(`[dwh] scheduling ETL cron: "${config.cronSchedule}"`);
  cron.schedule(config.cronSchedule, () => {
    void runAllPipelines().then((results) => {
      const failed = results.filter((r) => r.status !== 'succeeded');
      console.log(`[dwh] scheduled load done: ${results.length} pipelines, ${failed.length} failed`);
      for (const f of failed) {
        console.error(`[dwh] pipeline fallido: ${f.pipelineId}: ${f.error ?? f.status}`);
      }
    }).catch((err) => {
      console.error('[dwh] scheduled load error', err);
    });
  });
  started = true;
}