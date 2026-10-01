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
  login.html             the sign in page
  materials.html         the material catalogue
  users.html             the account list
  css/style.css          the whole design system
  js/
    hierarchy.js         shared faculty, department and program data
    login.js             sign in page logic
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
server on port 5500 and open it:

```
python -m http.server 5500
```

Run that from inside `frontend/`, then open `http://localhost:5500/index.html`.
Opening `login.html` directly is the same thing.

Port 5500 is not a preference, it is a requirement. The main backend allows
`http://localhost:5500` and `http://127.0.0.1:5500` as origins and nothing
else, so any other port gets its response blocked by the browser. There is
nothing else to arrange before the pages show real data.

There is no build step, so there is nothing to compile and nothing to reinstall.
A hard refresh picks up every change.

## The API

Every page calls the deployed main Lumina backend. `API` is hardcoded at the top
of `js/main.js`, `js/materials.js`, `js/users.js` and `js/login.js`. There is no
environment variable and no config file, so pointing the console somewhere else
means changing those four lines.

It reads:

```
https://william999.pythonanywhere.com/api
```

The console itself is still served from localhost. Only the data comes from
PythonAnywhere, so there is no local backend to start.

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

That endpoint is `IsAuthenticated` plus `IsAdminUser`, so it returns 401 unless
the token belongs to an account with `is_staff` set. It is not a public list.

## Authentication

`GET /accounts/users/` needs a staff JWT, and the console has no way to get one
on its own. Browser storage is scoped to one origin, so a token the main app
writes on its own domain is invisible here and cannot be reused. The console
signs in for itself.

The main app's login endpoint is `POST {API}/accounts/login/`. It takes
`matric_number` and `password`, not email. The server uppercases the matric
number itself, so the console sends what was typed. It answers 200 with `user`,
`access` and `refresh`, 401 on wrong details, 400 on missing fields, and 429
after five anonymous attempts in a minute. The `user` object it returns has no
`is_staff` key, so a successful login is not proof of staff rights.

`login.html` and `js/login.js` do this in two calls:

1. Post `matric_number` and `password` as JSON to `/accounts/login/`. Take the
   `access` and `refresh` values out of the response.
2. Request `/accounts/users/` with that access token as a `Bearer` header. This
   is where the staff check actually happens. A 403 means a signed in account
   with no admin rights, and nothing is stored. Any other non-200 is treated as
   a temporary failure.

Only when the second call answers 200 are the tokens written to
`sessionStorage` under `lumina_access_token` and `lumina_refresh_token`, and
only then does the page go to `index.html`.

Loading `login.html` clears both tokens first, so a stale or half written one
cannot carry over. The submit button is disabled while either request runs.

`explainLoginFailure` decides what the reader sees, in three bands. A
`TypeError` from `fetch` means the network never answered, which in practice
means the wrong origin, so that gets the unreachable message naming localhost on
port 5500. A refused login, meaning the server answered and said no, gets the
line `describeLoginFailure` produced for the status. Anything else gets the
generic line, which is what an unreadable response body lands on, so a JSON
parser message from the browser never reaches the page. Status codes and
response bodies go to `console.error` only.

SimpleJWT issues access tokens that last 30 minutes. Nothing in the console
refreshes them. When one expires the users endpoint answers 401 and the page
sends you back to `login.html`, which is the correct behaviour, just with a
sign in to do again.

`loadUsers` in `users.js` is the guard. It redirects to `/login.html` when
there is no stored token, before fetching, and it redirects and clears both
tokens when the endpoint answers 401 or 403. `signOut` in `main.js` and
`materials.js` already cleared the tokens and pointed at `/login.html`, so those
buttons were waiting on this page.

## Running it locally

Two things must line up.

**1. Serve the frontend on port 5500.** The main app's `CORS_ALLOWED_ORIGINS`
lists `http://localhost:5500` and `http://127.0.0.1:5500` alongside its own
domain, so any other local port gets its response blocked by the browser.

**2. Sign in through the console.** Tokens live in `sessionStorage`, which is
scoped to one origin and one browser profile. `sessionStorage` is not shared
between origins, so a token written by the main app on its own domain is
invisible to the console and cannot be reused. Open `login.html` and sign in
with a staff account. See "Authentication" above for what that does.

There is no local backend to run. `API` points at the deployed one, over HTTPS,
so there is no certificate and no `SECURE_SSL_REDIRECT` problem to work around
any more.

Only `users.html` is guarded. Opening `index.html` or `materials.html` directly
still loads the shell and then either renders data or shows the empty state.

### When the users page looks empty

The empty state means the database is genuinely empty for that filter. The two
failure cases that used to look identical now send you back to `login.html`
instead: a missing token and a token without admin rights. What is left on
screen is only a real empty result.

A network 404 means the URL is wrong. A CORS error in the console means the port
is not 5500. Those are the two signals worth reading before assuming the data
is missing.

To count what is actually there, from `lumina/backend/`:

```
python manage.py shell -c "from accounts.models import User; print(User.objects.count(), User.objects.filter(is_staff=True).count())"
```

The second number is the one that decides whether the users endpoint will answer
at all.

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

