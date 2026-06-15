/**
 * NWARE — script.js
 * Funcionalidades: tema, navegación, scroll, auth, formulario, seguimiento, galería
 */

/* ============================================================
   1. TEMA (MODO OSCURO / CLARO)
   ============================================================ */

const ThemeManager = (() => {
  const STORAGE_KEY = 'nware-theme';
  const body        = document.body;
  const toggleBtn   = document.getElementById('theme-toggle');

  /** Aplica el tema indicado al body */
  function applyTheme(theme) {
    body.classList.remove('dark-mode', 'light-mode');
    body.classList.add(theme === 'light' ? 'light-mode' : 'dark-mode');
    toggleBtn?.setAttribute('aria-label', theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  }

  /** Determina el tema inicial: localStorage → preferencia del sistema */
  function getInitialTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function init() {
    applyTheme(getInitialTheme());

    toggleBtn?.addEventListener('click', () => {
      const isDark = body.classList.contains('dark-mode');
      const next   = isDark ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next);
    });

    // Escucha cambios del sistema operativo
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(e.matches ? 'light' : 'dark');
      }
    });
  }

  return { init };
})();


/* ============================================================
   2. NAVEGACIÓN
   ============================================================ */

const NavManager = (() => {
  const header       = document.getElementById('nav-header');
  const hamburger    = document.getElementById('nav-hamburger');
  const mobileMenu   = document.getElementById('nav-mobile-menu');
  const mobileLinks  = document.querySelectorAll('.nav-mobile-link');

  let isMenuOpen = false;

  /** Agrega clase 'scrolled' a la navbar cuando hay scroll */
  function handleScroll() {
    if (window.scrollY > 20) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  }

  /** Abre o cierra el menú mobile */
  function toggleMenu(forceClose = false) {
    isMenuOpen = forceClose ? false : !isMenuOpen;

    hamburger?.setAttribute('aria-expanded', String(isMenuOpen));
    mobileMenu?.classList.toggle('open', isMenuOpen);
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
  }

  /** Cierra el menú al hacer clic en un enlace */
  function bindMobileLinks() {
    mobileLinks.forEach((link) => {
      link.addEventListener('click', () => toggleMenu(true));
    });
  }

  /** Cierra el menú al presionar Escape */
  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isMenuOpen) toggleMenu(true);
    });
  }

  function init() {
    handleScroll(); // Estado inicial
    window.addEventListener('scroll', handleScroll, { passive: true });
    hamburger?.addEventListener('click', () => toggleMenu());
    bindMobileLinks();
    bindKeyboard();
  }

  return { init };
})();


/* ============================================================
   3. ANIMACIONES AL HACER SCROLL (INTERSECTION OBSERVER)
   ============================================================ */

const ScrollReveal = (() => {
  const elements = document.querySelectorAll('.reveal');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Una vez visible, no necesitamos observarlo más
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -48px 0px',
    }
  );

  function init() {
    // Respetamos la preferencia de movimiento reducido
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((el) => el.classList.add('visible'));
      return;
    }

    elements.forEach((el) => observer.observe(el));
  }

  return { init };
})();


/* ============================================================
   4. SUPABASE — CLIENTE
   ============================================================ */

const SUPABASE_URL = 'https://xdjsfechpvquevkdcpmg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkanNmZWNocHZxdWV2a2RjcG1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzODY1NjUsImV4cCI6MjA5Njk2MjU2NX0.PO_rx6WuvSrSbRmET5K3Wj5rGioISo4ptucchFiVGUs';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============================================================
   5. AUTENTICACIÓN — GOOGLE OAUTH
   ============================================================ */

const AuthManager = (() => {
  let currentUser = null;

  function handleOAuthReturn() {
    if (sessionStorage.getItem('nware-oauth-return')) {
      sessionStorage.removeItem('nware-oauth-return');
      RepairForm.openModal();
      return true;
    }
    if (sessionStorage.getItem('nware-oauth-testimonial')) {
      sessionStorage.removeItem('nware-oauth-testimonial');
      setTimeout(() => {
        document.getElementById('opiniones')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
      return true;
    }
    return false;
  }

  async function initAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      await setUser(session.user);
      if (handleOAuthReturn()) return;
    }

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await setUser(session.user);
        RepairForm.onUserReady();
        Testimonials.onUserReady();
        handleOAuthReturn();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        RepairForm.onUserReady();
        Testimonials.onUserReady();
      }
    });
  }

  async function setUser(user) {
    try {
      const { error } = await supabaseClient.from('users').upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      });
      if (error) console.warn('Users table not available (RLS), continuing with Auth session:', error.message);
    } catch (e) {
      console.warn('Users table unavailable:', e.message);
    }
    currentUser = user;
  }

  async function signInWithGoogle() {
    sessionStorage.setItem('nware-oauth-return', 'true');
    const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google' });
    if (error) {
      sessionStorage.removeItem('nware-oauth-return');
      console.error('Error sign in:', error);
    }
  }

  async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) console.error('Error sign out:', error);
  }

  function getUser() { return currentUser; }

  return { initAuth, signInWithGoogle, signOut, getUser };
})();

