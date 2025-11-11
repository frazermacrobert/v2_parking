import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.5";

const SUPA_URL = "https://gukoruzworxkixrygudn.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1a29ydXp3b3J4a2l4cnlndWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NzAyNzksImV4cCI6MjA3ODM0NjI3OX0.e2EEM2bLy_0JehSrQfTMH9VkJ0x61jjrsvyNor7OuC8";
const supabase = createClient(SUPA_URL, SUPA_KEY);

const CAP = { desk: 9, parking: 5 };

const state = {
  monday: startOfWeek(new Date()),
  employees: [],
  employeeId: null,
  adminPass: "",
  adminMode: false,
  data: []
};

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
function labelDay(d){ return d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' }); }

function avatarUrl(emp){
  const slug = `${emp.name}-${emp.department}-1`.toLowerCase().replace(/\s+/g,'-');
  return `https://frazermacrobert.github.io/traitors_v4/assets/pngs/${slug}.png`;
}

async function init(){
  bindUI();
  await loadEmployees();
  await refreshWeek();
}

function bindUI(){
  document.getElementById('infoBtn').onclick = ()=> document.getElementById('info').classList.add('show');
  document.getElementById('closeInfo').onclick = ()=> document.getElementById('info').classList.remove('show');
  document.getElementById('prevWeek').onclick = ()=> { state.monday = addDays(state.monday, -7); refreshWeek(); };
  document.getElementById('nextWeek').onclick = ()=> { state.monday = addDays(state.monday, 7); refreshWeek(); };
  document.getElementById('employeeSelect').onchange = (e)=> onSelectEmployee(e.target.value);

  // Admin controls
  const adminWrap = document.querySelector('.admin');
  const passInput = document.getElementById('adminPass');
  const enterBtn = document.getElementById('enterAdmin');
  const statusEl = document.getElementById('adminStatus');

  // Add a show password toggle next to the input if it does not already exist
  if (!document.getElementById('showPass')) {
    const label = document.createElement('label');
    label.style.display = 'inline-flex';
    label.style.alignItems = 'center';
    label.style.gap = '6px';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'showPass';
    const txt = document.createElement('span');
    txt.textContent = 'Show';
    label.appendChild(cb);
    label.appendChild(txt);
    adminWrap.insertBefore(label, enterBtn);
    cb.addEventListener('change', () => {
      passInput.type = cb.checked ? 'text' : 'password';
    });
  }

  // Button acts as a true toggle
  enterBtn.onclick = () => {
    if (state.adminMode) {
      setAdminMode(false);
    } else {
      const val = passInput.value.trim();
      if (!val) {
        statusEl.textContent = 'enter a passphrase';
        return;
      }
      state.adminPass = val;
      setAdminMode(true);
    }
  };

  // Press Enter in the pass field to enable admin mode
  passInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (!state.adminMode) {
        const val = passInput.value.trim();
        if (!val) {
          statusEl.textContent = 'enter a passphrase';
          return;
        }
        state.adminPass = val;
        setAdminMode(true);
      } else {
        setAdminMode(false);
      }
    }
  });

  // Keep UI consistent on load
  updateAdminUI();
}

function updateAdminUI(){
  const enterBtn = document.getElementById('enterAdmin');
  const statusEl = document.getElementById('adminStatus');
  const passInput = document.getElementById('adminPass');

  enterBtn.textContent = state.adminMode ? 'Exit admin' : 'Enter admin';
  statusEl.textContent = state.adminMode ? 'admin on' : 'admin off';
  // Optional: clear the field when switching off so you do not leave the pass lying around
  if (!state.adminMode) {
    state.adminPass = "";
    passInput.value = "";
  }
}

function setAdminMode(on){
  state.adminMode = !!on;
  updateAdminUI();
  renderDays(); // re-render so queues and admin actions show or hide
}

async function loadEmployees(){
  const { data, error } = await supabase.from('employees').select('id,name,department').order('name');
  if(error) { console.error(error); alert('Failed to load employees'); return; }
  state.employees = data;
  const sel = document.getElementById('employeeSelect');
  sel.innerHTML = '<option value="">Select employee</option>' + data.map(e => `<option value="${e.id}">${e.name} — ${e.department}</option>`).join('');
  if(state.employeeId) sel.value = state.employeeId;
}

function onSelectEmployee(id){
  state.employeeId = id || null;
  const emp = state.employees.find(e=>e.id===id);
  document.getElementById('avatar').src = emp ? avatarUrl(emp) : '';
}

function withinWindow(d){
  const today = new Date(); today.setUTCHours(0,0,0,0);
  const max = addDays(today, 56);
  return d >= today && d <= max && d.getUTCDay()>=1 && d.getUTCDay()<=5;
}

