"use client";
import {useT} from "@/lib/i18n/client";

import { useFormStatus } from "react-dom";
import { setMedicationStatus } from "./actions";

function StatusButton({ value, children, primary = false }: { value: string; children: string; primary?: boolean }) {
  const t=useT();
  const { pending } = useFormStatus();
  return <button
    className={primary ? "primaryAction" : "secondaryAction"}
    type="submit"
    name="status"
    value={value}
    disabled={pending}
  >{pending ? t("Сохраняем…") : children}</button>;
}

export function CourseActions({ petId, medicationId, status }: {
  petId: string;
  medicationId: string;
  status: "active" | "paused" | "completed" | "cancelled";
}) {
  const t=useT();
  const action = setMedicationStatus.bind(null, petId, medicationId);
  return <div className="courseActions">
    {status === "active" && <form action={action}><StatusButton value="paused">{t("Поставить курс на паузу")}</StatusButton></form>}
    {(status === "paused" || status === "completed") && <form action={action}><StatusButton value="active" primary>{t("Возобновить курс")}</StatusButton></form>}
    {(status === "active" || status === "paused") && <form action={action}><StatusButton value="completed">{t("Завершить курс")}</StatusButton></form>}
  </div>;
}
