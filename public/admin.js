// Admin dashboard JS: list/create/edit/delete Tramites and Modulos
const state = { tab: 'tramites', tramites: [], modulos: [], selected: null };

const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));

// Session management
let inactivityTimeout;
const INACTIVITY_DURATION = 30 * 60 * 1000; // 30 minutos

async function checkAuth() {
  try {
    const res = await fetch('/api/auth-check');
    const data = await res.json();
    if (!data.authenticated) {
      window.location.href = '/login';
    } else {
      // Reset inactivity timer
      resetInactivityTimer();
    }
  } catch (e) {
    console.error('Auth check failed:', e);
  }
}

function resetInactivityTimer() {
  clearTimeout(inactivityTimeout);
  inactivityTimeout = setTimeout(() => {
    logout();
  }, INACTIVITY_DURATION);
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (e) {
    console.error('Logout error:', e);
  }
  window.location.href = '/login';
}

async function api(path, opts = {}){
  const res = await fetch('/api' + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (res.status === 401) {
    // No autenticado, redirigir al login
    window.location.href = '/login';
    throw new Error('Not authenticated');
  }
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

async function load() {
  try {
    const [tramites, modulos] = await Promise.all([api('/tramites'), api('/modulos')]);
    state.tramites = tramites || [];
    state.modulos = (modulos || []).slice().sort(compareModulos);
    renderList();
  } catch (e) {
    console.error(e);
    const container = qs('#items');
    if (container) container.innerHTML = `<li class="item"><div class="meta"><h4 style="opacity:.8">Error cargando datos: ${escapeHtml(e.message || String(e))}</h4></div></li>`;
    state.tramites = [];
    state.modulos = [];
  }
}

function setTab(t){
  state.tab = t; qs('#tab-tramites').classList.toggle('active', t==='tramites');
  qs('#tab-modulos').classList.toggle('active', t==='modulos');
  qs('#list-title').textContent = t === 'tramites' ? 'Trámites' : 'Módulos';
  renderList();
}

function renderList(){
  const container = qs('#items'); container.innerHTML = '';
  const items = state.tab === 'tramites' ? state.tramites : state.modulos;
  if (!items || items.length === 0){
    const li = document.createElement('li'); li.className='item'; li.innerHTML = '<div class="meta"><h4 style="opacity:.6">Sin elementos</h4></div>';
    container.appendChild(li); return;
  }

  items.forEach(it => {
    const li = document.createElement('li'); li.className = 'item';
    let subtitle = '';
    if (state.tab === 'modulos') {
      subtitle = `${it.numero || ''}${it.piso ? ' • ' + it.piso : ''}`;
    }
    li.innerHTML = `
      <div class="icon">${renderIcon(it.icono || it.titulo)}</div>
      <div class="meta"><h4>${escapeHtml(it.titulo || it.nombre)}</h4>
      <p>${escapeHtml(subtitle)}</p></div>
    `;
    li.addEventListener('click', ()=> selectItem(it));
    container.appendChild(li);
  });
}

function renderIcon(text){
  if (!text) return textToAvatar('??');
  if (text.startsWith('http')) return `<img src="${text}" alt="icon" style="width:100%;height:100%;border-radius:6px;object-fit:cover"/>`;
  // assume stored filename in public/icons
  return `<img src="/icons/${encodeURIComponent(text)}" alt="icon" style="width:100%;height:100%;border-radius:6px;object-fit:cover" onerror="this.onerror=null;this.style.display='none'"/>`;
}

function textToAvatar(s){ return `<span style="font-size:13px;color:#fff">${escapeHtml(s[0]||'?')}</span>` }

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }

function toIntOrNull(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function compareModulos(a, b) {
  const numeroA = toIntOrNull(a && a.numero);
  const numeroB = toIntOrNull(b && b.numero);
  if (numeroA !== numeroB) {
    if (numeroA == null) return 1;
    if (numeroB == null) return -1;
    return numeroA - numeroB;
  }

  const pisoA = toIntOrNull(a && a.piso);
  const pisoB = toIntOrNull(b && b.piso);
  if (pisoA !== pisoB) {
    if (pisoA == null) return 1;
    if (pisoB == null) return -1;
    return pisoA - pisoB;
  }

  return String((a && a.nombre) || '').localeCompare(String((b && b.nombre) || ''), 'es', { sensitivity: 'base' });
}

async function selectItem(item){
  state.selected = item;
  const d = qs('#detail');
  // Si no tiene el layout flexbox, crear la estructura
  if (!d.querySelector('[style*="display:flex"]')) {
    d.innerHTML = `
      <div style="display:flex;gap:20px;height:100%">
        <div style="flex:1;display:flex;flex-direction:column">
          <div id="tramite-info"></div>
          <div id="tramite-requisitos" style="flex:1;overflow:auto"></div>
        </div>
        <div id="tramite-modulos" style="flex:0 0 420px;overflow:auto;border-left:1px solid var(--border);padding-left:20px"></div>
      </div>
    `;
  }
  
  // Info principal
  const info = qs('#tramite-info');
  info.innerHTML = `
    <h2 style="margin:0 0 8px">${escapeHtml(item.titulo||item.nombre)}</h2>
    <p style="color:var(--muted)">${state.tab === 'modulos' ? escapeHtml(item.numero || '') : ''}</p>
    <p style="color:var(--muted);margin-top:8px">${item.piso ? escapeHtml(item.piso) : ''}</p>
    <div style="margin-top:14px">Foto:
      <div style="margin-top:8px">
        ${item.icono ? `<img src="/icons/${encodeURIComponent(item.icono)}" alt="${escapeHtml(item.titulo||item.nombre)}" style="width:120px;height:120px;border-radius:10px;object-fit:cover" onerror="this.onerror=null;this.style.display='none'"/>` : '<span style="margin-left:8px">—</span>'}
      </div>
    </div>
  `;
  // Acciones
  const actions = document.createElement('div'); actions.style.marginTop = '12px';
  const btnEdit = document.createElement('button'); btnEdit.className='btn-primary'; btnEdit.style.marginRight='8px'; btnEdit.textContent='Editar'; btnEdit.addEventListener('click', (ev)=>{ ev.stopPropagation(); editItem(item); });
  actions.appendChild(btnEdit);
  // Mostrar botón eliminar para ambos: trámites y módulos
  const btnDelete = document.createElement('button'); btnDelete.className='btn-ghost'; btnDelete.textContent='Eliminar'; btnDelete.addEventListener('click', (ev)=>{ ev.stopPropagation(); deleteItem(item); });
  actions.appendChild(btnDelete);
  info.appendChild(actions);

  // Requisitos y módulos
  if (state.tab === 'tramites') {
    // Requisitos - en el área principal
    const reqDiv = qs('#tramite-requisitos');
    reqDiv.innerHTML = `<h3 style="margin-top:24px;margin-bottom:16px">Requisitos</h3><div id="detail-requisitos-list" style="max-height:42vh;overflow-y:auto;padding-right:6px;margin-bottom:12px"></div><div><button id="detail-btn-add-requisito" class="btn-primary" type="button">Agregar</button></div>`;
    // Módulos - en el cuadro vertical a la derecha
    const modDiv = qs('#tramite-modulos');
    modDiv.innerHTML = `<h3 id="detail-modulos-title" style="margin-top:0;margin-bottom:16px">Módulos que atienden (${state.modulos.length})</h3><div id="detail-modulos-list" style="margin-top:0"></div>`;
    modDiv.scrollTop = 0;
    await loadTramiteExtras(item.id, '#detail-requisitos-list', '#detail-modulos-list');
    const addBtn = qs('#detail-btn-add-requisito');
    if (addBtn) addBtn.onclick = () => { showReqModal('create', null, item.id); };
  } else {
    // Para módulos, mostrar los trámites asociados en la derecha
    const reqDiv = qs('#tramite-requisitos');
    reqDiv.innerHTML = '';
    const modDiv = qs('#tramite-modulos');
    modDiv.innerHTML = `<h3 style="margin-top:0;margin-bottom:16px">Trámites asociados</h3><div id="detail-tramites-list" style="margin-top:0"></div>`;
    await loadModuloExtras(item.id, '#detail-tramites-list');
  }
}

// Modal form
function showModal(mode, item){
  qs('#modal').classList.remove('hidden');
  qs('#modal-form').dataset.mode = mode;
  // show/hide piso field for modules
  qs('#field-piso').style.display = mode === 'modulo' ? 'block' : 'none';
  const fieldModulo = document.getElementById('field-modulo');
  if (fieldModulo) fieldModulo.style.display = mode === 'modulo' ? 'block' : 'none';
  // icon file input available for modal (create/edit)
  qs('#field-icono-file').style.display = (mode === 'modulo' || mode === 'tramite') ? 'block' : 'none';

  if (item && item.id) {
    qs('#modal-form').dataset.action = 'edit';
    qs('#modal-form').dataset.id = item.id;
    qs('#modal-title').textContent = mode==='tramite' ? 'Editar Trámite' : 'Editar Módulo';
    // prefill
    qs('input[name="titulo"]').value = item.titulo || item.nombre || '';
    if (mode === 'modulo') {
      // Extraer número de módulo y piso si están en formato 'Módulo xx' y 'Piso xx'
      let moduloVal = '';
      let pisoVal = '';
      if (item.numero && /^Módulo \d{2}$/.test(item.numero)) moduloVal = item.numero.slice(-2);
      if (item.piso && /^Piso \d{2}$/.test(item.piso)) pisoVal = item.piso.slice(-2);
      qs('input[name="modulo"]').value = moduloVal || '';
      qs('input[name="piso"]').value = pisoVal || '';
    }
    // show preview for modules if icon exists
    const previewWrap = qs('#field-icon-preview');
    const previewImg = qs('#icon-preview');
    if (item.icono) {
      if (previewImg) { previewImg.src = '/icons/' + encodeURIComponent(item.icono); }
      if (previewWrap) previewWrap.style.display = 'block';
    } else {
      if (previewImg) { previewImg.src = ''; }
      if (previewWrap) previewWrap.style.display = 'none';
    }
    // modal only: do not load requisitos/modules here (they're managed in detail view)
    // preserve current icon filename in hidden input so edits without upload keep it
    const hidden = qs('input[name="iconoCurrent"]'); if (hidden) hidden.value = item.icono || '';
  } else {
    qs('#modal-form').dataset.action = 'create';
    delete qs('#modal-form').dataset.id;
    qs('#modal-title').textContent = mode==='tramite' ? 'Nuevo Trámite' : 'Nuevo Módulo';
    qs('#modal-form').reset();
    const hidden = qs('input[name="iconoCurrent"]'); if (hidden) hidden.value = '';
  }
}
function hideModal(){ qs('#modal').classList.add('hidden'); }

// Requisito modal handlers
function showReqModal(action, requisito, tramiteId){
  qs('#modal-req').classList.remove('hidden');
  const form = qs('#modal-req-form');
  form.dataset.action = action === 'edit' ? 'edit' : 'create';
  if (action === 'edit' && requisito) {
    form.dataset.id = requisito.id;
    form.querySelector('[name="texto"]').value = requisito.texto || '';
    form.querySelector('input[name="reqId"]').value = requisito.id;
    form.querySelector('input[name="reqTramiteId"]').value = requisito.tramite_id || tramiteId || '';
  } else {
    delete form.dataset.id; form.reset(); form.dataset.action = 'create';
    form.querySelector('input[name="reqTramiteId"]').value = tramiteId || '';
  }
}
function hideReqModal(){ qs('#modal-req').classList.add('hidden'); }

async function submitReqModal(e){
  e.preventDefault();
  const form = e.target; const fm = new FormData(form);
  const action = form.dataset.action || 'create';
  const tramite_id = fm.get('reqTramiteId');
  try{
    if (action === 'create'){
      await api('/requisitos', { method: 'POST', body: JSON.stringify({ tramite_id: Number(tramite_id), texto: fm.get('texto') }) });
    } else {
      const id = form.dataset.id;
      await api('/requisitos/' + id, { method: 'PUT', body: JSON.stringify({ texto: fm.get('texto') }) });
    }
    hideReqModal();
    await loadTramiteExtras(tramite_id);
  }catch(err){
    alert('Error: ' + err.message);
  }
}
async function submitModal(e){
  e.preventDefault();
  const fm = new FormData(e.target); const mode = e.target.dataset.mode;
  try{
    const action = e.target.dataset.action || 'create';
    if (mode === 'tramite'){
      const fileInput = document.querySelector('input[name="iconoFile"]');
      let uploaded = null;
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const fd = new FormData(); fd.append('file', fileInput.files[0]);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(await res.text());
        uploaded = await res.json();
      }
      const iconoValue = uploaded ? uploaded.filename : fm.get('iconoCurrent') || null;
      try {
        if (action === 'create') {
          await api('/tramites', { method: 'POST', body: JSON.stringify({ titulo: fm.get('titulo'), icono: iconoValue }) });
        } else {
          const id = e.target.dataset.id;
          await api(`/tramites/${id}`, { method: 'PUT', body: JSON.stringify({ titulo: fm.get('titulo'), icono: iconoValue }) });
        }
      } catch (err) {
        if (uploaded && uploaded.filename) {
          try { await fetch('/api/upload/' + encodeURIComponent(uploaded.filename), { method: 'DELETE' }); } catch (rollbackErr) { console.warn('Rollback delete failed', rollbackErr); }
        }
        throw err;
      }
    } else {
      const fileInput = document.querySelector('input[name="iconoFile"]');
      let uploaded = null;
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const fd = new FormData(); fd.append('file', fileInput.files[0]);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(await res.text());
        uploaded = await res.json();
      }
      const iconoValue = uploaded ? uploaded.filename : fm.get('iconoCurrent') || null;
      let moduloNum = fm.get('modulo');
      let pisoNum = fm.get('piso');
      if (!/^[0-9]{1,2}$/.test(moduloNum)) throw new Error('El campo Módulo debe ser un número de hasta dos cifras');
      if (!/^[0-9]{1,2}$/.test(pisoNum)) throw new Error('El campo Piso debe ser un número de hasta dos cifras');
      moduloNum = moduloNum.padStart(2, '0');
      pisoNum = pisoNum.padStart(2, '0');
      const numero = `Módulo ${moduloNum}`;
      const piso = `Piso ${pisoNum}`;
      try {
        if (action === 'create') {
          await api('/modulos', { method: 'POST', body: JSON.stringify({ nombre: fm.get('titulo'), numero, piso, icono: iconoValue }) });
        } else {
          const id = e.target.dataset.id;
          await api(`/modulos/${id}`, { method: 'PUT', body: JSON.stringify({ nombre: fm.get('titulo'), numero, piso, icono: iconoValue }) });
        }
      } catch (err) {
        if (uploaded && uploaded.filename) {
          try { await fetch('/api/upload/' + encodeURIComponent(uploaded.filename), { method: 'DELETE' }); } catch (rollbackErr) { console.warn('Rollback delete failed', rollbackErr); }
        }
        throw err;
      }
    }
    await load(); hideModal();
  }catch(err){ alert('Error: '+err.message) }
}

