/* ============================================================
   RECALLIFY — script.js
   Supabase edition — all localStorage replaced with Supabase.
   Original structure, variable names, and UI logic preserved.

   SETUP: Replace SUPABASE_URL and SUPABASE_ANON below with
   the values from: Supabase Dashboard → Project Settings → API
   ============================================================ */

'use strict';


// ============================================================
// SUPABASE — initialise client
// ============================================================

const SUPABASE_URL  = 'https://nfwvcswubmtqkinuelvz.supabase.co';
const SUPABASE_ANON = 'sb_publishable_qP1Awe5vRUOkUxxO6JkrNQ_RIeGMj60';

let supabaseClient;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
} catch (err) {
  console.error("Supabase failed to initialize. Check your URL and Key.", err);
  // We initialize bindEvents anyway so at least UI toggles work
  document.addEventListener('DOMContentLoaded', () => bindEvents());
}



// ============================================================
// STATE
// ============================================================

let currentUser         = null;  // { id, name, email }
let activeRecallEntryId = null;  // UUID string of content row being recalled
let lastLoggedId        = null;  // UUID string of content row just saved
let selectedScore       = null;  // integer 1–5
let pendingDeleteId     = null;  // UUID string awaiting delete confirm
let currentFilter       = 'All';


// ============================================================
// ELEMENT REFERENCES  (unchanged from original)
// ============================================================

const authScreen = document.getElementById('auth-screen');
const appScreen  = document.getElementById('app-screen');

const btnLogin    = document.getElementById('btn-login');
const btnSignup   = document.getElementById('btn-signup');
const loginForm   = document.getElementById('login-form');
const signupForm  = document.getElementById('signup-form');
const loginError  = document.getElementById('login-error');
const loginSubmit = document.getElementById('login-submit');
const signupSubmit = document.getElementById('signup-submit');
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
  social:    document.getElementById('view-social'),
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
const contentTitle  = document.getElementById('title');
const contentLink   = document.getElementById('link');
const contentNotes  = document.getElementById('content-notes');
const typeBtns      = document.querySelectorAll('.type-btn');
const logError      = document.getElementById('log-error');
const logSubmit     = document.getElementById('addContentBtn');
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
const recallInput    = document.getElementById('recallText');
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
// INIT
// Replaces: loadSession() from localStorage.
// Supabase persists the JWT in localStorage automatically and
// restores it on page load via getSession().
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  // 1. Bind events immediately so the UI is responsive even if Supabase is loading
  bindEvents();

  // 2. Wrap Supabase calls in try/catch to prevent the whole script from dying
  try {
    // Check if user already has an active session (survives refresh)
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (session && !error) {
      const meta = session.user.user_metadata;
      currentUser = {
        id:    session.user.id,
        email: session.user.email,
        name:  meta?.name || session.user.email.split('@')[0],
      };
      enterApp();
    }

    // Auth state listener
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (!session && currentUser) {
        currentUser = null;
        showAuthScreen();
      }
    });
  } catch (err) {
    console.error("Supabase session check failed. Check your API Key.", err);
  }
});


// ============================================================
// EVENTS  (structure identical to original)
// ============================================================

function bindEvents() {

  // Auth toggle
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

  // Auth submit
  loginSubmit?.addEventListener('click', handleLogin);
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });

  signupSubmit?.addEventListener('click', handleSignup);
  document.getElementById('signup-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSignup();
  });

  // Navigation
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
      closeSidebar();
    });
  });

  // Sign out
  signoutBtn.addEventListener('click', signOut);
  signoutBtnMob.addEventListener('click', signOut);

  // Mobile sidebar
  menuBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    sidebarOverlay.classList.remove('hidden');
  });
  sidebarOverlay.addEventListener('click', closeSidebar);

  // Content type selector
  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      typeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Log submit
  logSubmit.addEventListener('click', handleLogSubmit);

  // After log success
  recallNowBtn.addEventListener('click', () => {
    if (lastLoggedId) openRecallModal(lastLoggedId);
  });
  logAnotherBtn.addEventListener('click', resetLogForm);

  // Library filters
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderLibrary();
    });
  });

  // Social sub-tabs
  document.querySelectorAll('.social-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (!currentUser) return;
      document.querySelectorAll('.social-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.social-sub-view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('social-' + tab.dataset.sub).classList.add('active');
    });
  });

  // Social Join Button
  const joinSocialBtn = document.querySelector('.privacy-btn.accept');
  joinSocialBtn?.addEventListener('click', () => {
    handleJoinSocial();
  });

  // Recall modal
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

  // Delete modal
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

  // Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!recallModal.classList.contains('hidden')) closeRecallModal();
    if (!deleteModal.classList.contains('hidden')) {
      deleteModal.classList.add('hidden');
      pendingDeleteId = null;
    }
  });
}


