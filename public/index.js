document.addEventListener('DOMContentLoaded', () => {
  let lastTouchEnd = 0;
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 320) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  const cardsContainer = document.getElementById('cards');
  const startOverlay = document.getElementById('startOverlay');
  const startModuleBtn = document.getElementById('startModuleBtn');
  const modal = document.getElementById('modal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalFinish = document.getElementById('modalFinish');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalCountdown = document.getElementById('modalCountdown');
  const scrollUpBtn = document.getElementById('scrollUpBtn');
  const scrollDownBtn = document.getElementById('scrollDownBtn');
  const pagePrevBtn = document.getElementById('pagePrevBtn');
  const pageNextBtn = document.getElementById('pageNextBtn');
  const cardsRangeInfo = document.getElementById('cardsRangeInfo');
  const guideAssistant = document.getElementById('guideAssistant');
  const guideAssistantText = document.getElementById('guideAssistantText');
  const MODAL_TIMEOUT_MS = 300_000;
  const GUIDE_INTERVAL_MS = 300_000;
  const CARDS_PER_PAGE = 8;
  const PAGE_TRANSITION_MS = 240;
  const GUIDE_MESSAGE = 'Aqui puedes ver todos los tramites de la notaría Espinoza Lara. Acercate y solicita los requisitos que necesites';
  const GUIDE_CLICK_MESSAGE = 'Escoge el tramite que vas a realizar para obtener los requisitos';
  let modalTimeoutId = null;
  let modalCountdownIntervalId = null;
  let modalTimeoutDeadline = 0;
  let guideMessageIntervalId = null;
  let guideBubbleTimeoutId = null;
  let moduleStarted = false;
  let allTramites = [];
  let currentPage = 0;
  let isPageTransitioning = false;
  const tramiteDetailCache = new Map();
  const DETAIL_CACHE_TTL_MS = 120_000;

  function updateCardsRangeInfo() {
    if (!cardsRangeInfo) return;
    const total = allTramites.length;
    if (total === 0) {
      cardsRangeInfo.textContent = '0-0 / 0';
      return;
    }

    const startIndex = currentPage * CARDS_PER_PAGE + 1;
    const endIndex = Math.min(startIndex + CARDS_PER_PAGE - 1, total);
    cardsRangeInfo.textContent = `${startIndex}-${endIndex} / ${total}`;
  }

  function showGuideBubble(message) {
    if (!guideAssistantText) return;
    guideAssistantText.textContent = message;
    guideAssistantText.classList.add('show');
  }

  function hideGuideBubble() {
    if (!guideAssistantText) return;
    guideAssistantText.classList.remove('show');
  }

  function clearGuideBubbleTimeout() {
    if (guideBubbleTimeoutId) {
      clearTimeout(guideBubbleTimeoutId);
      guideBubbleTimeoutId = null;
    }
  }

  function speakMessage(message, onDone) {
    if (!('speechSynthesis' in window)) {
      if (typeof onDone === 'function') onDone();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'es-MX';
    utterance.rate = 0.97;
    utterance.pitch = 1;
    utterance.onend = () => {
      if (typeof onDone === 'function') onDone();
    };
    utterance.onerror = () => {
      if (typeof onDone === 'function') onDone();
    };
    window.speechSynthesis.speak(utterance);
  }

  function speakGuideLoopMessage() {
    showGuideBubble(GUIDE_MESSAGE);
    clearGuideBubbleTimeout();
    speakMessage(GUIDE_MESSAGE, hideGuideBubble);
  }

  function startGuideLoop() {
    if (guideMessageIntervalId) clearInterval(guideMessageIntervalId);
    speakGuideLoopMessage();
    guideMessageIntervalId = setInterval(speakGuideLoopMessage, GUIDE_INTERVAL_MS);
  }

  function startModule() {
    if (moduleStarted) return;
    moduleStarted = true;
    if (startOverlay) startOverlay.classList.add('hidden');
    hideGuideBubble();
    if (guideAssistant) guideAssistant.classList.add('show');
    startGuideLoop();
    renderCards().then(() => requestAnimationFrame(updatePageNavigationButtons));
  }

  function handleGuideAssistantClick() {
    clearGuideBubbleTimeout();
    showGuideBubble(GUIDE_CLICK_MESSAGE);
    guideBubbleTimeoutId = setTimeout(hideGuideBubble, 7000);
    speakMessage(GUIDE_CLICK_MESSAGE, () => {
      clearGuideBubbleTimeout();
      hideGuideBubble();
    });
  }

  function updateModalCountdown() {
    if (!modalCountdown) return;
    const remainingMs = Math.max(0, modalTimeoutDeadline - Date.now());
    const remainingSec = Math.ceil(remainingMs / 1000);
    modalCountdown.textContent = `Cierra en ${remainingSec}s`;
  }

  function clearModalTimeout() {
    if (modalTimeoutId) {
      clearTimeout(modalTimeoutId);
      modalTimeoutId = null;
    }
    if (modalCountdownIntervalId) {
      clearInterval(modalCountdownIntervalId);
      modalCountdownIntervalId = null;
    }
    modalTimeoutDeadline = 0;
    if (modalCountdown) {
      modalCountdown.classList.add('hidden');
      modalCountdown.textContent = '';
    }
  }

  function startModalTimeout() {
    clearModalTimeout();
    modalTimeoutDeadline = Date.now() + MODAL_TIMEOUT_MS;
    if (modalCountdown) {
      modalCountdown.classList.remove('hidden');
      updateModalCountdown();
      modalCountdownIntervalId = setInterval(updateModalCountdown, 1000);
    }
    modalTimeoutId = setTimeout(() => {
      closeModal();
    }, MODAL_TIMEOUT_MS);
  }

  function updatePageNavigationButtons() {
    updateCardsRangeInfo();
    if (!pagePrevBtn || !pageNextBtn) return;
    if (!modal.classList.contains('hidden')) {
      pagePrevBtn.classList.add('hidden');
      pageNextBtn.classList.add('hidden');
      return;
    }

    const totalPages = Math.ceil(allTramites.length / CARDS_PER_PAGE);
    if (totalPages <= 1) {
      pagePrevBtn.classList.add('hidden');
      pageNextBtn.classList.add('hidden');
      return;
    }

    pagePrevBtn.classList.toggle('hidden', currentPage <= 0);
    pageNextBtn.classList.toggle('hidden', currentPage >= totalPages - 1);
  }

  function changePage(direction) {
    if (isPageTransitioning) return;
    const totalPages = Math.ceil(allTramites.length / CARDS_PER_PAGE);
    if (totalPages <= 1) return;
    const nextPage = Math.min(Math.max(currentPage + direction, 0), totalPages - 1);
    if (nextPage === currentPage) return;
    currentPage = nextPage;
    renderCurrentPage(direction);
  }

  function updateScrollButtons() {
    if (!scrollUpBtn || !scrollDownBtn || !modalBody) return;

    const maxScroll = modalBody.scrollHeight - modalBody.clientHeight;
    const hasOverflow = maxScroll > 8;

    if (!hasOverflow) {
      scrollUpBtn.classList.add('hidden');
      scrollDownBtn.classList.add('hidden');
      return;
    }

    const isTop = modalBody.scrollTop <= 2;
    const isBottom = modalBody.scrollTop >= maxScroll - 2;

    scrollUpBtn.classList.toggle('hidden', isTop);
    scrollDownBtn.classList.toggle('hidden', isBottom);
  }

  function scrollModalContent(direction) {
    if (!modalBody) return;
    const step = Math.max(180, Math.floor(modalBody.clientHeight * 0.55));
    modalBody.scrollBy({ top: direction * step, behavior: 'smooth' });
    setTimeout(updateScrollButtons, 220);
  }

  async function fetchTramites() {
    try {
      const res = await fetch('/api/tramites');
      if (!res.ok) throw new Error('Error fetching trámites');
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  async function fetchTramiteDetail(id, { silent = false } = {}) {
    const cacheKey = String(id);
    const cached = tramiteDetailCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const res = await fetch(`/api/tramites/${id}`);
    if (!res.ok) {
      if (!silent) throw new Error('Error cargando trámite');
      return null;
    }
    const data = await res.json();
    tramiteDetailCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + DETAIL_CACHE_TTL_MS,
    });
    return data;
  }

  function prefetchCurrentPageDetails() {
    if (!allTramites || allTramites.length === 0) return;
    const startIndex = currentPage * CARDS_PER_PAGE;
    const pageItems = allTramites.slice(startIndex, startIndex + CARDS_PER_PAGE);
    pageItems.forEach((item) => {
      if (!item || item.id == null) return;
      fetchTramiteDetail(item.id, { silent: true }).catch(() => {});
    });
  }

  function createCard(tramite, numero) {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const numberBlock = document.createElement('span');
    numberBlock.className = 'card-number';
    numberBlock.textContent = String(numero);

    const icon = document.createElement('div');
    icon.className = 'card-icon';
    if (tramite.icono) {
      const img = document.createElement('img');
      img.src = `/icons/${tramite.icono}`;
      img.alt = '';
      img.style.width = '48px';
      img.style.height = '48px';
      icon.appendChild(img);
    } else {
      icon.textContent = '🗂️';
    }

    const body = document.createElement('div');
    body.className = 'card-body';
    const h3 = document.createElement('h3');
    h3.textContent = tramite.titulo || tramite.title || 'Trámite';
    body.appendChild(h3);
    card.appendChild(numberBlock);
    card.appendChild(icon);
    card.appendChild(body);

    card.addEventListener('click', () => openModalById(tramite.id));
    card.addEventListener('keyup', (e) => { if (e.key === 'Enter') openModalById(tramite.id); });

    return card;
  }

  function paintCurrentPage() {
    cardsContainer.innerHTML = '';
    if (!allTramites || allTramites.length === 0) {
      cardsContainer.textContent = 'No hay trámites disponibles.';
      return;
    }

    const startIndex = currentPage * CARDS_PER_PAGE;
    const pageItems = allTramites.slice(startIndex, startIndex + CARDS_PER_PAGE);

    pageItems.forEach((t, index) => {
      const card = createCard(t, startIndex + index + 1);
      cardsContainer.appendChild(card);
    });
  }

  function renderCurrentPage(direction = 0) {
    if (!cardsContainer) return;

    if (direction === 0 || cardsContainer.children.length === 0) {
      paintCurrentPage();
      updatePageNavigationButtons();
      prefetchCurrentPageDetails();
      return;
    }

    const exitClass = direction > 0 ? 'page-exit-left' : 'page-exit-right';
    const enterClass = direction > 0 ? 'page-enter-right' : 'page-enter-left';

    isPageTransitioning = true;
    cardsContainer.classList.remove('page-exit-left', 'page-exit-right', 'page-enter-left', 'page-enter-right');
    cardsContainer.classList.add(exitClass);

    setTimeout(() => {
      cardsContainer.classList.remove(exitClass);
      paintCurrentPage();
      updatePageNavigationButtons();
      prefetchCurrentPageDetails();
      cardsContainer.classList.add(enterClass);

      setTimeout(() => {
        cardsContainer.classList.remove(enterClass);
        isPageTransitioning = false;
      }, PAGE_TRANSITION_MS);
    }, PAGE_TRANSITION_MS);
  }

  async function renderCards() {
    allTramites = await fetchTramites();
    currentPage = 0;
    renderCurrentPage();
  }

  async function openModalById(id) {
    try {
      // show full-screen loader while fetching data
      const loader = document.getElementById('loaderOverlay');
      if (loader) loader.classList.remove('hidden');

      const t = await fetchTramiteDetail(id);

      // hide loader, then open modal with content
      if (loader) loader.classList.add('hidden');

      // build requisitos list
      modalTitle.textContent = t.titulo || 'Requisitos';
      modalBody.innerHTML = '';
      modalBody.scrollTop = 0;

      const reqList = document.createElement('div');
      reqList.className = 'req-list';

      (t.requisitos || []).forEach(r => {
        const row = document.createElement('div');
        row.className = 'req-item';

        const clip = document.createElement('span');
        clip.className = 'req-clip';
        clip.textContent = '📌';

        const text = document.createElement('p');
        text.className = 'req-text';
        text.textContent = r.texto || '';

        row.appendChild(clip);
        row.appendChild(text);
        reqList.appendChild(row);
      });

      // append requisitos list (or message)
      if (!t.requisitos || t.requisitos.length === 0) {
        modalBody.textContent = 'No hay requisitos registrados para este trámite.';
      } else {
        modalBody.appendChild(reqList);
      }

      // modules: render as square cards with icon (reuse req-card styles)
      const modsWrap = document.createElement('div');
      modsWrap.className = 'mods-wrap';
      const h3 = document.createElement('h4');
      h3.textContent = 'Donde se atiende';
      modsWrap.appendChild(h3);

      const modGrid = document.createElement('div');
      modGrid.className = 'req-grid';
      (t.modulos || []).forEach(m => {
        const card = document.createElement('div');
        card.className = 'req-card';

        const iconWrap = document.createElement('div');
        iconWrap.className = 'req-icon';
        iconWrap.textContent = '💻';

        const body = document.createElement('div');
        body.className = 'req-body';
        const h4 = document.createElement('h4');
        h4.textContent = m.numero || 'Módulo';
        const p = document.createElement('p');
        p.textContent = m.piso || '';
        body.appendChild(h4);
        body.appendChild(p);

        card.appendChild(iconWrap);
        card.appendChild(body);
        modGrid.appendChild(card);
      });
      modsWrap.appendChild(modGrid);
      modalBody.appendChild(modsWrap);

      // now show modal (after content ready) to avoid expansion jumps
      modal.classList.remove('hide');
      modalBackdrop.classList.remove('hidden');
      modal.classList.remove('hidden');
      // Add the 'show' class in a single animation frame to avoid double-toggle flicker
      requestAnimationFrame(() => {
        modalBackdrop.classList.add('show');
        modal.classList.add('show');
      });
      startModalTimeout();

      if (modalFinish) modalFinish.focus();
      requestAnimationFrame(updateScrollButtons);
      requestAnimationFrame(updatePageNavigationButtons);
    } catch (err) {
      console.error(err);
      modalTitle.textContent = 'Error';
      modalBody.textContent = 'No se pudieron cargar los requisitos.';
    }
  }

  function closeModal() {
    clearModalTimeout();
    // reuse existing animation logic
    modal.classList.add('hide');
    requestAnimationFrame(() => {
      modal.classList.remove('show');
      modalBackdrop.classList.remove('show');
    });
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('hide');
      modalBackdrop.classList.add('hidden');
      updateScrollButtons();
      updatePageNavigationButtons();
    }, 320);
  }

  function finishModal() { closeModal(); }

  // events
  modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keyup', (e) => { if (e.key === 'Escape') closeModal(); });
  if (modalFinish) modalFinish.addEventListener('click', finishModal);
  if (scrollUpBtn) scrollUpBtn.addEventListener('click', () => scrollModalContent(-1));
  if (scrollDownBtn) scrollDownBtn.addEventListener('click', () => scrollModalContent(1));
  if (pagePrevBtn) pagePrevBtn.addEventListener('click', () => changePage(-1));
  if (pageNextBtn) pageNextBtn.addEventListener('click', () => changePage(1));
  modalBody.addEventListener('scroll', updateScrollButtons);
  window.addEventListener('resize', updateScrollButtons);
  window.addEventListener('resize', updatePageNavigationButtons);
  if (guideAssistant) {
    guideAssistant.addEventListener('click', handleGuideAssistantClick);
  }
  if (startModuleBtn) {
    startModuleBtn.addEventListener('click', startModule);
  }

  // initial render
  hideGuideBubble();
  if (!startOverlay) startModule();
});