async function deleteItem(item){
  if (!confirm('¿Eliminar elemento?')) return;
  try{
    if (state.tab === 'tramites'){
      await api(`/tramites/${item.id}`, { method: 'DELETE' });
    } else {
      await api(`/modulos/${item.id}`, { method: 'DELETE' });
    }
    state.selected = null; qs('#detail').innerHTML = '<div class="empty">Selecciona un elemento para ver detalles</div>';
    await load();
  }catch(err){ alert('Error: '+err.message) }
}

function editItem(item){ showModal(state.tab==='tramites' ? 'tramite' : 'modulo', item); }

async function loadTramiteExtras(tramiteId, requisitosSel = '#detail-requisitos-list', modulosSel = '#detail-modulos-list'){
  try{
    const [reqs, assoc] = await Promise.all([
      api('/requisitos?tramite_id=' + encodeURIComponent(tramiteId)),
      api('/tramite-modulo?tramite_id=' + encodeURIComponent(tramiteId)),
    ]);

    // load requisitos for this tramite
    const wrap = qs(requisitosSel); if (!wrap) return;
    wrap.innerHTML = '';
    reqs.forEach(r => {
      const div = document.createElement('div'); div.className='req-row'; div.style.display='flex'; div.style.alignItems='center'; div.style.marginBottom='10px';
      const txt = document.createElement('div'); txt.style.flex='1'; txt.style.whiteSpace='pre-line'; txt.textContent = r.texto;
      const btnE = document.createElement('button'); btnE.className='btn-ghost'; btnE.textContent='Editar'; btnE.style.marginRight='6px'; btnE.addEventListener('click', async ()=>{ showReqModal('edit', r, tramiteId); });
      const btnD = document.createElement('button'); btnD.className='btn-ghost'; btnD.textContent='Eliminar'; btnD.addEventListener('click', async ()=>{ if (!confirm('Eliminar requisito?')) return; await api('/requisitos/' + r.id, { method: 'DELETE' }); await loadTramiteExtras(tramiteId, requisitosSel, modulosSel); });
      div.appendChild(txt); div.appendChild(btnE); div.appendChild(btnD);
      wrap.appendChild(div);
    });

    // load associations
    const current = assoc.map(a => String(a.modulo_id));
    const modWrap = qs(modulosSel); if (!modWrap) return; modWrap.innerHTML='';
    const renderedIds = [];
    const orderedModulos = (state.modulos || []).slice().sort(compareModulos);
    orderedModulos.forEach(m => {
      const id = String(m.id);
      renderedIds.push(id);
      const card = document.createElement('div'); card.className='req-card'; card.style.display='flex'; card.style.alignItems='center'; card.style.justifyContent='space-between'; card.style.padding='10px'; card.style.marginBottom='8px';
      const left = document.createElement('div'); left.style.display='flex'; left.style.alignItems='center'; left.style.flex='1';
      const imgWrap = document.createElement('div'); imgWrap.style.width='56px'; imgWrap.style.height='56px'; imgWrap.style.flex='0 0 56px'; imgWrap.style.marginRight='12px'; imgWrap.style.borderRadius='8px'; imgWrap.style.overflow='hidden';
      if (m.icono) { const im = document.createElement('img'); im.src = '/icons/' + encodeURIComponent(m.icono); im.style.width='100%'; im.style.height='100%'; im.style.objectFit='cover'; imgWrap.appendChild(im); } else { imgWrap.textContent='👤'; imgWrap.style.display='flex'; imgWrap.style.alignItems='center'; imgWrap.style.justifyContent='center'; }
      const lbl = document.createElement('div'); lbl.style.flex='1'; lbl.innerHTML = `<strong>${escapeHtml(m.nombre||m.titulo)}</strong><div style="color:var(--muted);font-size:0.95em">${escapeHtml(m.numero||'')} ${m.piso? ' • ' + escapeHtml(m.piso):''}</div>`;
      left.appendChild(imgWrap); left.appendChild(lbl);
      const action = document.createElement('div'); action.style.flex='0 0 auto'; action.style.display='flex'; action.style.gap='8px'; action.style.alignItems='center';
      const btn = document.createElement('button'); btn.className = current.includes(id) ? 'btn-ghost' : 'btn-primary'; btn.textContent = current.includes(id) ? 'Quitar' : 'Agregar';
      btn.addEventListener('click', async ()=>{
        try{
          if (!current.includes(id)) {
            await api('/tramite-modulo', { method: 'POST', body: JSON.stringify({ tramite_id: Number(tramiteId), modulo_id: Number(id) }) });
          } else {
            await api('/tramite-modulo/' + encodeURIComponent(tramiteId) + '/' + encodeURIComponent(id), { method: 'DELETE' });
          }
          await loadTramiteExtras(tramiteId, requisitosSel, modulosSel);
        }catch(e){ alert('Error: '+e.message) }
      });
      const btnEditMod = document.createElement('button'); btnEditMod.className='btn-ghost'; btnEditMod.textContent='Editar';
      btnEditMod.addEventListener('click', (ev)=>{ ev.stopPropagation(); editItem(m); });
      action.appendChild(btn);
      action.appendChild(btnEditMod);
      card.appendChild(left); card.appendChild(action); modWrap.appendChild(card);
    });

    const titleEl = qs('#detail-modulos-title');
    if (titleEl) {
      titleEl.textContent = `Módulos que atienden (renderizados ${renderedIds.length} de ${orderedModulos.length})`;
    }

    if (renderedIds.length !== orderedModulos.length) {
      const missing = orderedModulos.filter(m => !renderedIds.includes(String(m.id)));
      const warn = document.createElement('div');
      warn.style.marginTop = '8px';
      warn.style.color = '#b42318';
      warn.textContent = `Faltan módulos por renderizar: ${missing.map(m => `${m.nombre || ''} (${m.numero || ''})`).join(', ')}`;
      modWrap.appendChild(warn);
    }
  }catch(e){ console.error(e); }
}

