const Profile=(()=>{
 const q=s=>document.querySelector(s),key='artur-zhuk-job-profile-v1';
 const defaults=()=>({name:'',role:'',portfolio:'',letter:'',templates:[],activeLetter:''});
 let saved=defaults(),draft,library={items:[],activeId:''},readOk=true;
 function normalize(p){p={...defaults(),...p};if(!p.templates.length)p.templates=[{id:'legacy-letter',label:I18n.t("Основное письмо"),text:p.letter}];if(!p.templates.some(t=>t.id===p.activeLetter))p.activeLetter=p.templates[0].id;return p;}
 function load(){const raw=portableStorage.getItem(key);return normalize(raw?JSON.parse(raw):defaults());}
 function status(text,error=false){q('#profile-status').textContent=I18n.t(text);q('#profile-status').classList.toggle('error',error);}
 function cvStatus(text,error=false){q('#cv-status').textContent=I18n.t(text);q('#cv-status').classList.toggle('error',error);}
 try{saved=load();}catch{readOk=false;saved=normalize(defaults());status(I18n.t("Профиль не прочитан. Сохранение отключено до восстановления данных."),true);}
 draft=structuredClone(saved);
 function active(){return draft.templates.find(t=>t.id===draft.activeLetter);}
 function captureLetter(){const t=active();if(t){t.label=q('#letter-label').value.trim()||I18n.t("Без названия");t.text=q('#profile-letter').value;}}
 function drawLetters(){q('#letter-version').replaceChildren(...draft.templates.map(t=>new Option(t.label,t.id)));q('#letter-version').value=draft.activeLetter;const t=active();q('#letter-label').value=t?.label||'';q('#profile-letter').value=t?.text||'';q('#letter-delete').disabled=draft.templates.length<=1;}
 function updateLink(){const url=Tracker.safeUrl(q('#profile-portfolio').value);q('#portfolio-open').hidden=!/^https?:/i.test(url||'');q('#portfolio-open').href=url||'';}
 function fill(){for(const k of ['name','role','portfolio'])q('#profile-'+k).value=draft[k];drawLetters();updateLink();}
 function drawCV(){
  q('#cv-version').replaceChildren(...(library.items.length?library.items.map(c=>new Option(c.label,c.id)):[new Option(I18n.t("CV не добавлено"),'')]));q('#cv-version').value=library.activeId;
  const cv=library.items.find(c=>c.id===library.activeId);q('#cv-name').textContent=cv?.name||I18n.t("Резюме пока не добавлено");q('#cv-label').value=cv?.label||'';q('#cv-info').textContent=cv?(cv.size/1024/1024).toFixed(2)+I18n.t(" МБ"):'';
  q('#cv-upload').textContent=I18n.t("Добавить версию CV");q('#cv-download').hidden=q('#cv-remove').hidden=!cv;q('#cv-rename').disabled=!cv;
 }
 async function refreshCV(){library=await window.portable.cvList();drawCV();document.dispatchEvent(new Event('profile-updated'));return library;}
 function open(cvFocus=false){if(!q('#profile-dialog').open)q('#profile-dialog').showModal();(cvFocus?q('#cv-upload'):q('#profile-name')).focus();refreshCV().catch(e=>cvStatus(e.message,true));}
 q('#open-profile').onclick=()=>open();q('#open-cv').onclick=()=>download().catch(()=>{});q('#profile-close').onclick=q('#profile-cancel').onclick=()=>q('#profile-dialog').close();
 q('#profile-portfolio').oninput=updateLink;
 q('#letter-version').onchange=()=>{captureLetter();draft.activeLetter=q('#letter-version').value;drawLetters();};
 q('#letter-new').onclick=()=>{captureLetter();if(draft.templates.length>=30){status(I18n.t("Можно сохранить до 30 шаблонов."),true);return;}const t={id:crypto.randomUUID(),label:I18n.t("Новый шаблон"),text:''};draft.templates.push(t);draft.activeLetter=t.id;drawLetters();q('#letter-label').focus();status(I18n.t("Новый шаблон. Нажмите «Сохранить профиль»."));};
 q('#letter-delete').onclick=()=>{if(draft.templates.length<=1)return;draft.templates=draft.templates.filter(t=>t.id!==draft.activeLetter);draft.activeLetter=draft.templates[0].id;drawLetters();status(I18n.t("Шаблон удалён из формы. Нажмите «Сохранить профиль». История отправленных писем останется."));};
 q('#profile-form').onsubmit=event=>{event.preventDefault();if(!readOk)return;captureLetter();for(const k of ['name','role','portfolio'])draft[k]=q('#profile-'+k).value.trim();if(draft.portfolio&&!/^https?:/i.test(Tracker.safeUrl(draft.portfolio)||'')){status(I18n.t("Укажите ссылку http или https."),true);return;}draft.letter=active()?.text||'';try{portableStorage.setItem(key,JSON.stringify(draft));saved=structuredClone(draft);drawLetters();status(I18n.t("Профиль и шаблоны сохранены."));document.dispatchEvent(new Event('profile-updated'));}catch(e){status(e.message,true);}};
 q('#letter-copy').onclick=async()=>{try{await window.portable.copyText(q('#profile-letter').value);status(I18n.t("Письмо скопировано."));}catch(e){status(e.message,true);}};
 q('#cv-upload').onclick=()=>q('#cv-file').click();
 q('#cv-file').onchange=async()=>{const file=q('#cv-file').files[0];if(!file)return;q('#cv-upload').disabled=true;try{if(file.size>20*1024*1024)throw Error(I18n.t("CV до 20 МБ"));await window.portable.cvPut(file.name,new Uint8Array(await file.arrayBuffer()));await refreshCV();cvStatus(I18n.t("Версия CV сохранена."));}catch(e){cvStatus(e.message,true);}finally{q('#cv-upload').disabled=false;q('#cv-file').value='';}};
 q('#cv-version').onchange=async()=>{try{await window.portable.cvSelect(q('#cv-version').value);await refreshCV();cvStatus(I18n.t("Эта версия используется кнопкой CV."));}catch(e){cvStatus(e.message,true);}};
 q('#cv-rename').onclick=async()=>{try{await window.portable.cvRename(library.activeId,q('#cv-label').value);await refreshCV();cvStatus(I18n.t("Название сохранено."));}catch(e){cvStatus(e.message,true);}};
 q('#cv-remove').onclick=async()=>{try{await window.portable.cvDelete(library.activeId);await refreshCV();cvStatus(I18n.t("Версия удалена из списка. Файл остаётся в резервном хранилище."));}catch(e){cvStatus(e.message,true);}};
 async function download(id){try{const result=await window.portable.cvSave(id);if(result.missing){open(true);cvStatus(I18n.t("Сначала добавьте CV."));}else if(!result.canceled){message(I18n.t("CV сохранено в выбранный файл."));cvStatus(I18n.t("CV сохранено."));}return result;}catch(e){message(e.message,true);throw e;}}
 q('#cv-download').onclick=()=>download().catch(()=>{});
 document.addEventListener('language-changed',()=>{const label=q('#cv-label').value;drawCV();q('#cv-label').value=label;});
 fill();refreshCV().catch(e=>cvStatus(e.message,true));
 return {get:load,cvs:()=>library,refreshCV,download};
})();
