const I18n=require('./i18n.js');
const {app,BrowserWindow,Menu,dialog,ipcMain,shell,nativeTheme}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {clipboard}=require('electron');
const {Store,RECORDS}=require('./store.cjs');
const {portableRoot}=require('./portable-root.cjs');
const root=portableRoot(process.execPath,process.platform,process.env.OTKLIKI_PORTABLE_HOME),dataDir=path.join(root,'data');
let win,store;
try{fs.mkdirSync(path.join(dataDir,'runtime'),{recursive:true});app.setPath('userData',path.join(dataDir,'runtime'));app.setPath('sessionData',path.join(dataDir,'runtime'));app.setPath('logs',path.join(dataDir,'logs'));}
catch(error){dialog.showErrorBox(I18n.t("Отклики — нет доступа к папке"),I18n.t("Распакуйте приложение в папку, доступную для записи.\n")+error.message);app.exit(1);}
app.setName(I18n.t("Отклики"));
if(process.platform==='win32')app.setAppUserModelId('org.artur.otkliki.portable');
if(process.env.OTKLIKI_TEST_MODE)app.disableHardwareAcceleration();
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
const homeURL=pathToFileURL(path.join(__dirname,'index.html')).href;
function trusted(event){return !!win&&event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&event.senderFrame.url===homeURL;}
ipcMain.on('portable-storage',(event,action,...args)=>{
 try{if(!trusted(event))throw Error(I18n.t("Недоступно"));let value;if(action==='get')value=store.get(args[0]);else if(action==='set')store.set(args[0],args[1]);else throw Error(I18n.t("Недоступно"));event.returnValue={ok:true,value};}
 catch(error){event.returnValue={ok:false,error:error.message};}
});
ipcMain.handle('portable-cv',async(event,action,name,bytes)=>{
 if(trusted(event)&&action==='save'){
  const cv=store.getCV(name);if(!cv)return {missing:true};
  const result=await dialog.showSaveDialog(win,{title:I18n.t("Скачать CV"),defaultPath:cv.name,filters:[{name:I18n.t("CV / резюме"),extensions:[path.extname(cv.name).slice(1)]}]});
  if(result.canceled)return {canceled:true};
  const dest=path.resolve(result.filePath),data=path.resolve(dataDir);
  const relative=path.relative(data,dest);
  if(relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw Error(I18n.t("Выберите папку вне служебной папки data."));
  store.atomic(dest,cv.bytes);return {canceled:false};
 }
 if(!trusted(event))throw Error(I18n.t("Недоступно"));if(action==='get')return store.getCV();if(action==='list')return store.listCV();if(action==='select'){store.selectCV(name);return;}if(action==='rename'){store.renameCV(name,bytes);return;}if(action==='put'){if(!(bytes instanceof Uint8Array))throw Error(I18n.t("Некорректный файл"));return store.putCV(name,bytes);}if(action==='delete'){store.removeCV(name);return null;}throw Error(I18n.t("Недоступно"));
});
const zoomFile=path.join(dataDir,'preferences.json');
let zoomFactor=1;
try{const saved=JSON.parse(fs.readFileSync(zoomFile,'utf8')).zoom;if(Number.isFinite(saved)&&saved>=0.5&&saved<=2)zoomFactor=saved;}catch{}
function changeZoom(direction){
 if(![-1,0,1].includes(direction))throw Error(I18n.t("Недопустимый масштаб"));
 zoomFactor=direction===0?1:Math.max(0.5,Math.min(2,Math.round((zoomFactor+direction*0.1)*10)/10));
 win.webContents.setZoomFactor(zoomFactor);
 try{store.atomic(zoomFile,JSON.stringify({zoom:zoomFactor}));}catch{}
 return zoomFactor;
}
ipcMain.handle('portable-zoom',(event,direction)=>{if(!trusted(event))throw Error(I18n.t("Недоступно"));return changeZoom(direction);});
let updateMenus=()=>{};
ipcMain.handle('portable-language',(event,language)=>{if(!trusted(event)||!['ru','en'].includes(language))throw Error(I18n.t('Недоступно'));I18n.setLanguage(language);updateMenus();win.setTitle(I18n.t('Отклики'));});
ipcMain.handle('portable-copy',(event,text)=>{if(!trusted(event)||typeof text!=='string'||text.length>50000)throw Error(I18n.t("Недоступно"));clipboard.writeText(text);});
function notify(message){return dialog.showMessageBox(win,{type:'info',title:I18n.t("Отклики"),message});}
function guarded(fn){return async()=>{try{await fn();}catch(error){await dialog.showMessageBox(win,{type:'error',title:I18n.t("Отклики"),message:error.message});}};}
async function importData(){
 const selected=await dialog.showOpenDialog(win,{title:I18n.t("Перенести данные из HTML или резервной копии"),properties:['openFile'],filters:[{name:I18n.t("Файл данных"),extensions:['json']}]});if(selected.canceled)return;
 const file=selected.filePaths[0];if(fs.statSync(file).size>320*1024*1024)throw Error(I18n.t("Файл слишком большой"));
 const payload=JSON.parse(fs.readFileSync(file,'utf8')),prepared=store.prepareImport(payload),count=prepared.values[RECORDS]?JSON.parse(prepared.values[RECORDS]).length:0;
 const answer=await dialog.showMessageBox(win,{type:'question',title:I18n.t("Перенести данные"),message:I18n.f("Загрузить {0} записей из выбранного файла?",[count]),detail:I18n.t("Текущий список будет заменён. Перед заменой приложение сохранит резервный снимок. Профиль и CV переносятся, если включены в файл."),buttons:[I18n.t("Загрузить"),I18n.t("Отмена")],defaultId:0,cancelId:1});if(answer.response!==0)return;
 store.importBundle(payload);win.reload();
}
async function exportData(){const selected=await dialog.showSaveDialog(win,{title:I18n.t("Сохранить полную копию"),defaultPath:I18n.t("Отклики-копия-")+new Date().toISOString().slice(0,10)+'.json',filters:[{name:I18n.t("Файл данных"),extensions:['json']}]});if(!selected.canceled)store.atomic(selected.filePath,JSON.stringify(store.bundle(),null,2));}
async function restoreBackup(){
 const selected=await dialog.showOpenDialog(win,{title:I18n.t("Выбрать снимок для восстановления"),defaultPath:path.join(dataDir,'backups'),properties:['openFile'],filters:[{name:I18n.t("Снимок списка"),extensions:['json']}]});if(selected.canceled)return;
 if(fs.statSync(selected.filePaths[0]).size>48*1024*1024)throw Error(I18n.t("Файл слишком большой"));
 const state=store.validate(JSON.parse(fs.readFileSync(selected.filePaths[0],'utf8'))),count=state.values[RECORDS]?JSON.parse(state.values[RECORDS]).length:0;
 const answer=await dialog.showMessageBox(win,{title:I18n.t("Восстановить снимок"),type:'question',message:I18n.f("Вернуть состояние из {0}?",[path.basename(selected.filePaths[0])]),detail:I18n.f("Записей в снимке: {0}. Перед заменой текущее состояние тоже будет сохранено.",[count]),buttons:[I18n.t("Восстановить"),I18n.t("Отмена")],defaultId:1,cancelId:1});if(answer.response!==0)return;
 store.restoreSnapshot(state);win.reload();
}
app.whenReady().then(()=>{
 try{store=new Store(dataDir);}catch(error){dialog.showErrorBox(I18n.t("Данные не открылись"),error.message+I18n.t("\n\nДанные не перезаписаны. Проверьте state.json и резервные снимки в:\n")+dataDir);app.quit();return;}
 nativeTheme.themeSource='dark';
 win=new BrowserWindow({title:I18n.t("Отклики"),icon:path.join(__dirname,'assets/mushroom.png'),width:1450,height:950,minWidth:760,minHeight:600,backgroundColor:'#181818',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,offscreen:!!process.env.OTKLIKI_TEST_MODE,backgroundThrottling:false}});
 if(process.platform==='darwin')app.dock.setIcon(path.join(__dirname,'assets/mushroom.png'));
 win.webContents.on('did-finish-load',()=>win.webContents.setZoomFactor(zoomFactor));
 win.webContents.on('before-input-event',(event,input)=>{
  if(input.type!=='keyDown'||!(input.control||input.meta)||input.alt)return;
  let direction;
  if(['+','='].includes(input.key)||input.code==='NumpadAdd')direction=1;
  if(['-','_'].includes(input.key)||input.code==='NumpadSubtract')direction=-1;
  if(input.key==='0'||input.code==='Numpad0')direction=0;
  if(direction!==undefined){event.preventDefault();changeZoom(direction);}
 });
 win.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
 win.webContents.session.setPermissionCheckHandler(()=>false);
 win.webContents.session.webRequest.onBeforeRequest((details,callback)=>{callback({cancel:!details.url.startsWith('file://')&&!details.url.startsWith('blob:')&&!details.url.startsWith('data:')});});
 const external=url=>{try{const parsed=new URL(url);if(['https:','http:','mailto:'].includes(parsed.protocol))shell.openExternal(url).catch(()=>{});}catch{}};
 win.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
 win.webContents.on('will-navigate',(event,url)=>{if(url!==homeURL){event.preventDefault();external(url);}});
 win.webContents.on('will-attach-webview',event=>event.preventDefault());
 updateMenus=()=>{Menu.setApplicationMenu(Menu.buildFromTemplate([
  ...(process.platform==='darwin'?[{label:I18n.t("Отклики"),submenu:[{label:I18n.t("О программе"),click:()=>notify(I18n.t("Отклики · Portable 1.4"))},{type:'separator'},{label:I18n.t("Скрыть Отклики"),role:'hide'},{label:I18n.t("Скрыть другие"),role:'hideOthers'},{label:I18n.t("Показать все"),role:'unhide'},{type:'separator'},{label:I18n.t("Завершить Отклики"),role:'quit'}]}]:[]),
  {label:I18n.t("Файл"),submenu:[{label:I18n.t("Перенести данные из HTML / копии…"),click:guarded(importData)},{label:I18n.t("Сохранить полную копию…"),click:guarded(exportData)},{type:'separator'},{label:I18n.t("Открыть папку данных"),click:guarded(()=>shell.openPath(dataDir))},{type:'separator'},{label:I18n.t("Выход"),role:'quit'}]},
  {label:I18n.t("Восстановление"),submenu:[{label:I18n.t("Вернуть все удалённые записи"),click:guarded(async()=>{const n=store.restoreDeleted();win.reload();await notify(I18n.f("Восстановлено записей: {0}. Записи из архива возвращены в архив.",[n]));})},{label:I18n.t("Восстановить резервный снимок…"),click:guarded(restoreBackup)}]},
  {label:I18n.t("Правка"),submenu:[{label:I18n.t("Отменить"),role:'undo'},{label:I18n.t("Повторить"),role:'redo'},{type:'separator'},{label:I18n.t("Вырезать"),role:'cut'},{label:I18n.t("Копировать"),role:'copy'},{label:I18n.t("Вставить"),role:'paste'},{label:I18n.t("Выделить всё"),role:'selectAll'}]},
  {label:I18n.t("Вид"),submenu:[{label:I18n.t("Увеличить"),accelerator:'CommandOrControl+Plus',click:()=>changeZoom(1)},{label:I18n.t("Уменьшить"),accelerator:'CommandOrControl+-',click:()=>changeZoom(-1)},{label:I18n.t("Масштаб 100%"),accelerator:'CommandOrControl+0',click:()=>changeZoom(0)},{label:I18n.t("На весь экран"),role:'togglefullscreen'}]},
  {label:I18n.t("Настройки интерфейса"),submenu:[{label:I18n.t("Тема, язык и шрифт…"),click:()=>win.webContents.send('open-interface-settings')}]},
  {label:I18n.t("Справка"),submenu:[{label:I18n.t("Инструкция по разделам…"),click:()=>win.webContents.send("open-help-guide")},{label:I18n.t("О портативной версии"),click:()=>notify(I18n.t("Отклики · Portable 1.4"))}]}]));};updateMenus();
 require('./feature-main.cjs')({app,win,store,root,dataDir,ipcMain,dialog,Menu,Tray:require('electron').Tray,Notification:require('electron').Notification,nativeImage:require('electron').nativeImage,RECORDS,trusted});
 win.loadFile(path.join(__dirname,'index.html'));win.once('ready-to-show',()=>{if(!process.env.OTKLIKI_TEST_MODE)win.show();});
});
app.on('window-all-closed',()=>app.quit());
}