async function loadModuloExtras(moduloId, tramitesSel = '#detail-tramites-list'){
  try{
    // load associations
    const assoc = await api('/tramite-modulo?modulo_id=' + encodeURIComponent(moduloId));
    const tramiteIds = assoc.map(a => Number(a.tramite_id));
    const tramWrap = qs(tramitesSel); if (!tramWrap) return; tramWrap.innerHTML='';
    
    // render trámites asociados
    state.tramites.forEach(t => {
      if (tramiteIds.includes(Number(t.id))) {
        const card = document.createElement('div'); card.className='req-card'; card.style.display='flex'; card.style.alignItems='center'; card.style.justifyContent='space-between'; card.style.padding='10px'; card.style.marginBottom='8px';
        const left = document.createElement('div'); left.style.display='flex'; left.style.alignItems='center'; left.style.flex='1';
        const imgWrap = document.createElement('div'); imgWrap.style.width='56px'; imgWrap.style.height='56px'; imgWrap.style.flex='0 0 56px'; imgWrap.style.marginRight='12px'; imgWrap.style.borderRadius='8px'; imgWrap.style.overflow='hidden';
        if (t.icono) { const im = document.createElement('img'); im.src = '/icons/' + encodeURIComponent(t.icono); im.style.width='100%'; im.style.height='100%'; im.style.objectFit='cover'; imgWrap.appendChild(im); } else { imgWrap.textContent='📋'; imgWrap.style.display='flex'; imgWrap.style.alignItems='center'; imgWrap.style.justifyContent='center'; }
        const lbl = document.createElement('div'); lbl.style.flex='1'; lbl.innerHTML = `<strong>${escapeHtml(t.titulo)}</strong>`;
        left.appendChild(imgWrap); left.appendChild(lbl);
        const action = document.createElement('div'); action.style.flex='0 0 auto'; action.style.display='flex'; action.style.gap='8px'; action.style.alignItems='center';
        const btn = document.createElement('button'); btn.className = 'btn-ghost'; btn.textContent = 'Quitar';
        btn.addEventListener('click', async ()=>{
          try{
            await api('/tramite-modulo/' + encodeURIComponent(t.id) + '/' + encodeURIComponent(moduloId), { method: 'DELETE' });
            await loadModuloExtras(moduloId, tramitesSel);
          }catch(e){ alert('Error: '+e.message) }
        });
        action.appendChild(btn);
        card.appendChild(left); card.appendChild(action); tramWrap.appendChild(card);
      }
    });
  }catch(e){ console.error(e); }
}

