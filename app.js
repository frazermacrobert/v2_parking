import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.5";

const SUPA_URL = "https://gukoruzworxkixrygudn.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1a29ydXp3b3J4a2l4cnlndWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NzAyNzksImV4cCI6MjA3ODM0NjI3OX0.e2EEM2bLy_0JehSrQfTMH9VkJ0x61jjrsvyNor7OuC8";
const supabase = createClient(SUPA_URL, SUPA_KEY);

const CAP = { desk: 9, parking: 5 };
const PLACEHOLDER_URL = "https://frazermacrobert.github.io/traitors_v4/assets/pngs/unknown-employee-1.png";

const state = {
  monday: startOfWeek(new Date()),
  employees: [],
  employeeId: null,
  adminPass: "",
  adminMode: false,
  data: [],
  adminLog: []
};

// inject minimal styles for the info button
function injectStyles() {
  if (document.getElementById("day-info-btn-styles")) return;
  const css = `
  .day-info-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background-color: rgba(255, 230, 230, 0.5);
    border-radius: 50%;
    cursor: pointer;
    color: #e88b8b;
    transition: transform 0.2s ease-in-out, background-color 0.2s ease-in-out, color 0.2s ease-in-out;
    padding: 0;
    line-height: 0;
  }
  .day-info-btn:hover {
    background-color: rgba(255, 230, 230, 0.8);
    color: #d06666;
    transform: scale(1.08);
  }
  .day-info-btn:focus-visible {
    outline: 2px solid #f3b5b5;
    outline-offset: 2px;
  }
  .day-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .info-icon {
    width: 16px;
    height: 16px;
    display: block;
  }`;
  const style = document.createElement("style");
  style.id = "day-info-btn-styles";
  style.textContent = css;
  document.head.appendChild(style);
}

function startOfWeek(d){
  const dd = new Date(d);
  const day = dd.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  dd.setUTCDate(dd.getUTCDate() + diff);
  dd.setUTCHours(0,0,0,0);
  return dd;
}
function formatDateISO(d){ return d.toISOString().slice(0,10); }
function addDays(d,n){ const x = new Date(d); x.setUTCDate(x.getUTCDate()+n); return x; }
function labelDay(d){ return d.toLocaleDateString('en-GB', { weekday:"short", day:"numeric", month:"short" }); }

function avatarUrl(emp){
  const slug = `${emp.name}-${emp.department}-1`.toLowerCase().replace(/\s+/g,"-");
  return `https://frazermacrobert.github.io/traitors_v4/assets/pngs/${slug}.png`;
}

async function init(){
  injectStyles();
  bindUI();
  // show placeholder immediately before data loads
  const avatarImg = document.getElementById("avatar");
  avatarImg.src = PLACEHOLDER_URL;
  avatarImg.alt = "no employee selected";
  const storedLog = localStorage.getItem("adminLog");
  if (storedLog) {
    state.adminLog = JSON.parse(storedLog).map(entry => ({
      ...entry,
      timestamp: new Date(entry.timestamp)
    }));
  }
  await loadEmployees();
  await refreshWeek();
}

function bindUI(){
  document.getElementById("infoBtn").onclick = ()=> document.getElementById("info").classList.add("show");
  document.getElementById("closeInfo").onclick = ()=> document.getElementById("info").classList.remove("show");
  document.getElementById("closeDayInfo").onclick = ()=> document.getElementById("dayInfoModal").style.display = "none";
  document.getElementById("prevWeek").onclick = ()=> { state.monday = addDays(state.monday, -7); refreshWeek(); };
  document.getElementById("nextWeek").onclick = ()=> { state.monday = addDays(state.monday, 7); refreshWeek(); };
  document.getElementById("employeeSelect").onchange = (e)=> onSelectEmployee(e.target.value);

  // Admin controls
  const adminWrap = document.querySelector(".admin");
  const passInput = document.getElementById("adminPass");
  const enterBtn = document.getElementById("enterAdmin");
  const statusEl = document.getElementById("adminStatus");

  // Show password toggle
  if (!document.getElementById("showPass")) {
    const label = document.createElement("label");
    label.style.display = "inline-flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "showPass";
    const txt = document.createElement("span");
    txt.textContent = "Show";
    label.appendChild(cb);
    label.appendChild(txt);
    adminWrap.insertBefore(label, enterBtn);
    cb.addEventListener("change", () => {
      passInput.type = cb.checked ? "text" : "password";
    });
  }

  // Admin toggle
  function attemptAdminLogin() {
    const val = passInput.value.trim();
    if (val === 'parkyparker') {
      state.adminPass = val;
      setAdminMode(true);
    } else {
      statusEl.textContent = "Password incorrect";
      passInput.value = "";
    }
  }

  enterBtn.onclick = () => {
    if (state.adminMode) {
      setAdminMode(false);
    } else {
      attemptAdminLogin();
    }
  };

  // Enter key toggles on or off
  passInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (!state.adminMode) {
        attemptAdminLogin();
      } else {
        setAdminMode(false);
      }
    }
  });

  updateAdminUI();
}

