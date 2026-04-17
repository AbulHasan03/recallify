/* ============================================================
   RECALLIFY — script.js  (Supabase Edition)
   Replaces all localStorage logic with Supabase calls.
   Requires: @supabase/supabase-js loaded before this file.
   ============================================================ */

'use strict';


// ============================================================
// SECTION 1 — SUPABASE CONFIGURATION
// ▸ Where: Top of file, before anything else
// ▸ What:  Initialises the Supabase client used for all DB
//          and auth calls throughout the app.
// ▸ Action: Replace the two placeholder strings below with
//           your real values from:
//           Supabase Dashboard → Project Settings → API
// ============================================================

const SUPABASE_URL  = 'https://nfwvcswubmtqkinuelvz.supabase.co';
const SUPABASE_ANON = 'sb_publishable_qP1Awe5vRUOkUxxO6JkrNQ_RIeGMj60';

// window.supabase is injected by the CDN <script> tag in index.html
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);


// ============================================================
// SECTION 2 — APP STATE
// ▸ currentUser holds { id, name, email } of the signed-in user.
//   id is the UUID from auth.users — used as user_id FK in DB.
// ============================================================

let currentUser         = null;  // { id, name, email }
let activeRecallEntryId = null;  // UUID of content row being recalled
let lastLoggedId        = null;  // UUID of content row just logged
let selectedScore       = null;  // integer 1–5 chosen in recall modal
let pendingDeleteId     = null;  // UUID of content row awaiting delete
let currentFilter       = 'All'; // active filter in Library view


// ============================================================
// SECTION 3 — DOM REFERENCES
// No changes from original — all IDs match index.html exactly
// ============================================================

const authScreen = document.getElementById('auth-screen');
const appScreen  = document.getElementById('app-screen');

const btnLogin    = document.getElementById('btn-login');
const btnSignup   = document.getElementById('btn-signup');
const loginForm   = document.getElementById('login-form');
const signupForm  = document.getElementById('signup-form');
const loginError  = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');

const navBtns         = document.querySelectorAll('.nav-btn');
const sidebar         = document.getElementById('sidebar');
const sidebarOverlay  = document.getElementById('sidebar-overlay');
const menuBtn         = document.getElementById('menu-btn');
const signoutBtn      = document.getElementById('signout-btn');
const signoutBtnMob   = document.getElementById('signout-btn-mobile');
const userAvatar      = document.getElementById('user-avatar');
const userNameDisplay = document.getElementById('user-name-display');

const views = {
  dashboard: document.getElementById('view-dashboard'),
  log:       document.getElementById('view-log'),
  library:   document.getElementById('view-library'),
};

const statAvg      = document.getElementById('stat-avg');
const statTotal    = document.getElementById('stat-total');
const statRecalled = document.getElementById('stat-recalled');
const statPending  = document.getElementById('stat-pending');
const insightText  = document.getElementById('insight-text');
const recentList   = document.getElementById('recent-list');
const dashGreeting = document.getElementById('dashboard-greeting');

const logFormCard   = document.getElementById('log-form-card');
const logSuccess    = document.getElementById('log-success');
const contentTitle  = document.getElementById('content-title');
const contentLink   = document.getElementById('content-link');
const contentNotes  = document.getElementById('content-notes');
const typeBtns      = document.querySelectorAll('.type-btn');
const logError      = document.getElementById('log-error');
const logSubmit     = document.getElementById('log-submit');
const recallNowBtn  = document.getElementById('recall-now-btn');
const logAnotherBtn = document.getElementById('log-another-btn');

const libraryList = document.getElementById('library-list');
const filterBtns  = document.querySelectorAll('.filter-btn');

