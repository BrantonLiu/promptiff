import Wordiff from '@/components/wordiff';
import type { Level } from '@/lib/types';
export default async function Home({searchParams}:{searchParams:Promise<{level?:string}>}){
 const {level}=await searchParams;
 const selected=['original','low','medium','high'].includes(level??'')?level as Level:'medium';
 return <Wordiff initialLevel={selected}/>;
}
