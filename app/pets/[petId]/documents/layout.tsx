import type {ReactNode} from 'react';
import {RefreshOnFocus} from '@/app/components/refresh-on-focus';
import './documents.css';
export default function Layout({children}:{children:ReactNode}){return <main className="detailShell documentShell"><RefreshOnFocus/>{children}</main>;}