const recallModal    = document.getElementById('recall-modal');
const modalClose     = document.getElementById('modal-close');
const modalContentNm = document.getElementById('modal-content-name');
const recallStep1    = document.getElementById('recall-step-1');
const recallStep2    = document.getElementById('recall-step-2');
const recallStep3    = document.getElementById('recall-step-3');
const recallInput    = document.getElementById('recall-input');
const recallNextBtn  = document.getElementById('recall-next-btn');
const ratingBtns     = document.querySelectorAll('.rating-btn');
const recallSubmit   = document.getElementById('recall-submit-btn');
const resultScoreNum = document.getElementById('result-score-num');
const resultTitle    = document.getElementById('result-title');
const resultMessage  = document.getElementById('result-message');
const recallDoneBtn  = document.getElementById('recall-done-btn');

const deleteModal   = document.getElementById('delete-modal');
const deleteCancel  = document.getElementById('delete-cancel');
const deleteConfirm = document.getElementById('delete-confirm');


// ============================================================
// SECTION 4 — INITIALISATION
// ▸ What:  Supabase stores the JWT session in localStorage
//          automatically. We call getSession() to check if the
//          user is already logged in when the page loads —
//          no manual session management needed.
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check for an existing Supabase session (survives page refresh)
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    // User is already signed in — restore their profile
    const meta = session.user.user_metadata;
    currentUser = {
      id:    session.user.id,
      email: session.user.email,
      name:  meta?.name || session.user.email.split('@')[0],
    };
    enterApp();
  }

  // Listen for auth state changes (login / logout from any tab)
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session && currentUser) {
      currentUser = null;
      showAuthScreen();
    }
  });

  bindEvents();
});


// ============================================================
// SECTION 5 — EVENT BINDINGS
// ============================================================

function bindEvents() {

  // ---- Auth toggle (UI only) ----
  btnLogin.addEventListener('click', () => {
    btnLogin.classList.add('active');
    btnSignup.classList.remove('active');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
  });

  btnSignup.addEventListener('click', () => {
    btnSignup.classList.add('active');
    btnLogin.classList.remove('active');
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  });

  // ---- Auth submit ----
  document.getElementById('login-submit').addEventListener('click', handleLogin);
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });

  document.getElementById('signup-submit').addEventListener('click', handleSignup);
  document.getElementById('signup-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSignup();
  });

  // ---- Navigation ----
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
      closeSidebar();
    });
  });

  // ---- Sign out ----
  signoutBtn.addEventListener('click', signOut);
  signoutBtnMob.addEventListener('click', signOut);

  // ---- Mobile sidebar ----
  menuBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    sidebarOverlay.classList.remove('hidden');
  });
  sidebarOverlay.addEventListener('click', closeSidebar);

  // ---- Content type selector ----
  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      typeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ---- Log submit ----
  logSubmit.addEventListener('click', handleLogSubmit);

  // ---- After log success ----
  recallNowBtn.addEventListener('click', () => {
    if (lastLoggedId) openRecallModal(lastLoggedId);
  });
  logAnotherBtn.addEventListener('click', resetLogForm);

  // ---- Library filters ----
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderLibrary();
    });
  });

  // ---- Recall modal ----
  modalClose.addEventListener('click', closeRecallModal);
  recallModal.addEventListener('click', e => {
    if (e.target === recallModal) closeRecallModal();
  });

  recallNextBtn.addEventListener('click', () => {
    if (!recallInput.value.trim()) {
      recallInput.style.borderColor = 'var(--red-soft)';
      setTimeout(() => { recallInput.style.borderColor = ''; }, 1500);
      return;
    }
    recallStep1.classList.add('hidden');
    recallStep1.classList.remove('active');
    recallStep2.classList.remove('hidden');
    recallStep2.classList.add('active');
  });

  ratingBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      ratingBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedScore = parseInt(btn.dataset.score);
      recallSubmit.classList.remove('hidden');
    });
  });

  recallSubmit.addEventListener('click', handleRecallSubmit);

  recallDoneBtn.addEventListener('click', () => {
    closeRecallModal();
    switchView('library');
  });

  // ---- Delete modal ----
  deleteCancel.addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    pendingDeleteId = null;
  });
  deleteConfirm.addEventListener('click', () => {
    if (pendingDeleteId) deleteEntry(pendingDeleteId);
    deleteModal.classList.add('hidden');
    pendingDeleteId = null;
  });
  deleteModal.addEventListener('click', e => {
    if (e.target === deleteModal) {
      deleteModal.classList.add('hidden');
      pendingDeleteId = null;
    }
  });

  // ---- Keyboard: Escape closes modals ----
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!recallModal.classList.contains('hidden')) closeRecallModal();
    if (!deleteModal.classList.contains('hidden'))  {
      deleteModal.classList.add('hidden');
      pendingDeleteId = null;
    }
  });
}


