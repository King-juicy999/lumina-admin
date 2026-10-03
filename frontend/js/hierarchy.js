const FACULTY_NAMES = {
  fs: 'Faculty of Science',
  fbams: 'Faculty of Basic and Allied Medical Sciences',
  fes: 'Faculty of Environmental Sciences',
  fsms: 'Faculty of Social and Management Sciences',
  fol: 'Faculty of Law',
  eng: 'Faculty of English and Linguistics'
};

const DEPARTMENT_NAMES = {
  'dept-computing': 'Computing',
  'dept-mathematics': 'Mathematics',
  nur: 'Nursing Science',
  mls: 'Medical Laboratory Science',
  ph: 'Public Health',
  eng: 'English',
  architecture: 'Architecture',
  pol: 'Political Science',
  masscomm: 'Mass Communication'
};

const PROGRAM_NAMES = {
  'prog-cmp': 'Computer Science',
  'prog-swe': 'Software Engineering',
  'prog-ift': 'Information Technology',
  'prog-mth': 'Mathematics',
  'prog-nursing': 'Nursing',
  'prog-mls': 'Medical Laboratory Science',
  'prog-ph': 'Public Health',
  'prog-eng': 'English',
  'prog-arc': 'Architecture',
  'prog-irs': 'International Relations',
  'prog-mac': 'Mass Communication'
};

const CASCADE = {
  fs: {
    departments: {
      'dept-computing': ['prog-cmp', 'prog-swe', 'prog-ift'],
      'dept-mathematics': ['prog-mth']
    }
  },
  fbams: {
    departments: {
      nur: ['prog-nursing'],
      mls: ['prog-mls'],
      ph: ['prog-ph']
    }
  },
  eng: {
    departments: {
      eng: ['prog-eng']
    }
  },
  fol: {
    departments: {}
  },
  fes: {
    departments: {
      architecture: ['prog-arc']
    }
  },
  fsms: {
    departments: {
      pol: ['prog-irs'],
      masscomm: ['prog-mac']
    }
  }
};

function labelFor(names, id) {
  return names[id] || id || '';
}

function facultyMatches(user, faculty) {
  return fieldMatches(user, faculty, 'faculty', FACULTY_NAMES);
}
function departmentMatches(user, department) {
  return fieldMatches(user, department, 'department', DEPARTMENT_NAMES);
}
function programMatches(user, program) {
  return fieldMatches(user, program, 'program', PROGRAM_NAMES);
}
function fieldMatches(user, value, slug, names) {
  return user[slug] === value || user[slug] === names[value];
}
