// assets/js/components/creeper.js — easter egg: explosión del creeper.
(function () {
  const MC = {
    creeper: "creeper.png",
    white:   "creeper_white.png",
    expl:  ["explosion_0.png","explosion_1.png","explosion_2.png",
            "explosion_0.png","explosion_1.png","explosion_2.png",
            "explosion_3.png","explosion_4.png"],
    smoke:   "big_smoke_0.png",
    audio:   "explosion.mp3"
  };

  const cWrap = document.querySelector('.hero .creeper-wrap');
  const cImg  = cWrap ? cWrap.querySelector('.creeper-svg') : null;
  const flash = document.getElementById('mc-screen-flash');
  const pCont = document.getElementById('mc-particles');
  if (!cWrap || !cImg) return;

  let busy = false;
  let audioCtx = null;
  let audioBuf = null;

  let _audioPrefetch = null;
  fetch(MC.audio)
    .then(r => r.arrayBuffer())
    .then(ab => { _audioPrefetch = ab; })
    .catch(() => {});

  function initAudio() {
    if (audioCtx) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) { return; }
    if (_audioPrefetch) {
      audioCtx.decodeAudioData(_audioPrefetch.slice(0), buf => { audioBuf = buf; });
    } else {
      fetch(MC.audio)
        .then(r => r.arrayBuffer())
        .then(ab => audioCtx.decodeAudioData(ab, buf => { audioBuf = buf; }))
        .catch(() => {});
    }
  }

  function playBoom() {
    if (!audioCtx || !audioBuf) return;
    const src = audioCtx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(audioCtx.destination);
    src.start(audioCtx.currentTime);
  }

  const rnd    = (a,b) => Math.random()*(b-a)+a;
  const rndInt = (a,b) => Math.floor(rnd(a,b+1));
  const pick   = arr  => arr[rndInt(0,arr.length-1)];

  function clearMC(...cls) { cls.forEach(c => cWrap.classList.remove(c)); }

  function fase1() {
    busy = true;
    cWrap.classList.add('mc-charging');
    const BLINKS = 12, BASE_MS = 210;
    let blink = 0, scale = 1.0;
    function tick() {
      if (blink >= BLINKS) {
        cImg.src = MC.creeper;
        cImg.style.transform = '';
        fase2();
        return;
      }
      cImg.src = (blink % 2 === 0) ? MC.white : MC.creeper;
      scale += 0.022;
      cImg.style.transform = `scale(${scale.toFixed(3)})`;
      cImg.style.transformOrigin = 'center bottom';
      blink++;
      setTimeout(tick, Math.max(BASE_MS - blink * 5, 55));
    }
    tick();
  }

  function fase2() {
    cImg.src = MC.white;
    cImg.style.transform = 'scale(1.22)';
    clearMC('mc-charging');
    cWrap.classList.add('mc-shaking');
    setTimeout(() => { clearMC('mc-shaking'); fase3(); }, 0);
  }

  function fase3() {
    const rect = cWrap.getBoundingClientRect();
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;

    cImg.src = MC.creeper;
    cWrap.classList.add('mc-exploding');

    flash.classList.remove('active');
    void flash.offsetWidth;
    flash.classList.add('active');

    document.body.classList.remove('mc-cam-shaking');
    void document.body.offsetWidth;
    document.body.classList.add('mc-cam-shaking');

    spawnShockwaves(cx, cy);
    spawnParticles(cx, cy);
    setTimeout(() => spawnSmoke(cx, cy), 180);
    setTimeout(reset, 3800);
  }

  function spawnShockwaves(cx, cy) {
    [
      { delay:0,   size:20, s:22, dur:'0.55s', col:'rgba(255,230,100,0.75)' },
      { delay:110, size:30, s:18, dur:'0.65s', col:'rgba(255,160,50,0.60)'  },
      { delay:240, size:40, s:14, dur:'0.75s', col:'rgba(200,100,30,0.45)'  }
    ].forEach(({delay,size,s,dur,col}) => {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'mc-shockwave';
        el.style.cssText = `left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;border:3px solid ${col};--sw-dur:${dur};--sw-s:${s}`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 900);
      }, delay);
    });
  }

  function spawnParticles(cx, cy) {
    for (let i = 0; i < 80; i++) {
      const isSmoke = Math.random() < 0.22;
      const tex     = isSmoke ? MC.smoke : pick(MC.expl);
      const esDir   = (tex === MC.expl[6] || tex === MC.expl[7]);
      const sz      = isSmoke ? rndInt(4,9)*8 : rndInt(20,48)*8;
      const ang     = rnd(0, Math.PI*2);
      const spd     = esDir ? rnd(40,140) : rnd(60,340);
      const tx      = Math.cos(ang)*spd;
      const bias    = isSmoke ? rnd(-80,-140) : rnd(-80,80);
      const ty      = Math.sin(ang)*spd*0.75 + bias;
      const angBase = esDir
        ? (Math.atan2(ty, tx) * 180 / Math.PI) + 315
        : rnd(-600, 600);

      const el = document.createElement('div');
      el.className = esDir ? 'mc-particle mc-particle-dir' : 'mc-particle';
      el.style.cssText = [
        `left:${(cx-sz/2).toFixed(1)}px`,
        `top:${(cy-sz/2).toFixed(1)}px`,
        `width:${sz}px`,
        `height:${sz}px`,
        `background-image:url('${tex}')`,
        `--tx:${tx.toFixed(1)}px`,
        `--ty:${ty.toFixed(1)}px`,
        `--rot:${angBase.toFixed(0)}deg`,
        `--dur:${esDir ? rnd(0.4,0.9).toFixed(2) : rnd(0.45,1.7).toFixed(2)}s`,
        `--delay:${rnd(0,0.12).toFixed(3)}s`,
        `--sc1:${rnd(0.05,0.35).toFixed(2)}`,
        `--ease:${Math.random()<0.5?'cubic-bezier(.25,.46,.45,.94)':'ease-out'}`,
        `--op0:${rnd(0.8,1.0).toFixed(2)}`
      ].join(';');
      pCont.appendChild(el);
    }
    setTimeout(() => { pCont.innerHTML = ''; }, 1800);
  }

  function spawnSmoke(cx, cy) {
    for (let i = 0; i < 10; i++) {
      const sz  = rndInt(5,10)*12;
      const el  = document.createElement('div');
      el.className = 'mc-smoke-up';
      el.style.cssText = [
        `left:${(cx+rnd(-70,70)).toFixed(0)}px`,
        `top:${(cy+rnd(-70,30)).toFixed(0)}px`,
        `width:${sz}px`, `height:${sz}px`,
        `background-image:url('${MC.smoke}')`,
        `--sd:${rnd(1.4,2.5).toFixed(2)}s`,
        `--sdelay:${rnd(0,0.6).toFixed(2)}s`,
        `--srot:${rnd(-200,200).toFixed(0)}deg`
      ].join(';');
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    }
  }

  function reset() {
    clearMC('mc-charging','mc-shaking','mc-exploding');
    document.body.classList.remove('mc-cam-shaking');
    cImg.src = MC.creeper;
    cImg.style.transform = '';
    pCont.innerHTML = '';
    busy = false;
  }

  cWrap.addEventListener('click', () => {
    if (busy) return;
    initAudio();
    playBoom();
    fase1();
  });

  ['mousemove','touchstart','keydown'].forEach(ev =>
    document.addEventListener(ev, initAudio, { once: true })
  );
})();