// ============================================================
// SECTION 6 — AUTHENTICATION
// ▸ Replaces: handleLogin, handleSignup, signOut, loadSession
// ▸ Schema match:
//   #signup-name     → user_metadata.name  (stored on auth.users)
//   #signup-email    → auth.users.email
//   #signup-password → auth.users (hashed by Supabase, never stored in your tables)
//   #login-email     → auth.users.email
//   #login-password  → verified by Supabase auth
// ============================================================

/**
 * SIGN UP
 * supabase.auth.signUp() creates the user in auth.users.
 * `options.data` is stored as user_metadata on the auth.users row.
 */
async function handleSignup() {
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass  = document.getElementById('signup-password').value;

  if (!name || !email || !pass) {
    showError(signupError, 'Please fill in all fields.'); return;
  }
  if (!isValidEmail(email)) {
    showError(signupError, 'Please enter a valid email address.'); return;
  }
  if (pass.length < 6) {
    showError(signupError, 'Password must be at least 6 characters.'); return;
  }

  setLoading(document.getElementById('signup-submit'), true);

  // SUPABASE AUTH: create the user account
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: {
      data: { name }  // saved to user_metadata.name — retrieved on login
    }
  });

  setLoading(document.getElementById('signup-submit'), false);

  if (error) { showError(signupError, error.message); return; }

  currentUser = {
    id:    data.user.id,
    email: data.user.email,
    name,
  };

  enterApp();
}

/**
 * SIGN IN
 * supabase.auth.signInWithPassword() validates credentials,
 * returns a session JWT that Supabase stores in localStorage automatically.
 */
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;

  if (!email || !pass) {
    showError(loginError, 'Please fill in all fields.'); return;
  }

  setLoading(document.getElementById('login-submit'), true);

  // SUPABASE AUTH: authenticate
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  setLoading(document.getElementById('login-submit'), false);

  if (error) { showError(loginError, 'Invalid email or password.'); return; }

  const meta = data.user.user_metadata;
  currentUser = {
    id:    data.user.id,
    email: data.user.email,
    name:  meta?.name || email.split('@')[0],
  };

  enterApp();
}

/**
 * SIGN OUT
 * supabase.auth.signOut() clears the JWT from localStorage
 * and invalidates the session server-side.
 */
async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  showAuthScreen();
}

function showAuthScreen() {
  appScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
  authScreen.classList.add('active');
  document.getElementById('login-email').value    = '';
  document.getElementById('login-password').value = '';
}

function enterApp() {
  authScreen.classList.add('hidden');
  authScreen.classList.remove('active');
  appScreen.classList.remove('hidden');

  userNameDisplay.textContent = currentUser.name;
  userAvatar.textContent      = currentUser.name.charAt(0).toUpperCase();

  switchView('dashboard');
}


// ============================================================
// SECTION 7 — NAVIGATION
// ============================================================

function switchView(viewName) {
  Object.values(views).forEach(v => {
    v.classList.remove('active');
    v.classList.add('hidden');
  });

  const target = views[viewName];
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }

  navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  if (viewName === 'dashboard') renderDashboard();
  if (viewName === 'library')   renderLibrary();
  if (viewName === 'log')       resetLogForm();
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.add('hidden');
}


