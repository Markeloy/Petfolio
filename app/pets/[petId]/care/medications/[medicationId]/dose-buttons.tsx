'use client';
import {useT} from "@/lib/i18n/client";

import { useFormStatus } from 'react-dom';
export function DoseButtons() {
  const t=useT();
  const { pending } = useFormStatus();
  return <div className="doseActions" aria-busy={pending}>
    <button className="primaryAction" name="status" value="given" disabled={pending}>{pending ? t("Сохраняем…") : t("Дано")}</button>
    <button className="secondaryAction" name="status" value="skipped" disabled={pending}>{t("Пропущено")}</button>
  </div>;
}