// Wire UI
document.addEventListener('DOMContentLoaded', ()=>{
  qs('#tab-tramites').addEventListener('click', ()=> setTab('tramites'));
  qs('#tab-modulos').addEventListener('click', ()=> setTab('modulos'));
  qs('#btn-new').addEventListener('click', ()=> showModal(state.tab==='tramites' ? 'tramite' : 'modulo'));
  qs('#modal-close').addEventListener('click', hideModal);
  qs('#modal-cancel').addEventListener('click', hideModal);
  qs('#modal-form').addEventListener('submit', submitModal);
  // requisito modal wiring
  const reqClose = qs('#modal-req-close'); if (reqClose) reqClose.addEventListener('click', hideReqModal);
  const reqCancel = qs('#modal-req-cancel'); if (reqCancel) reqCancel.addEventListener('click', hideReqModal);
  const reqForm = qs('#modal-req-form'); if (reqForm) reqForm.addEventListener('submit', submitReqModal);
  // Show preview when selecting a file
  const fileInput = qs('input[name="iconoFile"]');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const wrap = qs('#field-icon-preview');
      const img = qs('#icon-preview');
      if (e.target.files && e.target.files.length > 0) {
        const url = URL.createObjectURL(e.target.files[0]);
        if (img) img.src = url;
        if (wrap) wrap.style.display = 'block';
      } else {
        if (img) img.src = '';
        if (wrap) wrap.style.display = 'none';
      }
    });
  }

  const logoutBtn = qs('#btn-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', async ()=>{
    if (confirm('¿Cerrar sesión?')) {
      await logout();
    }
  });
  
  // Detectar actividad del usuario para reset del timeout
  document.addEventListener('mousedown', resetInactivityTimer);
  document.addEventListener('keydown', resetInactivityTimer);
  document.addEventListener('scroll', resetInactivityTimer);
  
  // initial: check auth and load
  checkAuth().then(() => load());
});