// ============================================================
// SECTION 8 — LOG CONTENT (INSERT)
// ▸ Replaces: handleLogSubmit (was writing to localStorage)
// ▸ Schema match — frontend field → DB column (content table):
//   #content-title       → title        TEXT NOT NULL
//   .type-btn.active     → type         TEXT ('Video'|'Article'|'Other')
//   #content-link        → link         TEXT NULL
//   #content-notes       → notes        TEXT NULL
//   currentUser.id       → user_id      UUID FK → auth.users
//   (Postgres auto)      → id           UUID PK (gen_random_uuid())
//   (Postgres auto)      → created_at   TIMESTAMPTZ (NOW())
// ▸ NO mismatch: the old `entry.createdAt` (camelCase) is now
//   `entry.created_at` (snake_case) matching the DB column.
//   The renderDashboard/Library functions use `entry.created_at`.
// ============================================================

/**
 * INSERT into public.content
 * .select().single() returns the inserted row so we capture its UUID.
 */
async function handleLogSubmit() {
  const title = contentTitle.value.trim();
  const link  = contentLink.value.trim();
  const notes = contentNotes.value.trim();
  const type  = document.querySelector('.type-btn.active')?.dataset.type || 'Other';

  if (!title) {
    showError(logError, 'Please enter a title.'); contentTitle.focus(); return;
  }

  setLoading(logSubmit, true);

  // SUPABASE DB: insert one row into public.content
  const { data, error } = await supabase
    .from('content')
    .insert({
      user_id: currentUser.id,   // UUID — FK to auth.users.id
      title,                      // TEXT NOT NULL
      type,                       // TEXT — must match CHECK constraint
      link:  link  || null,       // TEXT NULL
      notes: notes || null,       // TEXT NULL
    })
    .select()   // return the inserted row
    .single();  // expect exactly one row

  setLoading(logSubmit, false);

  if (error) { showError(logError, error.message); return; }

  lastLoggedId = data.id; // UUID — used by "Recall Now" button

  logFormCard.classList.add('hidden');
  logSuccess.classList.remove('hidden');
}

function resetLogForm() {
  contentTitle.value = '';
  contentLink.value  = '';
  contentNotes.value = '';
  logError.classList.add('hidden');
  lastLoggedId = null;

  typeBtns.forEach(b => b.classList.remove('active'));
  typeBtns[0].classList.add('active');

  logFormCard.classList.remove('hidden');
  logSuccess.classList.add('hidden');
}


// ============================================================
// SECTION 9 — FETCH USER DATA (SELECT with JOIN)
// ▸ Replaces: getUserEntries() + getEntries().filter(...)
// ▸ What: One query joins content ↔ recall_entries via FK.
//   Supabase handles the join using the column name as the
//   nested object key. RLS ensures only the user's rows return.
// ▸ Return shape (normalised for the rest of the app):
//   {
//     id, title, type, link, notes, created_at,  ← content columns
//     recall: { text, score, date, id } | null    ← most recent recall
//   }
// ============================================================

async function getUserEntries() {
  if (!currentUser) return [];

  // SUPABASE DB: join content with its recall_entries
  const { data, error } = await supabase
    .from('content')
    .select(`
      id,
      title,
      type,
      link,
      notes,
      created_at,
      recall_entries (
        id,
        response_text,
        recall_score,
        created_at
      )
    `)
    .eq('user_id', currentUser.id)              // RLS also enforces this
    .order('created_at', { ascending: false });  // newest content first

  if (error) { console.error('Fetch error:', error.message); return []; }

  // Normalise: flatten the most recent recall_entry onto each content row
  return (data || []).map(entry => {
    // recall_entries is sorted by Supabase insert order; take first (most recent)
    const latestRecall = (entry.recall_entries || [])[0] || null;
    return {
      ...entry,
      recall: latestRecall
        ? {
            id:    latestRecall.id,
            text:  latestRecall.response_text,   // DB: response_text → app: text
            score: latestRecall.recall_score,     // DB: recall_score  → app: score
            date:  latestRecall.created_at,       // DB: created_at    → app: date
          }
        : null,
    };
  });
}


