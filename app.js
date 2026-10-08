import {readDocx,buildArticleDocx,sourceFootnotes} from './docx-engine.js';
import {analyzeThesis,generatePlan,diagnostics,helpers} from './article-ai.js';
import {translateAbstractLocal,abstractSource,localTranslatorInfo} from './local-translator.js';

const $=s=>document.querySelector(s);
let state={file:null,doc:null,analysis:null,plan:null,blob:null,englishAbstract:null,translating:false,mapping:{intro:'auto',method:'auto',discussion:'auto',conclusion:'auto'}};
const app=$('#app');
app.innerHTML=`<div class="shell">
  <div class="top"><div class="brand"><h1>ZAIN.NET — Skripsi Jadi Artikel</h1><p>Scrib Article AI Lokal V1.4 • detektor universal • sinkron footnote–daftar pustaka • tanpa API token</p></div><div class="badge">AI LOKAL • NO API TOKEN</div></div>
  <div class="grid">
   <aside class="panel"><h2>1. Upload & Pengaturan</h2><div class="pad">
    <label class="drop" id="drop"><strong>Upload Skripsi Utuh (.DOCX)</strong><small>Klik atau seret file Word ke sini</small><input id="file" type="file" accept=".docx"></label>
    <div class="field"><label>Mode Artikel</label><select id="mode"><option value="contoh">Mirip Contoh Anda (~3.300 kata)</option><option value="ringkas">Ringkas (~2.300 kata)</option><option value="lengkap">Lengkap (~5.000+ kata)</option></select></div>
    <div class="field"><label>Nama Penulis</label><input id="author" placeholder="Deteksi otomatis"></div>
    <div class="field"><label>Program Studi</label><input id="prodi" placeholder="Contoh: Pendidikan Agama Islam"></div>
    <div class="field"><label>Universitas</label><input id="univ" placeholder="Contoh: Universitas Islam Negeri Madura"></div>
    <div class="mapBox" id="mapBox">
      <div class="mapTitle">Pemetaan Struktur Skripsi</div>
      <div class="mapHint">Detektor universal membaca BAB, isi, style Word, dan variasi nama bagian. Jika salah, pilih sumber manual lalu buat ulang.</div>
      <div class="field"><label>Pendahuluan</label><select id="mapIntro" disabled><option value="auto">AUTO — deteksi terbaik</option></select></div>
      <div class="field"><label>Metode Penelitian</label><select id="mapMethod" disabled><option value="auto">AUTO — deteksi terbaik</option></select></div>
      <div class="field"><label>Hasil / Pembahasan</label><select id="mapDiscussion" disabled><option value="auto">AUTO — deteksi terbaik</option></select></div>
      <div class="field"><label>Kesimpulan / Saran</label><select id="mapConclusion" disabled><option value="auto">AUTO — deteksi terbaik</option></select></div>
      <button class="btn ghost" id="applyMap" disabled>Terapkan Pemetaan & Buat Ulang</button>
      <div id="mapSummary" class="mapSummary">Belum dianalisis.</div>
    </div>
    <div class="checks">
      <label><input type="checkbox" checked disabled> Abstrak Indonesia</label><label><input type="checkbox" id="useEnglish" checked> Abstract English AI Lokal</label>
      <label><input type="checkbox" checked disabled> Pendahuluan</label><label><input type="checkbox" checked disabled> Metode</label>
      <label><input type="checkbox" checked disabled> Pembahasan</label><label><input type="checkbox" checked disabled> Kesimpulan/Saran</label>
      <label><input type="checkbox" checked disabled> Daftar Pustaka Sinkron Footnote</label>
    </div>
    <div class="aiBox">
      <div class="aiTitle">Abstract Bahasa Inggris</div>
      <div class="aiHint">Diterjemahkan per paragraf dengan <b>${localTranslatorInfo.model}</b>. Jumlah paragraf Inggris dibuat sama dengan Abstrak Indonesia.</div>
      <button class="btn ghost" id="translate" disabled>Terjemahkan Ulang dengan AI Lokal</button>
      <div class="field"><label>English Abstract (pisahkan paragraf dengan baris kosong)</label><textarea id="englishAbstract" rows="9" placeholder="Akan dibuat otomatis setelah analisis..."></textarea></div>
      <div class="field"><label>Keywords</label><input id="englishKeywords" placeholder="Akan diterjemahkan otomatis"></div>
    </div>
    <div class="btnrow"><button class="btn primary" id="analyze" disabled>Analisis & Buat Draft + Download Otomatis</button><button class="btn ghost" id="regen" disabled>Buat Ulang</button></div>
    <div class="progress"><i id="bar"></i></div><div id="msg"></div>
   </div></aside>
   <main class="panel"><h2>2. Hasil Scrib Article AI Lokal</h2><div class="pad">
    <div class="stats"><div class="stat"><b id="sWords">0</b><span>Kata Skripsi</span></div><div class="stat"><b id="aWords">0</b><span>Kata Draft</span></div><div class="stat"><b id="conf">0%</b><span>Deteksi Struktur</span></div><div class="stat"><b id="refs">0</b><span>Referensi Tersinkron</span></div></div>
    <div class="tabs"><button class="tab on" data-tab="review">Review Sumber</button><button class="tab" data-tab="preview">Preview Artikel</button><button class="tab" data-tab="info">Cara Kerja AI Lokal</button></div>
    <div id="review" class="tabpane"><div id="diag"></div><div id="sections" class="sections"><div class="notice">Upload skripsi untuk memulai.</div></div></div>
    <div id="preview" class="tabpane hidden"><div class="previewPaper" id="paper"></div></div>
    <div id="info" class="tabpane hidden"><div class="notice"><b>V1.4 memakai tiga lapis pemrosesan lokal.</b><br>Detektor universal memetakan struktur skripsi. AI lokal menerjemahkan abstrak per paragraf. Mesin referensi membaca footnote yang benar-benar ikut ke artikel lalu mencocokkannya dengan Daftar Pustaka sumber. Formatting Word dilakukan langsung pada XML DOCX tanpa API token.</div></div>
    <div class="btnrow"><button class="btn ok" id="download" disabled>Download Ulang Artikel .DOCX</button><button class="btn ghost" id="report" disabled>Download Laporan .TXT</button></div>
   </div></main>
  </div><div class="footer">ZAIN.NET • Scrib Article AI Lokal V1.4 • DOCX diproses di perangkat pengguna</div></div>`;