// ============================================================
// AUTH HANDLERS
// Replaces: handleLogin, handleSignup, signOut, saveSession,
//           clearSession, loadSession — all localStorage logic gone.
// ============================================================

// SIGN UP — creates user in Supabase auth.users.
// Name is stored in user_metadata so we can retrieve it on login.
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

  setLoading(signupSubmit, true);

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password: pass,
      options: { data: { name } },
    });

    if (error) throw error;

    // If identities is empty, the user likely already exists
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      showError(signupError, "An account with this email already exists. Please Sign In.");
    } else if (data.user) {
      currentUser = { id: data.user.id, email: data.user.email, name };
      console.log("Signup successful, entering app:", currentUser);
      enterApp();
    } else {
      showError(signupError, "Check your email to confirm your account!");
    }
  } catch (err) {
    showError(signupError, err.message || "Signup failed. Please try again.");
  } finally {
    setLoading(signupSubmit, false);
  }
}

// SIGN IN — validates credentials, Supabase stores the JWT automatically.
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;

  if (!email || !pass) {
    showError(loginError, 'Please fill in all fields.'); return;
  }

  setLoading(loginSubmit, true);

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;

    const meta = data.user.user_metadata;
    console.log("Login successful, user data:", data.user);
    currentUser = {
      id:    data.user.id,
      email: data.user.email,
      name:  meta?.name || (email ? email.split('@')[0] : 'User'),
    };
    enterApp();
  } catch (err) {
    showError(loginError, err.message || "Login failed.");
  } finally {
    setLoading(loginSubmit, false);
  }
}

// SIGN OUT — clears the Supabase JWT and returns to auth screen.
async function signOut() {
  await supabaseClient.auth.signOut();
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
// NAVIGATION  (unchanged from original)
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
  navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));

  if (viewName === 'dashboard') renderDashboard();
  if (viewName === 'library')   renderLibrary();
  if (viewName === 'social')    renderSocial(); 
  if (viewName === 'log')       resetLogForm();
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.add('hidden');
}


// ============================================================
// LOG CONTENT
// Replaces: handleLogSubmit writing to localStorage.
// Now inserts a row into the `content` table in Supabase.
//
// Field mapping (frontend → database column):
//   #content-title    → content.title        TEXT NOT NULL
//   .type-btn.active  → content.type         TEXT ('Video'|'Article'|'Other')
//   #content-link     → content.link         TEXT NULL
//   #content-notes    → content.notes        TEXT NULL
//   currentUser.id    → content.user_id      UUID (FK → auth.users)
// ============================================================

async function handleLogSubmit() {
  const title = contentTitle.value.trim();
  const link  = contentLink.value.trim();
  const notes = contentNotes.value.trim();
  const type  = document.querySelector('.type-btn.active')?.dataset.type || 'Other';

  if (!title) {
    showError(logError, 'Please enter a title.'); contentTitle.focus(); return;
  }

  setLoading(logSubmit, true);

  // Insert into public.content — returns the new row so we get its UUID
  const { data, error } = await supabaseClient
    .from('content')
    .insert({
      user_id: currentUser.id,
      title,
      type,
      link:  link  || null,
      notes: notes || null,
    })
    .select()
    .single();

  setLoading(logSubmit, false);

  if (error) { showError(logError, error.message); return; }

  // Save the new row's UUID so "Recall Now" knows which entry to open
  lastLoggedId = data.id;

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
// FETCH USER DATA
// Replaces: getEntries() + getUserEntries() from localStorage.
// Fetches content rows joined with their recall_entries via FK.
//
// Returns an array shaped the same as before so all render
// functions work without changes:
//   entry.id, entry.title, entry.type, entry.link,
//   entry.notes, entry.created_at
//   entry.recall → null  OR  { text, score, date, id }
// ============================================================

async function getUserEntries() {
  if (!currentUser) return [];

  const { data, error } = await supabaseClient
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
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) { console.error('Fetch error:', error.message); return []; }

  // Flatten: attach the most recent recall as entry.recall (or null)
  return (data || []).map(entry => {
    const r = (entry.recall_entries || [])[0] || null;
    return {
      ...entry,
      recall: r ? {
        id:    r.id,
        text:  r.response_text,
        score: r.recall_score,
        date:  r.created_at,
      } : null,
    };
  });
}

// ============================================================
// SOCIAL
// ============================================================

async function renderSocial() {
  // Check if user has opted in (you could store this in Supabase user_metadata)
  const { data: { user } } = await supabaseClient.auth.getUser();
  const isOptedIn = user?.user_metadata?.social_opted_in;

  const privacyBanner = document.querySelector('.privacy-banner');
  if (isOptedIn) {
    privacyBanner.classList.add('hidden');
  } else {
    privacyBanner.classList.remove('hidden');
  }
}

