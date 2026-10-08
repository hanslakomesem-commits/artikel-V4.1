// ZAIN.NET — Local Abstract Translator V1.3
// Menjaga jumlah paragraf Abstract Inggris sama dengan Abstrak Indonesia.
// Inference berjalan di browser dengan Transformers.js tanpa API token.

let translatorPromise = null;
const MODEL = 'Xenova/opus-mt-id-en';
const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/+esm';

function norm(s){return (s||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();}
function splitSentences(text){
  const clean=norm(text); if(!clean)return [];
  const sentences=clean.match(/[^.!?]+(?:[.!?]+|$)/g)?.map(x=>x.trim()).filter(Boolean)||[clean];
  const chunks=[]; let cur='';
  for(const s of sentences){
    if((cur+' '+s).trim().length>620 && cur){chunks.push(cur.trim());cur=s;}
    else cur=(cur+' '+s).trim();
  }
  if(cur)chunks.push(cur.trim());
  return chunks;
}

async function getTranslator(onStatus){
  if(!translatorPromise){
    translatorPromise=(async()=>{
      onStatus?.('Memuat mesin terjemahan AI lokal…');
      const mod=await import(LIB);
      if(mod.env){mod.env.allowLocalModels=false;mod.env.useBrowserCache=true;}
      onStatus?.('Mengunduh/membuka model Indonesia → Inggris. Pertama kali bisa agak lama…');
      return await mod.pipeline('translation',MODEL,{progress_callback:(p)=>{if(p?.status==='progress'&&Number.isFinite(p.progress))onStatus?.(`Model AI lokal ${Math.round(p.progress)}%…`);}});
    })().catch(e=>{translatorPromise=null;throw e;});
  }
  return translatorPromise;
}

export function abstractSource(doc,plan){
  const sec=plan?.sections?.find(s=>s.id==='abstract');
  if(!sec)return {body:'',paragraphs:[],keywords:''};
  const paragraphs=[],keys=[];
  for(const x of sec.items||[]){
    const t=norm(doc.items?.[x.index]?.text||''); if(!t)continue;
    if(x.role==='keywords'||/^KATA\s*KUNCI\b/i.test(t)) keys.push(t.replace(/^KATA\s*KUNCI\s*:?\s*/i,''));
    else paragraphs.push(t);
  }
  return {body:paragraphs.join('\n\n'),paragraphs,keywords:norm(keys.join('; '))};
}

async function translateParagraph(translator,text,onStatus,label){
  const chunks=splitSentences(text),translated=[];
  for(let i=0;i<chunks.length;i++){
    onStatus?.(`${label} ${i+1}/${chunks.length}…`);
    const out=await translator(chunks[i],{max_new_tokens:512});
    translated.push(norm(out?.[0]?.translation_text||''));
  }
  return norm(translated.join(' '));
}

export async function translateAbstractLocal(doc,plan,onStatus){
  const src=abstractSource(doc,plan);
  if(!src.paragraphs.length)throw new Error('Isi abstrak Indonesia tidak ditemukan.');
  const translator=await getTranslator(onStatus);
  const paragraphs=[];
  for(let p=0;p<src.paragraphs.length;p++){
    paragraphs.push(await translateParagraph(translator,src.paragraphs[p],onStatus,`Menerjemahkan paragraf ${p+1}/${src.paragraphs.length}`));
  }
  let keywords='';
  if(src.keywords){
    onStatus?.('Menerjemahkan kata kunci…');
    try{const out=await translator(src.keywords,{max_new_tokens:128});keywords=norm(out?.[0]?.translation_text||'');}catch{keywords=src.keywords;}
  }
  return {body:paragraphs.join('\n\n'),paragraphs,keywords,paragraphCount:paragraphs.length,model:MODEL};
}

export const localTranslatorInfo={model:MODEL,library:LIB};