const fileInput=$('#file'),drop=$('#drop'),bar=$('#bar'),msg=$('#msg');
function setMsg(t,type=''){msg.innerHTML=t?`<div class="notice ${type}">${t}</div>`:'';}
function progress(n){bar.style.width=n+'%'}
function esc(s){return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function useFile(f){if(!f||!f.name.toLowerCase().endsWith('.docx')){setMsg('Pilih file .DOCX.','warn');return;}state.file=f;state.englishAbstract=null;$('#englishAbstract').value='';$('#englishKeywords').value='';$('#analyze').disabled=false;setMsg(`<b>${esc(f.name)}</b> siap dianalisis.`,'ok');}
fileInput.onchange=e=>useFile(e.target.files[0]);drop.onclick=e=>{if(e.target!==fileInput)fileInput.click()};
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.style.borderColor='#38bdf8'}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.style.borderColor=''}));drop.addEventListener('drop',e=>useFile(e.dataTransfer.files[0]));

function academicCase(s){
  let t=(s||'').replace(/^PROGRAM\s+STUDI\s*/i,'').trim();
  if(/^UIN\s+MADURA$/i.test(t))return 'Universitas Islam Negeri Madura';
  if(/^IAIN\s+MADURA$/i.test(t))return 'Institut Agama Islam Negeri Madura';
  const letters=t.replace(/[^A-Za-zÀ-ÿ]/g,'');const caps=letters.replace(/[^A-ZÀ-Ý]/g,'').length;
  if(letters&&caps/letters.length>.78)t=t.toLowerCase().replace(/(^|[\s/-])([a-zà-ÿ])/g,(m,a,b)=>a+b.toUpperCase());
  return t;
}
function mappingNow(){return {intro:$('#mapIntro').value||'auto',method:$('#mapMethod').value||'auto',discussion:$('#mapDiscussion').value||'auto',conclusion:$('#mapConclusion').value||'auto'};}
function roleLabel(r){return {intro:'Pendahuluan',method:'Metode',discussion:'Hasil/Pembahasan',conclusion:'Kesimpulan/Saran'}[r]||r;}
function populateMapping(a){
  const ids={intro:'#mapIntro',method:'#mapMethod',discussion:'#mapDiscussion',conclusion:'#mapConclusion'},blocks=(a.blocks||[]).filter(b=>b.wordCount>=40);
  for(const [role,sel] of Object.entries(ids)){const el=$(sel);el.innerHTML='<option value="auto">AUTO — deteksi terbaik</option>'+blocks.map(b=>`<option value="${esc(b.id)}">${esc(b.label)} — ${b.wordCount.toLocaleString('id-ID')} kata${b.role===role?' ✓':''}</option>`).join('');el.disabled=false;el.value=state.mapping[role]||'auto';}
  $('#applyMap').disabled=false;const auto=a.roleBlocks||{};$('#mapSummary').innerHTML=['intro','method','discussion','conclusion'].map(r=>{const b=auto[r];return `<div><b>${roleLabel(r)}:</b> ${b?esc(b.label)+' <span>('+b.wordCount.toLocaleString('id-ID')+' kata)</span>':'<em>belum ditemukan</em>'}</div>`;}).join('');
}
function planWithCurrentMapping(){state.mapping=mappingNow();return generatePlan(state.doc,state.analysis,{mode:$('#mode').value,mapping:state.mapping});}
function currentEnglish(){
  const body=$('#englishAbstract').value.trim(),keywords=$('#englishKeywords').value.trim();if(!body)return null;
  const paragraphs=body.split(/\n\s*\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  return {body:paragraphs.join('\n\n'),paragraphs,keywords,model:state.englishAbstract?.model||'manual/local'};
}
function englishParagraphsMatch(){
  if(!$('#useEnglish').checked)return true;const eng=currentEnglish();if(!eng||!state.doc||!state.plan)return false;
  const idCount=abstractSource(state.doc,state.plan).paragraphs?.length||0;return !idCount||eng.paragraphs.length===idCount;
}
async function rebuildBlob(){if(!state.doc||!state.plan)return;const english=$('#useEnglish').checked?currentEnglish():null;state.blob=await buildArticleDocx(state.doc,state.analysis,state.plan,{author:$('#author').value,prodi:academicCase($('#prodi').value),univ:academicCase($('#univ').value)},{englishAbstract:english});$('#download').disabled=$('#useEnglish').checked&&(!english||!englishParagraphsMatch());}
async function doTranslate(){
  if(!state.doc||!state.plan||state.translating)return false;state.translating=true;$('#translate').disabled=true;$('#download').disabled=true;
  try{const tr=await translateAbstractLocal(state.doc,state.plan,s=>setMsg(esc(s),'warn'));state.englishAbstract=tr;$('#englishAbstract').value=(tr.paragraphs||[]).join('\n\n')||tr.body||'';$('#englishKeywords').value=tr.keywords||'';setMsg(`Abstract Inggris selesai: ${tr.paragraphCount||tr.paragraphs?.length||0} paragraf, sama dengan sumber Indonesia. Silakan review.`, 'ok');render();await rebuildBlob();return true;}
  catch(e){console.error(e);setMsg('AI lokal gagal membuat English Abstract: '+esc(e.message||String(e))+'. Anda dapat mencoba lagi atau isi manual.','warn');return false;}
  finally{state.translating=false;$('#translate').disabled=false;}
}

async function run(){try{
  progress(10);setMsg('Membaca seluruh struktur DOCX…');state.doc=await readDocx(state.file);progress(30);state.analysis=analyzeThesis(state.doc);const a=state.analysis;
  $('#author').value=a.meta.author||'';$('#prodi').value=academicCase(a.meta.prodi||'');$('#univ').value=academicCase(a.meta.univ||'');progress(48);
  setMsg('Scrib Article AI Lokal menilai struktur, footnote, dan relevansi paragraf…');populateMapping(a);state.plan=planWithCurrentMapping();progress(65);render();$('#translate').disabled=false;
  if($('#useEnglish').checked){progress(72);await doTranslate();progress(92);}else{state.englishAbstract=null;$('#englishAbstract').value='';$('#englishKeywords').value='';}
  await rebuildBlob();progress(100);$('#report').disabled=false;$('#regen').disabled=false;$('#download').disabled=$('#useEnglish').checked&&!currentEnglish();
  const readyEnglish=!$('#useEnglish').checked||currentEnglish();
  if(readyEnglish&&englishParagraphsMatch()&&state.blob){
    setMsg(`Draft artikel selesai. File <b>Artikel_${esc(shortAuthor())}.docx</b> sedang didownload otomatis.`, 'ok');
    setTimeout(()=>saveBlob(state.blob,`Artikel_${shortAuthor()}.docx`),120);
  }else if(readyEnglish){
    setMsg('Draft selesai, tetapi jumlah paragraf Abstract Inggris belum sama dengan Abstrak Indonesia. Perbaiki lalu download manual.','warn');
  }

}catch(e){console.error(e);setMsg('Gagal: '+esc(e.message||String(e)),'warn');progress(0)}}
$('#analyze').onclick=run;$('#translate').onclick=doTranslate;
$('#regen').onclick=async()=>{if(!state.doc)return;state.plan=planWithCurrentMapping();render();if($('#useEnglish').checked&&!currentEnglish())await doTranslate();await rebuildBlob();setMsg('Draft dibuat ulang dengan mode baru.','ok')};
$('#applyMap').onclick=async()=>{if(!state.doc)return;state.plan=planWithCurrentMapping();render();await rebuildBlob();setMsg('Pemetaan struktur diterapkan. Periksa Review Sumber sebelum download.','ok')};
['mapIntro','mapMethod','mapDiscussion','mapConclusion'].forEach(id=>$('#'+id).addEventListener('change',()=>{state.mapping=mappingNow();}));
$('#useEnglish').onchange=async()=>{if(!state.doc)return;if($('#useEnglish').checked&&!currentEnglish())await doTranslate();else await rebuildBlob();render();};
let editTimer;['englishAbstract','englishKeywords','author','prodi','univ'].forEach(id=>$('#'+id).addEventListener('input',()=>{clearTimeout(editTimer);editTimer=setTimeout(async()=>{render();await rebuildBlob();},350)}));

function itemText(d,x){return x.virtual?(x.text||''):(d.items[x.index]?.text||'');}
function render(){
 const a=state.analysis,p=state.plan,d=state.doc;if(!a||!p||!d)return;
 $('#sWords').textContent=a.wordCount.toLocaleString('id-ID');$('#aWords').textContent=p.totalWords.toLocaleString('id-ID');$('#conf').textContent=Math.round(a.confidence*100)+'%';const b=p.sections.find(x=>x.id==='biblio');$('#refs').textContent=b?b.items.length:0;
 const notes=diagnostics(d,a,p);$('#diag').innerHTML=notes.map(x=>`<div class="notice warn">${esc(x)}</div>`).join('')||'<div class="notice ok">Struktur utama terdeteksi dengan baik.</div>';
 $('#sections').innerHTML=p.sections.map(s=>`<div class="sec"><div class="secHead"><b>${esc(s.title)}</b><span>${s.items.reduce((z,x)=>z+helpers.wc(itemText(d,x)),0)} kata • ${s.items.length} blok</span></div><div class="paras">${s.items.map(x=>`<div class="para ${x.role==='subheading'?'sub':''}">${esc(itemText(d,x))}<span class="trace">${x.virtual?'Dari footnote terpakai':'Sumber blok #'+(x.index+1)} • ${esc(x.source)}</span></div>`).join('')}</div></div>`).join('');
 const m={...a.meta,author:$('#author').value||a.meta.author,prodi:academicCase($('#prodi').value||a.meta.prodi),univ:academicCase($('#univ').value||a.meta.univ)};
 let html=`<h3>${esc((m.title||'ARTIKEL ILMIAH').toUpperCase())}</h3><div class="identity author"><b>${esc(m.author||'Nama Penulis')}</b></div><div class="identity academic">${esc(m.prodi||'')}</div><div class="identity academic">${esc(m.univ||'')}</div>`;
 for(const s of p.sections){
   html+=`<h4 class="${s.id==='abstract'?'center':s.id==='biblio'?'left':''}">${esc(s.title)}</h4>`;
   for(const x of s.items){const t=itemText(d,x),isAbs=s.id==='abstract',isConc=s.id==='conclusion'&&/^(?:[A-Z]\s*[.)]\s*)?(?:KESIMPULAN|SIMPULAN|SARAN)\b/i.test(t),isKey=isAbs&&(x.role==='keywords'||/^KATA\s*KUNCI\b/i.test(t));html+=`<p class="${x.role==='subheading'?'sub ':''}${isAbs?'abstractText ':''}${isConc?'conclusionHead ':''}${isKey?'abstractKeywords ':''}${s.id==='biblio'?'bib ':''}">${isKey?'<b>'+esc(t)+'</b>':esc(t)}</p>`;}
   if(s.id==='abstract'&&$('#useEnglish').checked){const eng=currentEnglish();if(eng?.body){html+=`<h4 class="center">ABSTRACT</h4>${eng.paragraphs.map(par=>`<p class="abstractText">${esc(par)}</p>`).join('')}${eng.keywords?`<p class="abstractKeywords"><b>Keywords: ${esc(eng.keywords)}</b></p>`:''}`;}else html+=`<div class="previewPending">English Abstract belum tersedia.</div>`;}
 }
 $('#paper').innerHTML=html;
}

