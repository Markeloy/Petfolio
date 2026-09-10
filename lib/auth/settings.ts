export function parseSettings(form:FormData) {
  const display_name=String(form.get('display_name')??'').trim(),timezone=String(form.get('timezone')??'');
  if(!display_name||display_name.length>100)throw new Error('Укажите имя — до 100 символов');
  try{new Intl.DateTimeFormat('ru-RU',{timeZone:timezone}).format();}catch{throw new Error('Выберите действующий часовой пояс');}
  return {display_name,timezone};
}
