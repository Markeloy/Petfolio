import Link from 'next/link';
export default function NotFound() {
  return <main className="authShell"><section className="authCard"><h1>Запись недоступна</h1><p>Возможно, ссылка устарела или у вас больше нет доступа к этой записи.</p><Link className="primaryAction" href="/">На главную</Link></section></main>;
}
