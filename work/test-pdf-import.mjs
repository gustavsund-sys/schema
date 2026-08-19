import fs from "node:fs/promises";
import * as pdfjs from "/Users/gvsh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs";

const days = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];
const matchers = [[/\b(?:SV|SVA|SVENSKA)\b/i,"SV"],[/\b(?:MA|MATTE|MATEMATIK)\b/i,"MA"],[/\bNO\b/i,"NO"],[/\bSL(?:ÖJD)?\b/i,"SL"],[/\bMU(?:SIK)?\b/i,"MU"],[/\bSO\b/i,"SO"],[/\bHKK\b/i,"HKK"],[/\bIDH\b/i,"IDH"],[/\bEN(?:GELSKA)?\b/i,"EN"],[/\bBL(?:ILD)?\b/i,"BL"],[/\bTK\b/i,"TK"],[/\b(?:SPRÅK|ELEVENS VAL)\b/i,"SPRÅK"],[/\bLUNCH\b/i,"LUNCH"]];
const time = text => { const m = text.replace(".", ":").match(/\b(\d{1,2}):(\d{2})\b/); return m ? `${m[1].padStart(2,"0")}:${m[2]}` : null; };
const plus45 = t => { const [h,m]=t.split(":").map(Number), n=h*60+m+45; return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`; };
async function parse(file) {
  const pdf = await pdfjs.getDocument({data:new Uint8Array(await fs.readFile(file)),disableWorker:true}).promise, items=[];
  for(let n=1;n<=pdf.numPages;n++){const content=await (await pdf.getPage(n)).getTextContent();content.items.forEach(i=>{if(i.str?.trim())items.push({text:i.str.trim(),x:i.transform[4],y:i.transform[5]})})}
  const headers=items.map(i=>({...i,day:days.findIndex(d=>i.text.toLowerCase().includes(d.toLowerCase()))})).filter(i=>i.day>=0);
  const nearest=i=>headers.reduce((c,h)=>Math.abs(h.x-i.x)<Math.abs(c.x-i.x)?h:c).day;
  const times=items.map(i=>({...i,time:time(i.text)})).filter(i=>i.time).map(i=>({...i,day:nearest(i)}));
  const week=Array.from({length:5},()=>[]);
  items.forEach(i=>{const found=matchers.find(([p])=>p.test(i.text));if(!found)return;const day=nearest(i);if(week[day].some(l=>l[4]&&Math.abs(l[4]-i.y)<10&&l[2]===found[1]))return;const dayTimes=times.filter(t=>t.day===day);const before=dayTimes.filter(t=>t.y>=i.y-8).sort((a,b)=>a.y-b.y)[0];const start=before?.time||"08:00";const after=dayTimes.filter(t=>before?t.y<before.y-4:t.y<i.y).sort((a,b)=>b.y-a.y)[0];week[day].push([start,after?.time||plus45(start),found[1],"",i.y])});
  return week.map(day=>day.map(l=>l.slice(0,4)).sort((a,b)=>a[0].localeCompare(b[0])));
}
for (const file of ["/Users/gvsh/Downloads/Schema.pdf","/Users/gvsh/Downloads/Schema (1).pdf"]) console.log(file, JSON.stringify(await parse(file)));
