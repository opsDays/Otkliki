if(typeof module!=='undefined'){require('./i18n.js');require('./feature-core.js');}
const Tracker = (() => {
  const stages = {new:I18n.t("Не откликался"),applied:I18n.t("Откликнулся"),reply:I18n.t("Получен ответ"),interview:I18n.t("Собеседование"),test:I18n.t("Тестовое"),offer:I18n.t("Оффер"),rejected:I18n.t("Отказ"),paused:I18n.t("Пауза")};
  const textFields = ['name','contact','website','vacancy','vacancyUrl','note','role','group','evidence','context'];
  function clean(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record) || typeof record.id !== 'string' || !record.id || record.id.length>500) throw Error(I18n.t("Неверная запись"));
    const r={id:record.id};
    for(const k of textFields){if(record[k]!==undefined && typeof record[k]!=='string')throw Error(I18n.t("Неверное поле"));r[k]=record[k]||'';}
    if(!r.name.trim())throw Error(I18n.t("Отсутствует имя"));
    if(typeof record.stage!=='string'||!Object.hasOwn(stages,record.stage))throw Error(I18n.t("Неверный статус"));
    r.stage=record.stage;
    if(typeof record.color!=='string'||(record.color && !/^#[0-9a-f]{6}$/i.test(record.color)))throw Error(I18n.t("Неверный цвет"));
    r.color=(record.color||'').toLowerCase();
    r.appliedDate=record.appliedDate;
    if(typeof r.appliedDate!=='string'||(r.appliedDate && (!/^\d{4}-\d{2}-\d{2}$/.test(r.appliedDate)||!Number.isFinite(Date.parse(r.appliedDate))||new Date(r.appliedDate).toISOString().slice(0,10)!==r.appliedDate)))throw Error(I18n.t("Неверная дата"));
    for(const k of ['reviewed','archived']){if(typeof record[k]!=='boolean')throw Error(I18n.t("Неверная отметка"));r[k]=record[k];}
    if(record.deleted!==undefined&&typeof record.deleted!=='boolean')throw Error(I18n.t("Неверная отметка удаления"));
    r.deleted=record.deleted===true;
    if(!['seed','custom'].includes(record.origin))throw Error(I18n.t("Неверный источник"));r.origin=record.origin;
    for(const k of ['company','person','nextAction','nextDate','testDeadline','testUrl','testSentDate','cvId','letterId']){
      if(record[k]!==undefined&&typeof record[k]!=='string')throw Error(I18n.t("Неверное поле ")+k);
      r[k]=record[k]||'';
    }
    for(const k of ['nextDate','testDeadline','testSentDate'])if(r[k]&&!validDate(r[k]))throw Error(I18n.t("Неверная дата"));
    r.history=record.history||[];
    if(!Array.isArray(r.history)||r.history.length>5000)throw Error(I18n.t("Неверная история"));
    r.history=r.history.map(e=>{
      if(!e||typeof e.id!=='string'||typeof e.at!=='string'||!Number.isFinite(Date.parse(e.at))||typeof e.text!=='string'||e.text.length>50000)throw Error(I18n.t("Неверное событие"));
      const event={id:e.id,at:e.at,text:e.text};
      for(const k of ['cvId','cvName','letter','recipient'])if(e[k]!==undefined){if(typeof e[k]!=='string'||e[k].length>50000)throw Error(I18n.t("Неверное событие"));event[k]=e[k];}
      return event;
    });
    return FeatureCore.validate(r,record);
  }
  function cleanList(list){
    if(!Array.isArray(list))throw Error(I18n.t("Неверный список"));
    const result=list.map(clean);if(new Set(result.map(r=>r.id)).size!==result.length)throw Error(I18n.t("Повторяющиеся записи"));return result;
  }
  function migrateLegacy(legacy, seed){
    if(!legacy || typeof legacy!=='object' || Array.isArray(legacy))throw Error(I18n.t("Неверные старые заметки"));
    return seed.map(r=>{const v=legacy[r.id];if(!v)return {...r};if(typeof v.note!=='string'||typeof v.reviewed!=='boolean')throw Error(I18n.t("Неверные старые заметки"));return {...r,note:v.note,reviewed:v.reviewed};});
  }
  function parseBackup(payload,seed){
    if(payload?.format==='job-applications'&&payload.version===2)return cleanList(payload.records);
    if(payload?.format==='linkedin-contact-notes'&&payload.version===1)return migrateLegacy(payload.contacts,seed);
    throw Error(I18n.t("Неподдерживаемый файл"));
  }
  function merge(current,incoming,seed){
    const result=current.map(r=>({...r})), index=new Map(result.map((r,i)=>[r.id,i])), originals=new Map(seed.map(r=>[r.id,r]));
    let added=0,updated=0,preserved=0;
    for(const r of incoming){
      if(!index.has(r.id)){index.set(r.id,result.length);result.push(r);added++;continue;}
      const i=index.get(r.id), old=result[i], base=originals.get(r.id);
      if(base && JSON.stringify(clean(old))===JSON.stringify(clean(base))){result[i]=r;updated++;}else preserved++;
    }
    return {records:result,added,updated,preserved};
  }
  function safeUrl(value){
    const v=value.trim();if(!v)return null;
    if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))return 'mailto:'+v;
    const candidate=/^[a-z][a-z\d+.-]*:/i.test(v)?v:/^[^\s/]+\.[^\s]+/.test(v)?'https://'+v:'';
    try{const u=new URL(candidate);return ['https:','http:','mailto:'].includes(u.protocol)?u.href:null;}catch{return null;}
  }
  function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
  function due(r,date=today()){return !!((r.nextDate&&r.nextDate<=date)||(r.stage==='test'&&r.testDeadline&&!r.testSentDate&&r.testDeadline<=date));}
  function withHistory(list,previous){
    const old=new Map(previous.map(r=>[r.id,r]));
    const labels={interviewAt:I18n.t('Время собеседования'),reminderAt:I18n.t('Напоминание'),source:I18n.t('Источник отклика'),stage:I18n.t("Статус"),nextAction:I18n.t("Следующее действие"),nextDate:I18n.t("Дата следующего действия"),testDeadline:I18n.t("Срок тестового"),testSentDate:I18n.t("Тестовое отправлено"),appliedDate:I18n.t("Дата отклика"),archived:I18n.t("Архив"),deleted:I18n.t("Удаление")};
    return cleanList(list).map(r=>{
      const before=old.get(r.id);let changes=[];
      if(!before){if(r.origin!=='seed')changes.push(I18n.t("Создана запись"));}
      else for(const [key,label]of Object.entries(labels))if((before[key]??'')!==r[key]){
        if(['archived','deleted'].includes(key))changes.push(key==='archived'?(r[key]?I18n.t("Перенесено в архив"):I18n.t("Возвращено из архива")):(r[key]?I18n.t("Запись удалена"):I18n.t("Запись восстановлена")));
        else changes.push(label+': '+(key==='stage'?I18n.t(stages[r[key]]):r[key]||I18n.t("очищено")));
      }
      if(changes.length)r.history.push({id:crypto.randomUUID(),at:new Date().toISOString(),text:changes.join('\n')});
      return r;
    });
  }
  function sorted(list,mode){
    const result=[...list],byName=(a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base',numeric:true});
    if(mode==='name-asc'||mode==='name-desc')result.sort((a,b)=>(mode==='name-desc'?-1:1)*byName(a,b));
    if(mode==='date-asc'||mode==='date-desc')result.sort((a,b)=>{
      if(!a.appliedDate&&!b.appliedDate)return byName(a,b);
      if(!a.appliedDate)return 1;if(!b.appliedDate)return -1;
      return (mode==='date-desc'?-1:1)*a.appliedDate.localeCompare(b.appliedDate)||byName(a,b);
    });
    if(mode==='next-date'||mode==='test-deadline'){const key=mode==='next-date'?'nextDate':'testDeadline';result.sort((a,b)=>((key==='testDeadline'&&a.testSentDate?'':a[key])||'9999').localeCompare((key==='testDeadline'&&b.testSentDate?'':b[key])||'9999')||byName(a,b));}
    return result;
  }
  return {get stages(){return Object.fromEntries(Object.entries(stages).map(([k,v])=>[k,I18n.t(v)]));},clean,cleanList,migrateLegacy,parseBackup,merge,safeUrl,today,sorted,validDate,due,withHistory};
})();
if(typeof module!=='undefined')module.exports=Tracker;
