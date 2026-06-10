import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequestInput, mockRequestQuery, mockPoolRequest } = vi.hoisted(() => {
  const mockRequestInput = vi.fn().mockReturnThis();
  const mockRequestQuery = vi.fn();
  const mockPoolRequest = vi.fn(() => ({ input: mockRequestInput, query: mockRequestQuery }));
  return { mockRequestInput, mockRequestQuery, mockPoolRequest };
});

vi.mock('mssql', () => {
  const UniqueIdentifier = () => ({ type: 'UniqueIdentifier' });
  return { default: { UniqueIdentifier } };
});

import { HttpError } from '../../../middleware/errorHandler.js';
import { assertConsultaInSucursal, assertPacienteInSucursal } from './tenantGuards.js';

const pool = { request: mockPoolRequest } as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestInput.mockReturnThis();
  mockPoolRequest.mockImplementation(() => ({ input: mockRequestInput, query: mockRequestQuery }));
});

describe('tenantGuards', () => {
  it('assertPacienteInSucursal exige paciente + sucursal', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [{ id: 'p1' }] });
    await expect(assertPacienteInSucursal(pool, 'p1', 's1')).resolves.toBeUndefined();
    expect(mockRequestInput).toHaveBeenCalledWith('paciente_id', expect.anything(), 'p1');
    expect(mockRequestInput).toHaveBeenCalledWith('sucursal_id', expect.anything(), 's1');
    expect(mockRequestQuery.mock.calls[0]![0]).toContain('sucursal_id = @sucursal_id');
  });

  it('assertPacienteInSucursal oculta pacientes de otra sucursal como 404', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [] });
    let error: unknown;
    try {
      await assertPacienteInSucursal(pool, 'p1', 's2');
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 404 });
  });

  it('assertConsultaInSucursal puede amarrar consulta al paciente esperado', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [{ id: 'c1' }] });
    await expect(assertConsultaInSucursal(pool, 'c1', 's1', 'p1')).resolves.toBeUndefined();
    const query = mockRequestQuery.mock.calls[0]![0] as string;
    expect(query).toContain('id = @consulta_id');
    expect(query).toContain('sucursal_id = @sucursal_id');
    expect(query).toContain('paciente_id = @paciente_id');
  });
});
