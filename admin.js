const SUPABASE_URL = 'https://coysymsgsgcmbadfbdvg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EkC3eUFQ1RgZiJ_FJQoZbg_YYC408ci';
const humsAdminClient = (typeof window !== 'undefined' && window.supabase && SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function toast(message, type = 'success') {
  document.querySelectorAll('.admin-toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = `admin-toast ${type === 'error' ? 'error' : ''}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
if (!humsAdminClient) {
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-overlay').innerHTML = `
      <div class="login-card">
        <h1>Not Configured</h1>
        <p class="sub">This admin dashboard isn't connected to Supabase yet.</p>
        <p style="font-size:.85rem;color:var(--text-light);line-height:1.7;">
          Edit <strong>SUPABASE_URL</strong> and <strong>SUPABASE_ANON_KEY</strong> at the top of
          <code>admin.js</code> (and <code>script.js</code>) with your project's credentials from
          Supabase Dashboard → Settings → API, then reload this page.
        </p>
      </div>
    `;
  });
}
/* AUTH */
async function initAuth() {
  const { data: { session } } = await humsAdminClient.auth.getSession();
  if (session) {
    showDashboard(session);
  } else {
    showLogin();
  }
  humsAdminClient.auth.onAuthStateChange((_event, session) => {
    if (session) showDashboard(session);
    else showLogin();
  });
}
function showLogin() {
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('dashboard').classList.remove('visible');
}
function showDashboard(session) {
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('dashboard').classList.add('visible');
  document.getElementById('admin-user-email').textContent = session.user.email;
  loadAllData();
}
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const btn = document.getElementById('login-btn');
      const errorBox = document.getElementById('login-error');
      errorBox.style.display = 'none';
      btn.disabled = true;
      btn.textContent = 'Signing in…';

      const { error } = await humsAdminClient.auth.signInWithPassword({ email, password });

      btn.disabled = false;
      btn.textContent = 'Sign In';

      if (error) {
        errorBox.textContent = error.message || 'Invalid email or password. Please try again.';
        errorBox.style.display = 'block';
      }
    });
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await humsAdminClient.auth.signOut();
    });
  }
  /* Sidebar tab switching */
  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.panel).classList.add('active');
    });
  });

  if (humsAdminClient) initAuth();
});


/* LOAD ALL DATA ON DASHBOARD ENTRY */
let currentGalleryTab = 'kg_gallery';

async function loadAllData() {
  await loadSiteContentIntoForms();
  await loadProgramLists();
  await loadMetrics();
  await loadGalleryList('homepage_wide', 'gallery-home-list');
  await loadGalleryList(currentGalleryTab, 'gallery-academics-list');
  await loadNewsList();
  await loadStaffList();
}
const SITE_CONTENT_KEYS = [
  'site_logo', 'footer_history', 'hero_headline', 'hero_bg_image',
  'director_welcome_text', 'director_name', 'director_title', 'director_photo',
  'contact_phone', 'contact_email', 'contact_address',
  'history_text', 'history_image', 'vision_text', 'mission_text',
  'focus_area_1', 'focus_area_2', 'goals_text', 'focused_goal_1',
  'expected_outcome', 'values_list',
];
async function loadSiteContentIntoForms() {
  const { data, error } = await humsAdminClient.from('site_content').select('key, value');
  if (error) { toast('Could not load site content: ' + error.message, 'error'); return; }
  const map = {};
  (data || []).forEach(row => { map[row.key] = row.value; });
  SITE_CONTENT_KEYS.forEach(key => {
    const el = document.getElementById('field-' + key);
    if (el) el.value = map[key] || '';
  });
}
async function saveSiteContentFields(keys, btnId) {
  const btn = document.getElementById(btnId);
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const rows = keys.map(key => ({
    key,
    value: document.getElementById('field-' + key)?.value ?? '',
  }));

  const { error } = await humsAdminClient.from('site_content').upsert(rows, { onConflict: 'key' });

  btn.disabled = false;
  btn.textContent = originalText;

  if (error) {
    toast('Save failed: ' + error.message, 'error');
  } else {
    toast('Saved successfully.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('save-global-btn')?.addEventListener('click', () =>
    saveSiteContentFields(['site_logo', 'footer_history', 'contact_phone', 'contact_email', 'contact_address'], 'save-global-btn')
  );
  document.getElementById('save-home-btn')?.addEventListener('click', () =>
    saveSiteContentFields(['hero_headline', 'hero_bg_image', 'director_name', 'director_title', 'director_photo', 'director_welcome_text'], 'save-home-btn')
  );
  document.getElementById('save-about-btn')?.addEventListener('click', () =>
    saveSiteContentFields(['history_text', 'history_image', 'vision_text', 'mission_text', 'focus_area_1', 'focus_area_2', 'goals_text', 'focused_goal_1', 'expected_outcome', 'values_list'], 'save-about-btn')
  );
});


/* GALLERIES */
async function loadGalleryList(sectionKey, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const { data, error } = await humsAdminClient
    .from('galleries')
    .select('*')
    .eq('section_key', sectionKey)
    .order('sort_order', { ascending: true });
  if (error) { container.innerHTML = `<p class="admin-empty">Could not load: ${esc(error.message)}</p>`; return; }
  if (!data || !data.length) { container.innerHTML = '<p class="admin-empty">No images yet.</p>'; return; }

  container.innerHTML = data.map(item => `
    <div class="admin-list-item" data-id="${item.id}">
      <div class="grow">
        <strong>${esc(item.image_url)}</strong>
        <span>${esc(item.description)}</span>
      </div>
      <div class="admin-list-actions">
        <button class="admin-btn admin-btn-ghost admin-btn-sm" onclick="editGalleryItem(${item.id}, '${sectionKey}', '${containerId}')">Edit</button>
        <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="deleteGalleryItem(${item.id}, '${sectionKey}', '${containerId}')">Delete</button>
      </div>
    </div>
  `).join('');
}

async function editGalleryItem(id, sectionKey, containerId) {
  const { data, error } = await humsAdminClient.from('galleries').select('*').eq('id', id).single();
  if (error || !data) { toast('Could not load item.', 'error'); return; }
  const newImage = prompt('Image filename:', data.image_url);
  if (newImage === null) return;
  const newDesc = prompt('Description:', data.description);
  if (newDesc === null) return;
  const { error: updateError } = await humsAdminClient.from('galleries').update({ image_url: newImage, description: newDesc }).eq('id', id);
  if (updateError) { toast('Update failed: ' + updateError.message, 'error'); return; }
  toast('Image updated.');
  loadGalleryList(sectionKey, containerId);
}

async function deleteGalleryItem(id, sectionKey, containerId) {
  if (!confirm('Delete this image from the gallery?')) return;
  const { error } = await humsAdminClient.from('galleries').delete().eq('id', id);
  if (error) { toast('Delete failed: ' + error.message, 'error'); return; }
  toast('Image removed.');
  loadGalleryList(sectionKey, containerId);
}

async function addGalleryItem(sectionKey, containerId) {
  const image = prompt('New image filename (e.g. daycare2.jpg):');
  if (!image) return;
  const desc = prompt('Description for this image:') || '';
  const { data: existing } = await humsAdminClient.from('galleries').select('sort_order').eq('section_key', sectionKey).order('sort_order', { ascending: false }).limit(1);
  const nextOrder = (existing && existing[0] ? existing[0].sort_order : 0) + 1;
  const { error } = await humsAdminClient.from('galleries').insert({ section_key: sectionKey, image_url: image, description: desc, sort_order: nextOrder });
  if (error) { toast('Add failed: ' + error.message, 'error'); return; }
  toast('Image added.');
  loadGalleryList(sectionKey, containerId);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('add-gallery-home-btn')?.addEventListener('click', () => addGalleryItem('homepage_wide', 'gallery-home-list'));
  document.getElementById('add-gallery-academics-btn')?.addEventListener('click', () => addGalleryItem(currentGalleryTab, 'gallery-academics-list'));

  document.querySelectorAll('[data-gallery-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentGalleryTab = btn.dataset.galleryTab;
      document.querySelectorAll('[data-gallery-tab]').forEach(b => b.classList.remove('admin-btn-primary'));
      btn.classList.add('admin-btn-primary');
      loadGalleryList(currentGalleryTab, 'gallery-academics-list');
    });
  });
});


/* TAB D: academic_metrics */
async function loadMetrics() {
  const { data, error } = await humsAdminClient.from('academic_metrics').select('*').order('sort_order', { ascending: true });
  if (error) { toast('Could not load metrics: ' + error.message, 'error'); return; }

  const studentsWrap = document.getElementById('metrics-students-list');
  const staffWrap = document.getElementById('metrics-staff-list');
  if (!data) return;

  const rowHtml = (m) => `
    <div class="admin-field" data-metric-id="${m.id}" style="display:flex; align-items:center; gap:1rem; margin-bottom:.75rem;">
      <label style="flex:1; margin-bottom:0;">${esc(m.category_name)}</label>
      <input type="number" min="0" value="${m.count_value}" style="max-width:140px;" data-metric-input="${m.id}" />
    </div>
  `;

  studentsWrap.innerHTML = data.filter(m => m.metric_group === 'students').map(rowHtml).join('') || '<p class="admin-empty">No student metrics yet.</p>';
  staffWrap.innerHTML = data.filter(m => m.metric_group === 'staff').map(rowHtml).join('') || '<p class="admin-empty">No staff metrics yet.</p>';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('save-metrics-btn')?.addEventListener('click', async () => {
    const inputs = document.querySelectorAll('[data-metric-input]');
    const btn = document.getElementById('save-metrics-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const updates = Array.from(inputs).map(input => {
      const id = parseInt(input.dataset.metricInput, 10);
      const count_value = parseInt(input.value, 10) || 0;
      return humsAdminClient.from('academic_metrics').update({ count_value }).eq('id', id);
    });

    const results = await Promise.all(updates);
    const failed = results.find(r => r.error);

    btn.disabled = false;
    btn.textContent = '💾 Save All Metrics';

    if (failed) {
      toast('Some metrics failed to save: ' + failed.error.message, 'error');
    } else {
      toast('All metrics saved.');
    }
  });
});


/*  PROGRAM LISTS  */
async function loadProgramLists() {
  const { data, error } = await humsAdminClient.from('program_lists').select('*').order('sort_order', { ascending: true });
  if (error) { toast('Could not load programs: ' + error.message, 'error'); return; }
  if (!data) return;

  const readOnlyHtml = (p) => `
    <div class="admin-list-item">
      <div class="grow">
        <strong>${esc(p.program_title)}</strong>
        <span>${esc(p.languages)} — ${esc(p.description)}</span>
      </div>
    </div>
  `;
  const aboutWrap = document.getElementById('program-list');
  if (aboutWrap) aboutWrap.innerHTML = data.map(readOnlyHtml).join('') || '<p class="admin-empty">No programs yet.</p>';

  const editableWrap = document.getElementById('program-list-academics');
  if (editableWrap) {
    editableWrap.innerHTML = data.map(p => `
      <div class="admin-card" style="background:var(--off-white); box-shadow:none; border:1px solid var(--gray-light); padding:1.25rem 1.5rem;" data-program-id="${p.id}">
        <div class="admin-row-2">
          <div class="admin-field">
            <label>Program Title</label>
            <input type="text" value="${esc(p.program_title)}" data-program-field="program_title" />
          </div>
          <div class="admin-field">
            <label>Languages</label>
            <input type="text" value="${esc(p.languages)}" data-program-field="languages" />
          </div>
        </div>
        <div class="admin-field">
          <label>Description</label>
          <textarea data-program-field="description">${esc(p.description)}</textarea>
        </div>
      </div>
    `).join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('save-programs-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('save-programs-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const cards = document.querySelectorAll('[data-program-id]');
    const updates = Array.from(cards).map(card => {
      const id = parseInt(card.dataset.programId, 10);
      const program_title = card.querySelector('[data-program-field="program_title"]').value;
      const languages = card.querySelector('[data-program-field="languages"]').value;
      const description = card.querySelector('[data-program-field="description"]').value;
      return humsAdminClient.from('program_lists').update({ program_title, languages, description }).eq('id', id);
    });

    const results = await Promise.all(updates);
    const failed = results.find(r => r.error);

    btn.disabled = false;
    btn.textContent = '💾 Save Program Details';

    if (failed) {
      toast('Some programs failed to save: ' + failed.error.message, 'error');
    } else {
      toast('Programs saved.');
      loadProgramLists();
    }
  });
});


/* TAB E1: NEWS — full CRUD */
async function loadNewsList() {
  const container = document.getElementById('news-list');
  if (!container) return;
  const { data, error } = await humsAdminClient.from('news').select('*').order('date', { ascending: false });
  if (error) { container.innerHTML = `<p class="admin-empty">Could not load: ${esc(error.message)}</p>`; return; }
  if (!data || !data.length) { container.innerHTML = '<p class="admin-empty">No news items yet.</p>'; return; }

  container.innerHTML = data.map(item => `
    <div class="admin-list-item">
      <div class="grow">
        <strong>${esc(item.title)}</strong>
        <span>${esc(item.date)} ${item.image_url ? '· 🖼️ ' + esc(item.image_url) : '· (text only)'}</span>
      </div>
      <div class="admin-list-actions">
        <button class="admin-btn admin-btn-ghost admin-btn-sm" onclick="editNewsItem(${item.id})">Edit</button>
        <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="deleteNewsItem(${item.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function resetNewsForm() {
  document.getElementById('news-edit-id').value = '';
  document.getElementById('news-date').value = '';
  document.getElementById('news-image').value = '';
  document.getElementById('news-title').value = '';
  document.getElementById('news-description').value = '';
  document.getElementById('news-form-title').textContent = '➕ Add News Item';
  document.getElementById('news-cancel-btn').style.display = 'none';
}

async function editNewsItem(id) {
  const { data, error } = await humsAdminClient.from('news').select('*').eq('id', id).single();
  if (error || !data) { toast('Could not load news item.', 'error'); return; }
  document.getElementById('news-edit-id').value = data.id;
  document.getElementById('news-date').value = data.date;
  document.getElementById('news-image').value = data.image_url || '';
  document.getElementById('news-title').value = data.title;
  document.getElementById('news-description').value = data.description;
  document.getElementById('news-form-title').textContent = '✏️ Edit News Item';
  document.getElementById('news-cancel-btn').style.display = 'inline-flex';
  document.getElementById('panel-news').scrollIntoView({ behavior: 'smooth' });
}

async function deleteNewsItem(id) {
  if (!confirm('Delete this news item permanently?')) return;
  const { error } = await humsAdminClient.from('news').delete().eq('id', id);
  if (error) { toast('Delete failed: ' + error.message, 'error'); return; }
  toast('News item deleted.');
  loadNewsList();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('news-save-btn')?.addEventListener('click', async () => {
    const id = document.getElementById('news-edit-id').value;
    const date = document.getElementById('news-date').value;
    const image_url = document.getElementById('news-image').value.trim();
    const title = document.getElementById('news-title').value.trim();
    const description = document.getElementById('news-description').value.trim();

    if (!date || !title) { toast('Date and Title are required.', 'error'); return; }

    const payload = { date, title, description, image_url };
    const btn = document.getElementById('news-save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const { error } = id
      ? await humsAdminClient.from('news').update(payload).eq('id', id)
      : await humsAdminClient.from('news').insert(payload);

    btn.disabled = false;
    btn.textContent = 'Save News Item';

    if (error) {
      toast('Save failed: ' + error.message, 'error');
    } else {
      toast(id ? 'News item updated.' : 'News item added.');
      resetNewsForm();
      loadNewsList();
    }
  });

  document.getElementById('news-cancel-btn')?.addEventListener('click', resetNewsForm);
});


/* TAB E2: STAFF — full CRUD */
async function loadStaffList() {
  const directWrap = document.getElementById('staff-list-directorates');
  const mgmtWrap = document.getElementById('staff-list-management');
  if (!directWrap || !mgmtWrap) return;

  const { data, error } = await humsAdminClient.from('staff').select('*').order('sort_order', { ascending: true });
  if (error) {
    directWrap.innerHTML = `<p class="admin-empty">Could not load: ${esc(error.message)}</p>`;
    return;
  }
  if (!data) return;

  const rowHtml = (person) => `
    <div class="admin-list-item">
      <img src="${esc(person.image_url)}" alt="${esc(person.name)}" onerror="this.style.visibility='hidden'" />
      <div class="grow">
        <strong>${esc(person.name)}</strong>
        <span>${esc(person.role)} · <span class="admin-tag admin-tag-${person.category === 'Directorates' ? 'directorates' : 'management'}">${esc(person.category)}</span></span>
      </div>
      <div class="admin-list-actions">
        <button class="admin-btn admin-btn-ghost admin-btn-sm" onclick="editStaffItem(${person.id})">Edit</button>
        <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="deleteStaffItem(${person.id})">Delete</button>
      </div>
    </div>
  `;

  const directorates = data.filter(p => p.category === 'Directorates');
  const management = data.filter(p => p.category === 'School Management');

  directWrap.innerHTML = directorates.map(rowHtml).join('') || '<p class="admin-empty">No directorate staff yet.</p>';
  mgmtWrap.innerHTML = management.map(rowHtml).join('') || '<p class="admin-empty">No management staff yet.</p>';
}

function resetStaffForm() {
  document.getElementById('staff-edit-id').value = '';
  document.getElementById('staff-name').value = '';
  document.getElementById('staff-role').value = '';
  document.getElementById('staff-category').value = 'Directorates';
  document.getElementById('staff-image').value = '';
  document.getElementById('staff-form-title').textContent = '➕ Add Staff Member';
  document.getElementById('staff-cancel-btn').style.display = 'none';
}

async function editStaffItem(id) {
  const { data, error } = await humsAdminClient.from('staff').select('*').eq('id', id).single();
  if (error || !data) { toast('Could not load staff member.', 'error'); return; }
  document.getElementById('staff-edit-id').value = data.id;
  document.getElementById('staff-name').value = data.name;
  document.getElementById('staff-role').value = data.role;
  document.getElementById('staff-category').value = data.category;
  document.getElementById('staff-image').value = data.image_url || '';
  document.getElementById('staff-form-title').textContent = '✏️ Edit Staff Member';
  document.getElementById('staff-cancel-btn').style.display = 'inline-flex';
  document.getElementById('panel-staff').scrollIntoView({ behavior: 'smooth' });
}

async function deleteStaffItem(id) {
  if (!confirm('Remove this staff member permanently?')) return;
  const { error } = await humsAdminClient.from('staff').delete().eq('id', id);
  if (error) { toast('Delete failed: ' + error.message, 'error'); return; }
  toast('Staff member removed.');
  loadStaffList();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('staff-save-btn')?.addEventListener('click', async () => {
    const id = document.getElementById('staff-edit-id').value;
    const name = document.getElementById('staff-name').value.trim();
    const role = document.getElementById('staff-role').value.trim();
    const category = document.getElementById('staff-category').value;
    const image_url = document.getElementById('staff-image').value.trim();

    if (!name) { toast('Name is required.', 'error'); return; }

    const payload = { name, role, category, image_url };
    const btn = document.getElementById('staff-save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const { error } = id
      ? await humsAdminClient.from('staff').update(payload).eq('id', id)
      : await humsAdminClient.from('staff').insert(payload);

    btn.disabled = false;
    btn.textContent = 'Save Staff Member';

    if (error) {
      toast('Save failed: ' + error.message, 'error');
    } else {
      toast(id ? 'Staff member updated.' : 'Staff member added.');
      resetStaffForm();
      loadStaffList();
    }
  });

  document.getElementById('staff-cancel-btn')?.addEventListener('click', resetStaffForm);
});