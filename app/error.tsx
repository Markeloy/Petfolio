'use client';
import Link from 'next/link';
export default function ApplicationError({retry}:{retry:()=>void}) {
  return <main className="authShell"><section className="authCard">
    <h1>Не удалось открыть страницу</h1>
    <p role="alert">Проверьте подключение к интернету и попробуйте ещё раз. Если ошибка возникла при сохранении, сначала проверьте историю записи.</p>
    <button className="primaryAction" onClick={retry}>Попробовать снова</button>
    <p><Link href="/">На главную</Link> · <Link href="/login">Войти в аккаунт</Link></p>
  </section></main>;
}
