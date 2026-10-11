const portableStorage={getItem:key=>window.portable.storageGet(key),setItem:(key,value)=>window.portable.storageSet(key,value)};
const $ = s => document.querySelector(s);
const seed=Tracker.cleanList(JSON.parse($('#seed-data').textContent));
const key='artur-zhuk-job-applications-v2',legacyKey='artur-zhuk-linkedin-contact-notes-v1';
let records=seed.map(r=>({...r})),storageOk=true,view='all',editing=null;
let lastDeleted=null;
const sortKey=key+'-sort',sortModes=['default','name-asc','name-desc','date-desc','date-asc','next-date','test-deadline'];
try{const savedSort=portableStorage.getItem(sortKey);$('#sort-order').value=sortModes.includes(savedSort)?savedSort:'default';}catch{$('#sort-order').value='default';}
function message(text,error=false){$('#save-status').textContent=I18n.t(text);$('#save-status').classList.toggle('error',error);}
try{
  const stored=portableStorage.getItem(key);
  if(stored){records=Tracker.cleanList(JSON.parse(stored));}
  else{const old=portableStorage.getItem(legacyKey);if(old)records=Tracker.migrateLegacy(JSON.parse(old),seed);}
  portableStorage.setItem(key,JSON.stringify(records));message(I18n.t("Автосохранение включено · в папке приложения"));
}catch{storageOk=false;message(I18n.t("Сохранение недоступно или данные не прочитались. Старые данные не перезаписаны. Новые изменения не сохраняются."),true);}
function persist(){
 if(!storageOk){message(I18n.t("Сохранение недоступно. Перезапустите приложение после проверки папки data."),true);return false;}
 try{const old=JSON.parse(portableStorage.getItem(key)||'[]'),next=Tracker.withHistory(records,old);portableStorage.setItem(key,JSON.stringify(next));next.forEach((r,i)=>Object.assign(records[i],r));message(I18n.t("Все изменения сохранены в папке приложения"));return true;}
 catch(error){storageOk=false;message(I18n.t("Не удалось сохранить: ")+error.message,true);return false;}
}
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn,cls){const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;}
function makeLink(value,label){const url=Tracker.safeUrl(value);if(!url)return el('span',label||value);const a=el('a',label||value);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function stageOptions(select,blank=false){select.replaceChildren();if(blank){const o=el('option',I18n.t("Все статусы"));o.value='';select.append(o);}for(const [value,label]of Object.entries(Tracker.stages)){const o=el('option',label);o.value=value;o.dataset.stage=value;select.append(o);}}
stageOptions($('#stage-filter'),true);stageOptions($('#f-stage'));
function updateStats(){
  const live=records.filter(r=>!r.archived&&!r.deleted);
  $('#stat-all').textContent=live.length;$('#stat-sent').textContent=live.filter(r=>!!r.appliedDate||['applied','reply','interview','test','offer','rejected'].includes(r.stage)).length;$('#today-count').textContent=live.filter(r=>Tracker.due(r)).length||'';
  $('#stat-tests').textContent=live.filter(r=>r.stage==='test').length;
  $('#stat-rejected').textContent=live.filter(r=>r.stage==='rejected').length;
  $('#stat-offers').textContent=live.filter(r=>r.stage==='offer').length;
}
function visible(r){
  if(view==='archive'?!r.archived:r.archived)return false;
  if(['test','rejected','offer'].includes(view)&&r.stage!==view)return false;
  if(view==='selected'&&!r.reviewed)return false;if(view==='today'&&!Tracker.due(r))return false;
  if($('#stage-filter').value&&r.stage!==$('#stage-filter').value)return false;
  const term=$('#search').value.toLocaleLowerCase();
  return [r.name,r.company,r.person,r.nextAction,r.contact,r.website,r.vacancy,r.note,r.role,r.group,r.source,r.jobText].join(' ').toLocaleLowerCase().includes(term);
}
function render(){
  updateStats();$('#stage-filter').dataset.stage=$('#stage-filter').value;const body=$('#records');body.replaceChildren();let count=0;
  for(const r of Tracker.sorted(records,view==='test'&&$('#sort-order').value==='default'?'test-deadline':view==='today'&&$('#sort-order').value==='default'?'next-date':$('#sort-order').value)){if(r.deleted||!visible(r))continue;count++;
    const tr=el('tr');tr.dataset.id=r.id;tr.dataset.stage=r.stage;tr.classList.toggle('is-selected',r.reviewed);
    const contact=el('td');
    contact.append(el('span',r.company||r.name,'name'));if(r.person)contact.append(el('small',r.person,'contact-person'));if(r.contact)contact.append(makeLink(r.contact,r.contact));if(r.role)contact.append(el('small',r.role));
    const review=el('label',undefined,'review'),check=el('input');check.type='checkbox';check.checked=r.reviewed;check.setAttribute('aria-label',I18n.t("Выделить: ")+r.name);check.addEventListener('change',()=>{r.reviewed=check.checked;persist();render();});review.title=I18n.t("Выделить запись");review.append(check);contact.append(review);
    if(r.origin==='seed'){const details=el('details',undefined,'source');details.append(el('summary',I18n.t("Проверка найма · 10.10.2026")),el('p',r.evidence),el('p',r.context));contact.append(details);}
    const vacancy=el('td');vacancy.append(el('p',r.vacancy||I18n.t("Вакансия не указана")));const links=el('div',undefined,'links');if(r.website)links.append(makeLink(r.website,I18n.t("Сайт компании")));if(r.vacancyUrl)links.append(makeLink(r.vacancyUrl,I18n.t("Вакансия ↗")));vacancy.append(links);
    const progress=el('td'),select=el('select',undefined,'stage-select');stageOptions(select);select.value=r.stage;select.dataset.stage=r.stage;select.setAttribute('aria-label',I18n.t("Статус: ")+r.name);select.addEventListener('change',()=>{r.stage=select.value;if(r.stage==='applied'&&!r.appliedDate)r.appliedDate=Tracker.today();persist();render();});progress.append(select,el('div',r.appliedDate?I18n.t("Отклик: ")+r.appliedDate.split('-').reverse().join('.'):I18n.t("Дата отклика не указана"),'date'));
    const notes=el('td');
    const textarea=el('textarea',undefined,'inline-note');textarea.value=r.note;textarea.placeholder=I18n.t("Заметка…");textarea.setAttribute('aria-label',I18n.t("Заметка: ")+r.name);textarea.addEventListener('input',()=>{r.note=textarea.value;persist();});notes.append(textarea);if(typeof Workflow!=='undefined')Workflow.decorate(r,progress,notes);
    const actions=el('td'),buttons=el('div',undefined,'row-actions');buttons.append(button(I18n.t("История"),()=>Workflow.history(r.id)),button(I18n.t("Подготовить"),()=>Workflow.prepare([r.id])),button(I18n.t("Изменить"),()=>openEditor(r)),button(r.archived?I18n.t("Вернуть"):I18n.t("В архив"),()=>{r.archived=!r.archived;persist();render();}),button(I18n.t("Удалить"),()=>{r.deleted=true;lastDeleted=r.id;persist();render();$('#delete-message').textContent=I18n.t("Удалена запись: ")+r.name;$('#undo-delete').hidden=false;},'danger'));actions.append(buttons);tr.append(contact,vacancy,progress,notes,actions);body.append(tr);
  }
  $('#count').textContent=I18n.f("Показано {0} · Выделено {1}",[count,records.filter(r=>!r.archived&&!r.deleted&&r.reviewed).length]);$('#empty').hidden=!!count;if(typeof Workflow!=='undefined')Workflow.bulkCount();
}
$('#undo-delete-button').onclick=()=>{const r=records.find(r=>r.id===lastDeleted);if(r){r.deleted=false;persist();render();}lastDeleted=null;$('#undo-delete').hidden=true;};
$('#sort-order').addEventListener('change',()=>{try{portableStorage.setItem(sortKey,$('#sort-order').value);}catch{}render();});
function openEditor(r){editing=r?.id||null;$('#editor-title').textContent=r?I18n.t("Изменить запись"):I18n.t("Новая запись");$('#entry-form').reset();$('#form-error').textContent='';for(const k of ['source','jobText','interviewAt','interviewZone','reminderAt','name','company','person','contact','website','vacancy','vacancyUrl','note','appliedDate','nextAction','nextDate','testDeadline','testUrl','testSentDate'])$('#f-'+k).value=r?.[k]||'';$('#f-stage').value=r?.stage||'new';$('#f-reviewed').checked=r?.reviewed||false;$('#f-stage').dataset.stage=$('#f-stage').value;if(typeof Workflow!=='undefined')Workflow.editor(r);$('#editor').showModal();$('#f-name').focus();}
$('#add').onclick=()=>openEditor();$('#empty-add').onclick=()=>openEditor();$('#close').onclick=()=>$('#editor').close();$('#cancel').onclick=()=>$('#editor').close();
$('#f-stage').addEventListener('change',()=>{if($('#f-stage').value==='applied'&&!$('#f-appliedDate').value)$('#f-appliedDate').value=Tracker.today();});
$('#entry-form').addEventListener('submit',event=>{event.preventDefault();const existing=records.find(r=>r.id===editing);const r=existing?{...existing}:{id:'custom-'+crypto.randomUUID(),origin:'custom',role:'',group:'',evidence:'',context:'',archived:false};for(const k of ['source','jobText','interviewAt','interviewZone','reminderAt','name','company','person','contact','website','vacancy','vacancyUrl','note','appliedDate','nextAction','nextDate','testDeadline','testUrl','testSentDate'])r[k]=$('#f-'+k).value.trim();r.stage=$('#f-stage').value;r.reviewed=$('#f-reviewed').checked;r.color=existing?.color||'';r.cvId=$('#f-cvId').value;r.letterId=$('#f-letterId').value;if(!r.name)r.name=[r.company,r.person].filter(Boolean).join(' — ');if(!r.name){$('#form-error').textContent=I18n.t("Введите контакт или компанию.");return;}for(const k of ['website','vacancyUrl','testUrl'])if(r[k]&&!/^https?:/i.test(Tracker.safeUrl(r[k])||'')){$('#form-error').textContent=I18n.t("Для сайта и вакансии укажите обычную ссылку http или https.");return;}try{const record=Tracker.clean(r);if(existing)records[records.indexOf(existing)]=record;else records.unshift(record);if(!persist())return;$('#editor').close();view='all';document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#search').value='';$('#stage-filter').value='';render();}catch{$('#form-error').textContent=I18n.t("Проверьте поля записи.");}});
for(const id of ['search','stage-filter'])$('#'+id).addEventListener(id==='search'?'input':'change',render);
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));render();}));
render();

for(const id of ['stage-filter','f-stage']){const select=$('#'+id);select.dataset.stage=select.value;select.addEventListener('change',()=>{select.dataset.stage=select.value;});}
