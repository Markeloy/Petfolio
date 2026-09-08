'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <><h1>Документы</h1><p role="alert">Не удалось загрузить записи.</p><button onClick={reset}>Повторить</button></>;}
