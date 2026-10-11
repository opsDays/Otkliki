const {contextBridge,ipcRenderer}=require('electron');
function sync(action,...args){const result=ipcRenderer.sendSync('portable-storage',action,...args);if(!result.ok)throw Error(result.error);return result.value;}
contextBridge.exposeInMainWorld('portable',{
 feature:(action,payload)=>ipcRenderer.invoke('portable-feature',action,payload),
 onFeature:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('open-feature',listener);return ()=>ipcRenderer.removeListener('open-feature',listener);},
 storageGet:key=>sync('get',key),storageSet:(key,value)=>sync('set',key,value),
 setLanguage:language=>ipcRenderer.invoke('portable-language',language),
 onHelp:callback=>{const listener=()=>callback();ipcRenderer.on('open-help-guide',listener);return ()=>ipcRenderer.removeListener('open-help-guide',listener);},
 cvGet:()=>ipcRenderer.invoke('portable-cv','get'),
 cvSave:id=>ipcRenderer.invoke('portable-cv','save',id),
 cvList:()=>ipcRenderer.invoke('portable-cv','list'),
 cvSelect:id=>ipcRenderer.invoke('portable-cv','select',id),
 cvRename:(id,label)=>ipcRenderer.invoke('portable-cv','rename',id,label),
 onSettings:callback=>{const listener=()=>callback();ipcRenderer.on('open-interface-settings',listener);return ()=>ipcRenderer.removeListener('open-interface-settings',listener);},
 zoom:direction=>ipcRenderer.invoke('portable-zoom',direction),
 cvPut:(name,bytes)=>ipcRenderer.invoke('portable-cv','put',name,bytes),
 cvDelete:id=>ipcRenderer.invoke('portable-cv','delete',id),copyText:text=>ipcRenderer.invoke('portable-copy',text)
});
