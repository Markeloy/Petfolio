"use client";

import { useState } from "react";

export function ScheduleFields({initialTimezone,zones}:{initialTimezone:string;zones:string[]}) {
  const [timezone, setTimezone] = useState(initialTimezone);
  return <div className="wizardFields">
    <fieldset className="scheduleDays">
      <legend>Дни приёма</legend>
      <div className="scheduleDayOptions">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, index) =>
          <label key={day}><input type="checkbox" name="daysOfWeek" value={index + 1} defaultChecked /><span>{day}</span></label>
        )}
      </div>
    </fieldset>
    <label><span>Часовой пояс расписания</span>
      <select name="timezone" value={timezone} onChange={event => setTimezone(event.target.value)}>
        {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
      </select>
    </label>
    <p className="formSectionHint">Время приёмов закреплено за выбранным часовым поясом и не меняется во время поездок.</p>
  </div>;
}
