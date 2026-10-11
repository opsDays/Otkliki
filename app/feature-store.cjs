const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
module.exports=(Store,RECORDS)=>{
 const originalBundle=Store.prototype.bundle,originalPrepare=Store.prototype.prepareImport,originalImport=Store.prototype.importBundle,originalRestore=Store.prototype.restoreSnapshot;
 const files=state=>JSON.parse(state.values[RECORDS]||'[]').flatMap(r=>r.attachments||[]);
 Store.prototype.addAttachment=function(id,name,bytes){
  const rows=JSON.parse(this.get(RECORDS)||'[]'),r=rows.find(r=>r.id===id&&!r.deleted);if(!r)throw Error('Entry not found');
  if(typeof name!=='string'||!name||name.length>300||!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>20*1024*1024)throw Error('Attachment must be 1 byte to 20 MB');
  if((r.attachments||[]).length>=30||files(this.state).reduce((n,a)=>n+a.size,0)+bytes.length>100*1024*1024)throw Error('Attachment library limit: 30 per entry, 100 MB total');
  const file=crypto.createHash('sha256').update(bytes).digest('hex')+'.bin',a={id:crypto.randomUUID(),name:path.basename(name),file,size:bytes.length};
  fs.mkdirSync(path.join(this.dir,'attachments'),{recursive:true});this.atomic(path.join(this.dir,'attachments',file),bytes);r.attachments=[...(r.attachments||[]),a];this.set(RECORDS,JSON.stringify(rows));return rows;
 };
 Store.prototype.attachment=function(id,aid){const r=JSON.parse(this.get(RECORDS)||'[]').find(r=>r.id===id);const a=r?.attachments?.find(a=>a.id===aid);if(!a)throw Error('Attachment not found');if(!/^[a-f0-9]{64}\.bin$/.test(a.file))throw Error('Invalid attachment');return {...a,bytes:fs.readFileSync(path.join(this.dir,'attachments',a.file))};};
 Store.prototype.removeAttachment=function(id,aid){const rows=JSON.parse(this.get(RECORDS)||'[]'),r=rows.find(r=>r.id===id);if(!r)throw Error('Entry not found');r.attachments=(r.attachments||[]).filter(a=>a.id!==aid);this.commit({...this.state,values:{...this.state.values,[RECORDS]:JSON.stringify(rows)}},true);return rows;};
 Store.prototype.bundle=function(){const p=originalBundle.call(this),unique=new Map(files(this.state).map(a=>[a.file,a]));return {...p,version:3,attachments:[...unique.values()].map(a=>({file:a.file,base64:fs.readFileSync(path.join(this.dir,'attachments',a.file)).toString('base64')}))};};
 Store.prototype.prepareImport=function(payload){if(payload?.format!=='otkliki-portable'||payload.version!==3)return originalPrepare.call(this,payload);const p=originalPrepare.call(this,{...payload,version:2});
  if(!Array.isArray(payload.attachments)||payload.attachments.length>10000)throw Error('Invalid attachments');let total=0;const found=new Map();
  for(const a of payload.attachments){if(!a||!/^[a-f0-9]{64}\.bin$/.test(a.file)||typeof a.base64!=='string'||a.base64.length>28*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(a.base64)||found.has(a.file))throw Error('Invalid attachment');const bytes=Buffer.from(a.base64,'base64');total+=bytes.length;if(!bytes.length||bytes.length>20*1024*1024||total>100*1024*1024||crypto.createHash('sha256').update(bytes).digest('hex')+'.bin'!==a.file)throw Error('Attachment checksum or size mismatch');found.set(a.file,bytes.length);}
  for(const a of files({values:p.values}))if(found.get(a.file)!==a.size)throw Error('Missing attachment');return {...p,attachments:payload.attachments};
 };
 Store.prototype.importBundle=function(payload){if(payload?.version!==3)return originalImport.call(this,payload);const p=this.prepareImport(payload);fs.mkdirSync(path.join(this.dir,'attachments'),{recursive:true});for(const a of p.attachments)this.atomic(path.join(this.dir,'attachments',a.file),Buffer.from(a.base64,'base64'));return originalImport.call(this,{...payload,version:2});};
 Store.prototype.restoreSnapshot=function(state){this.validate(state);for(const a of files(state))if(!fs.existsSync(path.join(this.dir,'attachments',a.file)))throw Error('Attachment file for snapshot is missing');return originalRestore.call(this,state);};
};