/* ============================================================
   6. FORMULARIO DE REPARACIÓN (MODAL)
   ============================================================ */

const RepairForm = (() => {
  const modal         = document.getElementById('modal-repair');
  const openBtn       = document.getElementById('btn-solicitar-reparacion');
  const closeBtn      = document.getElementById('modal-close');
  const googleSection = document.getElementById('google-auth-section');
  const userInfo      = document.getElementById('user-info');
  const userName      = document.getElementById('user-name');
  const userEmail     = document.getElementById('user-email');
  const userAvatar    = document.getElementById('user-avatar');
  const googleBtn     = document.getElementById('btn-google-login');
  const logoutBtn     = document.getElementById('btn-logout');
  const form          = document.getElementById('ticketForm');
  const resultBox     = document.getElementById('result');
  const resultCode    = document.getElementById('result-code-text');
  const resultClose   = document.getElementById('result-close');

  function onUserReady() {
    const user = AuthManager.getUser();
    if (user) {
      googleSection.hidden = true;
      userInfo.hidden = false;
      userName.textContent = user.user_metadata?.full_name || user.user_metadata?.name || 'Usuario';
      userEmail.textContent = user.email || '';
      userAvatar.src = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
      form.hidden = false;
      document.getElementById('customerName').value = userName.textContent;
      document.getElementById('contact').value = user.email || '';
      document.getElementById('userId').value = user.id;
    } else {
      googleSection.hidden = false;
      userInfo.hidden = true;
      form.hidden = true;
    }
  }

  function openModal() {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    resultBox.hidden = true;
    onUserReady();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  /* Submit form */
  async function handleSubmit(e) {
    e.preventDefault();

    const code = 'NW-' + String(Math.floor(Math.random() * 100000)).padStart(5, '0');

    const { error: insertError, data: inserted } = await supabaseClient
      .from('repairs')
      .insert([
        {
          code,
          user_id: document.getElementById('userId').value,
          customer_name: document.getElementById('customerName').value.trim(),
          contact: document.getElementById('contact').value.trim(),
          device_type: document.getElementById('deviceType').value,
          issue_description: document.getElementById('issue').value.trim(),
          status: 'recibido',
          notes: '',
        }
      ])
      .select()
      .single();

    if (insertError) {
      resultBox.querySelector('.result-title').textContent = 'Error al registrar';
      resultCode.textContent = '';
      resultBox.querySelector('.result-hint').textContent = 'Ocurrió un error. Intentá de nuevo más tarde.';
      resultBox.querySelector('.result-icon svg path').setAttribute('d', 'M18 6L6 18M6 6l12 12');
    } else {
      resultBox.querySelector('.result-title').textContent = '¡Solicitud registrada!';
      resultCode.textContent = code;
      resultBox.querySelector('.result-hint').textContent = 'Guardá este código para hacer el seguimiento de tu reparación.';
      resultBox.querySelector('.result-icon svg path').setAttribute('d', 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01 9 11.01');

      const user = AuthManager.getUser();
      if (user?.email && inserted) {
        fetch('https://emailworker.hero21kta.workers.dev/api/send-repair-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail: user.email, repair: inserted }),
        }).then(res => {
          if (!res.ok) console.error('Email worker returned', res.status);
        }).catch(err => console.error('Error sending email:', err));
      }
    }

    form.hidden = true;
    resultBox.hidden = false;
  }

  function init() {
    openBtn?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    resultClose?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });
    googleBtn?.addEventListener('click', AuthManager.signInWithGoogle);
    logoutBtn?.addEventListener('click', AuthManager.signOut);
    form?.addEventListener('submit', handleSubmit);
  }

  return { init, onUserReady, openModal };
})();