function updateAdminUI(){
  const enterBtn = document.getElementById("enterAdmin");
  const statusEl = document.getElementById("adminStatus");
  const passInput = document.getElementById("adminPass");

  enterBtn.textContent = state.adminMode ? "Exit admin" : "Enter admin";
  statusEl.textContent = state.adminMode ? "admin on" : "admin off";
  passInput.disabled = state.adminMode;
  if (!state.adminMode) {
    state.adminPass = "";
    passInput.value = "";
  }
}

function setAdminMode(on){
  state.adminMode = !!on;
  updateAdminUI();
  renderDays();
}

async function loadEmployees(){
  const { data, error } = await supabase.from("employees").select("id,name,department").order("name");
  if(error){ console.error(error); alert("Failed to load employees"); return; }

  state.employees = data || [];
  const sel = document.getElementById("employeeSelect");

  sel.innerHTML = '<option value="">Select employee</option>' +
    state.employees.map(e => `<option value="${e.id}">${e.name} — ${e.department}</option>`).join("");

  // Auto select Jonny if present
  const jonny = state.employees.find(e => (e.name || "").toLowerCase().includes("jonny"));
  const avatarImg = document.getElementById("avatar");

  if (jonny) {
    state.employeeId = jonny.id;
    sel.value = jonny.id;
    avatarImg.src = avatarUrl(jonny);
    avatarImg.alt = `${jonny.name} avatar`;
  } else {
    // keep placeholder if Jonny not found
    state.employeeId = null;
    avatarImg.src = PLACEHOLDER_URL;
    avatarImg.alt = "no employee selected";
  }
}

function onSelectEmployee(id){
  state.employeeId = id || null;
  const emp = state.employees.find(e => e.id === id);
  const avatarImg = document.getElementById("avatar");
  avatarImg.src = emp ? avatarUrl(emp) : PLACEHOLDER_URL;
  avatarImg.alt = emp ? `${emp.name} avatar` : "no employee selected";
}

function withinWindow(d){
  const today = new Date(); today.setUTCHours(0,0,0,0);
  const max = addDays(today, 56);
  return d >= today && d <= max && d.getUTCDay()>=1 && d.getUTCDay()<=5;
}

async function refreshWeek(){
  const end = addDays(state.monday, 4);
  document.getElementById("weekLabel").textContent =
    `${state.monday.toLocaleDateString("en-GB")} — ${end.toLocaleDateString("en-GB")}`;

  const from = formatDateISO(state.monday);
  const to = formatDateISO(addDays(state.monday, 4));
  const { data, error } = await supabase.from("v2_requests")
    .select("id,employee_id,date,kind,status,position,approved_at,created_at")
    .gte("date", from).lte("date", to).order("date").order("position");
  if(error){ console.error(error); }
  state.data = data || [];

  renderDays();
}

function byDateKind(date, kind){
  return state.data.filter(r => r.date === date && r.kind === kind);
}

