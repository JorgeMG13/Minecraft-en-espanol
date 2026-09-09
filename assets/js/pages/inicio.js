// assets/js/pages/inicio.js — lógica de la portada (secciones, búsqueda,
// quiz, contacto, notificaciones y realtime).
// Requiere: supabase-js (CDN), config.js, utils/dom.js, services/supabase.js
(function () {
  const { esc } = window.MCEDom;
  const { sb } = window.Servicios;

  const _cache = { noticia: [], curiosidad: [], quiz: [], otros: [], guias: [] };
  let _guiasFiltro = 'all';
  let _searchIndex = [];

  /* ══ BÚSQUEDA GLOBAL ══ */
  function buildSearchIndex() {
    _searchIndex = [];
    _cache.noticia.forEach(n    => _searchIndex.push({ tipo:'NOTICIA',    titulo:n.titulo,                 excerpt:n.texto?.slice(0,80),  action:()=>{ window.location.href='/noticias/'+encodeURIComponent(n.slug||n.id); } }));
    _cache.guias.forEach(g      => _searchIndex.push({ tipo:'GUÍA',       titulo:g.titulo,                 excerpt:g.categoria,           action:()=>{ window.location.href='/guias/'+encodeURIComponent(g.slug||g.id); } }));
    _cache.curiosidad.forEach(c => _searchIndex.push({ tipo:'CURIOSIDAD', titulo:c.texto?.slice(0,50)+'…', excerpt:c.texto,               action:()=>{ window.location.href='/curiosidades/'+c.id; } }));
    _cache.otros.forEach(o      => _searchIndex.push({ tipo:'OTROS',      titulo:o.titulo,                 excerpt:o.texto,               action:()=>{ window.location.href='/otros/'+encodeURIComponent(o.slug||o.id); } }));
    _cache.quiz.forEach(q => { const opciones=Array.isArray(q.opciones)?q.opciones:JSON.parse(q.opciones||'[]'); _searchIndex.push({ tipo:'QUIZ', titulo:q.pregunta, excerpt:opciones.join(' · '), action:()=>showSection('quiz',document.getElementById('nav-quiz')) }); });
  }
  document.getElementById('global-search').addEventListener('input', function() {
    const q = this.value.trim().toLowerCase();
    const el = document.getElementById('search-results');
    if (!q) { el.classList.remove('open'); return; }
    const results = _searchIndex.filter(x => x.titulo?.toLowerCase().includes(q) || x.excerpt?.toLowerCase().includes(q)).slice(0,8);
    if (!results.length) { el.innerHTML='<div class="search-empty">Sin resultados para "'+esc(this.value)+'"</div>'; el.classList.add('open'); return; }
    el.innerHTML = results.map((r,i)=>`<div class="search-result-item" id="sr-${i}"><div class="sr-type">${r.tipo}</div><div class="sr-title">${esc(r.titulo)}</div>${r.excerpt?`<div class="sr-excerpt">${esc(r.excerpt)}</div>`:''}</div>`).join('');
    results.forEach((r,i)=>{ document.getElementById('sr-'+i).addEventListener('click',()=>{ el.classList.remove('open'); document.getElementById('global-search').value=''; r.action(); }); });
    el.classList.add('open');
  });
  document.addEventListener('click', e=>{ if(!e.target.closest('.hero-search-wrap')) document.getElementById('search-results').classList.remove('open'); });

  /* ══ NAVEGACIÓN ══ */
  window.toggleMobileNav = function() {
    document.getElementById('mobile-nav').classList.toggle('open');
    document.getElementById('hamburger').classList.toggle('open');
  };
  window.showSection = function(id, btn, fromMobile=false) {
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    document.querySelectorAll('nav .nav-btn, .mobile-nav .nav-btn').forEach(b=>b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const db=document.getElementById('nav-'+id), mb=document.getElementById('m-nav-'+id);
    if(db) db.classList.add('active');
    if(mb) mb.classList.add('active');
    if(fromMobile) toggleMobileNav();
    renderTodo();
  };
  function renderTodo() { renderNoticias(); renderGuias(); renderCuriosidades(); renderQuiz(); renderOtros(); }

  /* ══ DETALLE EN PANTALLA COMPLETA ══ */
  let _fsPostBackSection = 'inicio';
  function abrirFsPost(metaTxt, titulo, cuerpo, imgUrl, enlace, backSection) {
    _fsPostBackSection = backSection || 'inicio';
    document.getElementById('fs-post-meta').textContent = metaTxt;
    document.getElementById('fs-post-title').textContent = titulo;
    document.getElementById('fs-post-topbar-title').textContent = titulo;
    document.getElementById('fs-post-body').textContent = cuerpo;
    const imgEl = document.getElementById('fs-post-img');
    if(imgUrl){ imgEl.src=imgUrl; imgEl.style.display='block'; } else { imgEl.style.display='none'; }
    const linkEl = document.getElementById('fs-post-link');
    if(enlace){ linkEl.href=enlace; linkEl.style.display='inline-flex'; } else { linkEl.style.display='none'; }
    document.getElementById('fs-post').classList.add('open');
    document.getElementById('fs-post').scrollTop = 0;
  }
  document.getElementById('fs-post-back').addEventListener('click', ()=>{
    document.getElementById('fs-post').classList.remove('open');
    showSection(_fsPostBackSection, document.getElementById('nav-'+_fsPostBackSection));
  });

  /* ══ NOTICIAS ══ */
  function renderNoticias() {
    const rev = getDatos('noticia');
    document.getElementById('home-posts').innerHTML = rev.length===0
      ? '<div class="empty-state">📭 Aún no hay noticias.</div>'
      : rev.slice(0,2).map(n=>cardNoticia(n)).join('');
    document.getElementById('news-posts').innerHTML = rev.length===0
      ? '<div class="empty-state">📭 Aún no hay noticias.</div>'
      : rev.map(n=>cardNoticia(n)).join('');
  }
  function cardNoticia(n) {
    const imgHtml = n.imagen
      ? `<div class="post-card-img-wrap"><img class="post-card-img" src="${esc(n.imagen)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=post-card-img-placeholder><img src=logo.png alt=Logo /></div>'" /></div>`
      : `<div class="post-card-img-placeholder"><img src="logo.png" alt="Logo" /></div>`;
    return `<a class="post-card" href="/noticias/${encodeURIComponent(n.slug||n.id)}" style="text-decoration:none;">
      ${imgHtml}
      <div class="post-card-body">
        <span class="post-card-category">Noticia</span>
        <div class="post-card-title">${esc(n.titulo)}</div>
        <div class="post-card-excerpt">${esc(n.texto?.slice(0,100))}${n.texto?.length>100?'…':''}</div>
        <div class="post-card-meta">${n.fecha}</div>
      </div>
    </a>`;
  }

  /* ══ GUÍAS ══ */
  function renderGuias() {
    const lista = getDatos('guias');
    const filtered = _guiasFiltro==='all' ? lista : lista.filter(g=>g.categoria===_guiasFiltro);
    document.getElementById('guias-list').innerHTML = filtered.length===0
      ? '<div class="empty-state">📖 Sin guías en esta categoría.</div>'
      : filtered.map(g=>cardGuia(g)).join('');
  }
  function difClass(d){ if(!d)return''; return d.toLowerCase().includes('fácil')||d.toLowerCase().includes('facil')?'dif-facil':d.toLowerCase().includes('difícil')||d.toLowerCase().includes('dificil')?'dif-dificil':'dif-medio'; }
  function cardGuia(g) {
    const pasos = Array.isArray(g.pasos)?g.pasos:(typeof g.pasos==='string'?JSON.parse(g.pasos||'[]'):[]);
    const imgHtml = g.imagen_url
      ? `<img class="guia-card-img" src="${esc(g.imagen_url)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
      : `<div class="guia-card-img-placeholder">📖</div>`;
    return `<a class="guia-card" href="/guias/${encodeURIComponent(g.slug||g.id)}" style="text-decoration:none;">
      ${imgHtml}
      <div class="guia-card-body">
        ${g.dificultad?`<span class="guia-dificultad ${difClass(g.dificultad)}">${esc(g.dificultad)}</span>`:''}
        ${g.categoria?`<span class="post-card-category">${esc(g.categoria)}</span>`:''}
        <div class="guia-card-title">${esc(g.titulo)}</div>
        <div class="guia-card-steps">${pasos.length} paso${pasos.length!==1?'s':''}</div>
      </div>
    </a>`;
  }
  window.filtrarGuias = function(cat, btn) {
    _guiasFiltro=cat;
    document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    renderGuias();
  };

  /* ══ CURIOSIDADES ══ */
  function renderCuriosidades() {
    const lista=getDatos('curiosidad');
    document.getElementById('curiosidades-list').innerHTML=lista.length===0
      ?'<div class="empty-state">💡 Aún no hay datos curiosos.</div>'
      :lista.map(c=>`<a class="curiosidad-card" href="/curiosidades/${c.id}" style="text-decoration:none;"><span class="curiosidad-icon">💡</span><p>${esc(c.texto)}</p><span class="post-date">${c.fecha}</span></a>`).join('');
  }

  /* ══ OTROS ══ */
  function renderOtros() {
    const lista=getDatos('otros');
    document.getElementById('otros-list').innerHTML=lista.length===0
      ?'<div class="empty-state">🎭 Aún no hay contenido.</div>'
      :lista.map(c=>`<a class="otros-card" href="/otros/${encodeURIComponent(c.slug||c.id)}" style="text-decoration:none;"><h3>${esc(c.titulo||'')}</h3><p>${esc(c.texto.slice(0,100))}${c.texto.length>100?'…':''}</p><span class="post-date">${c.fecha}</span></a>`).join('');
  }

  /* ══ QUIZ ══ */
  function renderQuiz() {
    const lista=getDatos('quiz');
    document.getElementById('quiz-list').innerHTML=lista.length===0
      ?'<div class="empty-state">❓ Aún no hay preguntas de quiz.</div>'
      :lista.map(q=>buildQuizCard(q)).join('');
  }
  function buildQuizCard(q) {
    const opciones=Array.isArray(q.opciones)?q.opciones:JSON.parse(q.opciones);
    const guardada=localStorage.getItem('quiz_'+q.id);
    const opts=opciones.map((op,i)=>{
      let clase='';
      if(guardada!==null){const el=parseInt(guardada);if(i===q.correcta)clase=el===i?'correcta':'revelar';else if(i===el)clase='incorrecta';}
      const click=guardada===null?`onclick="responderQuiz('${q.id}',${i})"`:'';
      return `<div class="quiz-option ${clase}" id="opt-${q.id}-${i}" ${click} style="${guardada!==null?'cursor:default':''}">${esc(op)}</div>`;
    }).join('');
    const resultado=guardada!==null?(parseInt(guardada)===q.correcta?'<span style="color:#a0f060;">✔ ¡CORRECTO!</span>':`<span style="color:#f08080;">✘ Incorrecto.</span> <span style="color:var(--txt-muted);">Correcta: ${esc(opciones[q.correcta])}</span>`):'';
    return `<div class="quiz-card"><p class="quiz-pregunta">${esc(q.pregunta)}</p>${opts}<div class="quiz-resultado" id="res-${q.id}">${resultado}</div></div>`;
  }
  window.responderQuiz = function(qid, elegida) {
    const q=getDatos('quiz').find(x=>x.id===qid); if(!q) return;
    localStorage.setItem('quiz_'+qid,elegida);
    const opciones=Array.isArray(q.opciones)?q.opciones:JSON.parse(q.opciones);
    opciones.forEach((_,i)=>{ const el=document.getElementById('opt-'+qid+'-'+i); if(el){ el.onclick=null; el.style.cursor='default'; if(i===q.correcta)el.classList.add(elegida===i?'correcta':'revelar'); else if(i===elegida)el.classList.add('incorrecta'); }});
    const resEl=document.getElementById('res-'+qid);
    if(resEl) resEl.innerHTML=elegida===q.correcta?'<span style="color:#a0f060;">✔ ¡CORRECTO!</span>':`<span style="color:#f08080;">✘ Incorrecto.</span> <span style="color:var(--txt-muted);">Correcta: ${esc(opciones[q.correcta])}</span>`;
  };

  /* ══ CONTACTO ══ */
  window.abrirContacto = function(){
    ['contacto-nombre','contacto-email','contacto-mensaje'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('contacto-aviso').textContent='';
    document.getElementById('contacto-panel').classList.add('open');
  };
  window.cerrarContacto = function(){ document.getElementById('contacto-panel').classList.remove('open'); };
  window.enviarContacto = async function(){
    const nombre=document.getElementById('contacto-nombre').value.trim();
    const email=document.getElementById('contacto-email').value.trim();
    const mensaje=document.getElementById('contacto-mensaje').value.trim();
    const aviso=document.getElementById('contacto-aviso');
    if(!mensaje){ aviso.style.color='var(--red)'; aviso.textContent='⚠ El mensaje es obligatorio.'; return; }
    aviso.style.color='var(--gold)'; aviso.textContent='Enviando...';
    const error = await window.Servicios.insertarMensaje({ nombre, email, mensaje });
    if(error){ aviso.style.color='var(--red)'; aviso.textContent='❌ Error al enviar.'; }
    else{ aviso.style.color='var(--green)'; aviso.textContent='✔ Mensaje enviado. ¡Gracias!'; setTimeout(cerrarContacto,2000); }
  };

  window.abrirInstalar = function(){ document.getElementById('instalar-panel').classList.add('open'); };
  window.cerrarInstalar = function(){ document.getElementById('instalar-panel').classList.remove('open'); };

  /* Vista de guía a pantalla completa (histórica; los enlaces actuales van a /guias/:slug) */
  window.cerrarFsGuia = function() {
    document.getElementById('fs-guia').classList.remove('open');
    document.getElementById('fs-guia-video').src = '';
  };

  /* ══ NOTIFICACIONES PUSH ══ */
  let _swReg = null;

  async function initNotificaciones() {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      document.getElementById('notif-btn').style.display = 'none';
      return;
    }
    try {
      _swReg = await navigator.serviceWorker.register('/sw.js');
    } catch(e) { console.warn('SW no registrado:', e); }

    actualizarBtnNotif();
    if (Notification.permission === 'granted') {
      await suscribirPush();
    }
  }

  function actualizarBtnNotif() {
    const btn = document.getElementById('notif-btn');
    const desBtn = document.getElementById('desactivar-notif-btn');
    const perm = Notification.permission;
    if (perm === 'granted') {
      btn.style.display = 'none';
      if (desBtn) desBtn.style.display = 'inline-flex';
    } else if (perm === 'denied') {
      btn.innerHTML = '🔕 BLOQUEADAS';
      btn.classList.add('off');
      btn.style.display = '';
      if (desBtn) desBtn.style.display = 'none';
    } else {
      btn.innerHTML = '🔔 ACTIVAR NOTIF.';
      btn.classList.remove('off');
      btn.style.display = '';
      if (desBtn) desBtn.style.display = 'none';
    }
  }

  window.desactivarNotificaciones = function() {
    alert('Para desactivar las notificaciones, ve a los ajustes de tu navegador y bloquea los permisos de notificación para este sitio.');
  };

  window.toggleNotificaciones = async function() {
    if (!('Notification' in window)) {
      alert('Tu navegador no soporta notificaciones.');
      return;
    }
    if (Notification.permission === 'denied') {
      alert('Las notificaciones están bloqueadas. Actívalas desde los ajustes del navegador.');
      return;
    }

    const esIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const esStandalone = window.navigator.standalone === true;

    if (esIOS && !esStandalone) {
      const confirmar = confirm(
        '⚠️ AVISO PARA IPHONE / IPAD\n\n' +
        'En iOS las notificaciones push solo funcionan si añades esta web a tu pantalla de inicio.\n\n' +
        '1. Pulsa el botón compartir ⬆ en Safari\n' +
        '2. "Añadir a pantalla de inicio"\n' +
        '3. Abre la app instalada\n' +
        '4. Activa las notificaciones desde ahí\n\n' +
        '¿Quieres continuar igualmente?'
      );
      if (!confirmar) return;
    }

    const perm = await Notification.requestPermission();
    actualizarBtnNotif();
    if (perm === 'granted') {
      enviarNotifLocal('🟢 ¡Notificaciones activadas!', 'Te avisaremos cuando haya nuevas publicaciones.');
      await suscribirPush();
    }
  }

  async function suscribirPush() {
    if (!_swReg) return;
    try {
      const VAPID_PUBLIC = 'BF7vezax1pPAnWv6SiMcPI5rcToC5E1InHgaKBkxJGuXiFLFp0FoC9OMvNEvNTpYnqFqDS9anBkp0wsyPE4E3bU';
      const sub = await _swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
      });
      const { endpoint, keys } = sub.toJSON();
      await fetch(`${window.MCE_CONFIG.SB_URL}/functions/v1/save-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.MCE_CONFIG.SB_ANON_KEY}` },
        body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth })
      });
    } catch(e) { console.warn('Error al suscribir push:', e); }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  function enviarNotifLocal(titulo, cuerpo, tag) {
    if (Notification.permission !== 'granted') return;
    if (_swReg) {
      _swReg.active?.postMessage({ type: 'SHOW_NOTIFICATION', title: titulo, body: cuerpo, tag: tag || 'mc-notif' });
    } else {
      new Notification(titulo, { body: cuerpo, icon: '/favicon-96x96.png' });
    }
  }

  /* ══ REALTIME ══ */
  function iniciarRealtime() {
    const tablas = [
      { tabla: 'noticias',     tipo: 'noticia',    emoji: '📰', label: 'Nueva noticia' },
      { tabla: 'guias',        tipo: 'guias',      emoji: '📖', label: 'Nueva guía' },
      { tabla: 'curiosidades', tipo: 'curiosidad', emoji: '💡', label: 'Nuevo dato curioso' },
      { tabla: 'otros',        tipo: 'otros',      emoji: '🎭', label: 'Nuevo contenido' },
    ];

    tablas.forEach(({ tabla, tipo, emoji, label }) => {
      sb.channel('realtime:' + tabla)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: tabla }, async (payload) => {
          const nuevo = payload.new;
          // Solo mostrar en portada lo que sea visible públicamente
          if (tabla === 'noticias' && nuevo.estado && nuevo.estado !== 'publicada') return;

          _cache[tipo] = [nuevo, ..._cache[tipo]];
          buildSearchIndex();
          renderTodo();

          const titulo = nuevo.titulo || nuevo.texto?.slice(0, 60) || label;
          mostrarToast(emoji + ' ' + label.toUpperCase(), titulo);
          enviarNotifLocal(emoji + ' Minecraft en Español', titulo, tabla);
        })
        .subscribe();
    });
  }

  function mostrarToast(tag, titulo) {
    document.getElementById('toast-tag').textContent = tag;
    document.getElementById('toast-title').textContent = titulo;
    const t = document.getElementById('notif-toast');
    t.classList.add('show');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(cerrarToast, 6000);
  }
  window.cerrarToast = function() {
    document.getElementById('notif-toast').classList.remove('show');
  };

  /* ══ ARRANQUE ══ */
  (async function(){
    window.Servicios.registrarVisita();
    Object.assign(_cache, await window.Servicios.listarTodo());
    buildSearchIndex();
    renderTodo();
    initNotificaciones();
    iniciarRealtime();
  })();
})();
