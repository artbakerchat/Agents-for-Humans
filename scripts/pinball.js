const board = document.querySelector('#pinballBoard');
const ball = document.querySelector('#pinballBall');
const status = document.querySelector('#pinballStatus');

if (board && ball) {
  const sun = document.createElement('div');
  sun.className = 'pinball-sun';
  sun.setAttribute('aria-hidden', 'true');
  const sunbeam = document.createElement('div');
  sunbeam.className = 'pinball-sunbeam';
  sunbeam.setAttribute('aria-hidden', 'true');
  board.prepend(sunbeam, sun);
  let sunSide = 'right';
  const moveSun = () => {
    sunSide = Math.random() < .5 ? 'left' : 'right';
    sun.classList.toggle('pinball-sun--left', sunSide === 'left');
    sunbeam.classList.toggle('pinball-sunbeam--left', sunSide === 'left');
  };
  moveSun();
  window.setInterval(moveSun, 10000);
  const flippers = {
    left: board.querySelector('[data-flipper="left"]'),
    right: board.querySelector('[data-flipper="right"]')
  };
  const bumpers = [...board.querySelectorAll('.pinball-bumper')];
  bumpers[0]?.classList.add('pinball-bumper--red');
  bumpers[1]?.classList.add('pinball-bumper--blue');
  while (bumpers.filter((bumper) => bumper.classList.contains('pinball-bumper--red')).length < 3) {
    const extra = bumpers[0].cloneNode(true);
    extra.className = 'pinball-bumper pinball-bumper--red';
    extra.textContent = '✦';
    board.append(extra);
    bumpers.push(extra);
  }
  while (bumpers.filter((bumper) => bumper.classList.contains('pinball-bumper--blue')).length < 3) {
    const extra = bumpers[1].cloneNode(true);
    extra.className = 'pinball-bumper pinball-bumper--blue';
    extra.textContent = '+';
    board.append(extra);
    bumpers.push(extra);
  }
  const bumperPositions = [[35, 43], [63, 48], [49, 31], [22, 60], [78, 35], [51, 66]];
  bumpers.forEach((bumper, index) => {
    bumper.style.left = `${bumperPositions[index][0]}%`;
    bumper.style.top = `${bumperPositions[index][1]}%`;
    bumper.style.right = 'auto';
  });
  let topBumperZ = 2;
  const balls = [ball];
  while (balls.length < 3) {
    const extra = ball.cloneNode(false);
    extra.id = `pinballBall${balls.length + 1}`;
    balls.push(extra);
    board.append(extra);
  }
  const states = balls.map((element, index) => ({
    element,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    running: false,
    sunHits: 0,
    sunOverlap: false,
    offset: (index - 1) * 34
  }));
  let last = performance.now();

  const resetBall = () => {
    states.forEach((state) => {
      state.x = board.clientWidth / 2 + state.offset;
      state.y = board.clientHeight - 48;
      state.vx = 0;
      state.vy = 0;
      state.running = false;
      state.element.style.transform = `translate(${state.x - 10}px, ${state.y - 10}px)`;
    });
  };

  const hitFlipper = (side) => {
    const flipper = flippers[side];
    if (!flipper) return;
    flipper.classList.remove('robot-arm--hit');
    void flipper.offsetWidth;
    flipper.classList.add('robot-arm--hit');
    window.setTimeout(() => flipper.classList.remove('robot-arm--hit'), 180);
    const targetX = side === 'left' ? board.clientWidth * .3 : board.clientWidth * .7;
    const nearby = states.filter((state) => state.y > board.clientHeight - 210 && Math.abs(state.x - targetX) < board.clientWidth * .48);
    if (!nearby.length) return;
    nearby.forEach((state) => {
      state.vy = -(850 + Math.random() * 180);
      state.vx += side === 'left' ? 260 : -260;
      state.running = true;
    });
    if (status) status.textContent = 'Strong robot arm launch!';
  };

  const bounceFromBumper = (state, bumper) => {
    const boardRect = board.getBoundingClientRect();
    const bumperRect = bumper.getBoundingClientRect();
    const cx = bumperRect.left - boardRect.left + bumperRect.width / 2;
    const cy = bumperRect.top - boardRect.top + bumperRect.height / 2;
    const dx = state.x - cx;
    const dy = state.y - cy;
    const distance = Math.hypot(dx, dy);
    if (distance > 30 || distance === 0) return;
    const nx = dx / distance;
    const ny = dy / distance;
    const velocity = state.vx * nx + state.vy * ny;
    if (velocity < 0) {
      state.vx -= 2 * velocity * nx;
      state.vy -= 2 * velocity * ny;
      state.vx *= 1.08;
      state.vy *= 1.08;
      if (status) status.textContent = 'Bumper hit!';
    }
  };

  const animate = (now) => {
    const dt = Math.min(.032, (now - last) / 1000);
    last = now;
    const width = board.clientWidth;
    const height = board.clientHeight;
    states.forEach((state) => {
      if (!state.running || state.destroyed) return;
      state.vy += 520 * dt;
      const inSunbeam = sunSide === 'right'
        ? state.x > width * .5 && state.x < width * .94 && state.y < height * .72
        : state.x > width * .06 && state.x < width * .5 && state.y < height * .72;
      if (inSunbeam) {
        state.vx += (sunSide === 'right' ? 240 : -240) * dt;
        if (status && Math.random() < .025) status.textContent = 'Sunshine curves the ball!';
      }
      state.x += state.vx * dt;
      state.y += state.vy * dt;
      const boardRect = board.getBoundingClientRect();
      const sunRect = sun.getBoundingClientRect();
      const sunX = sunRect.left - boardRect.left + sunRect.width / 2;
      const sunY = sunRect.top - boardRect.top + sunRect.height / 2;
      const sunRadius = sunRect.width / 2;
      const sunDistance = Math.hypot(state.x - sunX, state.y - sunY);
      const touchingSun = sunDistance <= sunRadius + 10;
      if (!touchingSun) state.sunOverlap = false;
      if (touchingSun && !state.sunOverlap) {
        state.sunOverlap = true;
        state.sunHits += 1;
        if (state.sunHits === 1) {
          state.element.classList.add('pinball-ball--black');
          if (status) status.textContent = 'The Sun turned a ball black!';
        } else {
          state.running = false;
          state.destroyed = true;
          state.element.classList.add('pinball-ball--destroyed');
          if (status) {
            const remaining = states.filter((candidate) => !candidate.destroyed).length;
            status.textContent = remaining ? `The Sun destroyed a ball. ${remaining} left.` : 'The Sun destroyed all three balls!';
          }
          return;
        }
        if (sunDistance > 0) {
          const nx = (state.x - sunX) / sunDistance;
          const ny = (state.y - sunY) / sunDistance;
          const velocity = state.vx * nx + state.vy * ny;
          if (velocity < 0) {
            state.vx -= 2 * velocity * nx;
            state.vy -= 2 * velocity * ny;
          }
        }
      }
      if (state.x < 12 || state.x > width - 12) { state.x = Math.max(12, Math.min(width - 12, state.x)); state.vx *= -.92; }
      if (state.y < 12) { state.y = 12; state.vy = Math.abs(state.vy); }
      bumpers.forEach((bumper) => bounceFromBumper(state, bumper));
      if (state.y > height - 14) {
        state.y = height - 14;
        state.vy = -Math.max(320, Math.abs(state.vy) * .92);
        state.vx *= .98;
      }
      state.element.style.transform = `translate(${state.x - 10}px, ${state.y - 10}px)`;
    });
    requestAnimationFrame(animate);
  };

  board.querySelectorAll('[data-flipper]').forEach((button) => button.addEventListener('click', () => hitFlipper(button.dataset.flipper)));
  bumpers.forEach((bumper) => {
    let drag = null;
    bumper.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const boardRect = board.getBoundingClientRect();
      const bumperRect = bumper.getBoundingClientRect();
      drag = { offsetX: event.clientX - bumperRect.left, offsetY: event.clientY - bumperRect.top, boardRect };
      bumper.style.zIndex = String(++topBumperZ);
      bumper.setPointerCapture?.(event.pointerId);
      bumper.classList.add('pinball-bumper--dragging');
    });
    bumper.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const left = Math.max(0, Math.min(drag.boardRect.width - bumper.offsetWidth, event.clientX - drag.boardRect.left - drag.offsetX));
      const top = Math.max(0, Math.min(drag.boardRect.height - bumper.offsetHeight, event.clientY - drag.boardRect.top - drag.offsetY));
      bumper.style.left = `${left / drag.boardRect.width * 100}%`;
      bumper.style.top = `${top / drag.boardRect.height * 100}%`;
    });
    const stopDragging = () => { drag = null; bumper.classList.remove('pinball-bumper--dragging'); };
    bumper.addEventListener('pointerup', stopDragging);
    bumper.addEventListener('pointercancel', stopDragging);
  });
  board.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { event.preventDefault(); hitFlipper('left'); }
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { event.preventDefault(); hitFlipper('right'); }
  });
  window.addEventListener('resize', () => { if (!states.some((state) => state.running)) resetBall(); });
  resetBall();
  states.forEach((state, index) => {
    state.vx = index % 2 ? 130 : -130;
    state.vy = -(380 + index * 45);
    state.running = true;
  });
  requestAnimationFrame(animate);
}
