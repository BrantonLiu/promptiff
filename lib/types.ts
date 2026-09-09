export type Mode = 'review' | 'diff' | 'lexical' | 'semantic';
export type Level = 'original' | 'low' | 'medium' | 'high';
export type Op = {type:'equal'|'insert'|'delete'|'replace';old:string;new:string;a:number;b:number};
export type Sentence = {id:number;p:number;text:string;tokens:string[];lexical:{source:number;score:number;words:{text:string;score:number}[]};semantic:{source:number;score:number;tokenCount:number;candidates:{source:number;score:number}[]}};
export type Doc = {text:string;chars:number;sha256:string;paragraphs:{text:string;sentences:number[]}[];sentences:Sentence[];review:Op[];diffRows:{type:string;old:string;new:string;oldNumber:number|null;newNumber:number|null;parts:Op[]}[];stats:{unchanged:number;added:number;deleted:number;retention:number;semanticMean:number;sourceCoverage:number;lowSemantic:number}};
export type Analysis = {meta:{model:string;revision:string;dimensions:number;maxTokens:number;jieba:string;generated:string;inference:string};documents:Record<Level,Doc>};