function renderDays(){
  const container = document.getElementById("days");
  container.innerHTML = "";
  for(let i=0;i<5;i++){
    const day = addDays(state.monday, i);
    const iso = formatDateISO(day);
    const card = document.createElement("section");
    card.className = "day";
    card.innerHTML = `
      <div class="day-header">
        <h3>${labelDay(day)}</h3>
        <button class="day-info-btn" data-iso="${iso}" aria-label="Info">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="info-icon" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" stroke-width="1.5"/>
            <line x1="12" y1="10" x2="12" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="12" cy="7.25" r="1.1" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <div class="row">
        <button class="btn primary" data-kind="parking">Request parking</button>
        <button class="btn primary" data-kind="desk">Request desk</button>
      </div>
      <div class="row">
        <span class="pill">Parking</span>
        <div class="slotbar" id="pb-${iso}"></div>
      </div>
      <div class="row">
        <span class="pill">Desk</span>
        <div class="slotbar" id="db-${iso}"></div>
      </div>
      <div class="queue" id="q-${iso}"></div>
    `;
    container.appendChild(card);

    // request buttons
    card.querySelectorAll(".btn.primary").forEach(btn => {
      btn.onclick = () => requestSlot(iso, btn.dataset.kind);
    });

    // robust info click handler
    const infoBtn = card.querySelector(".day-info-btn");
    infoBtn.addEventListener("click", (e) => {
      const btn = e.currentTarget;
      showDayInfo(btn.dataset.iso);
    });

    // fill bars
    fillBar(iso, "parking", document.getElementById(`pb-${iso}`), CAP.parking);
    fillBar(iso, "desk", document.getElementById(`db-${iso}`), CAP.desk);

    // admin queue
    if(state.adminMode){
      renderQueue(iso, "parking");
      renderQueue(iso, "desk");
    }
  }
}

function nameFor(employee_id){
  const e = state.employees.find(x=>x.id===employee_id);
  return e ? e.name : employee_id;
}
function empFor(employee_id){ return state.employees.find(x=>x.id===employee_id); }

function fillBar(iso, kind, el, cap){
  const rows = byDateKind(iso, kind);
  const confirmed = rows.filter(r => r.status === "confirmed");
  const pending = rows.filter(r => r.status === "pending");

  // confirmed avatars
  confirmed.forEach(r => {
    const e = empFor(r.employee_id);
    const img = document.createElement("img");
    img.className = "avatar";
    img.src = e ? avatarUrl(e) : PLACEHOLDER_URL;
    img.title = (e ? e.name : r.employee_id) + " — confirmed";
    el.appendChild(img);
  });

  // TBC up to capacity
  let slotsFilled = confirmed.length;
  for(let i=0; i < pending.length && slotsFilled < cap; i++, slotsFilled++){
    const p = pending[i];
    const div = document.createElement("span");
    div.className = "badge tbc";
    const e = empFor(p.employee_id);
    div.textContent = (e ? e.name : p.employee_id) + " · TBC";
    el.appendChild(div);
  }

  // TBA placeholders
  for(let i=slotsFilled; i<cap; i++){
    const tba = document.createElement("span");
    tba.className = "badge tba";
    tba.textContent = "TBA";
    el.appendChild(tba);
  }

  // overflow counter
  const overflow = Math.max(0, pending.length - Math.max(0, cap - confirmed.length));
  if(overflow > 0){
    const extra = document.createElement("span");
    extra.className = "badge";
    extra.textContent = `+${overflow} waiting`;
    el.appendChild(extra);
  }
}

function queueFor(iso, kind){
  return byDateKind(iso, kind).sort((a,b)=> a.position - b.position);
}

function renderQueue(iso, kind){
  const list = queueFor(iso, kind);
  if(list.length === 0) return;
  const qEl = document.getElementById(`q-${iso}`);
  const title = document.createElement("div");
  title.className = "muted";
  title.textContent = `${kind} queue`;
  qEl.appendChild(title);
  list.forEach(r => {
    const row = document.createElement("div");
    row.className = "reqline";
    const e = empFor(r.employee_id);
    row.innerHTML = `
      <span class="badge ${r.status==="confirmed"?"ok":""}">#${r.position} · ${e?e.name:r.employee_id} · ${r.status}</span>
      <span class="req-actions">
        <button class="approve">approve</button>
        <button class="reject reject">reject</button>
        <button class="cancel cancel">cancel</button>
      </span>
    `;
    const [ap, rej, can] = row.querySelectorAll("button");
    ap.onclick = ()=> adminApprove(r.id);
    rej.onclick = ()=> adminReject(r.id);
    can.onclick = ()=> adminCancel(r.id);
    qEl.appendChild(row);
  });
}

