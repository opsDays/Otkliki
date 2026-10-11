const fs=require('node:fs'),path=require('node:path');
const Core=require('./feature-core.js'),rawfs=require('original-fs');
module.exports=function setup({app,win,store,root,dataDir,ipcMain,dialog,Menu,Tray,Notification,nativeImage,RECORDS,trusted}){
 const t=I18n.t,prefFile=path.join(dataDir,'assistant-settings.json');let prefs={background:false,notifications:true,backupFolder:'',lastBackup:'',lastBackupError:''},tray,quitting=false,notices=new Map(),pendingRestore=null;
 try{prefs={...prefs,...JSON.parse(fs.readFileSync(prefFile,'utf8'))};}catch{}
 function save(){store.atomic(prefFile,JSON.stringify(prefs));}
 function outside(file){const rel=path.relative(path.resolve(dataDir),path.resolve(file));if(!rel||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)))throw Error(t('Выберите папку вне служебной папки data.'));}
 function show(){win.show();if(win.isMinimized())win.restore();win.focus();}
 function setTray(){if(prefs.background&&!tray){tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'assets/mushroom.png')).resize({width:20,height:20}));tray.setToolTip('Otkliki');tray.on('click',show);}if(tray)tray.setContextMenu(Menu.buildFromTemplate([{label:t('Отклики'),click:show},{label:t('Выход'),click:()=>app.quit()}]));if(!prefs.background&&tray){tray.destroy();tray=null;}}
 app.on('before-quit',()=>{quitting=true;});win.on('close',event=>{if(prefs.background&&!quitting){event.preventDefault();win.hide();}});setTray();
 function poll(){if(!prefs.notifications)return;const now=Date.now(),rows=JSON.parse(store.get(RECORDS)||'[]');let seen={};try{seen=JSON.parse(fs.readFileSync(path.join(dataDir,'reminders-seen.json'),'utf8'));}catch{}
  for(const r of rows){if(r.archived||r.deleted||!r.reminderAt||Date.parse(r.reminderAt)>now)continue;const key=r.id+'|'+r.reminderAt;if(seen[key])continue;if(Notification.isSupported()&&!process.env.OTKLIKI_TEST_MODE){const n=new Notification({title:t('Напоминание')+' · '+(r.company||r.name),body:r.nextAction||r.vacancy||t('Проверьте отклик'),icon:path.join(__dirname,'assets/mushroom.png')});n.on('click',()=>{show();win.webContents.send('open-feature','reminders');});n.show();notices.set(key,n);n.on('close',()=>notices.delete(key));}seen[key]=new Date().toISOString();}
  const active=new Set(rows.filter(r=>!r.deleted&&r.reminderAt).map(r=>r.id+'|'+r.reminderAt));seen=Object.fromEntries(Object.entries(seen).filter(([k])=>active.has(k)));store.atomic(path.join(dataDir,'reminders-seen.json'),JSON.stringify(seen));
 }
 function backup(){if(!prefs.backupFolder)throw Error(t('Сначала выберите папку копий.'));outside(prefs.backupFolder);fs.mkdirSync(prefs.backupFolder,{recursive:true});const file=path.join(prefs.backupFolder,'Otkliki-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');store.atomic(file,JSON.stringify(store.bundle()));prefs.lastBackup=new Date().toISOString();prefs.lastBackupError='';save();return file;}
 let lastState='';function autoBackup(){if(!prefs.backupFolder||Date.now()-Date.parse(prefs.lastBackup||'1970-01-01')<86400000)return;const signature=JSON.stringify(store.state);if(signature===lastState)return;try{backup();lastState=signature;}catch(e){prefs.lastBackupError=e.message;save();}}
 const timer=setInterval(()=>{try{poll();autoBackup();}catch{}},30000);timer.unref();app.on('will-quit',()=>{clearInterval(timer);tray?.destroy();});
 async function saveBytes(name,bytes,ext){const result=await dialog.showSaveDialog(win,{defaultPath:name,...(ext?{filters:[{name:ext,extensions:[ext]}]}:{})});if(result.canceled)return false;outside(result.filePath);store.atomic(result.filePath,bytes);return true;}
 async function cleanCopy(){const answer=await dialog.showOpenDialog(win,{title:t('Куда сохранить пустое приложение?'),properties:['openDirectory','createDirectory']});if(answer.canceled)return null;outside(answer.filePaths[0]);const distributionRoot=process.platform==='darwin'?path.resolve(process.execPath,'../../../..'):path.dirname(process.execPath),relative=path.relative(distributionRoot,answer.filePaths[0]);if(!relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw Error(t('Выберите папку вне текущего приложения.'));const dest=path.join(answer.filePaths[0],'Otkliki-Clean-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(dest);try{
   const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'distribution.json'),'utf8'));
   if(process.platform==='darwin'){await rawfs.promises.cp(path.resolve(process.execPath,'../../..'),path.join(dest,'Otkliki.app'),{recursive:true,dereference:false,verbatimSymlinks:true});for(const n of ['Первый запуск.command','entitlements.plist','LICENSE','LICENSES.chromium.html'])if(fs.existsSync(path.join(distributionRoot,n)))await rawfs.promises.copyFile(path.join(distributionRoot,n),path.join(dest,n));}
   else for(const rel of manifest){if(path.isAbsolute(rel)||rel.split(/[\\/]/).some(x=>x==='..'||x==='data'))throw Error('Invalid distribution manifest');const from=path.join(distributionRoot,rel),to=path.join(dest,rel);if(!rawfs.lstatSync(from).isFile())throw Error('Unexpected distribution file');fs.mkdirSync(path.dirname(to),{recursive:true});await rawfs.promises.copyFile(from,to);}
   fs.mkdirSync(path.join(dest,'data'));fs.writeFileSync(path.join(dest,'READ-ME.txt'),t('Пустая копия. Windows: Otkliki.exe. Mac: используйте Первый запуск.command. Создано Days.'),'utf8');return dest;
  }catch(e){throw Error(t('Не удалось создать копию. Неполная папка: ')+dest+'\n'+e.message);}
 }
 ipcMain.handle('portable-feature',async(event,action,payload={})=>{
  if(!trusted(event))throw Error(t('Недоступно'));
  if(action==='settings')return {...prefs,notificationSupport:Notification.isSupported()};
  if(action==='preferences'){if(typeof payload.background!=='boolean'||typeof payload.notifications!=='boolean')throw Error('Invalid preferences');prefs.background=payload.background;prefs.notifications=payload.notifications;save();setTray();return prefs;}
  if(action==='attachment-add')return store.addAttachment(payload.id,payload.name,payload.bytes);
  if(action==='attachment-remove')return store.removeAttachment(payload.id,payload.aid);
  if(action==='attachment-save'){const a=store.attachment(payload.id,payload.aid);return saveBytes(a.name,a.bytes);}
  if(action==='excel'){
   if(!Array.isArray(payload.ids)||payload.ids.length>100000||!['ru','en'].includes(payload.language))throw Error('Invalid export');const ids=new Set(payload.ids),map=new Map(JSON.parse(store.get(RECORDS)||'[]').filter(r=>!r.deleted&&ids.has(r.id)).map(r=>[r.id,r])),rows=payload.ids.map(id=>map.get(id)).filter(Boolean);const X=require('./vendor/xlsx.full.min.js');
   const columns=[['name','Название записи'],['company','Компания'],['person','Имя контакта / HR'],['vacancy','Вакансия'],['contact','Контакт для связи'],['website','Сайт компании'],['vacancyUrl','Ссылка на вакансию'],['stage','Статус'],['appliedDate','Дата отклика'],['source','Источник отклика'],['nextAction','Следующее действие'],['nextDate','Когда'],['testDeadline','Дедлайн тестового'],['interviewAt','Собеседование (UTC)'],['reminderAt','Напоминание (UTC)'],['note','Заметка'],['jobText','Текст вакансии']];
   const Tracker=require('./applications_core.js'),values=rows.map(r=>columns.map(([key])=>key==='stage'?Tracker.stages[r.stage]:r[key]||'')),expanded=columns.flatMap((c,i)=>Array.from({length:Math.max(1,...values.map(row=>Math.ceil(String(row[i]).length/32000)))},(_,part)=>({i,part,title:t(c[1])+(part?' ('+(part+1)+')':'')}))),sheet=X.utils.aoa_to_sheet([expanded.map(c=>c.title),...values.map(row=>expanded.map(c=>String(row[c.i]).slice(c.part*32000,(c.part+1)*32000)))]);sheet['!cols']=expanded.map(()=>({wch:28}));sheet['!autofilter']={ref:sheet['!ref']};const book=X.utils.book_new();X.utils.book_append_sheet(book,sheet,'Applications');return saveBytes('Otkliki-'+new Date().toISOString().slice(0,10)+'.xlsx',X.write(book,{bookType:'xlsx',type:'buffer'}),'xlsx');
  }
  if(action==='backup-folder'){const result=await dialog.showOpenDialog(win,{title:t('Папка резервных копий'),properties:['openDirectory','createDirectory']});if(!result.canceled){outside(result.filePaths[0]);prefs.backupFolder=result.filePaths[0];prefs.lastBackup='';lastState='';save();}return prefs;}
  if(action==='backup-now')return backup();
  if(action==='backup-disable'){prefs.backupFolder='';save();return prefs;}
  if(action==='restore-preview'){const result=await dialog.showOpenDialog(win,{title:t('Выбрать полную копию'),properties:['openFile'],filters:[{name:'JSON',extensions:['json']}]});if(result.canceled)return null;const file=result.filePaths[0];if(fs.statSync(file).size>320*1024*1024)throw Error('Backup too large');const payload=JSON.parse(fs.readFileSync(file,'utf8')),p=store.prepareImport(payload),rows=JSON.parse(p.values[RECORDS]||'[]');pendingRestore=payload;return {file,count:rows.filter(r=>!r.deleted).length,deleted:rows.filter(r=>r.deleted).length,cvs:p.cvs?.length||(p.cv?1:0),attachments:rows.flatMap(r=>r.attachments||[]).length,names:rows.slice(0,10).map(r=>r.name),date:payload.exportedAt||''};}
  if(action==='restore-confirm'){if(!pendingRestore)throw Error('Choose a backup first');store.importBundle(pendingRestore);pendingRestore=null;win.reload();return true;}
  if(action==='restore-cancel'){pendingRestore=null;return;}
  if(action==='clean-copy')return cleanCopy();
  if(action==='poll'){poll();return true;}
  throw Error('Unknown operation');
 });
};

