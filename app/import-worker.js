importScripts('i18n.js','vendor/xlsx.full.min.js','import-core.js');
function decode(bytes){const v=new Uint8Array(bytes);if(v[0]===255&&v[1]===254)return new TextDecoder('utf-16le').decode(v).replace(/^\uFEFF/,'');if(v[0]===254&&v[1]===255)return new TextDecoder('utf-16be').decode(v).replace(/^\uFEFF/,'');try{return new TextDecoder('utf-8',{fatal:true}).decode(v).replace(/^\uFEFF/,'');}catch{return new TextDecoder('windows-1251').decode(v);}}
function csv(text,sep){let rows=[],row=[],value='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else if(quoted||!value)quoted=!quoted;else value+=c;}else if(c===sep&&!quoted){row.push(value);value='';}else if((c==='\n'||c==='\r')&&!quoted){row.push(value);rows.push(row);row=[];value='';if(c==='\r'&&text[i+1]==='\n')i++;}else value+=c;}if(value||row.length){row.push(value);rows.push(row);}if(quoted)throw Error('Не закрыта кавычка в текстовой таблице');return rows;}
function textRows(text){
 const lines=text.split(/\r?\n/).filter(x=>x.trim());let sep='',best=0;
 for(const candidate of ['\t',';','|',',']){let sample;try{sample=csv(text,candidate);}catch{continue;}const counts=sample.slice(0,20).map(x=>x.length),score=counts.filter(n=>n>1).length;if(score>best){best=score;sep=candidate;}}
 if(sep&&best>=Math.min(lines.length,2))return csv(text,sep);
 const blocks=text.split(/\r?\n\s*\r?\n/),headers=Object.keys(Importer.fields),rows=[];
 let labeled=false;
 for(const block of blocks){const obj={};let notes=[];for(const line of block.split(/\r?\n/)){const m=line.match(/^\s*([^:]{1,50}):\s*(.*)$/),field=m&&Importer.classify(m[1]);if(field){labeled=true;obj[field]=[obj[field],m[2]].filter(Boolean).join(' ');}else if(line.trim())notes.push(line.trim());}if(Object.keys(obj).length){obj.note=[obj.note,...notes].filter(Boolean).join('\n');rows.push(headers.map(k=>obj[k]||''));}}
 if(labeled&&rows.length)return [headers.map(k=>Importer.fields[k]),...rows];
 return [['Контакт / компания','Вакансия','Сайт компании','Контакт для связи','Заметка'],...lines.map(line=>{let site='',contact='';line=line.replace(/https?:\/\/[^\s|]+/gi,url=>{site=site?site+' '+url:url;return '';}).replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g,email=>{contact=email;return '';});const parts=line.split(/\s+[—–]\s+|\t|\s+\|\s+/).map(s=>s.trim()).filter(Boolean);return [parts[0]||site,parts[1]||'',site,contact,parts.slice(2).join(' — ')];})];
}
self.onmessage=event=>{try{const {name,bytes}=event.data;let sheets;
 if(/\.(xlsx|xls)$/i.test(name)){const book=XLSX.read(bytes,{type:'array',cellDates:true,cellFormula:false,cellHTML:false,cellStyles:false,sheetRows:10002});sheets=book.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,raw:true,defval:'',blankrows:true}).map(row=>row.map(value=>value instanceof Date?`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`:String(value??'')))}));}
 else if(/\.(txt|csv|tsv)$/i.test(name)){sheets=[{name:'Текст',rows:textRows(decode(bytes))}];}else throw Error('Выберите XLSX, XLS, CSV, TSV или TXT');
 sheets=sheets.filter(s=>s.rows.some(row=>row.some(v=>String(v).trim())));if(!sheets.length)throw Error('Файл пуст');if(sheets.some(s=>s.rows.length>10000||s.rows.some(r=>r.length>100)))throw Error('Разделите таблицу: максимум 10 000 строк и 100 столбцов на лист');self.postMessage({ok:true,sheets});
 }catch(error){self.postMessage({ok:false,error:error.message||'Не удалось прочитать файл'});}};
