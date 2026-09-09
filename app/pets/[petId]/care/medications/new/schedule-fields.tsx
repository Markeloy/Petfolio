"use client";
import {useT} from "@/lib/i18n/client";

import { useState } from "react";

export function ScheduleFields({initialTimezone,zones}:{initialTimezone:string;zones:string[]}) {
  const t=useT();
  const [timezone, setTimezone] = useState(initialTimezone);
  return <div className="wizardFields">
    <fieldset className="scheduleDays">
      <legend>{t("Дни приёма")}</legend>
      <div className="scheduleDayOptions">
        {[t("Пн"), t("Вт"), t("Ср"), t("Чт"), t("Пт"), t("Сб"), t("Вс")].map((day, index) =>
          <label key={day}><input type="checkbox" name="daysOfWeek" value={index + 1} defaultChecked /><span>{t(day)}</span></label>
        )}
      </div>
    </fieldset>
    <label><span>{t("Часовой пояс расписания")}</span>
      <select name="timezone" value={timezone} onChange={event => setTimezone(event.target.value)}>
        {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
      </select>
    </label>
    <p className="formSectionHint">{t("Время приёмов закреплено за выбранным часовым поясом и не меняется во время поездок.")}</p>
  </div>;
}
