'use client';
import Link from 'next/link';
export default function ErrorPage({retry}: {retry: () => void}) { return <main className="appShell"><div className="content"><h1>Календарь</h1><p role="alert">Не удалось загрузить записи. Попробуйте ещё раз.</p><button onClick={retry}>Повторить</button><p><Link href="/">На главную</Link></p></div></main>; }
