# Lumina Admin

Admin platform for Lumina, the Anchor University Lagos course materials e-library.

Separate repository from the main Lumina app. Frontend and backend both live here.

This file is the reference for how the console is meant to work. It is updated as the
code changes. When a function does something, the explanation lives here, not in a
comment inside the file.

## What this is

Lumina Admin is where the site owner sees totals, progress and the state of the
library. It is private, single operator, and never student facing. The main Lumina
app is where students sign up and upload materials. This console reads the same
data and is where moderation is meant to happen.

The theme is "Card Catalogue": manila paper, ledger rules, stamp blue, filing red
and brass. The metadata metaphor from a physical card catalogue is the organising
idea, not a skin.

## Structure

```
backend/
  admin_dashboard/
    models.py            unmanaged mirrors of the main app tables
    management/commands/ empty, reserved for admin commands
frontend/
  index.html             the overview
  materials.html         the material catalogue
  users.html             the account list
  css/style.css          the whole design system
  js/
    hierarchy.js         shared faculty, department and program data
    main.js              overview page logic
    materials.js         materials page logic
    users.js             users page logic
```

The backend is a shell. There are no views, no URLs, no settings and no manage.py
yet, so nothing in it can read or write anything at runtime. Every number on the
console comes from the main Lumina API over HTTPS.

The frontend is vanilla HTML, CSS and JavaScript with no frameworks, no packages
and no build step. Opening `index.html` through any static server is enough.

## Running it

There is nothing to install. Serve the `frontend/` directory with any static
server and open it:

```
python -m http.server 8000 --directory frontend
```

Then open `http://localhost:8000/index.html`.

There is no build step, so there is nothing to compile and nothing to reinstall.
A hard refresh picks up every change.

## The API

Both pages call the deployed main Lumina backend:

```
https://william999.pythonanywhere.com/api
```

That base URL is hardcoded at the top of `js/main.js`, `js/materials.js` and
`js/users.js` as `API`. To point the console somewhere else, change it in those
three files. There is no environment variable and no config file.

The two materials requests are:

| Call | Purpose |
| --- | --- |
| `GET /materials/stats/` | the four overview figures |
| `GET /materials/?q=&faculty=&department=&program=&sort=` | the material list |

`sort` accepts `newest`, `download` and `title`, which is why the page's Sort
control maps "Most downloaded" onto `download` and "By course code" onto `title`.

The users request is:

```
GET /accounts/users/
```

It returns a flat array with no pagination wrapper. Each record has `id`,
`full_name`, `email`, `matric_number`, `faculty`, `department`, `program`, `level`
as a string, `is_staff`, `date_joined` as an ISO datetime, and `material_count`.

## Authentication

Tokens live in `sessionStorage` under `lumina_access_token` and
`lumina_refresh_token`, written by the main app on sign in. Every fetch reads the
access token and sends it as `Authorization: Bearer <token>`.

The console sends the token when it has one and makes the request anyway when it
does not, so a public endpoint still renders and an admin only endpoint returns
401. There is no login page here and no route guard, so opening a page directly
always loads the shell.

Sign out clears both keys and sends the browser to `/login.html`.

## js/hierarchy.js

Loaded before every page script. It defines four objects and one helper that the
whole console shares:

| Name | What it holds |
| --- | --- |
| `FACULTY_NAMES` | faculty slug to full faculty name |
| `DEPARTMENT_NAMES` | department slug to full department name |
| `PROGRAM_NAMES` | program slug to full program name |
| `CASCADE` | faculty to departments to programs, the parent-child tree |
| `labelFor(names, id)` | returns the full name, or the raw value if the map has no entry |

The data is copied from the main app's `HIERARCHY` in `lumina/js/main.js`, so the
two consoles cannot drift. Keys in `CASCADE` are ordered the way the main app
orders them, and object key order is insertion order, which is what the dropdowns
render in.

Slugs are the storage form. `CSC333` is stored without a space and displayed as
`CSC 333`, and every dropdown shows the full name while sending the slug back.

Because these are plain globals, `hierarchy.js` must be the first script tag on
any page that needs them. There is no module system here.

## index.html and js/main.js

The overview is a single page with four blocks: a master card, a "needs a
decision" queue, four stat figures, and a "where the library is thin" grid.

`loadStats` is the only real API call. It fetches `/materials/stats/` and maps
`total_materials`, `materials_this_week`, `program_count` and `hidden_materials`
onto the four figures. If the call fails, the sample figures set at the top of
the file stay on screen and the error goes to `console.error` only, so the page
never shows a raw failure to the reader.

`ATTENTION` and `THIN` are hardcoded placeholder lists. They are not wired to any
endpoint yet and are the obvious next thing to replace.

## materials.html and js/materials.js

A searchable, filterable card grid of every material on file.

`loadMaterials` builds its URL from the current control values, fetches, and
renders. The response is accepted either as a bare array or as an object with a
`results` key, so a paginated or unpaginated backend both work.

The faculty, department and program controls are a cascade:

- `populateFaculties` fills faculty from the keys of `CASCADE`.
- `populateDepartments(faculty)` fills department from the children of that
  faculty, or nothing at all when faculty is "all".
- `programsFor(department)` searches every faculty for the one holding that
  department and returns its programs, or an empty list.
