'use client';
import Link from 'next/link';
export default function ErrorPage({retry}:{retry:()=>void}){return <><h1>Запасы</h1><p role="alert">Не удалось загрузить записи.</p><button onClick={retry}>Повторить</button><p><Link href="/stock">К списку запасов</Link></p></>;}
