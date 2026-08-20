import type sql from 'mssql';

const MONTH_ES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const;
const DAY_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;

export const DIM_DATE_START = '2020-01-01';
export const DIM_DATE_END = '2030-12-31';

function toDateKey(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const offset = (copy.getDay() + 6) % 7; // lunes = 0
  copy.setDate(copy.getDate() - offset);
  return copy;
}

/** Población idempotente de dim_date (MERGE por date_key). */
export async function populateDimDate(pool: sql.ConnectionPool): Promise<number> {
  const start = new Date(`${DIM_DATE_START}T00:00:00Z`);
  const end = new Date(`${DIM_DATE_END}T00:00:00Z`);
  const rows: Array<{
    dateKey: number; dateValue: string; yearKey: number; quarterKey: number;
    monthKey: number; monthLabel: string; weekStart: string; dayOfMonth: number;
    dayOfWeek: number; dayNameEs: string; isWeekend: boolean;
  }> = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const weekStart = startOfWeek(cursor);
    rows.push({
      dateKey: toDateKey(cursor),
      dateValue: cursor.toISOString().slice(0, 10),
      yearKey: cursor.getFullYear(),
      quarterKey: Math.floor(cursor.getMonth() / 3) + 1,
      monthKey: cursor.getMonth() + 1,
      monthLabel: MONTH_ES[cursor.getMonth()]!,
      weekStart: weekStart.toISOString().slice(0, 10),
      dayOfMonth: cursor.getDate(),
      dayOfWeek: cursor.getDay(),
      dayNameEs: DAY_ES[cursor.getDay()]!,
      isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = chunk.map((r) => `(${r.dateKey}, '${r.dateValue}', ${r.yearKey}, ${r.quarterKey}, ${r.monthKey}, N'${r.monthLabel}', '${r.weekStart}', ${r.dayOfMonth}, ${r.dayOfWeek}, N'${r.dayNameEs}', ${r.isWeekend ? 1 : 0})`).join(',\n');
    const result = await pool.request().batch(`
      MERGE dim_date WITH (HOLDLOCK) AS t
      USING (VALUES ${values}) AS s(date_key, date_value, year_key, quarter_key, month_key, month_label, week_start_date, day_of_month, day_of_week, day_name_es, is_weekend)
      ON t.date_key = s.date_key
      WHEN MATCHED THEN UPDATE SET
        date_value = s.date_value, year_key = s.year_key, quarter_key = s.quarter_key,
        month_key = s.month_key, month_label = s.month_label, week_start_date = s.week_start_date,
        day_of_month = s.day_of_month, day_of_week = s.day_of_week, day_name_es = s.day_name_es,
        is_weekend = s.is_weekend
      WHEN NOT MATCHED THEN INSERT (date_key, date_value, year_key, quarter_key, month_key, month_label, week_start_date, day_of_month, day_of_week, day_name_es, is_weekend)
        VALUES (s.date_key, s.date_value, s.year_key, s.quarter_key, s.month_key, s.month_label, s.week_start_date, s.day_of_month, s.day_of_week, s.day_name_es, s.is_weekend);
    `);
    inserted += result.rowsAffected[0] ?? 0;
  }
  return inserted;
}