import type {ReactNode} from 'react';
import {BottomNav} from '@/app/components/petfolio-home';
import {RefreshOnFocus} from '@/app/components/refresh-on-focus';
import './stock.css';
export default function Layout({children}:{children:ReactNode}){return <main className="appShell"><RefreshOnFocus/><div className="content stockContent">{children}</div><BottomNav active="stock"/></main>;}