// ============================================================
// SECTION 10 — DASHBOARD RENDER
// ▸ Now async — awaits getUserEntries()
// ▸ Uses entry.created_at (snake_case, from DB)
// ============================================================

async function renderDashboard() {
  recentList.innerHTML = '<p class="empty-state">Loading...</p>';

  const entries  = await getUserEntries();
  const recalled = entries.filter(e => e.recall);
  const pending  = entries.filter(e => !e.recall);
  const scores   = recalled.map(e => e.recall.score);
  const avg      = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : null;

  statTotal.textContent    = entries.length;
  statRecalled.textContent = recalled.length;
  statPending.textContent  = pending.length;
  statAvg.textContent      = avg || '—';

  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  dashGreeting.textContent = `${greet}, ${currentUser.name}!`;

  insightText.textContent = generateInsight(entries);

  const recent = entries.slice(0, 5); // already newest-first
  recentList.innerHTML = recent.length === 0
    ? '<p class="empty-state">Nothing logged yet. Start by logging some content!</p>'
    : recent.map(recentItemHTML).join('');
}

function recentItemHTML(entry) {
  const badge = entry.recall
    ? `<span class="recall-badge score-${entry.recall.score}">${entry.recall.score}/5</span>`
    : `<span class="recall-badge pending">Pending</span>`;

  return `
    <div class="recent-item">
      <div class="recent-left">
        <div class="content-icon">${typeIcon(entry.type)}</div>
        <div class="recent-info">
          <div class="recent-title">${escapeHtml(entry.title)}</div>
          <div class="recent-meta">${entry.type} · ${formatDate(entry.created_at)}</div>
        </div>
      </div>
      ${badge}
    </div>
  `;
}

function generateInsight(entries) {
  if (entries.length === 0)
    return 'Log some content and perform recalls to see insights here.';
  if (entries.length < 3)
    return `You've logged ${entries.length} item${entries.length > 1 ? 's' : ''}. Keep going — insights appear after a few recalls!`;

  const recalled = entries.filter(e => e.recall);
  if (recalled.length === 0)
    return `You have ${entries.length} items logged. Try performing active recall on one — it's the #1 way to improve retention!`;

  const byType = {};
  recalled.forEach(e => {
    if (!byType[e.type]) byType[e.type] = { sum: 0, count: 0 };
    byType[e.type].sum   += e.recall.score;
    byType[e.type].count += 1;
  });

  const typeAvgs = Object.entries(byType)
    .map(([type, d]) => ({ type, avg: d.sum / d.count }))
    .sort((a, b) => b.avg - a.avg);

  if (typeAvgs.length >= 2) {
    const best  = typeAvgs[0];
    const worst = typeAvgs[typeAvgs.length - 1];
    return `You recall ${best.type.toLowerCase()}s better (avg ${best.avg.toFixed(1)}/5) than ${worst.type.toLowerCase()}s (avg ${worst.avg.toFixed(1)}/5). Focus more on ${worst.type.toLowerCase()}s!`;
  }

  const allScores = recalled.map(e => e.recall.score);
  const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  if (avg >= 4) return `Great retention! Your average recall score is ${avg.toFixed(1)}/5. Keep it up!`;
  if (avg >= 3) return `Solid progress! Average recall: ${avg.toFixed(1)}/5. Reviewing notes right after consuming content can help push this higher.`;
  return `Your average recall is ${avg.toFixed(1)}/5. Try jotting down key ideas immediately — even a few keywords help.`;
}


// ============================================================
// SECTION 11 — LIBRARY RENDER
// ▸ Now async — awaits getUserEntries()
// ▸ Uses entry.created_at (snake_case from DB)
// ============================================================

