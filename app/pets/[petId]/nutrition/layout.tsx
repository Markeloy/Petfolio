import type {ReactNode} from 'react';
import {RefreshOnFocus} from '@/app/components/refresh-on-focus';
import './nutrition.css';
export default function Layout({children}:{children:ReactNode}){return <main className="detailShell feedingShell"><RefreshOnFocus/>{children}</main>;}
