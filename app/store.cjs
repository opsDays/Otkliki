const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Tracker=require('./applications_core.js');
const RECORDS='artur-zhuk-job-applications-v2',PROFILE='artur-zhuk-job-profile-v1',SORT=RECORDS+'-sort';
const THEME='otkliki-interface-v1';
const KEYS=new Set([RECORDS,PROFILE,SORT,THEME,'otkliki-table-v1','artur-zhuk-linkedin-contact-notes-v1']);
function checkCV(cv){if(!cv||!/^[a-f0-9]{64}\.(pdf|doc|docx)$/.test(cv.file)||typeof cv.name!=='string'||!Number.isInteger(cv.size)||cv.size<1||cv.size>20*1024*1024)throw Error(I18n.t("Некорректные данные CV"));}
class Store {
 constructor(dir){
  this.dir=dir;this.file=path.join(dir,'state.json');this.lastSnapshot=0;
  fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(path.join(dir,'backups'),{recursive:true});fs.mkdirSync(path.join(dir,'cv'),{recursive:true});
  this.state=this.validate(fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):{version:1,values:{},cv:null});
 }
 validate(state){
  if(!state||state.version!==1||!state.values||typeof state.values!=='object'||Array.isArray(state.values))throw Error(I18n.t("Не удалось прочитать данные. Исходный файл не изменён."));
  for(const [key,value] of Object.entries(state.values)){if(!KEYS.has(key)||typeof value!=='string')throw Error(I18n.t("Неизвестный формат данных"));this.validateValue(key,value);}
  if(state.cv)checkCV(state.cv);
  const cvs=state.cvs??(state.cv?[{...state.cv,id:'legacy-cv',label:state.cv.name}]:[]);
  if(!Array.isArray(cvs)||cvs.length>10)throw Error(I18n.t("Можно хранить до 10 версий CV"));
  for(const cv of cvs){checkCV(cv);if(typeof cv.id!=='string'||!cv.id||cv.id.length>100||typeof cv.label!=='string'||!cv.label.trim()||cv.label.length>300)throw Error(I18n.t("Некорректная версия CV"));}
  if(new Set(cvs.map(c=>c.id)).size!==cvs.length||cvs.reduce((n,c)=>n+c.size,0)>100*1024*1024)throw Error(I18n.t("Некорректная библиотека CV или больше 100 МБ"));
  const active=state.cv?(cvs.find(c=>c.id===state.cv.id)||cvs.find(c=>c.file===state.cv.file)):null;
  if(state.cv&&!active)throw Error(I18n.t("Активное CV не найдено"));
  return {...state,cvs,cv:active||null};
 }
 validateValue(key,value){
  if(Buffer.byteLength(value)>16*1024*1024)throw Error(I18n.t("Слишком большой список"));
  if(key===RECORDS)Tracker.cleanList(JSON.parse(value));
  if(key===PROFILE){const p=JSON.parse(value);if(!p||['name','role','portfolio','letter'].some(k=>typeof p[k]!=='string'))throw Error(I18n.t("Некорректный профиль"));}
  if(key===PROFILE){const p=JSON.parse(value);if(p.templates!==undefined){if(!Array.isArray(p.templates)||p.templates.length>30||p.templates.some(t=>!t||typeof t.id!=='string'||typeof t.label!=='string'||typeof t.text!=='string'||t.text.length>50000||t.label.length>300)||new Set(p.templates.map(t=>t.id)).size!==p.templates.length)throw Error(I18n.t("Некорректные шаблоны писем"));}}
  if(key==='otkliki-table-v1'){const p=JSON.parse(value);if(!p||typeof p.compact!=='boolean'||!Array.isArray(p.columns)||p.columns.length!==5||new Set(p.columns.map(c=>c.id)).size!==5||p.columns.some(c=>!['contact','job','stage','note','actions'].includes(c.id)||typeof c.show!=='boolean'||!Number.isInteger(c.width)||c.width<110||c.width>900||(['contact','actions'].includes(c.id)&&!c.show)))throw Error('Invalid table settings');}
  if(key===THEME){const p=JSON.parse(value);if((p?.language!==undefined&&!['ru','en'].includes(p.language))||(p?.font!==undefined&&!Object.hasOwn(I18n.fonts,p.font)))throw Error(I18n.t('Некорректные настройки интерфейса'));if(!p||['bg','surface','accent'].some(k=>typeof p[k]!=='string'||!/^#[0-9a-f]{6}$/i.test(p[k])))throw Error(I18n.t("Некорректные цвета темы"));}
 }
 atomic(file,value){
  const tmp=file+'.'+crypto.randomUUID()+'.tmp';let fd;
  try{fd=fs.openSync(tmp,'wx');fs.writeFileSync(fd,value);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(tmp,file);}
  finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
 }
 snapshot(){
  if(!fs.existsSync(this.file))return;
  const name=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8)+'.json';
  this.atomic(path.join(this.dir,'backups',name),JSON.stringify(this.state,null,2));this.lastSnapshot=Date.now();
  // Keep all snapshots: no automatic deletion of the user's recovery history.
 }
 commit(next,force=false){
  next=this.validate(next);
  if(JSON.stringify(this.state)===JSON.stringify(next))return;
  if(fs.existsSync(this.file)){
   if(force||Date.now()-this.lastSnapshot>=5*60*1000)this.snapshot();
   this.atomic(path.join(this.dir,'previous.json'),JSON.stringify(this.state,null,2));
  }
  this.atomic(this.file,JSON.stringify(next,null,2));this.state=next;
 }
 get(key){if(!KEYS.has(key))throw Error('Недоступный ключ');return this.state.values[key]??null;}
 set(key,value){
  if(!KEYS.has(key)||typeof value!=='string')throw Error('Недоступный ключ');this.validateValue(key,value);
  let destructive=false;
  if(key===RECORDS&&this.state.values[key]){const next=new Map(JSON.parse(value).map(r=>[r.id,r])),old=JSON.parse(this.state.values[key]);destructive=next.size!==old.length||old.some(r=>!next.has(r.id)||(!r.deleted&&next.get(r.id).deleted));}
  this.commit({...this.state,values:{...this.state.values,[key]:value}},destructive);
 }
 cvPut(name,bytes){
  if(typeof name!=='string'||name.length>500||!(/\.(pdf|doc|docx)$/i.test(name)))throw Error('Нужен файл PDF, DOC или DOCX');
  const buffer=Buffer.from(bytes);if(!buffer.length||buffer.length>20*1024*1024)throw Error('CV должно быть размером до 20 МБ');
  const ext=name.match(/\.([^.]+)$/)[1].toLowerCase(),file=crypto.createHash('sha256').update(buffer).digest('hex')+'.'+ext;
  this.atomic(path.join(this.dir,'cv',file),buffer);
  return {name:path.basename(name),file,size:buffer.length};
 }
 putCV(name,bytes){if(this.state.cvs.length>=10)throw Error('Можно хранить до 10 версий CV');const cv={...this.cvPut(name,bytes),id:crypto.randomUUID(),label:path.basename(name)};this.commit({...this.state,cv,cvs:[...this.state.cvs,cv]},true);return cv;}
 listCV(){return {items:this.state.cvs.map(c=>({...c})),activeId:this.state.cv?.id||''};}
 selectCV(id){const cv=this.state.cvs.find(c=>c.id===id);if(!cv)throw Error('CV не найдено');this.commit({...this.state,cv});}
 renameCV(id,label){if(typeof label!=='string'||!label.trim()||label.length>300)throw Error('Введите название до 300 символов');const cvs=this.state.cvs.map(c=>c.id===id?{...c,label:label.trim()}:c);this.commit({...this.state,cvs,cv:cvs.find(c=>c.id===this.state.cv?.id)||null});}
 getCV(id){const cv=id?this.state.cvs.find(c=>c.id===id):this.state.cv;if(!cv)return null;return {id:cv.id,name:cv.name,bytes:fs.readFileSync(path.join(this.dir,'cv',cv.file))};}
 removeCV(id=this.state.cv?.id){const cvs=this.state.cvs.filter(c=>c.id!==id);this.commit({...this.state,cvs,cv:cvs.find(c=>c.id===this.state.cv?.id)||cvs[0]||null},true);}
 bundle(){const cvs=this.state.cvs.map(c=>({id:c.id,label:c.label,name:c.name,base64:this.getCV(c.id).bytes.toString('base64')}));return {format:'otkliki-portable',version:2,exportedAt:new Date().toISOString(),values:this.state.values,cvs,activeCvId:this.state.cv?.id||''};}
 prepareImport(payload){
  if(payload?.format==='otkliki-portable'&&payload.version===2){
   this.validate({version:1,values:payload.values,cv:null});
   if(!Array.isArray(payload.cvs)||payload.cvs.length>10||new Set(payload.cvs.map(c=>c.id)).size!==payload.cvs.length)throw Error('Некорректная библиотека CV');
   let size=0;for(const c of payload.cvs){if(!c||typeof c.id!=='string'||!c.id||c.id.length>100||typeof c.label!=='string'||!c.label.trim()||c.label.length>300||typeof c.name!=='string'||!(/\.(pdf|doc|docx)$/i.test(c.name))||typeof c.base64!=='string'||!(/^[A-Za-z0-9+/]*={0,2}$/.test(c.base64)))throw Error('Некорректное CV');const bytes=Buffer.from(c.base64,'base64').length;if(!bytes||bytes>20*1024*1024)throw Error('CV до 20 МБ');size+=bytes;}
   if(size>100*1024*1024||typeof payload.activeCvId!=='string'||(payload.activeCvId&&!payload.cvs.some(c=>c.id===payload.activeCvId)))throw Error('Некорректная библиотека CV');
   return {values:payload.values,cvs:payload.cvs,activeCvId:payload.activeCvId};
  }
  if(payload?.format==='otkliki-portable'&&payload.version===1){
   this.validate({version:1,values:payload.values,cv:null});
   if(payload.cv&&(typeof payload.cv.name!=='string'||typeof payload.cv.base64!=='string'||payload.cv.base64.length>28*1024*1024||!(/^[A-Za-z0-9+/]*={0,2}$/.test(payload.cv.base64))))throw Error('Некорректное CV');
   return {values:payload.values,cv:payload.cv||null};
  }
  if(payload?.format==='job-applications'&&payload.version===2)return {values:{...this.state.values,[RECORDS]:JSON.stringify(Tracker.cleanList(payload.records))},cv:'keep'};
  throw Error('Выберите файл переноса или резервную копию откликов');
 }
 importBundle(payload){const prepared=this.prepareImport(payload);if(prepared.cvs){const cvs=prepared.cvs.map(c=>({...this.cvPut(c.name,Buffer.from(c.base64,'base64')),id:c.id,label:c.label}));this.commit({version:1,values:{...prepared.values},cvs,cv:cvs.find(c=>c.id===prepared.activeCvId)||null},true);return;}let cv=this.state.cv,cvs=this.state.cvs;if(prepared.cv!=='keep'){cv=prepared.cv?{...this.cvPut(prepared.cv.name,Buffer.from(prepared.cv.base64,'base64')),id:'legacy-cv',label:prepared.cv.name}:null;cvs=cv?[cv]:[];}this.commit({version:1,values:{...prepared.values},cv,cvs},true);}
 restoreSnapshot(state){state=this.validate(state);for(const cv of state.cvs)if(!fs.existsSync(path.join(this.dir,'cv',cv.file)))throw Error('Файл CV для этого снимка не найден');this.commit(state,true);}
 restoreDeleted(){const raw=this.get(RECORDS);if(!raw)return 0;let n=0;const records=JSON.parse(raw).map(r=>{if(r.deleted){n++;return {...r,deleted:false};}return r;});if(n)this.commit({...this.state,values:{...this.state.values,[RECORDS]:JSON.stringify(records)}},true);return n;}
}
require('./feature-store.cjs')(Store,RECORDS);
module.exports={Store,RECORDS,PROFILE,SORT};