for(const t of document.querySelectorAll('.tab'))t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));document.querySelectorAll('.tabpane').forEach(x=>x.classList.add('hidden'));t.classList.add('on');$('#'+t.dataset.tab).classList.remove('hidden')};
function saveBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function shortAuthor(){const raw=($('#author').value||state.analysis?.meta?.author||'Mahasiswa').trim();return (raw.split(/\s+/)[0]||'Mahasiswa').replace(/[^\p{L}\p{N}-]+/gu,'')||'Mahasiswa';}
$('#download').onclick=async()=>{if(!state.blob)return;if($('#useEnglish').checked&&!currentEnglish()){setMsg('English Abstract belum selesai. Terjemahkan dulu atau matikan opsi Abstract English.','warn');return;}if(!englishParagraphsMatch()){const idCount=abstractSource(state.doc,state.plan).paragraphs?.length||0,enCount=currentEnglish()?.paragraphs?.length||0;setMsg(`Jumlah paragraf belum sama: Indonesia ${idCount}, Inggris ${enCount}. Pisahkan English Abstract dengan baris kosong atau klik Terjemahkan Ulang.`, 'warn');return;}await rebuildBlob();saveBlob(state.blob,`Artikel_${shortAuthor()}.docx`)};
$('#report').onclick=()=>{const a=state.analysis,p=state.plan;const fns=sourceFootnotes(state.doc,p);const refs=p.sections.find(s=>s.id==='biblio')?.items.length||0;const abs=abstractSource(state.doc,p),eng=currentEnglish();let txt=`ZAIN.NET — LAPORAN SCRIB ARTICLE AI LOKAL V1.4\n\nFile: ${state.file.name}\nJudul: ${a.meta.title}\nPenulis: ${$('#author').value}\nProgram Studi: ${academicCase($('#prodi').value)}\nUniversitas: ${academicCase($('#univ').value)}\nKata skripsi: ${a.wordCount}\nKata draft: ${p.totalWords}\nConfidence struktur: ${Math.round(a.confidence*100)}%\nFootnote yang ikut terpakai: ${fns.length}\nReferensi tersinkron: ${refs}\nParagraf Abstrak Indonesia: ${abs.paragraphs?.length||0}\nParagraf Abstract Inggris: ${eng?.paragraphs?.length||0}\nEnglish Abstract: ${eng?'YA — '+(state.englishAbstract?.model||'manual'):'TIDAK'}\n\nBAGIAN TERPILIH:\n`;for(const s of p.sections)txt+=`- ${s.title}: ${s.items.length} blok\n`;txt+='\nPEMETAAN STRUKTUR:\n';for(const r of ['intro','method','discussion','conclusion']){const b=p.usedBlocks?.[r];txt+=`- ${roleLabel(r)}: ${b?b.label+' ('+b.wordCount+' kata)':'TIDAK DITEMUKAN'}\n`;}txt+='\nFormat V1.4: identitas akademik diperbesar; ABSTRAK/ABSTRACT centered dan single spacing; jumlah paragraf EN=ID; kata kunci bold; indent isi diperkecil; Daftar Pustaka rata kiri dan tersinkron dengan footnote; nama file Artikel_Nama.docx.\n';saveBlob(new Blob([txt],{type:'text/plain;charset=utf-8'}),'Laporan_Artikel_ZAINNET.txt')};
