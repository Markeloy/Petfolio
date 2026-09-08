'use client';
export default function ErrorPage({retry}:{retry:()=>void}){return <><h1>Документы</h1><p role="alert">Не удалось загрузить записи.</p><button onClick={retry}>Повторить</button></>;}
