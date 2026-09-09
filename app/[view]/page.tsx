import Wordiff from '@/components/wordiff';
import { notFound } from 'next/navigation';
import type { Mode, Level } from '@/lib/types';
export default async function View({params,searchParams}:{params:Promise<{view:string}>;searchParams:Promise<{level?:string}>}){
 const {view}=await params;
 if(!['review','diff','lexical','semantic'].includes(view))notFound();
 const {level}=await searchParams;
 const selected=['original','low','medium','high'].includes(level??'')?level as Level:'medium';
 return <Wordiff initialMode={view as Mode} initialLevel={selected}/>;
}
