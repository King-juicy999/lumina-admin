const USERS = [
  { id: 1, full_name: 'Oluwaseun Adeyemi', email: 'adeyemi.o@aul.edu.ng', matric_number: 'AUL/CSC/21/0142', faculty: 'Computing', department: 'Computer Science', program: 'Computer Science', level: 300, is_staff: false, material_count: 4, joined_at: '2024-09-03' },
  { id: 2, full_name: 'Chidinma Okafor', email: 'okafor.c@aul.edu.ng', matric_number: 'AUL/CSC/22/0871', faculty: 'Computing', department: 'Computer Science', program: 'Computer Science', level: 200, is_staff: false, material_count: 3, joined_at: '2024-10-11' },
  { id: 3, full_name: 'Tunde Bakare', email: 'bakare.t@aul.edu.ng', matric_number: 'AUL/CSC/20/0315', faculty: 'Computing', department: 'Computer Science', program: 'Computer Science', level: 400, is_staff: false, material_count: 2, joined_at: '2023-09-18' },
  { id: 4, full_name: 'Aisha Bello', email: 'bello.a@aul.edu.ng', matric_number: 'AUL/CSC/23/1104', faculty: 'Computing', department: 'Computer Science', program: 'Computer Science', level: 300, is_staff: false, material_count: 1, joined_at: '2025-01-22' },
  { id: 5, full_name: 'Segun Williams', email: 'williams.s@aul.edu.ng', matric_number: 'AUL/SCT/22/0640', faculty: 'Sciences', department: 'Mathematics', program: 'Mathematics', level: 200, is_staff: false, material_count: 2, joined_at: '2024-11-05' },
  { id: 6, full_name: 'Ngozi Eze', email: 'eze.n@aul.edu.ng', matric_number: 'AUL/CSC/24/1502', faculty: 'Computing', department: 'Computer Science', program: 'Computer Science', level: 100, is_staff: false, material_count: 1, joined_at: '2025-02-14' },
  { id: 7, full_name: 'Ibrahim Musa', email: 'musa.i@aul.edu.ng', matric_number: 'AUL/PHY/24/0333', faculty: 'Sciences', department: 'Physics', program: 'Physics', level: 100, is_staff: false, material_count: 1, joined_at: '2025-03-02' },
  { id: 8, full_name: 'Fatima Abdullahi', email: 'abdullahi.f@aul.edu.ng', matric_number: 'AUL/ACC/22/0488', faculty: 'Management Sciences', department: 'Accounting', program: 'Accounting', level: 200, is_staff: true, material_count: 0, joined_at: '2024-09-27' }
];

const elements = {
  search: document.getElementById('search'),
  faculty: document.getElementById('faculty'),
  records: document.getElementById('records'),
  count: document.getElementById('results-count'),
  empty: document.getElementById('empty-state'),
  emptyReset: document.getElementById('empty-reset'),
  logout: document.getElementById('logout-btn')
};

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function formatDate(value) {
  const [year, month, day] = value.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
}

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function populateSelect(select, values, firstLabel) {
  const first = makeElement('option', '', firstLabel);
  first.value = 'all';
  select.replaceChildren(first);
  for (const value of values) {
    const option = makeElement('option', '', value);
    option.value = value;
    select.appendChild(option);
  }
}

function populateFaculties() {
  const names = [...new Set(USERS.map((user) => user.faculty))].sort();
  populateSelect(elements.faculty, names, 'All faculties');
}

function matchesSearch(user, term) {
  if (!term) {
    return true;
  }
  const name = user.full_name.toLowerCase();
  const matric = user.matric_number.toLowerCase();
  return name.includes(term) || matric.includes(term);
}

function filteredUsers() {
  const term = elements.search.value.trim().toLowerCase();
  const faculty = elements.faculty.value;
  return USERS.filter((user) => {
    if (!matchesSearch(user, term)) {
      return false;
    }
    return faculty === 'all' || user.faculty === faculty;
  });
}

function buildBody(user) {
  const body = makeElement('div', 'resource-card__body');
  body.appendChild(makeElement('h3', 'resource-card__title', user.full_name));
  body.appendChild(makeElement('p', 'resource-card__ref', user.matric_number));

  const meta = makeElement('p', 'resource-card__meta');
  meta.textContent = `${user.faculty} / ${user.department} / L${user.level} / joined ${formatDate(user.joined_at)}`;
  body.appendChild(meta);

  if (user.is_staff) {
    const wrap = makeElement('p', 'resource-card__meta');
    wrap.appendChild(makeElement('span', 'pill pill--staff', 'Staff'));
    body.appendChild(wrap);
  }
  return body;
}

function buildFoot(user) {
  const foot = makeElement('div', 'resource-card__foot');
  const value = makeElement('span', '');
  value.appendChild(makeElement('strong', 'resource-card__value', String(user.material_count)));
  value.appendChild(document.createTextNode(user.material_count === 1 ? ' material' : ' materials'));
  foot.appendChild(value);

  const button = makeElement('button', 'record-action record-action--danger', 'Remove');
  button.type = 'button';
  button.dataset.id = String(user.id);
  foot.appendChild(button);
  return foot;
}

function buildRecord(user) {
  const card = makeElement('article', 'resource-card resource-card--person');
  card.appendChild(makeElement('span', 'avatar', initials(user.full_name)));
  card.appendChild(buildBody(user));
  card.appendChild(buildFoot(user));
  return card;
}

function render() {
  const visible = filteredUsers();
  elements.records.replaceChildren(...visible.map(buildRecord));
  elements.count.textContent = `${visible.length} ${visible.length === 1 ? 'record' : 'records'}`;
  elements.empty.hidden = visible.length > 0;
}

function resetFilters() {
  elements.search.value = '';
  elements.faculty.value = 'all';
  render();
}

function handleAction(event) {
  const button = event.target.closest('.record-action');
  if (!button) {
    return;
  }
  console.warn('Remove is not wired to the backend yet.', button.dataset.id);
}

function signOut() {
  sessionStorage.removeItem('lumina_access_token');
  sessionStorage.removeItem('lumina_refresh_token');
  window.location.href = '/login.html';
}

elements.search.addEventListener('input', render);
elements.faculty.addEventListener('change', render);
elements.records.addEventListener('click', handleAction);
elements.emptyReset.addEventListener('click', resetFilters);
elements.logout.addEventListener('click', signOut);

populateFaculties();
render();