/* ============================================================
   7. SEGUIMIENTO DE REPARACIONES
   ============================================================ */

const RepairTracker = (() => {

  /* Pasos del timeline de reparación */
  const TIMELINE_STEPS = [
    { id: 'recibido',     label: 'Recibido' },
    { id: 'diagnostico',  label: 'Diagnóstico' },
    { id: 'reparacion',   label: 'Reparación' },
    { id: 'verificacion', label: 'Verificación' },
    { id: 'completado',   label: 'Listo' },
  ];

  /* Orden de los estados para el timeline */
  const STATUS_ORDER = {
    recibido:     0,
    diagnostico:  1,
    reparacion:   2,
    verificacion: 3,
    espera:       2,
    completado:   4,
  };

  const STATUS_LABELS = {
    recibido:     'Recibido',
    diagnostico:  'En diagnóstico',
    reparacion:   'En reparación',
    verificacion: 'En verificación',
    espera:       'Esperando componentes',
    completado:   'Listo para retirar',
  };

  /* Referencias al DOM */
  const input      = document.getElementById('repair-code');
  const btn        = document.getElementById('tracker-btn');
  const resultWrap = document.getElementById('tracker-result');
  const loading    = document.getElementById('tracker-loading');
  const card       = document.getElementById('tracker-card');
  const errorBox   = document.getElementById('tracker-error');

  /* --- Utilidades del DOM --- */
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function showOnly(...elements) {
    [loading, card, errorBox].forEach((el) => {
      if (el) el.hidden = !elements.includes(el);
    });
  }

  /** Renderiza el timeline de estados */
  function renderTimeline(estado) {
    const timeline = document.getElementById('result-timeline');
    if (!timeline) return;

    const currentStep = STATUS_ORDER[estado] ?? 0;
    timeline.innerHTML = '';

    TIMELINE_STEPS.forEach((step, i) => {
      const stepEl = document.createElement('div');
      stepEl.className = 'tracker-timeline-step';

      if (i < currentStep)  stepEl.classList.add('completed');
      if (i === currentStep) stepEl.classList.add('active');

      stepEl.innerHTML = `
        <div class="tracker-timeline-dot" aria-hidden="true"></div>
        <span class="tracker-timeline-label">${step.label}</span>
      `;
      timeline.appendChild(stepEl);
    });
  }

  /** Aplica clase de color según el estado */
  function applyStatusStyles(estado, badge) {
    const statuses = ['recibido', 'diagnostico', 'reparacion', 'verificacion', 'completado', 'espera'];
    badge?.classList.remove(...statuses.map(s => 'status--' + s));
    if (estado && statuses.includes(estado)) {
      badge?.classList.add('status--' + estado);
    }
  }

  /** Muestra los datos de la reparación en el DOM */
  function renderResult(data) {
    setText('result-code',        data.codigo);
    setText('result-status-text', data.estadoLabel);
    setText('result-device',      data.dispositivo);
    setText('result-date',        data.ingreso);
    setText('result-tech',        data.tecnico);
    setText('result-notes', data.notes);

    const badge = document.getElementById('result-status-badge');
    applyStatusStyles(data.estado, badge);

    const statuses = ['recibido', 'diagnostico', 'reparacion', 'verificacion', 'completado', 'espera'];
    card?.classList.remove(...statuses.map(s => 'status--' + s));
    if (data.estado && statuses.includes(data.estado)) {
      card?.classList.add('status--' + data.estado);
    }

    renderTimeline(data.estado);

    showOnly(card);
  }

  async function fetchRepairStatus(code) {
    const { data, error } = await supabaseClient
      .from('repairs')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .maybeSingle();

    if (error || !data) return null;

    const status = data.status || 'recibido';

    return {
      codigo:      data.code,
      dispositivo: data.device_type,
      ingreso:     new Date(data.created_at).toLocaleDateString('es-AR'),
      tecnico:     'Equipo Nware',
      estado:      status,
      estadoLabel: STATUS_LABELS[status] || status,
      notes: data.notes || 'Sin novedades por el momento.',
    };
  }

  /** Manejador principal de consulta */
  async function handleQuery() {
    const code = input?.value?.trim();

    if (!code) {
      input?.focus();
      input?.classList.add('tracker-input--error');
      setTimeout(() => input?.classList.remove('tracker-input--error'), 600);
      return;
    }

    // Muestra el wrapper de resultados y el loader
    if (resultWrap) resultWrap.hidden = false;
    showOnly(loading);
    btn && (btn.disabled = true);

    try {
      const data = await fetchRepairStatus(code);
      if (data) {
        renderResult(data);
      } else {
        showOnly(errorBox);
      }
    } catch {
      showOnly(errorBox);
    } finally {
      btn && (btn.disabled = false);
    }
  }

  /** Formatea el input mientras se escribe (convierte a mayúsculas) */
  function handleInputFormat(e) {
    const start = e.target.selectionStart;
    const end   = e.target.selectionEnd;
    e.target.value = e.target.value.toUpperCase();
    e.target.setSelectionRange(start, end);
  }

  function init() {
    btn?.addEventListener('click', handleQuery);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleQuery();
    });
    input?.addEventListener('input', handleInputFormat);
  }

  return { init };
})();


