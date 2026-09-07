"use client";

import { useFormStatus } from "react-dom";

export function SaveButton() {
  const { pending } = useFormStatus();
  return <button className="primaryAction" type="submit" disabled={pending} aria-disabled={pending}>
    {pending ? "Сохраняем…" : "Сохранить лекарство"}
  </button>;
}
