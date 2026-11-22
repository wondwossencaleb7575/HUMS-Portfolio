(() => {
  const SUPABASE_URL = 'https://coysymsgsgcmbadfbdvg.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_EkC3eUFQ1RgZiJ_FJQoZbg_YYC408ci';

  const supabase = (typeof window !== 'undefined' && window.supabase && SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL')
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  function dbReady() {
    if (!supabase) {
      console.warn('[HUMS] Supabase is not configured yet. Edit SUPABASE_URL / SUPABASE_ANON_KEY at the top of script.js.');
      return false;
    }
    return true;
  }

  /* ── Small helpers ──────────────────────────────────────────── */
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  async function fetchSiteContent() {
    if (!dbReady()) return {};
    const { data, error } = await supabase.from('site_content').select('key, value');
    if (error) { console.error('[HUMS] site_content fetch error:', error.message); return {}; }
    const map = {};
    (data || []).forEach(row => { map[row.key] = row.value; });
    return map;
  }
  function applyGlobalLogo(content) {
    // Keep it pointing to your jpg file
    const logo = content.site_logo || 'haramayalogo.jpg';
    document.querySelectorAll('.nav-logo-wrap img, .footer-logo').forEach(img => {
      img.src = logo;
    });
  }
  function applyGlobalFooterAndContact(content) {
    document.querySelectorAll('[data-field="footer_history"]').forEach(el => {
      el.textContent = content.footer_history || '';
    });
    const PHONE_OVERRIDE = '+251 913 8827 932';
    document.querySelectorAll('[data-field="contact_phone"]').forEach(el => {
      el.textContent = PHONE_OVERRIDE;
    });
    document.querySelectorAll('[data-field="contact_email"]').forEach(el => {
      el.textContent = content.contact_email || '';
    });
    document.querySelectorAll('[data-field="contact_address"]').forEach(el => {
      el.innerHTML = esc(content.contact_address || '').replace(/, /g, ',<br />');
    });
  }
  /* ---------- HOME PAGE ---------- */
  async function renderHomePage(content) {
    // Hero
    const heroHeadlineEl = document.querySelector('[data-field="hero_headline"]');
    if (heroHeadlineEl && content.hero_headline) {
      heroHeadlineEl.textContent = content.hero_headline;
    }
    const heroBgEl = document.querySelector('.hero-bg');
    if (heroBgEl && content.hero_bg_image) {
      heroBgEl.style.backgroundImage = `url('${content.hero_bg_image}')`;
    }
    // Quick stats — Student & Staff totals only 
    const quickStatsWrap = document.querySelector('[data-quickstats="home"]');
    if (quickStatsWrap && dbReady()) {
      const { data, error } = await supabase
        .from('academic_metrics')
        .select('count_value, metric_group');
      if (!error && data) {
        const studentTotal = data.filter(m => m.metric_group === 'students').reduce((sum, m) => sum + m.count_value, 0);
        const staffTotal = data.filter(m => m.metric_group === 'staff').reduce((sum, m) => sum + m.count_value, 0);
        quickStatsWrap.innerHTML = `
          <div class="quick-stat-card">
            <div class="quick-stat-number">${studentTotal.toLocaleString()}+</div>
            <div class="quick-stat-label">Total Students</div>
          </div>
          <div class="quick-stat-card">
            <div class="quick-stat-number">${staffTotal.toLocaleString()}+</div>
            <div class="quick-stat-label">Dedicated Staff</div>
          </div>
        `;
      }
    }
    // Director's Welcome
    const directorQuoteEl = document.querySelector('[data-field="director_welcome_text"]');
    if (directorQuoteEl) directorQuoteEl.textContent = content.director_welcome_text || '';
    const directorNameEl = document.querySelector('[data-field="director_name"]');
    if (directorNameEl) directorNameEl.textContent = content.director_name || '';
    const directorTitleEl = document.querySelector('[data-field="director_title"]');
    if (directorTitleEl) directorTitleEl.textContent = content.director_title || '';
    const directorPhotoEl = document.querySelector('[data-field="director_photo"]');
    if (directorPhotoEl && content.director_photo) {
      directorPhotoEl.src = content.director_photo;
      directorPhotoEl.alt = content.director_name || 'School Director';
    }
    // Wide homepage gallery
    const galleryWrap = document.querySelector('[data-gallery="homepage_wide"]');
    if (galleryWrap && dbReady()) {
      const { data, error } = await supabase
        .from('galleries')
        .select('*')
        .eq('section_key', 'homepage_wide')
        .order('sort_order', { ascending: true });
      if (!error && data) {
        galleryWrap.innerHTML = data.map(item => `
          <div class="gallery-card fade-in">
            <img src="${esc(item.image_url)}" alt="${esc(item.description)}" class="gallery-card-img" />
            <div class="gallery-card-body"><p>${esc(item.description)}</p></div>
          </div>
        `).join('');
        observeFadeIns();
      }
    }
    // Latest news 
    const newsWrap = document.querySelector('[data-news-grid="home"]');
    if (newsWrap && dbReady()) {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('date', { ascending: false })
        .limit(4);
      if (!error && data) {
        newsWrap.innerHTML = data.map(item => `
          <div class="news-card fade-in">
            <div class="news-card-img-wrap">
              <img src="${esc(item.image_url)}" alt="${esc(item.title)}" />
            </div>
            <div class="news-card-body">
              <div class="news-date">${esc(formatDate(item.date))}</div>
              <h3 class="news-card-title">${esc(item.title)}</h3>
              <p class="news-card-desc">${esc(item.description)}</p>
              <a href="news.html" class="news-card-tag">Read More →</a>
            </div>
          </div>
        `).join('');
        observeFadeIns();
      }
    }
  }
  /* ---------- ABOUT PAGE ---------- */
  async function renderAboutPage(content) {
    const map = {
      history_text: '[data-field="history_text"]',
      history_image: '[data-field="history_image"]',
      vision_text: '[data-field="vision_text"]',
      mission_text: '[data-field="mission_text"]',
      focus_area_1: '[data-field="focus_area_1"]',
      focus_area_2: '[data-field="focus_area_2"]',
      goals_text: '[data-field="goals_text"]',
      focused_goal_1: '[data-field="focused_goal_1"]',
      expected_outcome: '[data-field="expected_outcome"]',
    };
    Object.entries(map).forEach(([key, selector]) => {
      const el = document.querySelector(selector);
      if (!el) return;
      if (el.tagName === 'IMG') {
        if (content[key]) el.src = content[key];
      } else {
        el.textContent = content[key] || '';
      }
    });
    // Values list 
    const valuesWrap = document.querySelector('[data-field="values_list"]');
    if (valuesWrap && content.values_list) {
      const values = content.values_list.split(',').map(v => v.trim()).filter(Boolean);
      valuesWrap.innerHTML = values.map(v => {
        const isTransparency = v.toLowerCase() === 'transparency';
        const cls = isTransparency ? 'value-chip value-chip-emphasis' : 'value-chip';
        return `<div class="${cls}">${esc(v)}</div>`;
      }).join('');
    }
    // Program list grid 
    const programWrap = document.querySelector('[data-programs="about"]');
    if (programWrap && dbReady()) {
      const { data, error } = await supabase
        .from('program_lists')
        .select('*')
        .order('sort_order', { ascending: true });
      if (!error && data) {
        const icons = ['🧸', '📚', '🏫', '🎓'];
        programWrap.innerHTML = data.map((p, i) => `
          <div class="program-card">
            <h3>${icons[i % icons.length]} ${i + 1}. ${esc(p.program_title)}</h3>
            <p>${esc(p.description)}</p>
          </div>
        `).join('');
      }
    }
  }
  /* ---------- ACADEMICS PAGE ---------- */
  async function renderAcademicsPage() {
    if (!dbReady()) return;
    // Program cards (overview section)
    const programWrap = document.querySelector('[data-programs="academics"]');
    if (programWrap) {
      const { data, error } = await supabase
        .from('program_lists')
        .select('*')
        .order('sort_order', { ascending: true });
      if (!error && data) {
        const icons = ['🧸', '📚', '🏫', '🎓'];
        programWrap.innerHTML = data.map((p, i) => `
          <div class="program-card">
            <h3>${icons[i % icons.length]} ${esc(p.program_title)}</h3>
            <p>${p.languages && p.languages !== '—' ? `<strong>${esc(p.languages)}</strong> — ` : ''}${esc(p.description)}</p>
          </div>
        `).join('');
      }
    }
    // Galleries: KG, Daycare, Primary/Secondary
    const galleryTargets = [
      { selector: '[data-gallery="kg_gallery"]', key: 'kg_gallery' },
      { selector: '[data-gallery="daycare_gallery"]', key: 'daycare_gallery' },
      { selector: '[data-gallery="primary_secondary_gallery"]', key: 'primary_secondary_gallery' },
    ];
    for (const target of galleryTargets) {
      const wrap = document.querySelector(target.selector);
      if (!wrap) continue;
      const { data, error } = await supabase
        .from('galleries')
        .select('*')
        .eq('section_key', target.key)
        .order('sort_order', { ascending: true });
      if (!error && data) {
        const studentImgs = data.filter(item => !item.description.includes('Group Photo'));
        const groupImgs   = data.filter(item =>  item.description.includes('Group Photo'));
        const studentHtml = studentImgs
          .map(item => `<img src="${esc(item.image_url)}" alt="${esc(item.description)}" />`)
          .join('');
        const groupHtml = groupImgs.length ? groupImgs.map(item => `
          <div class="gallery-group-photo-row">
            <p class="section-photo-label">${esc(item.description)}</p>
            <img src="${esc(item.image_url)}" alt="${esc(item.description)}" class="gallery-group-photo" />
          </div>`).join('') : '';
        wrap.innerHTML = studentHtml + groupHtml;
      }
    }
    // Animated counters — students & staff
    const counterTargets = [
      { selector: '[data-counters="students"]', group: 'students' },
      { selector: '[data-counters="staff"]', group: 'staff' },
    ];
    for (const target of counterTargets) {
      const wrap = document.querySelector(target.selector);
      if (!wrap) continue;
      const { data, error } = await supabase
        .from('academic_metrics')
        .select('*')
        .eq('metric_group', target.group)
        .order('sort_order', { ascending: true });
      if (!error && data) {
        wrap.innerHTML = data.map(m => `
          <div class="counter-card fade-in">
            <div class="counter-number" data-target="${m.count_value}">0</div>
            <div class="counter-label">${esc(m.category_name)}</div>
          </div>
        `).join('');
      }
    }
    observeFadeIns();
    initCounterObserver();
  }
  /* ---------- STAFF PAGE ---------- */
  async function renderStaffPage() {
    if (!dbReady()) return;
    const directWrap    = document.querySelector('[data-staff="Directorates"]');
    const unitWrap      = document.querySelector('[data-staff="Unit Leaders"]');
    const deptWrap      = document.querySelector('[data-staff="Department Heads"]');
    if (!directWrap && !unitWrap && !deptWrap) return;
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error || !data) { console.error('[HUMS] staff fetch error:', error?.message); return; }
    const EXCLUDED_NAMES = ['Yared', 'Tamru'];
    const IMAGE_OVERRIDES = {
      'Bikile':  'bikile.jpg',
      'Bontu':   'bontu.jpg',
      'Sichale': 'sichale.jpg',
    };
    const buildCard = (person) => {
      let imgSrc = esc(person.image_url);
      for (const [firstName, overrideImg] of Object.entries(IMAGE_OVERRIDES)) {
        if (person.name.startsWith(firstName)) {
          imgSrc = overrideImg;
          break;
        }
      }
      return `
        <div class="staff-card">
          <img src="${imgSrc}" alt="${esc(person.name)}" class="staff-avatar" />
          <div class="staff-name">${esc(person.name)}</div>
          <div class="staff-role">${esc(person.role)}</div>
        </div>
      `;
    };
    const visible = data.filter(p => !EXCLUDED_NAMES.some(ex => p.name.startsWith(ex)));
    const directorates  = visible.filter(p => p.category === 'Directorates');
    const unitLeaders   = visible.filter(p => p.category === 'School Management' && p.role === 'Unit Leader');
    const deptHeads     = visible.filter(p => p.category === 'School Management' && p.role !== 'Unit Leader');
    if (directWrap) directWrap.innerHTML = directorates.map(buildCard).join('');
    if (unitWrap)   unitWrap.innerHTML   = unitLeaders.map(buildCard).join('');
    if (deptWrap)   deptWrap.innerHTML   = deptHeads.map(buildCard).join('');
    observeFadeIns();
  }
  /* ---------- NEWS PAGE ---------- */
  async function renderNewsPage() {
    const feedWrap = document.querySelector('[data-news-feed]');
    if (!feedWrap || !dbReady()) return;
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .order('date', { ascending: false });
    if (error || !data) { console.error('[HUMS] news fetch error:', error?.message); return; }
    feedWrap.innerHTML = data.map(item => {
      if (!item.image_url) {
        return `
          <div class="news-text-only fade-in">
            <div class="news-date">${esc(formatDate(item.date))}</div>
            <h2>${esc(item.title)}</h2>
            <p style="color:var(--text-light);margin-top:.75rem;font-size:.92rem;line-height:1.75;">${esc(item.description)}</p>
          </div>
        `;
      }
      return `
        <div class="news-feed-card fade-in">
          <img src="${esc(item.image_url)}" alt="${esc(item.title)}" class="news-feed-img" />
          <div class="news-feed-body">
            <div class="news-date">${esc(formatDate(item.date))}</div>
            <h2>${esc(item.title)}</h2>
            <p>${esc(item.description)}</p>
          </div>
        </div>
      `;
    }).join('');
    observeFadeIns();
  }
  /* ---------- CONTACT PAGE ---------- */
  function renderContactPage(content) {
    void content;
  }
  let fadeObserverInstance = null;
  function observeFadeIns() {
    const fadeEls = document.querySelectorAll('.fade-in:not(.visible)');
    if (!fadeEls.length) return;
    if (!fadeObserverInstance) {
      fadeObserverInstance = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            fadeObserverInstance.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
    }
    fadeEls.forEach(el => fadeObserverInstance.observe(el));
  }
  let counterObserverInstance = null;
  function initCounterObserver() {
    const counterEls = document.querySelectorAll('.counter-number[data-target]');
    if (!counterEls.length) return;
    const animateCounter = (el) => {
      const target = parseInt(el.getAttribute('data-target'), 10);
      const duration = 1800;
      const step = Math.ceil(target / (duration / 16)) || 1;
      let current = 0;
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current.toLocaleString();
        if (current >= target) clearInterval(timer);
      }, 16);
    };
    if (counterObserverInstance) counterObserverInstance.disconnect();
    counterObserverInstance = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserverInstance.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    counterEls.forEach(el => counterObserverInstance.observe(el));
  }
  function showAlert(message, type = 'success') {
    const existing = document.querySelector('.hums-alert');
    if (existing) existing.remove();
    const alert = document.createElement('div');
    alert.className = 'hums-alert';
    alert.innerHTML = `
      <div class="hums-alert-inner hums-alert-${type}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span>${esc(message)}</span>
        <button onclick="this.parentElement.parentElement.remove()">✕</button>
      </div>
    `;
    Object.assign(alert.style, {
      position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: '9999',
      maxWidth: '420px', animation: 'alertSlideIn .35s ease'
    });
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 6000);
  }
  document.addEventListener('DOMContentLoaded', async () => {
    const hamburger = document.querySelector('.hamburger');
    const navLinks  = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        navLinks.classList.toggle('open');
      });
      navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          hamburger.classList.remove('open');
          navLinks.classList.remove('open');
        });
      });
    }
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === currentPage || (currentPage === '' && href === 'index.html')) {
        a.classList.add('active');
      }
    });
    const yearEl = document.getElementById('copyright-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    /* ── Hero Parallax (subtle) ────────────────────────────── */
    const heroBg = document.querySelector('.hero-bg');
    if (heroBg) {
      window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        heroBg.style.transform = `scale(1.04) translateY(${scrolled * 0.12}px)`;
      }, { passive: true });
    }
    /* ── Contact Form ──────────────────────────────────────── */
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
      contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = contactForm.querySelector('#name')?.value || 'there';
        showAlert(`Thank you, ${name}! Your message has been received. We will get back to you shortly.`, 'success');
        contactForm.reset();
      });
    }
    if (!document.getElementById('hums-alert-styles')) {
      const style = document.createElement('style');
      style.id = 'hums-alert-styles';
      style.textContent = `
        @keyframes alertSlideIn { from { opacity:0; transform: translateX(30px); } to { opacity:1; transform: translateX(0); } }
        .hums-alert-inner { display:flex; align-items:center; gap:.85rem; padding:1rem 1.25rem; border-radius:10px; box-shadow:0 8px 32px rgba(0,0,0,.18); font-family:'Inter',sans-serif; font-size:.9rem; }
        .hums-alert-success { background:#0b3c6d; color:#fff; }
        .hums-alert-error { background:#7a1f1f; color:#fff; }
        .hums-alert-inner svg { width:20px; height:20px; flex-shrink:0; color:#ffd700; }
        .hums-alert-inner button { background:none; border:none; color:rgba(255,255,255,.6); cursor:pointer; font-size:1rem; margin-left:auto; line-height:1; padding:0; }
        .fade-in { opacity:0; transform:translateY(24px); transition:opacity .6s ease, transform .6s ease; }
        .fade-in.visible { opacity:1; transform:translateY(0); }
      `;
      document.head.appendChild(style);
    }
    if (!dbReady()) {
      const notice = document.createElement('div');
      notice.style.cssText = 'background:#fff3cd;color:#7a5200;padding:.85rem 1.25rem;text-align:center;font-family:Inter,sans-serif;font-size:.85rem;';
      notice.textContent = 'This site is not yet connected to its database. Edit SUPABASE_URL and SUPABASE_ANON_KEY at the top of script.js to go live.';
      document.body.insertBefore(notice, document.body.firstChild);
    }
    const content = await fetchSiteContent();
    applyGlobalLogo(content);
    applyGlobalFooterAndContact(content);
    await renderHomePage(content);
    await renderAboutPage(content);
    await renderAcademicsPage();
    await renderStaffPage();
    await renderNewsPage();
    renderContactPage(content);
    observeFadeIns();
    initCounterObserver();
  });
})();