async function refreshWeek(){
  const end = addDays(state.monday, 4);
  document.getElementById('weekLabel').textContent = `${state.monday.toLocaleDateString('en-GB')} — ${end.toLocaleDateString('en-GB')}`;

  const from = formatDateISO(state.monday);
  const to = formatDateISO(addDays(state.monday, 4));
  const { data, error } = await supabase.from('v2_requests')
    .select('id,employee_id,date,kind,status,position,approved_at,created_at')
    .gte('date', from).lte('date', to).order('date').order('position');
  if(error) { console.error(error); }
  state.data = data || [];

  renderDays();
}

function byDateKind(date, kind){
  return state.data.filter(r => r.date === date && r.kind === kind);
}

function renderDays(){
  const container = document.getElementById('days');
  container.innerHTML = '';
  for(let i=0;i<5;i++){
    const day = addDays(state.monday, i);
    const iso = formatDateISO(day);
    const card = document.createElement('section');
    card.className = 'day';
    card.innerHTML = `
      <h3>${labelDay(day)}</h3>
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
    card.querySelectorAll('.btn.primary').forEach(btn => {
      btn.onclick = () => requestSlot(iso, btn.dataset.kind);
    });

    // fill bars
    fillBar(iso, 'parking', document.getElementById(`pb-${iso}`), CAP.parking);
    fillBar(iso, 'desk', document.getElementById(`db-${iso}`), CAP.desk);

    // admin queue
    if(state.adminMode){
      renderQueue(iso, 'parking');
      renderQueue(iso, 'desk');
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
  const confirmed = rows.filter(r => r.status === 'confirmed');
  const pending = rows.filter(r => r.status === 'pending');

  // confirmed avatars
  confirmed.forEach(r => {
    const e = empFor(r.employee_id);
    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = e ? avatarUrl(e) : '';
    img.title = (e ? e.name : r.employee_id) + ' — confirmed';
    el.appendChild(img);
  });

  // TBC up to capacity
  let slotsFilled = confirmed.length;
  for(let i=0; i < pending.length && slotsFilled < cap; i++, slotsFilled++){
    const p = pending[i];
    const div = document.createElement('span');
    div.className = 'badge tbc';
    const e = empFor(p.employee_id);
    div.textContent = (e ? e.name : p.employee_id) + ' · TBC';
    el.appendChild(div);
  }

  // TBA placeholders
  for(let i=slotsFilled; i<cap; i++){
    const tba = document.createElement('span');
    tba.className = 'badge tba';
    tba.textContent = 'TBA';
    el.appendChild(tba);
  }

  // overflow counter
  const overflow = Math.max(0, pending.length - Math.max(0, cap - confirmed.length));
  if(overflow > 0){
    const extra = document.createElement('span');
    extra.className = 'badge';
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
  const title = document.createElement('div');
  title.className = 'muted';
  title.textContent = `${kind} queue`;
  qEl.appendChild(title);
  list.forEach(r => {
    const row = document.createElement('div');
    row.className = 'reqline';
    const e = empFor(r.employee_id);
    row.innerHTML = `
      <span class="badge ${r.status==='confirmed'?'ok':''}">#${r.position} · ${e?e.name:r.employee_id} · ${r.status}</span>
      <span class="req-actions">
        <button class="approve">approve</button>
        <button class="reject reject">reject</button>
        <button class="cancel cancel">cancel</button>
      </span>
    `;
    const [ap, rej, can] = row.querySelectorAll('button');
    ap.onclick = ()=> adminApprove(r.id);
    rej.onclick = ()=> adminReject(r.id);
    can.onclick = ()=> adminCancel(r.id);
    qEl.appendChild(row);
  });
}

async function requestSlot(iso, kind){
  if(!state.employeeId){ alert('Select an employee first'); return; }
  const d = new Date(iso);
  if(!withinWindow(d)){ alert('Date not in booking window'); return; }
  const { error } = await supabase.rpc('v2_request_slot', {
    p_employee: state.employeeId,
    p_date: iso,
    p_kind: kind
  });
  if(error) { alert(error.message); return; }
  await refreshWeek();
}

async function adminApprove(id){
  const { error } = await supabase.rpc('v2_admin_approve', { p_request_id: id, p_passphrase: state.adminPass });
  if(error) { alert(error.message); return; }
  await refreshWeek();
}
async function adminReject(id){
  const { error } = await supabase.rpc('v2_admin_reject', { p_request_id: id, p_passphrase: state.adminPass });
  if(error) { alert(error.message); return; }
  await refreshWeek();
}
async function adminCancel(id){
  const { error } = await supabase.rpc('v2_admin_cancel', { p_request_id: id, p_passphrase: state.adminPass });
  if(error) { alert(error.message); return; }
  await refreshWeek();
}

init();