`loadUsers` also guards the page. With no stored token it redirects to
`/login.html` before making any request, and on a 401 or 403 it clears both
tokens and redirects there too.

`filteredUsers` applies the search term, the three hierarchy filters, the level
and the staff only toggle. `matchesSearch` matches on `full_name` or
`matric_number`, case insensitively, and tolerates either being null.
`facultyMatches`, `departmentMatches` and `programMatches` all go through one
`fieldMatches` helper that accepts a user whose value is either the slug or the
full name, because the `User` model stores those three as free text rather than
as references to the hierarchy. `levelMatches` compares `String(user.level)`
against the dropdown value, because the API sends the level as a string.

A `LEVEL_NAMES` map at the top of `users.js` holds the four levels the system
uses, 100, 200, 300 and 400, displayed as "100 Level" and so on. That wording is
the main app's, which writes `${level} Level` on its cards and in its dropdowns,
so the two consoles cannot drift on the same word.
`populateLevels` fills the control from those keys rather than from the data, so
100 level is offered even before anybody is in it, and a level nobody is in
never turns into an empty filter. It runs at load time next to the other
populators, not inside `loadUsers`, because the list of levels does not depend
on the request.

Sorting is `sortedUsers`, applied by `render` on top of the filtered list. It
copies the array before sorting, because `sort` mutates in place and the module
level `users` must keep its original order. "Newest first" is the default and
sorts on `date_joined` descending, "Oldest first" reverses it, and the other two
sort on `full_name` and `material_count`.

A stat band sits above the grid with four figures: accounts on file, students,
staff, and joined this week. `renderStats` writes them once, after the fetch.
They count every account, not the filtered set, so changing a filter moves the
grid and the record count but leaves the figures alone. `joinedThisWeek` is a
rolling seven days from the browser clock, the same rule the overview uses.

A staff roster sits directly under the stat band, before the control bar, so
staff can be identified without opening a card. `renderStaffRoster` takes the
already filtered staff list, writes one `li` per person holding the full name
and the matric number, and hides the whole section when there is no staff. The
figure and the roster come from the same filter inside `renderStats`, so the
count and the names cannot disagree. It summarises every account, not the
filtered set, so it does not change when a filter does.

The faculty, department and program controls use the same cascade as the
materials page, built from the same `CASCADE` data, so the two pages cannot
drift apart. Department appears once a faculty is chosen and program appears once
a department is chosen, exactly as on materials.

A user card shows only the name and the matric number until it is opened, then
the rest. `buildBody` and `buildFoot` both take an `isExpanded` flag and skip the
second half of the card when it is false, so the collapsed card is the avatar,
the name, the matric number and a "View details" button. Opened, it adds the
faculty, department, level and join date line
`labelFor(FACULTY_NAMES, user.faculty)` and
`labelFor(DEPARTMENT_NAMES, user.department)` separated by slashes, the level as
`<level> Level`, and the join date formatted as day, short month, year, plus a
staff pill when `is_staff` is true and the material count.

Expanded ids are held in a module level `Set` called `expanded`, and
`handleAction` adds or removes the clicked id before calling `render`, the same
shape the materials page uses for revealed uploader ids. State survives a
re-render, so a filter change does not collapse everything back, but not a page
reload. The toggle carries `aria-expanded` and its text flips between "View
details" and "Hide details".

The foot is a column in both states, so the collapsed card stacks the toggle
under the name rather than stretching it across the row.

`align-items: start` on the users grid stops the rows stretching. Grid items
stretch to the tallest card in their row by default, so opening one card used to
inflate every card beside it, which read as the whole row opening. The rule is
scoped to `body[data-page='users']` and `.resource-card--person`, so the materials
page keeps the stretch it always had.

Remove is a stub that only logs the id. It only appears on an opened card.

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
controls, and every control has a label. The staff only toggle is a checkbox
wrapped in a `.field-check__box` pill, restyled through `:has()` so the focus
ring and the checked state both come from the input rather than from a class
toggled in JavaScript. The card details toggle uses `aria-expanded` as its state
hook, styled with an attribute selector rather than a class, for the same reason.

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
- `API` pointed at `http://localhost:8000/api` in all three page scripts for local
  work, with the production value and the three local conditions written down.
- Sign in added. `login.html` and `js/login.js` post a matric number and password
  to `/accounts/login/`, confirm staff access with one call to
  `/accounts/users/` before storing anything, and write the tokens to
  `sessionStorage`. `loadUsers` in `users.js` redirects to `login.html` when
  there is no token and on a 401 or 403, so the empty list was never really
  empty, it was unauthorised.
- `API` pointed at the deployed backend in all four page scripts, and the login
  error bands split three ways so an unreadable response body can no longer put
  a browser parser message on the page.
- Users page filled out. A sort control with newest first as the default, a
  level filter covering all four levels, a staff only toggle, and a four figure
  stat band above the grid.
- User cards collapsed to name and matric number, with the faculty, level, join
  date, staff pill, material count and Remove behind a "View details" toggle,
  because the full card was too crowded at a glance.
- User cards stop stretching to the tallest in their row, so opening one no
  longer inflates the cards beside it.
