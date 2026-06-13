/**
 * NWARE — script.js
 * Funcionalidades: tema, navegación, scroll, seguimiento, galería
 * Sin dependencias externas.
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
   4. SEGUIMIENTO DE REPARACIONES
   ============================================================
   TODO: Para conectar a Supabase o Firebase, reemplazar la función
   `fetchRepairStatus(code)` con una llamada real a tu base de datos.
   Ejemplo con Supabase:
   
   async function fetchRepairStatus(code) {
     const { data, error } = await supabase
       .from('reparaciones')
       .select('*')
       .eq('codigo', code)
       .single();
     if (error || !data) return null;
     return data;
   }
   ============================================================ */

const RepairTracker = (() => {

  /* --- Datos de ejemplo (demo) --- */
  const DEMO_DATA = {
    'NW-2026-001': {
      codigo:      'NW-2026-001',
      dispositivo: 'Notebook HP Pavilion 15',
      ingreso:     '13/06/2026',
      tecnico:     'Equipo Nware',
      estado:      'diagnostico',
      estadoLabel: 'En diagnóstico',
      observacion: 'Se detectó una falla en la unidad de almacenamiento (HDD con sectores defectuosos). Se está realizando verificación adicional con herramientas de análisis para determinar si es posible la recuperación de datos antes de proceder con el reemplazo.',
    },
    'NW-2026-002': {
      codigo:      'NW-2026-002',
      dispositivo: 'iPhone 13 – Pantalla rota',
      ingreso:     '12/06/2026',
      tecnico:     'Equipo Nware',
      estado:      'completado',
      estadoLabel: 'Listo para retirar',
      observacion: 'Se realizó el cambio de display OLED y batería. El equipo fue verificado completamente: táctil, Face ID y cámara funcionan correctamente. Incluye 30 días de garantía.',
    },
    'NW-2026-003': {
      codigo:      'NW-2026-003',
      dispositivo: 'PC de escritorio – Armado nuevo',
      ingreso:     '11/06/2026',
      tecnico:     'Equipo Nware',
      estado:      'espera',
      estadoLabel: 'Esperando componentes',
      observacion: 'Se está aguardando la llegada del procesador (Ryzen 5 7600X) y la placa base. El resto de los componentes ya están verificados y listos para el armado. ETA: 2 días hábiles.',
    },
  };

  /* Pasos del timeline de reparación */
  const TIMELINE_STEPS = [
    { id: 'recibido',    label: 'Recibido' },
    { id: 'diagnostico', label: 'Diagnóstico' },
    { id: 'reparacion',  label: 'Reparación' },
    { id: 'verificacion', label: 'Verificación' },
    { id: 'completado',  label: 'Listo' },
  ];

  /* Orden de los estados para el timeline */
  const STATUS_ORDER = {
    recibido:     0,
    diagnostico:  1,
    reparacion:   2,
    verificacion: 3,
    espera:       2, // Espera de componentes se muestra en "reparación"
    completado:   4,
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

  /** Aplica clases de color según el estado */
  function applyStatusStyles(estado, badge) {
    badge?.classList.remove('status--completado', 'status--espera');
    if (estado === 'completado') badge?.classList.add('status--completado');
    if (estado === 'espera')     badge?.classList.add('status--espera');
  }

  /** Muestra los datos de la reparación en el DOM */
  function renderResult(data) {
    setText('result-code',        data.codigo);
    setText('result-status-text', data.estadoLabel);
    setText('result-device',      data.dispositivo);
    setText('result-date',        data.ingreso);
    setText('result-tech',        data.tecnico);
    setText('result-observation', data.observacion);

    const badge = document.getElementById('result-status-badge');
    applyStatusStyles(data.estado, badge);
    renderTimeline(data.estado);

    showOnly(card);
  }

  /**
   * Simula una llamada asíncrona a una API.
   * REEMPLAZAR con llamada real a Supabase/Firebase.
   */
  async function fetchRepairStatus(code) {
    // Simula latencia de red
    await new Promise((resolve) => setTimeout(resolve, 900));
    return DEMO_DATA[code.toUpperCase().trim()] || null;
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
   5. GALERÍA — FILTROS
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
   6. SCROLL SUAVE PARA ANCHORS
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
   7. BOTÓN "VOLVER ARRIBA" IMPLÍCITO EN EL LOGO
   Ya funciona por href="#inicio" en el logo del footer/nav.
   No requiere código adicional gracias a scroll-behavior CSS.
   ============================================================ */


/* ============================================================
   8. INICIALIZACIÓN
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  NavManager.init();
  ScrollReveal.init();
  RepairTracker.init();
  GalleryFilter.init();
  initSmoothScroll();

  // Log de versión (útil para debugging en producción)
  console.log('%cNware v1.0 🔧', 'color: #5FE3F0; font-weight: bold; font-size: 14px;');
});
