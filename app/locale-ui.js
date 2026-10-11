(()=>{
 const q=id=>document.getElementById(id);
 function refresh(){
  for(const id of ['stage-filter','f-stage','bulk-stage']){const field=q(id),value=field.value;stageOptions(field,id==='stage-filter');if(id==='bulk-stage')field.prepend(new Option(I18n.t('Выберите статус'),''));field.value=value;field.dataset.stage=value;}
  if(q('editor').open)q('editor-title').textContent=I18n.t(editing?'Изменить запись':'Новая запись');
  for(const id of ['f-cvId','f-letterId','prepare-cv','prepare-template'])for(const option of q(id).options)if(!option.value)option.textContent=I18n.t(option.textContent);
  for(const id of ['save-status','profile-status','theme-status','cv-name','delete-message']){const e=q(id);if(e)e.textContent=I18n.t(e.textContent);}
  render();
 }
 document.addEventListener('language-changed',refresh);
 window.portable.onHelp(()=>{if(!q('help-dialog').open)q('help-dialog').showModal();});
 q('help-close').onclick=()=>q('help-dialog').close();
})();