- `refreshCascade` only decides visibility. The department control appears once a
  faculty is chosen, and the program control appears once a department is chosen.
- The change handlers repopulate the levels below the one that changed, then
  reload. `refreshCascade` deliberately does not repopulate anything, because
  doing so would reset the selection it just made.

Every dropdown is populated with full names through `labelFor`, never slugs.

Each card shows the material type as a badge, the course code with a space
inserted, the level, the session, the faculty, department and program, the
semester, the download count, and who filed it.

Uploader identity is admin only. An anonymous upload shows "Anonymous student"
to everyone, and the "View who posted" toggle reveals the real name for William
only. Revealed ids are held in a module level `Set` and survive a re-render but
not a page reload.

The Hide button and the identity toggle are stubs. `handleHide` and
`handleReveal` currently only log to the console; the reveal toggle does re-run
the load so the revealed name shows.

The Status control offers Live and Hidden, but `Material` has no `is_hidden`
field on the main app, so that filter does nothing yet.

## users.html and js/users.js

A card grid of every account that has signed up.

`loadUsers` fetches `/accounts/users/` once on load and stores the array in a
module level `users`. Filtering after that is entirely client side, so typing in
search or changing any filter re-renders instantly with no further network call.

`filteredUsers` applies the search term and the three hierarchy filters.
`matchesSearch` matches on `full_name` or `matric_number`, case insensitively,
and tolerates either being null. `facultyMatches`, `departmentMatches` and
`programMatches` all go through one `fieldMatches` helper that accepts a user
whose value is either the slug or the full name, because the `User` model stores
those three as free text rather than as references to the hierarchy.

The faculty, department and program controls use the same cascade as the
materials page, built from the same `CASCADE` data, so the two pages cannot
drift apart. Department appears once a faculty is chosen and program appears once
a department is chosen, exactly as on materials.

`buildBody` renders the name, the matric number, then
`labelFor(FACULTY_NAMES, user.faculty)` and
`labelFor(DEPARTMENT_NAMES, user.department)` separated by slashes, the level as
`L<level>`, and the join date formatted as day, short month, year. A staff pill is
added when `is_staff` is true.

The card foot shows `material_count` with correct singular and plural, and a
Remove button. Remove is a stub that only logs the id.

The empty state shows whenever the filtered list is empty, including when the
fetch itself failed.

The search field is capped at 18rem on this page only, through a
`body[data-page='users']` rule, because with only a few controls in the bar the
flex grow on `.field-search` would otherwise stretch it across the whole row. The
materials page keeps the uncapped version.

## errors

Raw error text never reaches the DOM. Plain language goes to the user, technical
detail goes to `console.error` only. Frontend validation is never a security
boundary, so anything a control checks the backend must check independently.

## styling

`css/style.css` is the entire design system in one file, with all values as
custom properties on `:root`.

| Token | Role |
| --- | --- |
| `--paper`, `--paper-deep` | the manila page and the recessed band |
| `--record` | the card surface |
| `--ink`, `--ink-soft`, `--ink-subtle` | body text at three weights |
| `--ledger`, `--ledger-faint` | the ruled lines |
| `--stamp`, `--stamp-deep` | the accent blue |
| `--filing-red` | the red used for rules, badges and the live dot |
| `--brass` | the secondary warm accent |
| `--font-display` | Young Serif, headings |
| `--font-ui` | Schibsted Grotesk, body and controls |
| `--font-record` | Fragment Mono, codes, refs and small data |

The page background is a repeating ledger gradient, not a flat colour, so it
reads as ruled paper. Cards lift on hover through `--shadow-lift`. Two animations
exist, `card-files-in` for a card dropping into the grid and `live-pulse` for the
attention dot.

There is no `prefers-reduced-motion` block yet, so both animations run for
everyone. That is a gap worth closing.

Two breakpoints exist, at 900px and 640px. Focus rings are visible on the form
controls, and every control has a label.

## Rules for changing this

- No comments in code. If a function needs explaining, the explanation goes in
  this file.
- No em dashes in code or in copy.
- Never rename an existing variable, function or class. Add alongside it.
- Do not add a framework, a package or a build step.
- Do not put raw error text in the DOM.
- The hierarchy data in `hierarchy.js` must stay identical to the main app's.
- Materials and users stay on separate pages. The overview is the overview only.

## Backend shell

`backend/admin_dashboard/models.py` declares unmanaged mirrors of the main app's
`materials_material`, `materials_download` and `materials_materialrequest`
tables, all with `managed = False`. They exist so the tables can be queried
without the admin platform owning the schema.

The local mirror is not identical to the live tables. It declares an `is_hidden`
column the live `Material` does not have, and it omits `description`,
`is_anonymous`, `allow_duplicate` and `preview_page`, which the live table does
have. Treat it as a starting point, not as truth.

## Project history

- Initial commit: gitignore and README.
- Overview, Materials and Users pages built with placeholder data and the Card
  Catalogue design system.
- Faculty, department and program dropdowns wired to the main app hierarchy, and
  the unclickable department and program controls fixed.
- Real users loaded from `GET /api/accounts/users/`, mock records deleted, and the
  hierarchy data moved into `js/hierarchy.js` and shared by both pages.
- Department and program filters added to the users page, matching the materials
  cascade, and the search field capped so it stops spanning the control bar.
