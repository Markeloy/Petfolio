'use client';
import {useT} from "@/lib/i18n/client";

import { useFormStatus } from 'react-dom';
import { trackClient } from '@/lib/analytics/client';

export function DoseButtons() {
  const t=useT();
  const { pending } = useFormStatus();
  return <div className="doseActions" aria-busy={pending}>
    <button className="primaryAction" name="status" value="given" disabled={pending} onClick={() => void trackClient('dose_action_started', { action: 'given' })}>{pending ? t("Сохраняем…") : t("Дано")}</button>
    <button className="secondaryAction" name="status" value="skipped" disabled={pending} onClick={() => void trackClient('dose_action_started', { action: 'skipped' })}>{t("Пропущено")}</button>
  </div>;
}
