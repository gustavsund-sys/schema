const days = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];
const subjectInfo = {
  SV:["Svenska","📝","#f51d24"], MA:["Matte","📐","#2049e8"], NO:["NO","⚗️","#058344"], SL:["Slöjd","🪚","#0eef13"], MU:["Musik","🎧","#6e0575"], SO:["SO","🗺️","#fff200"], HKK:["Hemkunskap","🥘","#a56a18"], IDH:["Idrott","🏃","#ef78ee"], EN:["Engelska","💬","#8a0991"], BL:["Bild","🖌️","#a56a18"], TK:["Teknik","🔧","#058344"], LUNCH:["Lunch","🍽️","#d9dde7"], SPRÅK:["Språk / elevens val","🗣️","#ff7c3d"]
};
const subjectMatchers = [
  [/\b(?:SV|SVA|SVENSKA)\b/i, "SV"], [/\b(?:MA|MATTE|MATEMATIK)\b/i, "MA"], [/\bNO\b/i, "NO"], [/\bSL(?:ÖJD)?\b/i, "SL"], [/\bMU(?:SIK)?\b/i, "MU"], [/\bSO\b/i, "SO"], [/\bHKK\b/i, "HKK"], [/\bIDH\b/i, "IDH"], [/\bEN(?:GELSKA)?\b/i, "EN"], [/\bBL(?:ILD)?\b/i, "BL"], [/\bTK\b/i, "TK"], [/\b(?:SPRÅK|ELEVENS VAL)\b/i, "SPRÅK"], [/\bLUNCH\b/i, "LUNCH"]
];
const pdfDays = /måndag|tisdag|onsdag|torsdag|fredag/i;
function emptyWeek() { return Array.from({ length: 5 }, () => []); }
function formatTime(value) { const match = value.replace(".", ":").match(/\b(\d{1,2}):(\d{2})\b/); return match ? `${match[1].padStart(2, "0")}:${match[2]}` : null; }
function addMinutes(time, minutes) { const [hours, mins] = time.split(":").map(Number); const total = hours * 60 + mins + minutes; return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }
async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => { const script = document.createElement("script"); script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"; script.onload = resolve; script.onerror = reject; document.head.append(script); });
  return window.Tesseract;
}
async function ocrPdfPages(pdf) {
  const Tesseract = await loadTesseract();
  const worker = await Tesseract.createWorker("swe+eng");
  const items = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber), viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const result = await worker.recognize(canvas);
      (result.data.words || []).forEach(word => { if (word.text?.trim()) items.push({ text: word.text.trim(), x: word.bbox.x0, y: canvas.height - word.bbox.y0 }); });
    }
  } finally { await worker.terminate(); }
  return items;
}
async function readPdfSchedule(file) {
  const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.mjs";
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let items = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    content.items.forEach(item => { if (item.str?.trim()) items.push({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }); });
  }
  if (!items.length) items = await ocrPdfPages(pdf);
  let headers = items.map(item => ({ ...item, day: days.findIndex(day => item.text.toLowerCase().includes(day.toLowerCase())) })).filter(item => item.day >= 0 || pdfDays.test(item.text));
  let dayHeaders = headers.filter(item => item.day >= 0);
  if (dayHeaders.length < 3) { const ocrItems = await ocrPdfPages(pdf); if (ocrItems.length) { items = ocrItems; headers = items.map(item => ({ ...item, day: days.findIndex(day => item.text.toLowerCase().includes(day.toLowerCase())) })).filter(item => item.day >= 0 || pdfDays.test(item.text)); dayHeaders = headers.filter(item => item.day >= 0); } }
  if (dayHeaders.length < 3) throw new Error("NO_DAY_HEADERS");
  const nearestDay = item => dayHeaders.reduce((closest, header) => Math.abs(header.x - item.x) < Math.abs(closest.x - item.x) ? header : closest).day;
  const times = items.map(item => ({ ...item, time: formatTime(item.text) })).filter(item => item.time).map(item => ({ ...item, day: nearestDay(item) }));
  const week = emptyWeek();
  items.forEach(item => {
    const match = subjectMatchers.find(([pattern]) => pattern.test(item.text));
    if (!match) return;
    const day = nearestDay(item);
    const duplicates = week[day].some(lesson => lesson[4]?._y && Math.abs(lesson[4]._y - item.y) < 10 && lesson[2] === match[1]);
    if (duplicates) return;
    const dayTimes = times.filter(time => time.day === day);
    const before = dayTimes.filter(time => time.y >= item.y - 8).sort((a, b) => a.y - b.y)[0];
    const start = before?.time || "08:00";
    const after = dayTimes.filter(time => before ? time.y < before.y - 4 : time.y < item.y).sort((a, b) => b.y - a.y)[0];
    week[day].push([start, after?.time || addMinutes(start, 45), match[1], "", { _y: item.y }]);
  });
  const clean = week.map(day => day.map(lesson => lesson.slice(0, 4)).sort((a, b) => a[0].localeCompare(b[0])));
  if (!clean.some(day => day.length)) throw new Error("NO_SUBJECTS");
  const allText = items.map(item => item.text).join(" ").toLowerCase();
  return { week: clean, student: allText.includes("ilse") ? "ilse" : allText.includes("sixten") ? "sixten" : null };
}
const schedules = {
  sixten: [
    [["08:10","09:10","SO",""],["09:15","10:00","BL",""],["10:20","11:10","IDH",""],["11:25","11:50","SV",""],["11:50","12:10","LUNCH",""],["12:40","13:40","MA",""],["13:55","15:00","NO",""]],
    [["08:10","09:00","SV",""],["09:05","10:00","IDH",""],["10:20","11:15","SO",""],["11:20","11:50","SV",""],["11:50","12:10","LUNCH",""],["12:40","13:20","EN",""],["13:25","14:10","MA",""]],
    [["08:10","08:55","SO",""],["09:00","10:00","SV",""],["10:20","11:05","MA",""],["11:10","11:50","EN",""],["11:50","12:10","LUNCH",""],["12:45","14:05","SL",""]],
    [["08:10","09:20","HKK",""],["09:35","10:50","HKK",""],["11:10","11:50","MA",""],["11:50","12:10","LUNCH",""],["12:40","13:40","NO",""],["13:40","14:10","TK",""]],
    [["08:10","09:05","SV",""],["09:10","10:00","SO",""],["10:20","11:05","MA",""],["11:10","11:50","EN",""],["11:50","12:10","LUNCH",""],["12:45","14:10","SPRÅK","Elevens val"]]
  ],
  ilse: [
    [["08:10","09:30","SV",""],["10:00","11:15","MA",""],["11:15","11:45","LUNCH",""],["12:25","13:55","NO",""]],
    [["08:10","09:35","SL",""],["10:00","10:30","SV",""],["10:30","11:15","MU",""],["11:15","11:45","LUNCH",""],["12:25","13:05","MA",""],["13:05","14:10","SV",""]],
    [["08:10","08:50","SV",""],["09:00","09:40","IDH",""],["10:15","11:15","MA",""],["11:15","11:45","LUNCH",""],["12:25","13:30","SO",""],["13:30","14:10","SV",""]],
    [["08:10","08:50","EN",""],["09:00","09:30","BL",""],["10:00","10:40","TK",""],["10:40","11:15","MA",""],["11:15","11:45","LUNCH",""],["12:25","13:25","SO",""],["13:25","14:10","SV",""]],
    [["08:20","09:00","IDH",""],["09:15","09:30","SV",""],["10:00","10:40","SV",""],["10:40","11:15","MA",""],["11:15","11:45","LUNCH",""],["12:25","14:10","SV",""]]
  ]
};
const storageKey = "mitt-skolschema-barnvanlig-v1";
const settingsKey = "mitt-skolschema-installningar-v1";
const accents = { purple: "#5b47e5", blue: "#2378df", green: "#058344", coral: "#e75a5a" };
const defaultSettings = () => ({ accent: "purple", display: "both", packItems: [], packDone: {} });
let childSettings = { sixten: defaultSettings(), ilse: defaultSettings() };
function validSchedule(schedule) {
  return Array.isArray(schedule) && schedule.length === 5 && schedule.every(day =>
    Array.isArray(day) && day.every(lesson => Array.isArray(lesson) && lesson.length >= 3 && lesson.slice(0, 3).every(value => typeof value === "string"))
  );
}
const todayIndex = new Date().getDay() - 1;
let child = null, view = "day", chosenDay = todayIndex;
if (chosenDay < 0 || chosenDay > 4) chosenDay = 0;
const $ = s => document.querySelector(s);
function settingsForChild() { return childSettings[child] || defaultSettings(); }
function saveSettings() { localStorage.setItem(settingsKey, JSON.stringify(childSettings)); }
function applyAccent() { document.documentElement.style.setProperty("--purple", accents[settingsForChild().accent] || accents.purple); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char])); }
const installButton = $("#install-app"), installHelp = $("#install-help");
let installEvent;
const onPhone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const onIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const installed = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
if (onIos && !installed) { installHelp.textContent = "Installera: öppna sidan i Safari, tryck Dela och välj “Lägg till på hemskärmen”."; installHelp.classList.remove("hidden"); }
if (!onPhone) { installHelp.textContent = "Öppna appen på en telefon för att installera den på hemskärmen."; installHelp.classList.remove("hidden"); }
window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); installEvent = event; installButton.classList.remove("hidden"); });
installButton.onclick = async () => { if (!installEvent) return; installEvent.prompt(); await installEvent.userChoice; installEvent = null; installButton.classList.add("hidden"); };
window.addEventListener("appinstalled", () => { installHelp.textContent = "Appen är installerad på hemskärmen."; installHelp.classList.remove("hidden"); installButton.classList.add("hidden"); });
function info(code) { return subjectInfo[code] || [code, "📘", "#8d92a7"]; }
function minutesSinceMidnight(time) { const [hours, minutes] = time.split(":").map(Number); return hours * 60 + minutes; }
function updateNextLesson() {
  const container = $("#next-lesson");
  if (!child) { container.innerHTML = ""; return; }
  const actualDay = new Date().getDay() - 1;
  if (actualDay < 0 || actualDay > 4) { container.innerHTML = `<article class="next-card finished"><p class="eyebrow">SKOLDAGEN</p><h2>Ingen skola idag</h2><p>Vi ses nästa skoldag.</p></article>`; return; }
  const now = new Date(), nowMinutes = now.getHours() * 60 + now.getMinutes(), today = schedules[child][actualDay];
  const current = today.find(lesson => minutesSinceMidnight(lesson[0]) <= nowMinutes && minutesSinceMidnight(lesson[1]) > nowMinutes);
  const upcoming = today.find(lesson => lesson[2] !== "LUNCH" && minutesSinceMidnight(lesson[0]) > nowMinutes);
  const lunch = today.find(lesson => lesson[2] === "LUNCH");
  const last = [...today].filter(lesson => lesson[2] !== "LUNCH").at(-1);
  const nextDay = actualDay === 4 ? 0 : actualDay + 1;
  const tomorrowFirst = schedules[child][nextDay].find(lesson => lesson[2] !== "LUNCH");
  const summary = `<div class="quick-facts"><span>🍽️ Lunch ${lunch?.[0] || ""}</span><span>🏁 Slutar ${last?.[1] || ""}</span><span>→ ${days[nextDay]} ${tomorrowFirst?.[0] || ""}</span></div>`;
  if (current) { const [name, icon] = info(current[2]), remaining = minutesSinceMidnight(current[1]) - nowMinutes; container.innerHTML = `<article class="next-card"><p class="eyebrow">JUST NU</p><h2>${icon} ${name} · till ${current[1]}</h2><p class="countdown">Slutar om ${remaining} min</p>${summary}</article>`; return; }
  if (!upcoming) { container.innerHTML = `<article class="next-card finished"><p class="eyebrow">SKOLDAGEN</p><h2>Dagens skoldag är slut</h2><p>Fint jobbat idag.</p>${summary}</article>`; return; }
  const [name, icon] = info(upcoming[2]), remaining = minutesSinceMidnight(upcoming[0]) - nowMinutes;
  container.innerHTML = `<article class="next-card"><p class="eyebrow">NÄSTA LEKTION</p><h2>${icon} ${name} · ${upcoming[0]}</h2><p class="countdown">${name} börjar om ${remaining} min</p>${summary}</article>`;
}
function lessonCard(lesson, small=false) { const [start,end,code,detail] = lesson, [name,icon,color] = info(code), display = settingsForChild().display; const time = display === "icons" ? "" : `<time>${start}${small ? "–" : "<br>– "}${end}</time>`; const iconHtml = display === "times" ? "" : `<span class="subject-icon" aria-hidden="true">${icon}</span>`; return small ? `<article class="week-lesson ${display}" style="--subject:${color}">${time}<strong>${name}</strong>${detail?`<small>${detail}</small>`:""}</article>` : `<article class="lesson ${display}" style="--subject:${color}">${time}<div class="lesson-info"><div><h3>${name}</h3>${detail?`<p>${detail}</p>`:""}</div>${iconHtml}</div></article>`; }
function packList() {
  const nextDay = chosenDay === 4 ? 0 : chosenDay + 1, nextLessons = schedules[child][nextDay];
  const hints = { IDH: "Gympakläder och inneskor", SL: "Kläder som tål att bli smutsiga" };
  const suggested = [...new Set(nextLessons.map(lesson => hints[lesson[2]]).filter(Boolean))];
  const settings = settingsForChild(), items = [...suggested, ...settings.packItems];
  const done = settings.packDone[String(nextDay)] || [];
  const tomorrowSubjects = [...new Set(nextLessons.filter(lesson => lesson[2] !== "LUNCH").map(lesson => info(lesson[2])[0]))].join(" · ");
  return `<section class="pack-card"><div><p class="eyebrow">I MORGON</p><h2>Packa till ${days[nextDay]}</h2><p>${tomorrowSubjects || "Inga lektioner."}</p></div>${items.length ? `<div class="pack-items">${items.map(item => `<label><input type="checkbox" data-pack-item="${escapeHtml(item)}" ${done.includes(item) ? "checked" : ""} /><span>${escapeHtml(item)}</span></label>`).join("")}</div>` : `<p class="pack-empty">Inget särskilt att packa just nu.</p>`}<form class="pack-add" id="pack-form"><input id="pack-input" maxlength="70" placeholder="Lägg till egen sak" aria-label="Lägg till egen sak" /><button class="secondary">Lägg till</button></form></section>`;
}
function render() {
  const name = child === "sixten" ? "Sixten" : "Ilse"; const data = schedules[child];
  applyAccent();
  $("#child-label").textContent = `${name.toUpperCase()}S SCHEMA`; $("#schedule-title").textContent = `Hej ${name}!`;
  document.querySelectorAll(".view-toggle button").forEach(b => b.classList.toggle("active",b.dataset.view===view));
  if (view === "day") { const isToday = chosenDay === todayIndex; $("#schedule-content").innerHTML = `<h2 class="day-title">${isToday ? "IDAG · " : ""}${days[chosenDay]}</h2><div class="day-list">${data[chosenDay].map(x=>lessonCard(x)).join("") || '<p class="empty">Inga lektioner idag.</p>'}</div>${packList()}<nav class="day-navigation" aria-label="Byt dag"><button data-step="-1" ${chosenDay === 0 ? "disabled" : ""}><span aria-hidden="true">←</span> Föregående</button><button data-step="1" ${chosenDay === days.length - 1 ? "disabled" : ""}>Nästa <span aria-hidden="true">→</span></button></nav>`; }
  else { const used=[...new Set(data.flat().map(x=>x[2]))]; $("#schedule-content").innerHTML = `<p class="week-hint">Tryck på dagens rubrik för att se den närmare.</p><div class="week-grid">${data.map((day,i)=>`<section class="week-day ${i === todayIndex ? "is-today" : ""}"><button class="week-day-heading" data-week-day="${i}" aria-label="Visa ${days[i]}"><h2>${days[i]}${i === todayIndex ? '<span class="today-badge">IDAG</span>' : ""}</h2><span aria-hidden="true">→</span></button><span class="week-count">${day.length} pass</span>${day.map(x=>lessonCard(x,true)).join("")}</section>`).join("")}</div><div class="legend">${used.map(c=>{const [n,,color]=info(c);return `<span style="--subject:${color}">${n}</span>`}).join("")}</div>`; }
  updateNextLesson();
}
document.addEventListener("click", e => { const childBtn=e.target.closest("[data-child]"); if(childBtn){child=childBtn.dataset.child; theme=settingsForChild().theme || theme; applyTheme(theme); $("#home").classList.add("hidden"); $("#schedule").classList.remove("hidden"); render();} const weekDay=e.target.closest("[data-week-day]"); if(weekDay){chosenDay=+weekDay.dataset.weekDay;view="day";render();window.scrollTo({ top: 0, behavior: "smooth" });} const step=e.target.closest("[data-step]"); if(step && !step.disabled){chosenDay+=+step.dataset.step;render();window.scrollTo({ top: 0, behavior: "smooth" });} const viewBtn=e.target.closest("[data-view]"); if(viewBtn){view=viewBtn.dataset.view;if(view === "day" && todayIndex >= 0 && todayIndex < 5)chosenDay=todayIndex;render();} });
document.addEventListener("change", e => { const pack=e.target.closest("[data-pack-item]"); if(!pack)return; const settings=settingsForChild(), day=String(chosenDay === 4 ? 0 : chosenDay + 1), item=pack.dataset.packItem, done=new Set(settings.packDone[day] || []); pack.checked ? done.add(item) : done.delete(item); settings.packDone[day]=[...done]; saveSettings(); });
document.addEventListener("submit", e => { if (e.target.id !== "pack-form") return; e.preventDefault(); const input=$("#pack-input"), item=input.value.trim(); if (!item) return; const settings=settingsForChild(); if (!settings.packItems.includes(item)) settings.packItems.push(item); saveSettings(); render(); });
$("#go-home").onclick=()=>{$("#schedule").classList.add("hidden");$("#home").classList.remove("hidden")};
function applyTheme(theme) { document.body.classList.toggle("dark", theme === "dark"); document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#171827" : "#5b47e5"; $("#theme-toggle").textContent = theme === "dark" ? "☀" : "◐"; }
let theme = localStorage.getItem("mitt-skolschema-tema") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
applyTheme(theme);
$("#theme-toggle").onclick=()=>{theme=theme === "dark" ? "light" : "dark"; localStorage.setItem("mitt-skolschema-tema",theme); if(child){settingsForChild().theme=theme;saveSettings();} applyTheme(theme);};
const dialog=$("#import-dialog"), settingsDialog=$("#settings-dialog");
function refreshSettingsDialog() { const settings=settingsForChild(); document.querySelectorAll("[data-accent]").forEach(button => button.classList.toggle("selected", button.dataset.accent === settings.accent)); document.querySelectorAll("[data-display]").forEach(button => button.classList.toggle("selected", button.dataset.display === settings.display)); }
$("#open-settings").onclick=()=>{refreshSettingsDialog();settingsDialog.showModal();};
$("#accent-choices").onclick=e=>{const button=e.target.closest("[data-accent]");if(!button)return;settingsForChild().accent=button.dataset.accent;saveSettings();applyAccent();refreshSettingsDialog();render();};
$("#display-choices").onclick=e=>{const button=e.target.closest("[data-display]");if(!button)return;settingsForChild().display=button.dataset.display;saveSettings();refreshSettingsDialog();render();};
$("#open-import").onclick=()=>{settingsDialog.close();dialog.showModal();};
$("#open-import-home").onclick=()=>dialog.showModal();
function saveImportedSchedule(imported) { if (!validSchedule(imported.sixten) || !validSchedule(imported.ilse)) throw Error("INVALID_FORMAT"); schedules.sixten = imported.sixten; schedules.ilse = imported.ilse; localStorage.setItem(storageKey, JSON.stringify(imported)); if (child) render(); }
function pdfPreview(week) { return week.map((day, index) => `<section><h4>${days[index]}</h4>${day.length ? day.map(lesson => `<p>${lesson[0]} ${info(lesson[2])[0]}</p>`).join("") : "<p>Inget hittat</p>"}</section>`).join(""); }
$("#file-input").onchange=async e=>{const status=$("#import-status"), review=$("#pdf-review"); const file=e.target.files[0]; if(!file)return; review.classList.add("hidden"); try { status.textContent="Läser PDF:en lokalt och skapar ett förslag ..."; const parsed=await readPdfSchedule(file); const target=parsed.student || (/ilse/i.test(file.name)?"ilse":"sixten"); const draft={sixten:schedules.sixten,ilse:schedules.ilse}; draft[target]=parsed.week; $("#pdf-json").value=JSON.stringify(draft,null,2); $("#pdf-preview").innerHTML=pdfPreview(parsed.week); review.classList.remove("hidden"); status.textContent=`Förslag klart för ${target === "ilse" ? "Ilse" : "Sixten"}. Kontrollera och spara.`; }catch(error){ status.textContent=error.message === "NO_DAY_HEADERS" ? "Jag kunde inte hitta Måndag–Fredag i PDF:en. Kontrollera att det är ett veckoschema." : "PDF:en kunde inte tolkas. Kontrollera att texten är tydlig och prova igen."; }};
$("#save-pdf-import").onclick=()=>{const status=$("#import-status");try{saveImportedSchedule(JSON.parse($("#pdf-json").value)); $("#pdf-review").classList.add("hidden"); status.textContent="Klart! Det granskade PDF-schemat är sparat på den här enheten.";}catch{status.textContent="Kunde inte spara. Kontrollera att JSON:en innehåller fem dagar för både Sixten och Ilse.";}};
try {const saved=JSON.parse(localStorage.getItem(storageKey));if(validSchedule(saved?.sixten)&&validSchedule(saved?.ilse)){schedules.sixten=saved.sixten;schedules.ilse=saved.ilse;}}catch{}
try {const saved=JSON.parse(localStorage.getItem(settingsKey));["sixten","ilse"].forEach(name => { if (saved?.[name]) childSettings[name] = { ...defaultSettings(), ...saved[name], packDone: saved[name].packDone || {} }; });}catch{}
setInterval(updateNextLesson, 30000);
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