async function handleJoinSocial() {
  // Update Supabase metadata to persist the choice
  const { error } = await supabaseClient.auth.updateUser({
    data: { social_opted_in: true }
  });

  if (error) {
    console.error("Error joining social:", error.message);
    return;
  }

  // Refresh the social view
  renderSocial();
}

// ============================================================
// DASHBOARD
// Replaces: synchronous renderDashboard reading localStorage.
// Now async — awaits getUserEntries().
// Uses entry.created_at (snake_case from DB, was entry.createdAt).
// ============================================================

async function renderDashboard() {
  recentList.innerHTML = '<p class="empty-state">Loading…</p>';

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

  const recent = entries.slice(0, 5);
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
  if (avg >= 3) return `Solid progress! Average recall: ${avg.toFixed(1)}/5. Reviewing notes right after consuming content can push this higher.`;
  return `Your average recall is ${avg.toFixed(1)}/5. Try jotting down key ideas immediately — even a few keywords help.`;
}


// ============================================================
// LIBRARY
// Replaces: synchronous renderLibrary reading localStorage.
// Now async — awaits getUserEntries().
// ============================================================

async function renderLibrary() {
  libraryList.innerHTML = '<p class="empty-state">Loading…</p>';

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

  // Expand/collapse on header click
  libraryList.querySelectorAll('.library-item-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      header.nextElementSibling?.classList.toggle('open');
    });
  });

  // Recall buttons inside expanded body
  libraryList.querySelectorAll('.btn-recall-inline').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openRecallModal(btn.dataset.id);
    });
  });

  // Recall icon buttons in header
  libraryList.querySelectorAll('.icon-btn[data-action="recall"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openRecallModal(btn.dataset.id);
    });
  });

  // Delete icon buttons
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
    const recallDate = formatDate(entry.recall.date);
    html += `
      <div class="recall-detail-section" style="margin-top:${entry.notes ? '1rem' : '0'}">
        <div class="recall-detail-label">Active Recall · ${recallDate} · Score: ${entry.recall.score}/5</div>
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
// RECALL MODAL
// Replaces: openRecallModal (was reading from localStorage).
// Now fetches the entry title directly from Supabase.
// IDs are now UUID strings instead of integers (Date.now()).
//
// handleRecallSubmit replaces the localStorage array mutation.
// Now inserts into the `recall_entries` table:
//   recallInput.value  → recall_entries.response_text  TEXT NOT NULL
//   selectedScore      → recall_entries.recall_score   INTEGER (1–5)
//   activeRecallEntryId→ recall_entries.content_id     UUID FK
//   currentUser.id     → recall_entries.user_id        UUID FK
// ============================================================

async function openRecallModal(entryId) {
  activeRecallEntryId = entryId;

  // Fetch just the title to display in the modal header
  const { data, error } = await supabaseClient
    .from('content')
    .select('title')
    .eq('id', entryId)
    .single();

  if (error || !data) return;

  // Reset modal to step 1
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

async function handleRecallSubmit() {
  if (!selectedScore || !activeRecallEntryId) return;

  const text = recallInput.value.trim();
  if (!text) return;

  setLoading(recallSubmit, true);

  // Insert into public.recall_entries
  const { error } = await supabaseClient
    .from('recall_entries')
    .insert({
      content_id:    activeRecallEntryId,
      user_id:       currentUser.id,
      response_text: text,
      recall_score:  selectedScore,
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
// DELETE
// Replaces: deleteEntry() filtering a localStorage array.
// Deletes the content row from Supabase. Because recall_entries
// has ON DELETE CASCADE in schema.sql, all related recall rows
// are removed automatically — no extra query needed.
// ============================================================

async function deleteEntry(id) {
  const { error } = await supabaseClient
    .from('content')
    .delete()
    .eq('id', id)
    .eq('user_id', currentUser.id); // safety check: only delete own rows

  if (error) { console.error('Delete error:', error.message); return; }

  renderLibrary();
  renderDashboard();
}


// ============================================================
// HELPERS  (unchanged from original, plus setLoading)
// ============================================================

function showError(el, msg) {
  // Clear the input fields associated with the error before showing the message
  if (el === loginError) document.getElementById('login-password').value = '';
  if (el === signupError) document.getElementById('signup-password').value = '';
  el.textContent = msg;
  el.classList.remove('hidden');
  // For auth errors, keep them visible until next action or refresh for easier debugging
  if (el !== loginError && el !== signupError) {
    setTimeout(() => el.classList.add('hidden'), 4000);
  }
}

// Disables a button during async calls to prevent double-submits
function setLoading(btn, isLoading) {
  btn.disabled      = isLoading;
  btn.style.opacity = isLoading ? '0.6' : '1';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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