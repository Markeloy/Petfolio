import Link from 'next/link';
import {getPreferences} from '@/lib/i18n/server';
export const dynamic='force-dynamic';
export default async function About(){
 const {locale}=await getPreferences();
 const en=locale==='en';
 const text=(ru:string,english:string)=>en?english:ru;
 const email=process.env.PETFOLIO_SUPPORT_EMAIL?.trim();
 const contact=email&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)?email:null;
 const operator=process.env.PETFOLIO_OPERATOR_NAME?.trim();
 return <main className="detailShell formDetailShell">
 <Link href="/">{text('← В приложение','← Open app')}</Link>
 <h1>{text('О бете и ваших данных','About the beta and your data')}</h1>
 <section className="formSectionCard"><h2>{text('Petfolio — уход под рукой','Petfolio — care at hand')}</h2>
 <p>{text('Petfolio помогает одному владельцу вести здоровье, уход и историю питомца. Совместный доступ можно использовать при необходимости.','Petfolio helps an owner keep track of a pet’s health, care and history. Shared access is available when needed.')}</p>
 <p>{text('Это тестовая версия. Если заметили ошибку, сообщите организатору тестирования, что вы делали и что ожидали увидеть. Не прикладывайте пароли и личные медицинские документы.','This is a beta. Report what you did and what you expected to the test organiser. Do not include passwords or private medical documents.')}</p></section>
 <section className="formSectionCard"><h2>{text('Какие данные сохраняются','What is stored')}</h2>
 <p>{text('Данные аккаунта, сведения о питомце, введённые вами записи ухода, фотографии и документы сохраняются для работы приложения. Для авторизации, базы и файлов используется Supabase.','Account details, pet information, care records, photos and documents you provide are stored to operate the app. Authentication, database and file storage use Supabase.')}</p>
 <p>{text('Записи доступны вашему аккаунту и участникам, которым предоставлен совместный доступ. Файлы хранятся в закрытом хранилище. Организатор сервиса имеет административный доступ для его поддержки.','Records are accessible to your account and people granted shared access. Files are kept in private storage. The service organiser has administrative access to support the service.')}</p></section>
 <section className="formSectionCard"><h2>{text('Статистика использования','Usage statistics')}</h2>
 <p>{text('Мы учитываем открытия экранов и результаты действий, чтобы понять, помогает ли Petfolio. В статистику входят идентификаторы аккаунта и питомца, сессии, время и категории действий. Имена, email, названия лекарств, дозировки, заметки и содержимое документов в эти события не включаются.','We record screen views and action outcomes to understand whether Petfolio helps. Events include account, pet and session identifiers, time and action categories. Names, email, medication names, doses, notes and document contents are excluded from these events.')}</p>
 <p>{text('Настройки языка, темы, сессии и прочтения уведомлений сохраняются в браузере. Очистка данных браузера может сбросить эти настройки и завершить вход.','Language, theme, session and notification read state are stored in your browser. Clearing browser data may reset preferences and sign you out.')}</p></section>
 <section className="formSectionCard"><h2>{text('Что важно знать','Current limitations')}</h2>
 <p>{text('Для сохранения записей нужен интернет. Уведомления сейчас работают внутри приложения; доставка при закрытом приложении не подключена. Petfolio хранит ваши записи и не назначает лечение.','Saving records requires internet access. Reminders currently appear inside the app; closed-app delivery is not connected. Petfolio stores your records and does not prescribe treatment.')}</p>
 <p>{text('Архив скрывает запись из основного списка, но не удаляет её навсегда. Встроенной кнопки удаления аккаунта пока нет. Для запроса удаления данных свяжитесь с организатором тестирования.','Archiving hides a record from the main list but does not permanently delete it. There is no account-deletion button yet. Contact the test organiser to request data deletion.')}</p></section>
 <section className="formSectionCard"><h2>{text('Обратная связь и запросы о данных','Feedback and data requests')}</h2>
 {operator&&<p>{operator}</p>}
 {contact?<a href={'mailto:'+contact}>{contact}</a>:<p>{text('Свяжитесь с человеком, который пригласил вас в тестирование.','Contact the person who invited you to the beta.')}</p>}
 </section></main>;
}