/* ============================================================
   8. OPINIONES DE CLIENTES (TESTIMONIALS)
   ============================================================ */

const Testimonials = (() => {
  const list       = document.getElementById('testimonials-list');
  const prompt     = document.getElementById('testimonial-login-prompt');
  const form       = document.getElementById('testimonial-form');
  const formUser   = document.getElementById('testimonial-form-user');
  const userName   = document.getElementById('testimonial-user-name');
  const userAvatar = document.getElementById('testimonial-user-avatar');
  const textarea   = document.getElementById('testimonial-message');
  const charCount  = document.getElementById('testimonial-char-count');
  const loginBtn   = document.getElementById('btn-testimonial-login');
  const imageInput = document.getElementById('testimonial-image');
  const imagePreview = document.getElementById('testimonial-image-preview');
  const imagePreviewImg = document.getElementById('testimonial-image-preview-img');
  const imageRemoveBtn = document.getElementById('testimonial-image-remove');

  async function loadTestimonials() {
    console.log('Cargando testimonios...');
    const { data, error } = await supabaseClient
      .from('testimonials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading testimonials:', error);
      list.innerHTML = '<div class="testimonials-empty"><p class="testimonials-empty-text">Error al cargar: ' + error.message + '</p></div>';
      return;
    }

    console.log('Testimonios obtenidos:', data);
    const items = data || [];

    const userIds = [...new Set(items.map(t => t.user_id).filter(Boolean))];
    let userMap = {};
    if (userIds.length > 0) {
      const { data: users, error: userErr } = await supabaseClient
        .from('users')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      if (userErr) console.warn('Could not load user profiles (RLS), using fallback:', userErr.message);
      (users || []).forEach(u => { userMap[u.id] = u; });
    }

    const enriched = items.map(t => ({ ...t, user: userMap[t.user_id] || null }));
    renderList(enriched);
  }

  function renderList(items) {
    if (items.length === 0) {
      list.innerHTML = '<div class="testimonials-empty"><p class="testimonials-empty-text">Aún no hay opiniones. Sé el primero en dejar una.</p></div>';
      return;
    }
    const currentUser = AuthManager.getUser();
    list.innerHTML = items.map(t => {
      let userName = t.user?.full_name || null;
      let userAvatar = t.user?.avatar_url || null;
      if (!userName && currentUser?.id === t.user_id) {
        userName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || null;
        userAvatar = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || null;
      }
      if (!userName) userName = 'Cliente';

      let imageHtml = '';
      if (t.image_url) {
        const { data: { publicUrl } } = supabaseClient.storage.from('testimonials-images').getPublicUrl(t.image_url);
        imageHtml = `<img class="testimonial-card-image" src="${esc(publicUrl)}" alt="Foto del testimonio" loading="lazy" />`;
      }

      return `
        <article class="testimonial-card">
          ${imageHtml}
          <div class="testimonial-author">
            ${userAvatar
              ? `<img class="testimonial-avatar" src="${esc(userAvatar)}" alt="" />`
              : `<div class="testimonial-avatar-fallback">${(userName || '?')[0]}</div>`
            }
            <div>
              <span class="testimonial-name">${esc(userName || 'Usuario')}</span>
              <span class="testimonial-date">${formatDate2(t.created_at)}</span>
            </div>
          </div>
          <p class="testimonial-text">${esc(t.message)}</p>
        </article>
      `;
    }).join('');
  }

  function resetImageUpload() {
    imageInput.value = '';
    imagePreview.hidden = true;
    imagePreviewImg.src = '';
  }

  function handleImageSelect() {
    const file = imageInput.files[0];
    if (!file) { resetImageUpload(); return; }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Solo se permiten imágenes JPG, PNG o WEBP.');
      imageInput.value = '';
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('La imagen no debe superar los 10 MB.');
      imageInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreviewImg.src = e.target.result;
      imagePreview.hidden = false;
    };
    reader.readAsDataURL(file);
  }

  function onUserReady() {
    const user = AuthManager.getUser();
    if (user) {
      prompt.hidden = true;
      form.hidden = false;
      userName.textContent = user.user_metadata?.full_name || user.user_metadata?.name || 'Usuario';
      userAvatar.src = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
    } else {
      prompt.hidden = false;
      form.hidden = true;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const msg = textarea.value.trim();
    if (!msg) return;
    const user = AuthManager.getUser();
    if (!user) { onUserReady(); return; }

    let image_url = null;
    const file = imageInput.files[0];
    if (file) {
      const ext = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabaseClient.storage
        .from('testimonials-images')
        .upload(fileName, file);
      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        return;
      }
      image_url = fileName;
    }

    const { error } = await supabaseClient.from('testimonials').insert([
      { user_id: user.id, message: msg, image_url }
    ]);

    if (error) {
      console.error('Error posting testimonial:', error);
      return;
    }

    textarea.value = '';
    charCount.textContent = '0/500';
    resetImageUpload();
    await loadTestimonials();

    document.getElementById('opiniones')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleLoginClick() {
    sessionStorage.setItem('nware-oauth-testimonial', 'true');
    AuthManager.signInWithGoogle();
  }

  function handleTextareaFocus() {
    if (!AuthManager.getUser()) {
      handleLoginClick();
    }
  }

  function init() {
    loadTestimonials();
    onUserReady();
    form?.addEventListener('submit', handleSubmit);
    loginBtn?.addEventListener('click', handleLoginClick);
    textarea?.addEventListener('focus', handleTextareaFocus);
    textarea?.addEventListener('input', () => {
      charCount.textContent = textarea.value.length + '/500';
    });
    imageInput?.addEventListener('change', handleImageSelect);
    imageRemoveBtn?.addEventListener('click', resetImageUpload);
  }

  return { init, onUserReady, loadTestimonials };
})();

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function formatDate2(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ============================================================
   9. GALERÍA — FILTROS
   ============================================================ */

const GalleryFilter = (() => {
  const filterBtns = document.querySelectorAll('.gallery-filter');
  const items      = document.querySelectorAll('.gallery-item');

  function filter(category) {
    items.forEach((item) => {
      const match = category === 'all' || item.dataset.category === category;
      item.classList.toggle('hidden', !match);

      // Pequeña animación al filtrar
      if (match) {
        item.style.animation = 'none';
        requestAnimationFrame(() => {
          item.style.animation = 'fadeInUp 0.4s ease';
        });
      }
    });
  }

  function init() {
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        // Actualiza estado activo
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        filter(btn.dataset.filter || 'all');
      });
    });
  }

  return { init };
})();