async function requestSlot(iso, kind){
  if(!state.employeeId){ alert("Select an employee first"); return; }
  const d = new Date(iso);
  if(!withinWindow(d)){ alert("Date not in booking window"); return; }
  const { error } = await supabase.rpc("v2_request_slot", {
    p_employee: state.employeeId,
    p_date: iso,
    p_kind: kind
  });
  if(error){ alert(error.message); return; }
  await refreshWeek();
}

async function adminApprove(id){
  const { error } = await supabase.rpc("v2_admin_approve", { p_request_id: id, p_passphrase: state.adminPass });
  if(error){ alert(error.message); return; }
  const r = state.data.find(r => r.id === id);
  if(r) {
    r.status = "confirmed";
    state.adminLog.push({ action: "approve", requestId: id, employee: nameFor(r.employee_id), date: r.date, timestamp: new Date() });
    saveAdminLog();
  }
  renderDays();
}
async function adminReject(id){
  const { error } = await supabase.rpc("v2_admin_reject", { p_request_id: id, p_passphrase: state.adminPass });
  if(error){ alert(error.message); return; }
  const r = state.data.find(r => r.id === id);
  if(r) {
    state.adminLog.push({ action: "reject", requestId: id, employee: nameFor(r.employee_id), date: r.date, timestamp: new Date() });
    saveAdminLog();
    state.data = state.data.filter(r => r.id !== id);
    promoteNext(r.date, r.kind);
  }
  renderDays();
}
async function adminCancel(id){
  const { error } = await supabase.rpc("v2_admin_cancel", { p_request_id: id, p_passphrase: state.adminPass });
  if(error){ alert(error.message); return; }
  const r = state.data.find(r => r.id === id);
  if(r) {
    state.adminLog.push({ action: "cancel", requestId: id, employee: nameFor(r.employee_id), date: r.date, timestamp: new Date() });
    saveAdminLog();
    state.data = state.data.filter(r => r.id !== id);
    promoteNext(r.date, r.kind);
  }
  renderDays();
}

function showDayInfo(iso) {
  const modal = document.getElementById("dayInfoModal");
  const title = document.getElementById("dayInfoTitle");
  const content = document.getElementById("dayInfoContent");
  const day = new Date(iso);

  title.textContent = labelDay(day);

  const parkingRequests = byDateKind(iso, "parking");
  const deskRequests = byDateKind(iso, "desk");

  let html = "<h4>Parking</h4>";
  if (parkingRequests.length > 0) {
    html += "<ul>";
    parkingRequests.forEach(r => {
      html += `<li>${nameFor(r.employee_id)} - ${r.status}</li>`;
    });
    html += "</ul>";
  } else {
    html += "<p>No parking requests.</p>";
  }

  html += "<h4>Desk</h4>";
  if (deskRequests.length > 0) {
    html += "<ul>";
    deskRequests.forEach(r => {
      html += `<li>${nameFor(r.employee_id)} - ${r.status}</li>`;
    });
    html += "</ul>";
  } else {
    html += "<p>No desk requests.</p>";
  }

  content.innerHTML = html;

  const adminLogEntries = state.adminLog.filter(entry => entry.date === iso);
  if (adminLogEntries.length > 0) {
    html += "<h4>Admin Activity Log</h4><ul>";
    adminLogEntries.forEach(entry => {
      html += `<li>${entry.employee}'s request was ${entry.action}d at ${entry.timestamp.toLocaleTimeString()}</li>`;
    });
    html += "</ul>";
  } else {
    html += "<h4>Admin Activity Log</h4><p>No admin activity recorded for this day.</p>";
  }

  content.innerHTML = html;
  modal.style.display = "flex";
}

function promoteNext(iso, kind) {
  const cap = CAP[kind];
  const requests = byDateKind(iso, kind);
  const confirmedCount = requests.filter(r => r.status === "confirmed").length;

  if (confirmedCount < cap) {
    const pendingRequests = requests.filter(r => r.status === "pending").sort((a, b) => a.position - b.position);
    if (pendingRequests.length > 0) {
      adminApprove(pendingRequests[0].id);
    }
  }
}

function saveAdminLog() {
  localStorage.setItem("adminLog", JSON.stringify(state.adminLog));
}

init();
