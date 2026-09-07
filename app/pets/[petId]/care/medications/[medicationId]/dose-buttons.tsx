'use client';
import { useFormStatus } from 'react-dom';
export function DoseButtons() {
  const { pending } = useFormStatus();
  return <div className="doseActions" aria-busy={pending}>
    <button className="primaryAction" name="status" value="given" disabled={pending}>{pending ? 'Сохраняем…' : 'Дано'}</button>
    <button className="secondaryAction" name="status" value="skipped" disabled={pending}>Пропущено</button>
  </div>;
}