/* ============================================================
   10. SCROLL SUAVE PARA ANCHORS
   ============================================================ */

function initSmoothScroll() {
  // El CSS ya maneja scroll-behavior: smooth en html.
  // Aquí corregimos el offset por la navbar fija para navegadores
  // que no soporten scroll-padding-top.
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (!targetId || targetId === '#') return;

      const target = document.querySelector(targetId);
      if (!target) return;

      // Verificar que el navegador soporte scroll-padding-top
      if (CSS.supports('scroll-padding-top', '0px')) return;

      // Fallback manual
      e.preventDefault();
      const navHeight = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--nav-height'),
        10
      ) || 68;

      const top = target.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}


/* ============================================================
   11. BOTÓN "VOLVER ARRIBA" IMPLÍCITO EN EL LOGO
   Ya funciona por href="#inicio" en el logo del footer/nav.
   No requiere código adicional gracias a scroll-behavior CSS.
   ============================================================ */


/* ============================================================
   12. INICIALIZACIÓN
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  ThemeManager.init();
  NavManager.init();
  ScrollReveal.init();
  await AuthManager.initAuth();
  RepairForm.init();
  RepairTracker.init();
  Testimonials.init();
  GalleryFilter.init();
  initSmoothScroll();

  // Log de versión (útil para debugging en producción)
  console.log('%cNware v1.0 🔧', 'color: #5FE3F0; font-weight: bold; font-size: 14px;');
});
