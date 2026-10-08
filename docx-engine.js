const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL='http://schemas.openxmlformats.org/package/2006/relationships';
const CT='http://schemas.openxmlformats.org/package/2006/content-types';
const parser=()=>new DOMParser(); const ser=()=>new XMLSerializer();
const norm=s=>(s||'').replace(/\u00a0/g,' ').replace(/[\u00ad\ufffe]/g,'').replace(/\s+/g,' ').trim();
const esc=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function q(root,local){return [...root.getElementsByTagNameNS(W,local)];}
function getText(node){return q(node,'t').map(x=>x.textContent||'').join('');}
function getBoldRatio(p){const runs=q(p,'r');if(!runs.length)return 0;let n=0,d=0;for(const r of runs){const txt=getText(r);if(!txt.trim())continue;d++;const b=r.getElementsByTagNameNS(W,'b')[0];if(b&&b.getAttributeNS(W,'val')!=='0')n++;}return d?n/d:0;}
function footnoteIds(p){return q(p,'footnoteReference').map(x=>x.getAttributeNS(W,'id')||x.getAttribute('w:id')).filter(Boolean);}
function styleId(p){const e=p.getElementsByTagNameNS(W,'pStyle')[0];return e?(e.getAttributeNS(W,'val')||e.getAttribute('w:val')||''):'';}
function cloneItem(node,index){return {index,type:node.localName==='tbl'?'table':'p',text:norm(getText(node)),xml:ser().serializeToString(node),style:node.localName==='p'?styleId(node):'',boldRatio:node.localName==='p'?getBoldRatio(node):0,footnoteIds:node.localName==='p'?footnoteIds(node):[]};}

export async function readDocx(fileOrBuffer){
  const ab=fileOrBuffer instanceof ArrayBuffer?fileOrBuffer:await fileOrBuffer.arrayBuffer();
  const zip=await JSZip.loadAsync(ab);const f=zip.file('word/document.xml');if(!f)throw new Error('File bukan DOCX Word yang valid.');
  const xml=await f.async('string');const doc=parser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw new Error('document.xml tidak dapat dibaca.');
  const body=doc.getElementsByTagNameNS(W,'body')[0];const nodes=[...body.children].filter(x=>x.localName==='p'||x.localName==='tbl');
  const items=nodes.map((n,i)=>cloneItem(n,i));
  const footnotes=new Map();const ff=zip.file('word/footnotes.xml');
  if(ff){const fx=parser().parseFromString(await ff.async('string'),'application/xml');for(const fn of fx.getElementsByTagNameNS(W,'footnote')){const id=fn.getAttributeNS(W,'id')||fn.getAttribute('w:id');if(id!=null)footnotes.set(String(id),norm(getText(fn)));}}
  return {arrayBuffer:ab,zip,xml,items,footnotes};
}

