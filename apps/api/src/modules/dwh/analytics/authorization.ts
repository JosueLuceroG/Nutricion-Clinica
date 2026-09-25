import sql from 'mssql';
import type { JwtPayload } from '@nutriclinica/shared';
import { getDwhPool } from '../dwhConnection.js';
import { ForbiddenError } from '../../../middleware/errorHandler.js';
import type { AnalyticsScope } from '../semantic/metricService.js';

/**
 * Autorización del DWH analytics:
 *  - el alcance SIEMPRE se deriva del token + header de sucursal (nunca del cliente).
 *  - admin puede pedir vista global (todas las sucursales cargadas);
 *  - profesional no-admin: solo su sucursal y solo su propia dimensión de profesional
 *    (breakdown_by_professional se restringe a sí mismo).
 */

export async function resolveScope(user: JwtPayload, sucursalId: string, allBranches = false): Promise<AnalyticsScope> {
  const isAdmin = user.rol === 'admin';
  const dwh = await getDwhPool();
  let sucursalKeys: number[] = [];

  if (!allBranches || !isAdmin) {
    const result = await dwh.request()
      .input('sid', sql.UniqueIdentifier, sucursalId)
      .query<{ sucursal_key: number }>(
        'SELECT sucursal_key FROM dim_sucursal WHERE sucursal_natural_id = @sid AND is_current = 1',
      );
    if (result.recordset.length === 0) {
      throw new ForbiddenError('Sucursal no cargada en el DWH (ejecutar ETL primero)');
    }
    sucursalKeys = [result.recordset[0]!.sucursal_key];
  }

  let professionalKey: number | undefined;
  if (!isAdmin) {
    const prof = await dwh.request()
      .input('pid', sql.UniqueIdentifier, user.sub)
      .query<{ professional_key: number }>(
        'SELECT professional_key FROM dim_professional WHERE professional_natural_id = @pid AND is_current = 1',
      );
    professionalKey = prof.recordset[0]?.professional_key;
  }

  return { sucursalKeys, professionalKey, isAdmin };
}

export function assertCanBreakdownByProfessional(scope: AnalyticsScope): void {
  if (!scope.isAdmin && scope.professionalKey === undefined) {
    throw new ForbiddenError('Profesional sin dimensión cargada en el DWH: no puede desglosar por profesional');
  }
}