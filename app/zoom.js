// Native page zoom keeps dialogs, text and controls at the same scale.
(()=>{
 let last=0;
 window.addEventListener('keydown',event=>{
  if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
  let direction;
  if(['+','='].includes(event.key)||event.code==='NumpadAdd')direction=1;
  if(['-','_'].includes(event.key)||event.code==='NumpadSubtract')direction=-1;
  if(event.key==='0'||event.code==='Numpad0')direction=0;
  if(direction===undefined)return;
  event.preventDefault();window.portable.zoom(direction).catch(()=>{});
 },{capture:true});
 window.addEventListener('wheel',event=>{
  if(!(event.ctrlKey||event.metaKey))return;
  event.preventDefault();
  if(!event.deltaY||Date.now()-last<80)return;
  last=Date.now();window.portable.zoom(event.deltaY<0?1:-1).catch(()=>{});
 },{passive:false});
})();
