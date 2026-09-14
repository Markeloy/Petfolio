import type {ReactNode} from 'react';
import {RefreshOnFocus} from '@/app/components/refresh-on-focus';
import './activity.css';
export default function Layout({children}:{children:ReactNode}){return <main className="detailShell activityShell"><RefreshOnFocus/>{children}</main>;}
