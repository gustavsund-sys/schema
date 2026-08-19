const days = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];
const subjectInfo = {
  SV:["Svenska","📝","#f51d24"], MA:["Matte","📐","#2049e8"], NO:["NO","⚗️","#058344"], SL:["Slöjd","🪚","#0eef13"], MU:["Musik","🎧","#6e0575"], SO:["SO","🗺️","#fff200"], HKK:["Hemkunskap","🥘","#a56a18"], IDH:["Idrott","🏃","#ef78ee"], EN:["Engelska","💬","#8a0991"], BL:["Bild","🖌️","#a56a18"], TK:["Teknik","🔧","#058344"], LUNCH:["Lunch","🍽️","#d9dde7"], SPRÅK:["Språk / elevens val","🗣️","#ff7c3d"]
};
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
const settingsKey = "mitt-skolschema-installningar-v1";
const accents = { purple: "#5b47e5", blue: "#2378df", green: "#058344", coral: "#e75a5a" };
const defaultSettings = () => ({ accent: "purple", display: "both" });
let childSettings = { sixten: defaultSettings(), ilse: defaultSettings() };
const todayIndex = new Date().getDay() - 1;
let child = null, view = "day", chosenDay = todayIndex;
if (chosenDay < 0 || chosenDay > 4) chosenDay = 0;
const $ = s => document.querySelector(s);
function settingsForChild() { return childSettings[child] || defaultSettings(); }
function saveSettings() { localStorage.setItem(settingsKey, JSON.stringify(childSettings)); }
function applyAccent() { document.documentElement.style.setProperty("--purple", accents[settingsForChild().accent] || accents.purple); }
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
  const reminder = view === "day" ? packReminder() : "";
  const actualDay = new Date().getDay() - 1;
  if (actualDay < 0 || actualDay > 4) { container.innerHTML = `<article class="next-card finished"><p class="eyebrow">SKOLDAGEN</p><h2>Ingen skola idag</h2><p>Vi ses nästa skoldag.</p></article>${reminder}`; return; }
  const now = new Date(), nowMinutes = now.getHours() * 60 + now.getMinutes(), today = schedules[child][actualDay];
  const current = today.find(lesson => minutesSinceMidnight(lesson[0]) <= nowMinutes && minutesSinceMidnight(lesson[1]) > nowMinutes);
  const upcoming = today.find(lesson => lesson[2] !== "LUNCH" && minutesSinceMidnight(lesson[0]) > nowMinutes);
  const lunch = today.find(lesson => lesson[2] === "LUNCH");
  const last = [...today].filter(lesson => lesson[2] !== "LUNCH").at(-1);
  const nextDay = actualDay === 4 ? 0 : actualDay + 1;
  const tomorrowFirst = schedules[child][nextDay].find(lesson => lesson[2] !== "LUNCH");
  const summary = `<div class="quick-facts"><span>🍽️ Lunch ${lunch?.[0] || ""}</span><span>🏁 Slutar ${last?.[1] || ""}</span><span>→ ${days[nextDay]} ${tomorrowFirst?.[0] || ""}</span></div>`;
  if (current) { const [name, icon] = info(current[2]), remaining = minutesSinceMidnight(current[1]) - nowMinutes; container.innerHTML = `<article class="next-card"><p class="eyebrow">JUST NU</p><h2>${icon} ${name} · till ${current[1]}</h2><p class="countdown">Slutar om ${remaining} min</p>${summary}</article>${reminder}`; return; }
  if (!upcoming) { container.innerHTML = `<article class="next-card finished"><p class="eyebrow">SKOLDAGEN</p><h2>Dagens skoldag är slut</h2><p>Fint jobbat idag.</p>${summary}</article>${reminder}`; return; }
  const [name, icon] = info(upcoming[2]), remaining = minutesSinceMidnight(upcoming[0]) - nowMinutes;
  container.innerHTML = `<article class="next-card"><p class="eyebrow">NÄSTA LEKTION</p><h2>${icon} ${name} · ${upcoming[0]}</h2><p class="countdown">${name} börjar om ${remaining} min</p>${summary}</article>${reminder}`;
}
function lessonCard(lesson, small=false) { const [start,end,code,detail] = lesson, [name,icon,color] = info(code), display = settingsForChild().display; const time = display === "icons" ? "" : `<time>${start}${small ? "–" : "<br>– "}${end}</time>`; const iconHtml = display === "times" ? "" : `<span class="subject-icon" aria-hidden="true">${icon}</span>`; return small ? `<article class="week-lesson ${display}" style="--subject:${color}">${time}<strong>${name}</strong>${detail?`<small>${detail}</small>`:""}</article>` : `<article class="lesson ${display}" style="--subject:${color}">${time}<div class="lesson-info"><div><h3>${name}</h3>${detail?`<p>${detail}</p>`:""}</div>${iconHtml}</div></article>`; }
function packReminder() {
  const nextDay = chosenDay === 4 ? 0 : chosenDay + 1;
  if (!schedules[child][nextDay].some(lesson => lesson[2] === "IDH")) return "";
  return `<aside class="pack-reminder"><span aria-hidden="true">🏃</span><div><p class="eyebrow">I MORGON · ${days[nextDay].toUpperCase()}</p><h2>Kom ihåg idrottskläder</h2><p>Packa gympakläder och inneskor till i morgon.</p></div></aside>`;
}
function render() {
  const name = child === "sixten" ? "Sixten" : "Ilse"; const data = schedules[child];
  applyAccent();
  $("#child-label").textContent = `${name.toUpperCase()}S SCHEMA`; $("#schedule-title").textContent = `Hej ${name}!`;
  document.querySelectorAll(".view-toggle button").forEach(b => b.classList.toggle("active",b.dataset.view===view));
  if (view === "day") { const isToday = chosenDay === todayIndex; $("#schedule-content").innerHTML = `<h2 class="day-title">${isToday ? "IDAG · " : ""}${days[chosenDay]}</h2><div class="day-list">${data[chosenDay].map(x=>lessonCard(x)).join("") || '<p class="empty">Inga lektioner idag.</p>'}</div><nav class="day-navigation" aria-label="Byt dag"><button data-step="-1" ${chosenDay === 0 ? "disabled" : ""}><span aria-hidden="true">←</span> Föregående</button><button data-step="1" ${chosenDay === days.length - 1 ? "disabled" : ""}>Nästa <span aria-hidden="true">→</span></button></nav>`; }
  else { const used=[...new Set(data.flat().map(x=>x[2]))]; $("#schedule-content").innerHTML = `<p class="week-hint">Tryck på dagens rubrik för att se den närmare.</p><div class="week-grid">${data.map((day,i)=>`<section class="week-day ${i === todayIndex ? "is-today" : ""}"><button class="week-day-heading" data-week-day="${i}" aria-label="Visa ${days[i]}"><h2>${days[i]}${i === todayIndex ? '<span class="today-badge">IDAG</span>' : ""}</h2><span aria-hidden="true">→</span></button><span class="week-count">${day.length} pass</span>${day.map(x=>lessonCard(x,true)).join("")}</section>`).join("")}</div><div class="legend">${used.map(c=>{const [n,,color]=info(c);return `<span style="--subject:${color}">${n}</span>`}).join("")}</div>`; }
  updateNextLesson();
}
document.addEventListener("click", e => { const childBtn=e.target.closest("[data-child]"); if(childBtn){child=childBtn.dataset.child; theme=settingsForChild().theme || theme; applyTheme(theme); $("#home").classList.add("hidden"); $("#schedule").classList.remove("hidden"); render();} const weekDay=e.target.closest("[data-week-day]"); if(weekDay){chosenDay=+weekDay.dataset.weekDay;view="day";render();window.scrollTo({ top: 0, behavior: "smooth" });} const step=e.target.closest("[data-step]"); if(step && !step.disabled){chosenDay+=+step.dataset.step;render();window.scrollTo({ top: 0, behavior: "smooth" });} const viewBtn=e.target.closest("[data-view]"); if(viewBtn){view=viewBtn.dataset.view;if(view === "day" && todayIndex >= 0 && todayIndex < 5)chosenDay=todayIndex;render();} });
$("#go-home").onclick=()=>{$("#schedule").classList.add("hidden");$("#home").classList.remove("hidden")};
function applyTheme(theme) { document.body.classList.toggle("dark", theme === "dark"); document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#171827" : "#5b47e5"; $("#theme-toggle").textContent = theme === "dark" ? "☀" : "◐"; }
let theme = localStorage.getItem("mitt-skolschema-tema") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
applyTheme(theme);
$("#theme-toggle").onclick=()=>{theme=theme === "dark" ? "light" : "dark"; localStorage.setItem("mitt-skolschema-tema",theme); if(child){settingsForChild().theme=theme;saveSettings();} applyTheme(theme);};
const settingsDialog=$("#settings-dialog");
function refreshSettingsDialog() { const settings=settingsForChild(); document.querySelectorAll("[data-accent]").forEach(button => button.classList.toggle("selected", button.dataset.accent === settings.accent)); document.querySelectorAll("[data-display]").forEach(button => button.classList.toggle("selected", button.dataset.display === settings.display)); }
$("#open-settings").onclick=()=>{refreshSettingsDialog();settingsDialog.showModal();};
$("#accent-choices").onclick=e=>{const button=e.target.closest("[data-accent]");if(!button)return;settingsForChild().accent=button.dataset.accent;saveSettings();applyAccent();refreshSettingsDialog();render();};
$("#display-choices").onclick=e=>{const button=e.target.closest("[data-display]");if(!button)return;settingsForChild().display=button.dataset.display;saveSettings();refreshSettingsDialog();render();};
try {const saved=JSON.parse(localStorage.getItem(settingsKey));["sixten","ilse"].forEach(name => { if (saved?.[name]) childSettings[name] = { ...defaultSettings(), accent: saved[name].accent, display: saved[name].display, theme: saved[name].theme }; });}catch{}
setInterval(updateNextLesson, 30000);
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