function frag(doc,xml){const d=parser().parseFromString(`<x xmlns:w="${W}" xmlns:r="${R}">${xml}</x>`,'application/xml');return doc.importNode(d.documentElement.firstElementChild,true);}
function ensurePPr(doc,p){let pPr=[...p.children].find(x=>x.localName==='pPr');if(!pPr){pPr=doc.createElementNS(W,'w:pPr');p.insertBefore(pPr,p.firstChild);}return pPr;}
function rmChildren(parent,names){for(const x of [...parent.children])if(names.includes(x.localName))x.remove();}
function wEl(doc,name,val){const e=doc.createElementNS(W,'w:'+name);if(val!==undefined)e.setAttributeNS(W,'w:val',String(val));return e;}
function setIndent(doc,pPr,attrs={}){const ind=wEl(doc,'ind');for(const [k,v] of Object.entries(attrs))ind.setAttributeNS(W,'w:'+k,String(v));pPr.appendChild(ind);}
function setSpacing(pPr,doc,{before=0,after=0,line=360,rule='auto'}={}){const sp=wEl(doc,'spacing');sp.setAttributeNS(W,'w:before',String(before));sp.setAttributeNS(W,'w:after',String(after));sp.setAttributeNS(W,'w:line',String(line));sp.setAttributeNS(W,'w:lineRule',rule);pPr.appendChild(sp);}
function setParaFormat(doc,p,role){
  const pPr=ensurePPr(doc,p);rmChildren(pPr,['sectPr','pageBreakBefore','keepNext','spacing','ind','jc','tabs']);
  let align='both';
  if(['title','identity','author','sectionCenter'].includes(role))align='center';
  else if(['section','sectionLeft','subheading','conclusionHeading','bibliography','abstractKeywords'].includes(role))align='left';
  pPr.appendChild(wEl(doc,'jc',align));
  if(role==='title') setSpacing(pPr,doc,{before:40,after:240,line:300});
  else if(role==='author') setSpacing(pPr,doc,{before:0,after:40,line:300});
  else if(role==='identity') setSpacing(pPr,doc,{before:0,after:20,line:300});
  else if(role==='sectionCenter'||role==='section'||role==='sectionLeft'){setSpacing(pPr,doc,{before:220,after:100,line:300});pPr.appendChild(wEl(doc,'keepNext'));}
  else if(role==='subheading'){setSpacing(pPr,doc,{before:90,after:50,line:360});pPr.appendChild(wEl(doc,'keepNext'));}
  else if(role==='bibliography'){setSpacing(pPr,doc,{before:0,after:30,line:300});setIndent(doc,pPr,{left:720,hanging:720});}
  else if(role==='abstractBody'){setSpacing(pPr,doc,{before:0,after:0,line:240});setIndent(doc,pPr,{firstLine:720,left:0,right:0});}
  else if(role==='abstractKeywords'){setSpacing(pPr,doc,{before:60,after:0,line:240});setIndent(doc,pPr,{firstLine:0,left:0,right:0});}
  else if(role==='conclusionHeading'){setSpacing(pPr,doc,{before:100,after:50,line:360});pPr.appendChild(wEl(doc,'keepNext'));}
  else {setSpacing(pPr,doc,{before:0,after:40,line:360});setIndent(doc,pPr,{firstLine:425,left:0,right:0});}
  for(const br of q(p,'br'))if((br.getAttributeNS(W,'type')||br.getAttribute('w:type'))==='page')br.remove();
}
function ensureRPr(doc,r){let rPr=[...r.children].find(x=>x.localName==='rPr');if(!rPr){rPr=doc.createElementNS(W,'w:rPr');r.insertBefore(rPr,r.firstChild);}return rPr;}
function setRunBold(doc,rPr,on=true){for(const n of [...rPr.children])if(n.localName==='b'||n.localName==='bCs')n.remove();if(on){rPr.appendChild(wEl(doc,'b'));rPr.appendChild(wEl(doc,'bCs'));}}
function forceRuns(doc,p,role){
  for(const r of q(p,'r')){
    const rPr=ensureRPr(doc,r);for(const n of [...rPr.children])if(['rFonts','sz','szCs'].includes(n.localName))n.remove();
    const fonts=wEl(doc,'rFonts');['ascii','hAnsi','eastAsia','cs'].forEach(a=>fonts.setAttributeNS(W,'w:'+a,'Times New Roman'));rPr.appendChild(fonts);
    let size='24';if(role==='title')size='28';else if(role==='identity')size='28';else if(role==='sectionCenter'||role==='section'||role==='sectionLeft')size='24';
    rPr.appendChild(wEl(doc,'sz',size));rPr.appendChild(wEl(doc,'szCs',size));
    if(['title','author','section','sectionCenter','sectionLeft','conclusionHeading','abstractKeywords'].includes(role))setRunBold(doc,rPr,true);
    else if(role==='identity')setRunBold(doc,rPr,false);
  }
}
function normalizeTextNodes(p,role){
  // Hilangkan tab/line-break manual yang sering membuat alinea terdorong terlalu dalam.
  for(const tab of q(p,'tab'))tab.remove();
  for(const br of [...q(p,'br')]){if(!(br.getAttributeNS(W,'type')||br.getAttribute('w:type'))){const parent=br.parentNode;const t=parent?.getElementsByTagNameNS(W,'t')?.[0];if(t)t.textContent=(t.textContent||'')+' ';br.remove();}}
  const texts=q(p,'t');
  for(const t of texts){let v=(t.textContent||'').replace(/\u00a0/g,' ').replace(/[\u00ad\ufffe]/g,'').replace(/[ \t]{2,}/g,' ');v=v.replace(/\s+([,.;:!?])/g,'$1').replace(/([,.;:!?])(?=[A-Za-zÀ-ÿ])/g,'$1 ');t.textContent=v;}
  if(texts.length){texts[0].textContent=(texts[0].textContent||'').replace(/^\s+/,'');texts[texts.length-1].textContent=(texts[texts.length-1].textContent||'').replace(/\s+$/,'');}
  // Jangan biarkan paragraf body diawali tab/spasi dari dokumen sumber.
  if(['body','subheading','conclusionHeading','abstractBody','abstractKeywords'].includes(role)&&texts[0])texts[0].textContent=(texts[0].textContent||'').trimStart();
}
function makeP(doc,text,role='body',extra={}){
  const t=esc(text);const bold=['title','author','section','sectionCenter','sectionLeft','conclusionHeading','abstractKeywords'].includes(role)||extra.bold;const italic=extra.italic;
  const xml=`<w:p><w:r><w:rPr>${bold?'<w:b/>':''}${italic?'<w:i/>':''}</w:rPr><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
  const p=frag(doc,xml);setParaFormat(doc,p,role);forceRuns(doc,p,role);normalizeTextNodes(p,role);return p;
}
function cleanCopied(doc,xml,role){const p=frag(doc,xml);if(p.localName==='p'){setParaFormat(doc,p,role);normalizeTextNodes(p,role);forceRuns(doc,p,role);}return p;}
function removeHeaderFooterRefs(sect){for(const x of [...sect.children])if(['headerReference','footerReference','pgNumType','titlePg'].includes(x.localName))x.remove();}
async function ensureFooter(zip,doc,sect){
  const relPath='word/_rels/document.xml.rels';let relXml=zip.file(relPath)?await zip.file(relPath).async('string'):`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL}"></Relationships>`;
  const rd=parser().parseFromString(relXml,'application/xml');const root=rd.documentElement;let max=0;for(const r of [...root.children]){const id=r.getAttribute('Id')||'';const m=id.match(/rId(\d+)/);if(m)max=Math.max(max,+m[1]);}
  const rid='rId'+(max+1);const re=rd.createElementNS(REL,'Relationship');re.setAttribute('Id',rid);re.setAttribute('Type','http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer');re.setAttribute('Target','footerArticle.xml');root.appendChild(re);zip.file(relPath,ser().serializeToString(rd));
  const footer=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="${W}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;zip.file('word/footerArticle.xml',footer);
  const ref=doc.createElementNS(W,'w:footerReference');ref.setAttributeNS(W,'w:type','default');ref.setAttributeNS(R,'r:id',rid);sect.insertBefore(ref,sect.firstChild);
  const ctPath='[Content_Types].xml';if(zip.file(ctPath)){const cd=parser().parseFromString(await zip.file(ctPath).async('string'),'application/xml');const cr=cd.documentElement;const exists=[...cr.children].some(x=>x.getAttribute('PartName')==='/word/footerArticle.xml');if(!exists){const ov=cd.createElementNS(CT,'Override');ov.setAttribute('PartName','/word/footerArticle.xml');ov.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml');cr.appendChild(ov);zip.file(ctPath,ser().serializeToString(cd));}}
}
function setSect(doc,sect){removeHeaderFooterRefs(sect);for(const n of [...sect.children])if(['pgSz','pgMar','cols','docGrid'].includes(n.localName))n.remove();const sz=wEl(doc,'pgSz');sz.setAttributeNS(W,'w:w','11906');sz.setAttributeNS(W,'w:h','16838');sect.appendChild(sz);const mar=wEl(doc,'pgMar');[['top','1701'],['right','1701'],['bottom','1701'],['left','1701'],['header','720'],['footer','720'],['gutter','0']].forEach(([k,v])=>mar.setAttributeNS(W,'w:'+k,v));sect.appendChild(mar);}
function englishParagraphs(en){if(Array.isArray(en?.paragraphs)&&en.paragraphs.length)return en.paragraphs.map(norm).filter(Boolean);return String(en?.body||'').split(/\n\s*\n/).map(norm).filter(Boolean);}

export async function buildArticleDocx(docData,analysis,plan,metaOverride={},options={}){
  const zip=await JSZip.loadAsync(docData.arrayBuffer);const xml=await zip.file('word/document.xml').async('string');const doc=parser().parseFromString(xml,'application/xml');const body=doc.getElementsByTagNameNS(W,'body')[0];
  let sect=[...body.children].reverse().find(x=>x.localName==='sectPr');sect=sect?sect.cloneNode(true):doc.createElementNS(W,'w:sectPr');for(const ch of [...body.children])ch.remove();
  const meta={...analysis.meta,...metaOverride};
  body.appendChild(makeP(doc,(meta.title||'ARTIKEL ILMIAH').toUpperCase(),'title'));
  body.appendChild(makeP(doc,meta.author||'Nama Penulis','author'));
  if(meta.prodi)body.appendChild(makeP(doc,meta.prodi,'identity'));
  if(meta.univ)body.appendChild(makeP(doc,meta.univ,'identity'));
  for(const sec of plan.sections){
    const sectionRole=sec.id==='abstract'?'sectionCenter':sec.id==='biblio'?'sectionLeft':'section';
    body.appendChild(makeP(doc,sec.title,sectionRole));
    for(const x of sec.items){
      if(x.virtual){body.appendChild(makeP(doc,x.text||'',x.role==='bibliography'?'bibliography':'body'));continue;}
      const src=docData.items[x.index];if(!src)continue;
      let role=x.role==='bibliography'?'bibliography':x.role==='subheading'?'subheading':'body';
      if(sec.id==='abstract')role=x.role==='keywords'?'abstractKeywords':'abstractBody';
      if(sec.id==='conclusion'&&/^(?:[A-Z]\s*[.)]\s*)?(?:KESIMPULAN|SIMPULAN|SARAN)\b/i.test(src.text||''))role='conclusionHeading';
      body.appendChild(cleanCopied(doc,src.xml,role));
    }
    if(sec.id==='abstract'&&options.englishAbstract?.body){
      body.appendChild(makeP(doc,'ABSTRACT','sectionCenter'));
      const pars=englishParagraphs(options.englishAbstract);for(const par of pars)body.appendChild(makeP(doc,par,'abstractBody'));
      if(options.englishAbstract.keywords)body.appendChild(makeP(doc,'Keywords: '+options.englishAbstract.keywords,'abstractKeywords'));
    }
  }
  setSect(doc,sect);await ensureFooter(zip,doc,sect);body.appendChild(sect);zip.file('word/document.xml',ser().serializeToString(doc));
  const core=zip.file('docProps/core.xml');if(core){let c=await core.async('string');c=c.replace(/<dc:title>[\s\S]*?<\/dc:title>/,`<dc:title>${esc(meta.title||'Artikel Ilmiah')}</dc:title>`);zip.file('docProps/core.xml',c);}
  return await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'});
}

export function sourceFootnotes(docData,plan){const ids=new Set();for(const s of plan.sections)for(const x of s.items){if(x.virtual||x.index==null)continue;for(const id of (docData.items[x.index]?.footnoteIds||[]))ids.add(String(id));}return [...ids].map(id=>({id,text:docData.footnotes.get(String(id))||''})).filter(x=>x.text);}