async function renderLibrary() {
  libraryList.innerHTML = '<p class="empty-state">Loading...</p>';

  let entries = await getUserEntries();

  if (currentFilter === 'Pending') {
    entries = entries.filter(e => !e.recall);
  } else if (currentFilter !== 'All') {
    entries = entries.filter(e => e.type === currentFilter);
  }

  if (entries.length === 0) {
    libraryList.innerHTML = '<p class="empty-state">No entries match this filter.</p>';
    return;
  }

  libraryList.innerHTML = entries.map(libraryItemHTML).join('');

  // Expand/collapse body on header click
  libraryList.querySelectorAll('.library-item-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      header.nextElementSibling?.classList.toggle('open');
    });
  });

  // "Recall Now" inline buttons (inside expanded body)
  libraryList.querySelectorAll('.btn-recall-inline').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openRecallModal(btn.dataset.id);
    });
  });

  // Recall icon button (in header)
  libraryList.querySelectorAll('.icon-btn[data-action="recall"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openRecallModal(btn.dataset.id);
    });
  });

  // Delete icon button
  libraryList.querySelectorAll('.icon-btn[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      pendingDeleteId = btn.dataset.id;
      deleteModal.classList.remove('hidden');
    });
  });
}

function libraryItemHTML(entry) {
  const recallBadge = entry.recall
    ? `<span class="recall-badge score-${entry.recall.score}">${entry.recall.score}/5</span>`
    : `<span class="recall-badge pending">Needs Recall</span>`;

  const recallAction = entry.recall
    ? `<button class="icon-btn" data-action="recall" data-id="${entry.id}" title="Recall again">↻</button>`
    : `<button class="icon-btn" data-action="recall" data-id="${entry.id}" title="Perform recall">⚡</button>`;

  const linkHTML = entry.link
    ? `<a class="lib-link" href="${escapeHtml(entry.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗ Link</a>`
    : '';

  return `
    <div class="library-item">
      <div class="library-item-header">
        <div class="lib-left">
          <div class="content-icon">${typeIcon(entry.type)}</div>
          <div class="lib-info">
            <div class="lib-title">${escapeHtml(entry.title)}${linkHTML}</div>
            <div class="lib-meta">${entry.type} · ${formatDate(entry.created_at)}</div>
          </div>
        </div>
        <div class="lib-right">
          ${recallBadge}
          <div class="lib-actions">
            ${recallAction}
            <button class="icon-btn danger" data-action="delete" data-id="${entry.id}" title="Delete">✕</button>
          </div>
        </div>
      </div>
      <div class="library-item-body">
        ${buildLibraryBody(entry)}
      </div>
    </div>
  `;
}

function buildLibraryBody(entry) {
  let html = '';

  if (entry.notes) {
    html += `
      <div class="recall-detail-section">
        <div class="recall-detail-label">Your Notes</div>
        <div class="recall-text">${escapeHtml(entry.notes)}</div>
      </div>
    `;
  }

  if (entry.recall) {
    html += `
      <div class="recall-detail-section" style="margin-top:${entry.notes ? '1rem' : '0'}">
        <div class="recall-detail-label">
          Active Recall · ${formatDate(entry.recall.date)} · Score: ${entry.recall.score}/5
        </div>
        <div class="recall-text">${escapeHtml(entry.recall.text)}</div>
      </div>
    `;
  } else {
    html += `
      <div class="no-recall-prompt" style="margin-top:${entry.notes ? '1rem' : '0'}">
        <p>You haven't performed an active recall on this yet.</p>
        <button class="btn-recall-inline" data-id="${entry.id}">Recall Now →</button>
      </div>
    `;
  }

  return html;
}


// ============================================================
// SECTION 12 — RECALL MODAL
// ▸ openRecallModal: accepts UUID string (was integer from Date.now())
// ▸ handleRecallSubmit: INSERT into recall_entries
// ▸ Schema match — frontend field → DB column (recall_entries):
//   activeRecallEntryId  → content_id    UUID FK → content.id
//   currentUser.id       → user_id       UUID FK → auth.users
//   recallInput.value    → response_text TEXT NOT NULL
//   selectedScore        → recall_score  INTEGER CHECK (1–5)
//   (Postgres auto)      → id            UUID PK
//   (Postgres auto)      → created_at    TIMESTAMPTZ
// ============================================================

