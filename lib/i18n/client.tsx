'use client';
import {createContext,useContext} from 'react';
import {translator,type Locale} from './core';
const Language=createContext<Locale>('ru');
export function LanguageProvider({locale,children}:{locale:Locale;children:React.ReactNode}){return <Language.Provider value={locale}>{children}</Language.Provider>;}
export function useT(){return translator(useContext(Language));}
export function useLocale(){return useContext(Language);}
