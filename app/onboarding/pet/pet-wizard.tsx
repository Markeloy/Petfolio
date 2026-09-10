"use client";
import {useT} from "@/lib/i18n/client";

import { useState } from "react";
import { createPet } from "./actions";

const speciesOptions = [
  ["dog", "Собака"],
  ["cat", "Кошка"],
  ["bird", "Птица"],
  ["rodent", "Грызун"],
  ["reptile", "Рептилия"],
  ["other", "Другое"],
] as const;

export function PetWizard({ error }: { error?: string }) {
  const t=useT();
  const [step, setStep] = useState(1);
  const [species, setSpecies] = useState<string>("");
  const [name, setName] = useState("");

  return <form className="petWizard" action={createPet}>
    <input type="hidden" name="species" value={species || "other"} />
    <div className="wizardProgress" aria-label={`${t('Шаг')} ${step} ${t('из')} 3`}><span className={step >= 1 ? "active" : ""}/><span className={step >= 2 ? "active" : ""}/><span className={step >= 3 ? "active" : ""}/></div>
    {error ? <p className="formNotice errorNotice" role="alert">{t(error)}</p> : null}

    <section className={`wizardStep ${step === 1 ? "active" : ""}`}>
      <p className="wizardEyebrow">{t("Шаг 1 из 3")}</p>
      <h1>{t("Кто ваш питомец?")}</h1>
      <p>{t("Выберите тип животного. Это поможет Petfolio подстроить разделы и подсказки.")}</p>
      <div className="speciesGrid">{speciesOptions.map(([value, label]) => <button key={value} className={species === value ? "selected" : ""} type="button" onClick={() => setSpecies(value)}>{t(label)}</button>)}</div>
      <button className="primaryAction" type="button" disabled={!species} onClick={() => setStep(2)}>{t("Продолжить")}</button>
    </section>

    <section className={`wizardStep ${step === 2 ? "active" : ""}`}>
      <p className="wizardEyebrow">{t("Шаг 2 из 3")}</p>
      <h1>{t("Основная информация")}</h1>
      <p>{t("Имя обязательно, остальное можно заполнить сейчас или позже.")}</p>
      <div className="wizardFields">
        <label><span>{t("Фото питомца")}</span><input name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" /><small className="fieldHint">{t("JPG, PNG, WebP или фото с iPhone, до 8 МБ")}</small></label>
        <label><span>{t("Имя питомца")}</span><input name="name" type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("Марли")} required /></label>
        <label><span>{t("Дата рождения")}</span><input name="birthDate" type="date" /></label>
        <label><span>{t("Порода")}</span><input name="breed" type="text" placeholder={t("Необязательно")} /></label>
        <label><span>{t("Пол")}</span><select name="sex" defaultValue="unknown"><option value="unknown">{t("Не указан")}</option><option value="male">{t("Самец")}</option><option value="female">{t("Самка")}</option></select></label>
        <label><span>{t("Окрас")}</span><input name="color" type="text" placeholder={t("Необязательно")} /></label>
      </div>
      <div className="wizardActions"><button className="ghostAction" type="button" onClick={() => setStep(1)}>{t("Назад")}</button><button className="primaryAction" type="button" disabled={!name.trim()} onClick={() => setStep(3)}>{t("Продолжить")}</button></div>
    </section>

    <section className={`wizardStep ${step === 3 ? "active" : ""}`}>
      <p className="wizardEyebrow">{t("Шаг 3 из 3")}</p>
      <h1>{t("Дополнительные данные")}</h1>
      <p>{t("Эти поля необязательны. Их всегда можно изменить в профиле питомца.")}</p>
      <div className="wizardFields">
        <label><span>{t("Вес, кг")}</span><input name="weight" type="number" min="0.001" max="5000" step="0.001" inputMode="decimal" placeholder="12,4" /></label>
        <label><span>{t("Номер микрочипа")}</span><input name="microchip" type="text" /></label>
        <label><span>{t("Номер ветпаспорта")}</span><input name="passport" type="text" /></label>
        <label><span>{t("Ветеринарная клиника")}</span><input name="clinic" type="text" /></label>
        <label><span>{t("Ветеринар")}</span><input name="veterinarian" type="text" /></label>
        <label><span>{t("Комментарий")}</span><textarea name="notes" rows={3} /></label>
      </div>
      <div className="wizardActions"><button className="ghostAction" type="button" onClick={() => setStep(2)}>{t("Назад")}</button><button className="primaryAction" type="submit">{t("Сохранить питомца")}</button></div>
    </section>
  </form>;
}
