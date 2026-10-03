const RECYCLE_URL = `${API}/accounts/recycle/`;
let recycleItems = [];
const recElements = { records: document.getElementById('records'), count: document.getElementById('results-count'), empty: document.getElementById('empty-state'), logout: document.getElementById('logout-btn') };
function buildRecycleCard(item) {
  const card = document.createElement('article'); card.className = 'resource-card';
  const body = document.createElement('div'); body.className = 'resource-card__body';
  body.appendChild(document.createTextNode((item.name || item.title || 'Deleted item') + ' ' + (item.kind || '')));
  card.appendChild(body);
  const foot = document.createElement('div'); foot.className = 'resource-card__foot';
  const restore = document.createElement('button'); restore.className = 'record-action record-action--restore'; restore.type = 'button'; restore.textContent = 'Restore'; restore.addEventListener('click', () => restoreItem(item.id)); foot.appendChild(restore);
  card.appendChild(foot); return card;
}
function renderRecycle() { recElements.records.replaceChildren(...recycleItems.map(buildRecycleCard)); recElements.count.textContent = `${recycleItems.length} ${recycleItems.length === 1 ? 'record' : 'records'}`; recElements.empty.hidden = recycleItems.length > 0; }
async function loadRecycle() { if (!isSuperAdmin()) { window.location.href = 'index.html'; return; } const token = sessionStorage.getItem('lumina_access_token'); if (!token) { window.location.href = '/login.html'; return; } try { const res = await fetch(RECYCLE_URL, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } }); if (res.status === 401 || res.status === 403) { sessionStorage.clear(); window.location.href = '/login.html'; return; } if (!res.ok) throw new Error('status ' + res.status); recycleItems = await res.json(); } catch (e) { console.error('Recycle load failed.', e); recycleItems = []; } renderRecycle(); }
async function restoreItem(id) { try { const res = await authorisedFetch(`${RECYCLE_URL}${id}/restore/`, { method: 'POST', body: JSON.stringify({}) }); if (!res.ok) { console.error('Restore refused', res.status); showNotice('Restore failed.', 'bad'); return; } recycleItems = recycleItems.filter((i) => i.id !== id); renderRecycle(); showNotice('Restored.', 'good'); } catch (e) { console.error('Restore error', e); showNotice('Restore failed.', 'bad'); } }
if (recElements.logout) recElements.logout.addEventListener('click', () => { sessionStorage.removeItem('lumina_access_token'); sessionStorage.removeItem('lumina_refresh_token'); window.location.href = '/login.html'; });
loadRecycle();
