export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0,10) === value;
}

export function parseMedicationEdit(form: FormData) {
  const text = (key: string) => String(form.get(key) ?? '').trim();
  const name = text('name');
  const dose = text('doseAmount').replace(',', '.');
  const amount = dose ? Number(dose) : null;
  const starts = text('startsOn'), ends = text('endsOn');
  if (!name || name.length > 200) throw new Error('Укажите название до 200 символов.');
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0 || amount >= 10000000)) throw new Error('Проверьте дозировку.');
  if (!validDate(starts) || (ends && (!validDate(ends) || ends < starts))) throw new Error('Проверьте даты начала и окончания курса.');
  return { name, dose_amount: amount, dose_unit: text('doseUnit') || null,
    instructions: text('instructions') || null, notes: text('notes') || null,
    starts_on: starts, ends_on: ends || null };
}
