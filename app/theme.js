(()=>{
 const key='otkliki-interface-v1',q=id=>document.getElementById(id);
 const presets={dark:{bg:'#181818',surface:'#232323',accent:'#d4d4d4'},light:{bg:'#f1f3f6',surface:'#ffffff',accent:'#285cc7'},navy:{bg:'#101826',surface:'#1b293d',accent:'#8ab4f8'},forest:{bg:'#101e1a',surface:'#1d3028',accent:'#91c8a0'},plum:{bg:'#211923',surface:'#302433',accent:'#d9a7de'}};
 let saved={...presets.dark,preset:'dark',language:'ru',font:'system'};
 const rgb=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16));
 const lum=hex=>rgb(hex).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
 const mix=(a,b,t)=>'#'+rgb(a).map((v,i)=>Math.round(v*(1-t)+rgb(b)[i]*t).toString(16).padStart(2,'0')).join('');
 const valid=p=>p&&['bg','surface','accent'].every(k=>/^#[0-9a-f]{6}$/i.test(p[k]||''));
 function apply(p){
  const dark=lum(p.surface)<.179,text=dark?'#f4f4f5':'#18191c',muted=mix(p.surface,text,.69),style=document.documentElement.style;
  const v={...p,text,muted,field:mix(p.surface,dark?'#000000':'#ffffff',.12),line:mix(p.surface,text,.24),hover:mix(p.surface,text,.08),selected:mix(p.surface,p.accent,.13),link:dark?'#a8c7fa':'#174caa',warning:dark?'#efd26d':'#775700',danger:dark?'#f4a29d':'#a9211c','accent-text':lum(p.accent)>.179?'#121212':'#ffffff'};
  style.setProperty('--app-font',I18n.fonts[p.font]||I18n.fonts.system);I18n.setLanguage(p.language||'ru');
  Object.entries(v).forEach(([k,value])=>{if(!['preset','language','font'].includes(k))style.setProperty('--'+k,value);});
  style.colorScheme=dark?'dark':'light';
 }
 try{const raw=portableStorage.getItem(key);if(raw){const p=JSON.parse(raw);if(valid(p))saved=p;}}catch{}
 apply(saved);
 function fill(p){q('interface-language').value=p.language||'ru';q('interface-font').value=p.font||'system';q('theme-preset').value=presets[p.preset]?p.preset:'custom';for(const k of ['bg','surface','accent'])q('theme-'+k).value=p[k];}
 function read(){return {language:q('interface-language').value,font:q('interface-font').value,preset:q('theme-preset').value,...Object.fromEntries(['bg','surface','accent'].map(k=>[k,q('theme-'+k).value]))};}
 function open(){fill(saved);q('theme-status').textContent='';if(!q('theme-dialog').open)q('theme-dialog').showModal();}
 function cancel(){apply(saved);q('theme-dialog').close();}
 q('theme-close').onclick=q('theme-cancel').onclick=cancel;q('theme-dialog').addEventListener('cancel',e=>{e.preventDefault();cancel();});
 q('theme-preset').onchange=()=>{const p=presets[q('theme-preset').value];if(p){fill({...read(),...p,preset:q('theme-preset').value});apply(read());}};
 for(const k of ['bg','surface','accent'])q('theme-'+k).oninput=()=>{q('theme-preset').value='custom';apply(read());};
 for(const id of ['interface-language','interface-font'])q(id).onchange=()=>apply(read());
 q('theme-default').onclick=()=>{fill({...read(),...presets.dark,preset:'dark'});apply(read());};
 q('theme-form').onsubmit=e=>{e.preventDefault();const next=read();try{portableStorage.setItem(key,JSON.stringify(next));saved=next;apply(saved);q('theme-dialog').close();message(I18n.t("Настройки интерфейса сохранены."));}catch(err){q('theme-status').textContent=err.message;}};
 window.portable.onSettings(open);
})();
