"use client";
import {useT} from "@/lib/i18n/client";

import { useFormStatus } from "react-dom";

export function SaveButton() {
  const t=useT();
  const { pending } = useFormStatus();
  return <button className="primaryAction" type="submit" disabled={pending} aria-disabled={pending}>
    {pending ? t("Сохраняем…") : t("Сохранить лекарство")}
  </button>;
}
