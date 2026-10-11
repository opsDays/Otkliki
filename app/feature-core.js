(function(root){
 const fields=['source','jobText','interviewAt','interviewZone','reminderAt'];
 function validate(r,raw){
  for(const k of fields){if(raw[k]!==undefined&&(typeof raw[k]!=='string'||raw[k].length>(k==='jobText'?50000:300)))throw Error('Invalid application field: '+k);r[k]=raw[k]||'';}
  for(const k of ['interviewAt','reminderAt'])if(r[k]&&(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r[k])||!Number.isFinite(Date.parse(r[k]))))throw Error('Invalid appointment date');
  r.attachments=raw.attachments||[];if(!Array.isArray(r.attachments)||r.attachments.length>30)throw Error('Invalid attachments');
  r.attachments=r.attachments.map(a=>{if(!a||typeof a.id!=='string'||a.id.length>100||typeof a.name!=='string'||!a.name||a.name.length>300||!/^[a-f0-9]{64}\.bin$/.test(a.file)||!Number.isInteger(a.size)||a.size<1||a.size>20*1024*1024)throw Error('Invalid attachment');return {id:a.id,name:a.name,file:a.file,size:a.size};});
  if(new Set(r.attachments.map(a=>a.id)).size!==r.attachments.length)throw Error('Duplicate attachment');return r;
 }
 function toUTC(wall,offset){if(!wall)return '';if(!/^[+-]\d\d:\d\d$/.test(offset))throw Error('Invalid time zone');const mins=(+offset.slice(1,3)*60 + +offset.slice(4))*(offset[0]==='-'?-1:1);const d=new Date(wall+':00'+offset);if(!Number.isFinite(+d)||Math.abs(mins)>840)throw Error('Invalid time');return d.toISOString();}
 function wall(iso,offset){if(!iso)return '';const mins=(+offset.slice(1,3)*60 + +offset.slice(4))*(offset[0]==='-'?-1:1);return new Date(Date.parse(iso)+mins*60000).toISOString().slice(0,16);}
 function offset(){const n=-new Date().getTimezoneOffset();return (n<0?'-':'+')+String(Math.floor(Math.abs(n)/60)).padStart(2,'0')+':'+String(Math.abs(n)%60).padStart(2,'0');}
 function events(rows){const out=[];for(const r of rows.filter(r=>!r.deleted&&!r.archived)){for(const [kind,key]of [['action','nextDate'],['test','testDeadline'],['interview','interviewAt'],['reminder','reminderAt']]){if(!r[key]||(kind==='test'&&(r.testSentDate||r.stage!=='test')))continue;const at=r[key];out.push({id:r.id,kind,at,title:r.company||r.name,text:kind==='action'?r.nextAction:r.vacancy});}}return out.sort((a,b)=>a.at.localeCompare(b.at));}
 function stats(rows){const live=rows.filter(r=>!r.deleted),sent=r=>!!r.appliedDate||['applied','reply','interview','test','offer','rejected'].includes(r.stage),answered=r=>['reply','interview','test','offer','rejected'].includes(r.stage);const groups={};for(const r of live){const name=r.source||'—';const g=groups[name]??={name,total:0,sent:0,answers:0,offers:0};g.total++;if(sent(r))g.sent++;if(['reply','interview','test','offer','rejected'].includes(r.stage))g.answers++;if(r.stage==='offer')g.offers++;}
 const cvs={};for(const r of live.filter(sent)){const sends=(r.history||[]).filter(e=>e.cvId),last=sends.at(-1),id=last?.cvId||r.cvId||'none',g=cvs[id]??={name:last?.cvName||id,total:0,answers:0,offers:0};g.total++;if(['reply','interview','test','offer','rejected'].includes(r.stage))g.answers++;if(r.stage==='offer')g.offers++;}
 return {total:live.length,sent:live.filter(sent).length,answers:live.filter(r=>['reply','interview','test','offer','rejected'].includes(r.stage)).length,tests:live.filter(r=>r.stage==='test'||r.testSentDate).length,offers:live.filter(r=>r.stage==='offer').length,sources:Object.values(groups),cvs:Object.values(cvs)};}
 const api={validate,toUTC,wall,offset,events,stats};root.FeatureCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