async function openRecallModal(entryId) {
  activeRecallEntryId = entryId; // UUID string

  // Fetch title from Supabase to display in the modal
  const { data, error } = await supabase
    .from('content')
    .select('title')
    .eq('id', entryId)
    .single();

  if (error || !data) return;

  // Reset modal UI
  recallInput.value = '';
  selectedScore     = null;
  ratingBtns.forEach(b => b.classList.remove('selected'));
  recallSubmit.classList.add('hidden');

  [recallStep1, recallStep2, recallStep3].forEach(s => {
    s.classList.add('hidden');
    s.classList.remove('active');
  });

  recallStep1.classList.remove('hidden');
  recallStep1.classList.add('active');
  modalContentNm.textContent = `"${data.title}"`;
  recallModal.classList.remove('hidden');
  setTimeout(() => recallInput.focus(), 100);
}

function closeRecallModal() {
  recallModal.classList.add('hidden');
  activeRecallEntryId = null;
  selectedScore       = null;
}

/**
 * INSERT into public.recall_entries
 * This saves the user's recall attempt linked to the content item.
 */
async function handleRecallSubmit() {
  if (!selectedScore || !activeRecallEntryId) return;

  const text = recallInput.value.trim();
  if (!text) return;

  setLoading(recallSubmit, true);

  // SUPABASE DB: insert one row into public.recall_entries
  const { error } = await supabase
    .from('recall_entries')
    .insert({
      content_id:    activeRecallEntryId,  // UUID — FK to content.id
      user_id:       currentUser.id,        // UUID — FK to auth.users.id
      response_text: text,                  // TEXT NOT NULL — what user remembered
      recall_score:  selectedScore,         // INTEGER — must be 1 through 5
    });

  setLoading(recallSubmit, false);

  if (error) { console.error('Recall save error:', error.message); return; }

  // Advance to result step
  recallStep2.classList.add('hidden');
  recallStep2.classList.remove('active');
  recallStep3.classList.remove('hidden');
  recallStep3.classList.add('active');

  resultScoreNum.textContent = selectedScore;

  const msgs = {
    1: { title: 'Keep practicing!',  msg: "You recalled very little this time — that's okay. Review the material and try again soon." },
    2: { title: 'Room to grow!',     msg: 'A few things came back. Try to actively review your notes to reinforce those connections.' },
    3: { title: 'Not bad!',          msg: 'You remembered the key ideas. A second pass could help solidify the details.' },
    4: { title: 'Well done!',        msg: "Strong recall! You've clearly processed this content well. Keep it up." },
    5: { title: 'Excellent!',        msg: "Outstanding recall. You've mastered this material. Consider revisiting in a month to maintain it." },
  };

  const r = msgs[selectedScore];
  resultTitle.textContent   = r.title;
  resultMessage.textContent = r.msg;
}


// ============================================================
// SECTION 13 — DELETE
// ▸ Supabase call: supabase.from('content').delete()
// ▸ ON DELETE CASCADE means related recall_entries are deleted
//   automatically by Postgres — no extra query needed.
// ▸ RLS policy enforces users can only delete their own rows.
// ============================================================

async function deleteEntry(id) {
  // SUPABASE DB: delete the content row (cascade deletes recall_entries)
  const { error } = await supabase
    .from('content')
    .delete()
    .eq('id', id)
    .eq('user_id', currentUser.id); // extra safety — belt-and-suspenders

  if (error) { console.error('Delete error:', error.message); return; }

  renderLibrary();
  renderDashboard();
}


// ============================================================
// SECTION 14 — HELPERS
// ============================================================

/** Shows an error message element, auto-hides after 5s */
function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

/**
 * Disables/enables a button during async operations.
 * Prevents double-submits on slow connections.
 */
function setLoading(btn, isLoading) {
  btn.disabled      = isLoading;
  btn.style.opacity = isLoading ? '0.6' : '1';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Prevent XSS by escaping HTML special characters */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function typeIcon(type) {
  const icons = { Video: '📹', Article: '📄', Other: '📦' };
  return icons[type] || '📦';
}
