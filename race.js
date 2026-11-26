// 달리기 룰렛: 운동회 달리기, 수영 경기, 교실 종이비행기.
// index.html 의 명단(capsules), 설정, 소리, 공개 화면, 기록을 함께 쓴다(일반 <script> 끼리는 맨 위 선언을 공유).
//
// 공정성: 도착 순서를 출발 전에 암호학 난수(index 의 shuffle)로 먼저 정한다. 그다음 스킬이 섞인
// «원래 달리기»를 만들고, 재생 속도만 늘이고 줄여 정해진 순서대로 결승선을 넘게 한다.
// 스킬은 중간 순위를 뒤집는 연출일 뿐 결과를 바꾸지 않는다.

const RW = 1100, RH = 820;
const RMAX = 30;          // 한 경주에 달리는 최대 인원
const RLEAD = 2.4;        // 준비, 차렷, 출발! 시간
const RBASE = 28;         // 1등이 들어오는 시각(초)
const RSCREENS = 3;       // 코스 길이(화면 몇 개)
const rcv = document.getElementById('rc'), g = rcv.getContext('2d');
rcv.width = RW * DPR; rcv.height = RH * DPR; g.setTransform(DPR, 0, 0, DPR, 0, 0);
const RFONT = '"Jua", "Pretendard Variable", sans-serif';
const KIND_COLOR = { dash: '#ffd95a', stop: '#cdb8ff', slow: '#a8d8ff', back: '#ffb3c8' };
const MEDAL = ['#ffcf3f', '#cfd6de', '#e0a36a'];

const RACE_THEMES = {
  field: [
    { name: '전력 질주!', kind: 'dash', dur: 1.8, m: 2.3 },
    { name: '친구들 응원!', kind: 'dash', dur: 1.4, m: 1.9 },
    { name: '신발끈 풀림', kind: 'stop', dur: 1.6 },
    { name: '꽈당!', kind: 'stop', dur: 1.3, fall: true },
    { name: '맞바람', kind: 'slow', dur: 2.0, m: .4 },
  ],
  swim: [
    { name: '돌핀킥!', kind: 'dash', dur: 1.7, m: 2.4 },
    { name: '접영 스퍼트!', kind: 'dash', dur: 1.3, m: 3.0, fly: true },
    { name: '물 먹음 켁켁', kind: 'stop', dur: 1.8, cough: true },
    { name: '수경 김서림', kind: 'slow', dur: 2.0, m: .4, fog: true },
    { name: '파도 맞음', kind: 'back', dur: 1.0, m: -.6 },
  ],
  plane: [
    { name: '상승 기류!', kind: 'dash', dur: 1.7, m: 2.3 },
    { name: '선풍기 바람', kind: 'dash', dur: 1.3, m: 2.8 },
    { name: '공중제비', kind: 'stop', dur: 1.5, loop: true },
    { name: '급강하', kind: 'slow', dur: 1.8, m: .35, dip: true },
    { name: '창문 맞바람', kind: 'back', dur: 1.0, m: -.6 },
  ],
};

const race = {
  theme: 'field', state: 'idle',   // idle 기다림, run 달리는 중, result 결과 공개 중
  pick: 'first',                   // first 먼저 들어온 사람, last 늦게 들어온 사람을 뽑는다
  runners: [], src: null, lay: null, clock: 0, log: [], leader: null,
  leadSndAt: -9, skillSndAt: -9, rolled: false, went: false,
};

// ── 준비: 명단으로 줄 세우기 ──
function rLayout(n) {
  const TOP = n <= 12 ? 140 : 92, BOT = RH - 28, LANE = (BOT - TOP) / Math.max(n, 1);
  const START = 170, TRACK = (RW - 280) * RSCREENS;
  return { n, TOP, BOT, LANE, START, TRACK, FIN: START + TRACK, s: Math.max(.6, Math.min(1.35, LANE / 38)) };   // 캐릭터는 줄보다 조금 크게(살짝 겹쳐도 잘 보이게)
}

function rPrepare() {
  let pool = capsules.slice();
  if (pool.length > RMAX) pool = shuffle(pool).slice(0, RMAX);   // 많으면 30명을 무작위로
  pool.sort((a, b) => a.plugin.label.localeCompare(b.plugin.label, 'ko', { numeric: true }));   // 번호 순서대로 줄
  race.runners = pool.map((b, lane) => ({ b, lane, phase: Math.random() * 6, track: null, ev: [], T: 0, rank: 0 }));
  race.lay = rLayout(pool.length);
  race.src = capsules;
  race.clock = 0;
  race.camX = 0;
}

// ── 경주 계획: 도착 순서 먼저, 그다음 스킬 섞인 달리기 ──
function rPlan() {
  const rs = race.runners, sk = RACE_THEMES[race.theme];
  shuffle([...rs.keys()]).forEach((ri, rank) => { rs[ri].rank = rank; });
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const bad = sk.filter(s => s.kind !== 'dash'), good = sk.filter(s => s.kind === 'dash');
  const n = rs.length, last = race.pick === 'last';
  for (const r of rs) {
    let ev;
    if (!last && r.rank === 0) {        // 1등: 초반에 손해, 막판에 질주 → 역전
      ev = [{ at: 3 + Math.random() * 4, s: pick(bad) }, { at: 9 + Math.random() * 2, s: pick(sk) },
            { at: 13.5 + Math.random() * 1.5, s: pick(good) }];
    } else if (!last && r.rank === 1) { // 2등도 막판에 따라붙어 사진 판정처럼
      ev = [{ at: 2 + Math.random() * 8, s: pick(sk) }, { at: 14 + Math.random() * 1.5, s: pick(good) }];
    } else if (last && r.rank === n - 1) {   // 꼴찌: 초반에 앞서가다 막판에 넘어지거나 낮잠
      ev = [{ at: 2 + Math.random() * 3, s: pick(good) }, { at: 8 + Math.random() * 2, s: pick(sk) },
            { at: 13 + Math.random() * 2, s: pick(bad) }];
    } else if (last && r.rank === n - 2) {   // 끝에서 둘째도 막판에 붙잡혀 아슬아슬하게
      ev = [{ at: 2 + Math.random() * 8, s: pick(sk) }, { at: 13.5 + Math.random() * 2, s: pick(bad) }];
    } else {
      ev = Array.from({ length: 3 + Math.floor(Math.random() * 2) }, () => ({ at: 1.5 + Math.random() * 15, s: pick(sk) }));
    }
    ev.sort((a, b) => a.at - b.at);
    for (let j = 1; j < ev.length; j++) ev[j].at = Math.max(ev[j].at, ev[j - 1].at + ev[j - 1].s.dur + .5);
    // 원래 달리기(1/60초 간격 위치 기록)
    const track = [0]; let p = 0, t = 0;
    const ph = Math.random() * 6, w = .4 + Math.random() * .5;
    while (p < 1 && t < 90) {
      t += 1 / 60;
      let v = .056 * (1 + .2 * Math.sin(t * w + ph));
      const e = ev.find(e => t >= e.at && t < e.at + e.s.dur);
      if (e) v = e.s.kind === 'stop' ? 0 : e.s.kind === 'back' ? .056 * e.s.m : v * e.s.m;
      p = Math.max(0, p + v / 60);
      track.push(Math.min(p, 1));
    }
    const tau = (track.length - 1) / 60;
    const gap = r.rank === 0 ? 0 : r.rank === 1 ? .35 : .8 + (r.rank - 2) * .35;
    r.T = RBASE + gap; r.k = tau / r.T; r.track = track;
    r.ev = ev.map(e => ({ s: e.s, show: e.at / r.k, end: (e.at + e.s.dur) / r.k, done: false }));
  }
}

function rPos(r, t) {
  if (!r.track || t <= 0) return 0;
  const idx = t * r.k * 60;
  if (idx >= r.track.length - 1) return 1 + Math.min(.06, (t - r.T) * .03);   // 들어온 뒤 조금 더 감
  const a = Math.floor(idx), f = idx - a;
  return r.track[a] * (1 - f) + r.track[a + 1] * f;
}

// ── 시작과 끝 ──
function raceStart() {
  if (race.state !== 'idle' || claw.state !== 'idle') return;
  rPrepare();
  if (!race.runners.length) return;
  round.total = Math.min(pickCount(), race.runners.length);
  rPlan();
  Object.assign(race, { state: 'run', clock: 0, camX: 0, log: [], leader: null, rolled: false, went: false, leadSndAt: -9, skillSndAt: -9 });
  document.body.classList.add('stage');   // 달리는 동안 경주 화면만 창 가득
  sound.bgm('play');
  sound.roll(RLEAD - .3);
  els.tries.textContent = '준비!';
  updateUI();
}

// 뽑히는 주자(뽑히는 차례대로): 먼저 들어온 쪽이면 1등부터, 늦게 들어온 쪽이면 꼴찌부터
function rPicked() {
  const rs = [...race.runners].sort((a, b) => a.rank - b.rank);
  if (race.pick === 'last') rs.reverse();
  return rs.slice(0, round.total);
}
function rWinners() { return rPicked().map(r => r.b); }

function rShowResult() {
  race.state = 'result';
  const ws = rWinners(), many = ws.length > 1;
  showReveal({ race: true, winners: ws }, {
    c: ws[0].plugin.c, c2: ws[0].plugin.c2, who: ws[0].plugin.title,
    tag: race.pick === 'last' ? '가장 늦게 들어왔어요!' : '1등으로 들어왔어요!',
    chips: many ? ws.map((b, i) => chip('span', b, i + 1)) : [],
    hint: HINT_CLOSE, autoNext: false,
  });
}

// index 의 closeReveal 이 부른다
function raceDone(ws) {
  ws.forEach(b => els.log.appendChild(chip('li', b, els.log.children.length + 1)));
  els.log.scrollTop = els.log.scrollHeight;
  if (els.removeWinner.checked) {   // 인형 뽑기 기계에서도 함께 빠진다
    ws.forEach(b => Composite.remove(world, b));
    capsules = capsules.filter(b => !ws.includes(b));
  }
  race.state = 'idle';
  race.slow = 1;
  document.body.classList.remove('stage');
  sound.bgm('stop');
  els.tries.textContent = '준비 완료'; showGauge(0, '');
  updateUI();
}

// ── 매 프레임 진행 ──
function rTick(dt) {
  race.clock += dt;
  const t = race.clock - RLEAD, rs = race.runners;
  if (!race.went && t >= 0) { race.went = true; sound.go(); }
  if (t < 0) { els.tries.textContent = t < -1.6 ? '준비!' : t < -.8 ? '차렷!' : '출발!'; return; }
  for (const r of rs) for (const e of r.ev) {
    if (!e.done && t >= e.show) {
      e.done = true;
      r.burst = { t: e.show, kind: e.s.kind };   // «펑» 효과용
      race.log.unshift({ text: `${r.b.plugin.title} ${e.s.name}`, kind: e.s.kind });
      race.log.length = Math.min(race.log.length, 2);
      if (t - race.skillSndAt > .35) { race.skillSndAt = t; sound.skill(e.s.kind); }
    }
  }
  // 알림판 주인공: 먼저 들어온 쪽이면 선두, 늦게 들어온 쪽이면 지금 꼴찌. 결정되면 그 주자로 고정
  const last = race.pick === 'last';
  const key = rs.find(r => r.rank === (last ? rs.length - 1 : 0));   // 최종 1등 또는 꼴찌
  const running = rs.filter(r => t < r.T);
  const now = !running.length ? key : last
    ? rs.reduce((a, b) => rPos(b, t) < rPos(a, t) ? b : a)
    : running.reduce((a, b) => rPos(b, t) > rPos(a, t) ? b : a);
  const decided = t >= key.T, shown = decided ? key : now;
  if (shown !== race.leader) {
    if (race.leader && t - race.leadSndAt > .5 && !decided) { race.leadSndAt = t; sound.lead(); }
    race.leader = shown;
  }
  // 카메라: 먼저 들어온 쪽이면 선두를 화면 70% 자리에, 늦게 들어온 쪽이면 꼴찌를 30% 자리에
  {
    const L = race.lay, pool = running.length ? running : rs;
    const xs = pool.map(r => L.START + L.TRACK * Math.min(1, rPos(r, t)));
    const tgt = last ? Math.min(...xs) - RW * .3 : Math.max(...xs) - RW * .7;
    const goal = Math.max(0, Math.min(L.FIN + 110 - RW, tgt));
    race.camX += (goal - race.camX) * Math.min(1, dt * 2.5);
  }
  const lp = Math.min(1, rPos(now, t));
  const word = last ? '꼴찌' : (decided ? '1등' : '선두');
  showGauge(Math.max(1, Math.ceil(lp * 5)), `${word} ${shown.b.plugin.title}`);
  els.tries.textContent = decided ? (last ? '꼴찌 결정!' : '결승!') : '달리는 중';
  if (!race.rolled && lp > .86) { race.rolled = true; sound.roll(2.2); }   // 막판 드럼롤
  if (race.state === 'run' && t >= Math.max(...rPicked().map(r => r.T)) + 1) rShowResult();
}

// ── 결승선 클로즈업: 승부가 갈리는 순간 앞뒤로 결승선 쪽을 키우고 조금 느리게 ──
function rCamera(t) {
  const rs = race.runners, L = race.lay, none = { z: 1, x: 0, y: 0 };
  if (race.state === 'idle' || !rs.length || !rs[0].track) return none;
  const n = rs.length, last = race.pick === 'last';
  const key = rs.find(r => r.rank === (last ? n - 1 : 0));                 // 승부의 주인공(1등 또는 꼴찌)
  const rival = rs.find(r => r.rank === (last ? n - 2 : 1)) || key;        // 맞붙은 상대
  const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
  const a = ease((t - (key.T - 2.6)) / .7) * (1 - ease((t - (key.T + .9)) / .7));
  if (a <= .001) return none;
  // 두 주자가 함께 들어오면 둘을 담는 만큼(최대 2.2배), 너무 멀어 1.7배도 안 되면 주인공만 따라가 1.9배
  const y1 = laneY(L, key.lane), y2 = laneY(L, rival.lane);
  const fit = RH * .8 / (Math.abs(y1 - y2) + L.LANE * 3);
  const zMax = fit >= 1.7 ? Math.min(2.2, fit) : 1.9, fy = fit >= 1.7 ? (y1 + y2) / 2 : y1;
  const z = 1 + a * (zMax - 1);
  const x = Math.max(0, Math.min(RW - RW / z, (L.FIN - race.camX) - RW * .66 / z));
  const y = Math.max(0, Math.min(RH - RH / z, fy - RH * .55 / z));
  return { z, x, y };
}

// ── Codex 로 그린 캐릭터 그림: 초록 자리(가면)에 참가자 색을 곱해 입힌다 ──
// 픽셀을 읽지 않고 합성만 하므로 file:// 로 열어도(캔버스 오염) 문제없다
const SPRITES = {};
for (const n of ['kid-a', 'kid-b', 'kid-fall', 'swim-a', 'swim-b', 'swim-cough', 'plane']) {
  const base = new Image(), mask = new Image();
  base.src = `sprites/${n}.png`; mask.src = `sprites/${n}-mask.png`;
  SPRITES[n] = { base, mask, cache: new Map() };
}
function sprite(n, color) {
  const sp = SPRITES[n];
  if (!sp || !sp.base.complete || !sp.mask.complete || !sp.base.naturalWidth || !sp.mask.naturalWidth) return null;
  let out = sp.cache.get(color);
  if (out) return out;
  const w = sp.base.naturalWidth, h = sp.base.naturalHeight;
  const tint = document.createElement('canvas'); tint.width = w; tint.height = h;
  const t = tint.getContext('2d');
  t.drawImage(sp.mask, 0, 0); t.globalCompositeOperation = 'source-in'; t.fillStyle = color; t.fillRect(0, 0, w, h);
  out = document.createElement('canvas'); out.width = w; out.height = h;
  const o = out.getContext('2d');
  o.drawImage(sp.base, 0, 0);
  o.globalCompositeOperation = 'multiply'; o.drawImage(tint, 0, 0);       // 회색 명암 × 참가자 색
  o.globalCompositeOperation = 'destination-in'; o.drawImage(sp.base, 0, 0);   // 바깥은 다시 투명하게
  sp.cache.set(color, out);
  return out;
}
// 그림 한 장을 원점 기준으로 그린다. w: 그릴 폭, ax/ay: 원점이 그림의 어디인지(0~1)
function drawSprite(n, color, w, ax, ay) {
  const im = sprite(n, color);
  if (!im) return false;
  const h = w * im.height / im.width;
  g.drawImage(im, -w * ax, -h * ay, w, h);
  return true;
}
// 테마별 그림(그림이 없으면 false → 코드 그림으로 대신)
function spriteRunner(theme, c, ph, e, t) {
  const stop = e && e.s.kind === 'stop';
  if (theme === 'field') {
    if (e && e.s.fall) return drawSprite('kid-fall', c, 74, .5, .9);
    const bob = stop ? 0 : -Math.abs(Math.sin(ph * 2.2)) * 3;
    g.translate(0, bob);
    const ok = drawSprite(stop || Math.sin(ph * 2.2) > 0 ? 'kid-a' : 'kid-b', c, 50, .5, .78);
    if (ok && stop) { g.fillStyle = '#7fc8ff'; g.beginPath(); g.arc(20, -40, 4, 0, 7); g.fill(); }   // 땀방울
    return ok;
  }
  if (theme === 'swim') {
    if (e && e.s.cough) {
      const ok = drawSprite('swim-cough', c, 80, .5, .55);
      g.fillStyle = 'rgba(255,255,255,.9)';
      for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(26 + k * 6, -20 - ((t * 22 + k * 7) % 16), 3 + k * .7, 0, 7); g.fill(); }
      return ok;
    }
    g.translate(0, Math.sin(ph) * 1.5);
    return drawSprite(Math.sin(ph * 1.1) > 0 ? 'swim-a' : 'swim-b', c, 80, .5, .55);
  }
  let dy = 4 * Math.sin(ph * .45), rot = 0;
  const prog = e ? Math.min(1, (t - e.show) / (e.end - e.show)) : 0;
  if (e && e.s.dip) dy += 12 * Math.sin(Math.PI * prog);
  if (e && e.s.loop) rot = -Math.PI * 2 * prog;
  g.translate(0, dy); g.rotate(rot + (e && e.s.kind === 'back' ? .25 : 0));
  return drawSprite('plane', c, 62, .5, .5);
}

// ── 스킬 효과: 터지는 순간의 «펑»과, 이어지는 동안의 꼬리·별·바람·화살표 ──
function drawBurst(kind, age) {   // age: 터진 뒤 지난 초(0~.6)
  const u = age / .6, col = KIND_COLOR[kind];
  g.globalAlpha = 1 - u;
  g.strokeStyle = col; g.lineWidth = 8 * (1 - u) + 2;
  g.beginPath(); g.arc(0, -6, 16 + u * 52, 0, 7); g.stroke();
  g.lineCap = 'round'; g.lineWidth = 4;
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + .3, r1 = 24 + u * 40, r2 = r1 + 14;
    g.beginPath(); g.moveTo(Math.cos(a) * r1, -6 + Math.sin(a) * r1); g.lineTo(Math.cos(a) * r2, -6 + Math.sin(a) * r2); g.stroke();
  }
  g.globalAlpha = 1;
}
function drawAura(e, t) {   // 캐릭터 뒤에 깔리는 것
  if (!e) return;
  const col = KIND_COLOR[e.s.kind];
  const gr = g.createRadialGradient(0, -6, 4, 0, -6, 46);
  gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalAlpha = .55 + .2 * Math.sin(t * 12); g.fillStyle = gr; g.beginPath(); g.arc(0, -6, 46, 0, 7); g.fill(); g.globalAlpha = 1;
  if (e.s.kind === 'dash') {   // 혜성 꼬리 + 속도선
    const tail = g.createLinearGradient(-110, 0, -20, 0);
    tail.addColorStop(0, 'rgba(255,217,90,0)'); tail.addColorStop(1, 'rgba(255,217,90,.85)');
    g.fillStyle = tail; g.beginPath(); g.moveTo(-20, -22); g.lineTo(-110, -4); g.lineTo(-20, 12); g.closePath(); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 3.5; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const yy = -20 + k * 10, off = (t * 260 + k * 37) % 40;
      g.beginPath(); g.moveTo(-34 - off, yy); g.lineTo(-64 - off, yy); g.stroke();
    }
  }
}
function drawOverlay(e, t) {   // 캐릭터 앞에 얹히는 것
  if (!e) return;
  const k = e.s.kind;
  if (k === 'stop') {   // 머리 위를 도는 별 셋
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + i * 2.1, x = Math.cos(a) * 20, y = -48 + Math.sin(a) * 6;
      g.fillStyle = '#ffd95a'; g.strokeStyle = '#33244f'; g.lineWidth = 1.5;
      g.beginPath();
      for (let j = 0; j < 10; j++) { const r = j % 2 ? 3.2 : 7.5, b = j * Math.PI / 5 - Math.PI / 2; g.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r); }
      g.closePath(); g.fill(); g.stroke();
    }
  } else if (k === 'slow') {   // 앞에서 불어오는 맞바람 물결
    g.strokeStyle = '#a8d8ff'; g.lineWidth = 3.5; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x = 70 - ((t * 120 + i * 30) % 90), y = -26 + i * 14;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 10, y - 7, x - 20, y); g.quadraticCurveTo(x - 30, y + 7, x - 40, y); g.stroke();
    }
  } else if (k === 'back') {   // 뒤로 밀리는 화살표
    g.fillStyle = '#ff6f91'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const x = 46 - ((t * 140 + i * 40) % 80);
      g.beginPath(); g.moveTo(x, -10); g.lineTo(x + 14, -22); g.lineTo(x + 14, -15); g.lineTo(x + 30, -15); g.lineTo(x + 30, -5);
      g.lineTo(x + 14, -5); g.lineTo(x + 14, 2); g.closePath(); g.fill(); g.stroke();
    }
  }
}
function drawKindIcon(kind, cx, cy, r) {   // 말풍선 앞 동그라미 아이콘
  g.fillStyle = '#33244f'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  g.fillStyle = KIND_COLOR[kind]; g.strokeStyle = KIND_COLOR[kind]; g.lineWidth = r * .28; g.lineCap = 'round'; g.lineJoin = 'round';
  const s = r / 10;
  g.beginPath();
  if (kind === 'dash') { g.moveTo(cx + 2 * s, cy - 7 * s); g.lineTo(cx - 4 * s, cy + 1 * s); g.lineTo(cx + 1 * s, cy + 1 * s); g.lineTo(cx - 2 * s, cy + 7 * s); g.lineTo(cx + 5 * s, cy - 1.5 * s); g.lineTo(cx, cy - 1.5 * s); g.closePath(); g.fill(); }
  else if (kind === 'stop') { g.moveTo(cx, cy - 6 * s); g.lineTo(cx, cy + 1.5 * s); g.stroke(); g.beginPath(); g.arc(cx, cy + 5.5 * s, 1.4 * s, 0, 7); g.fill(); }
  else if (kind === 'slow') { for (const dy of [-3.5, 3.5]) { g.moveTo(cx - 6 * s, cy + dy * s); g.quadraticCurveTo(cx - 3 * s, cy + (dy - 3) * s, cx, cy + dy * s); g.quadraticCurveTo(cx + 3 * s, cy + (dy + 3) * s, cx + 6 * s, cy + dy * s); } g.stroke(); }
  else { g.moveTo(cx - 6 * s, cy); g.lineTo(cx + 6 * s, cy); g.moveTo(cx - 6 * s, cy); g.lineTo(cx - 1 * s, cy - 5 * s); g.moveTo(cx - 6 * s, cy); g.lineTo(cx - 1 * s, cy + 5 * s); g.stroke(); }
}

// ── 그리기 도움 ──
function rRect(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function rText(s, x, y, size, color, align = 'center', stroke) {
  g.font = `${size}px ${RFONT}`; g.textAlign = align; g.textBaseline = 'middle';
  if (stroke) { g.lineJoin = 'round'; g.lineWidth = stroke[1]; g.strokeStyle = stroke[0]; g.strokeText(s, x, y); }
  g.fillStyle = color; g.fillText(s, x, y);
}
const laneY = (L, i) => L.TOP + L.LANE * (i + .5);

// ── 배경: 보이는 범위 [x0, x1](세상 좌표)만 그린다 ──
// 위쪽 장식은 카메라 이동의 절반만큼 따라 옮겨, 화면에서는 절반 속도로 흐른다(시차로 깊이감)
const MARKS = [.25, .5, .75];   // 25m, 50m, 75m 거리 표지
function distanceMarks(L, x0, x1, color, signBg, signFg) {
  for (const q of MARKS) {
    const x = L.START + L.TRACK * q;
    if (x < x0 - 60 || x > x1 + 60) continue;
    g.strokeStyle = color; g.lineWidth = 3; g.setLineDash([10, 10]);
    g.beginPath(); g.moveTo(x, L.TOP); g.lineTo(x, L.BOT); g.stroke(); g.setLineDash([]);
    rRect(x - 34, L.TOP - 34, 68, 28, 8); g.fillStyle = signBg; g.fill();
    g.strokeStyle = '#33244f'; g.lineWidth = 2; g.stroke();
    rText(`${Math.round(q * 100)}m`, x, L.TOP - 19, 19, signFg);
  }
}
function bunting(x0, x1, par, y0, sag, colors, step) {   // 기둥 사이 360마다 처지는 줄과 삼각 깃발
  const off = race.camX * par;
  g.strokeStyle = '#7a6a5a'; g.lineWidth = 1.5; g.beginPath();
  const sx = Math.floor((x0 - off) / 8) * 8;
  for (let x = sx; x <= x1 - off + 8; x += 8) { const y = y0 + sag * Math.sin(Math.PI * (((x % 360) + 360) % 360) / 360); x === sx ? g.moveTo(x + off, y) : g.lineTo(x + off, y); }
  g.stroke();
  const fx = Math.floor((x0 - off) / step) * step;
  for (let x = fx, k = Math.round(fx / step); x < x1 - off + step; x += step, k++) {
    const y = y0 + sag * Math.sin(Math.PI * (((x % 360) + 360) % 360) / 360);
    g.fillStyle = colors(k);
    g.beginPath(); g.moveTo(x + off, y); g.lineTo(x + off + step * .72, y + 1); g.lineTo(x + off + step * .36, y + 17); g.fill();
  }
}

function bgField(L, tapeUp, x0, x1) {
  const w = x1 - x0;
  let gr = g.createLinearGradient(0, 0, 0, L.TOP); gr.addColorStop(0, '#bfe6ff'); gr.addColorStop(1, '#eaf8ff');
  g.fillStyle = gr; g.fillRect(x0, 0, w, L.TOP);
  const off = race.camX * .5, hs = Math.floor((x0 - off) / 60) * 60;   // 언덕(절반 속도)
  g.fillStyle = '#8fd07a'; g.beginPath(); g.moveTo(hs + off, L.TOP - 26);
  for (let x = hs; x <= x1 - off + 60; x += 60) g.quadraticCurveTo(x + off + 30, L.TOP - 46, x + off + 60, L.TOP - 26);
  g.lineTo(x1 + 60, RH); g.lineTo(hs + off, RH); g.fill();
  bunting(x0, x1, .5, 14, 24, k => `hsl(${(((k * 53) % 360) + 360) % 360} 80% 62%)`, 30);
  bunting(x0, x1, .5, 36, 16, k => `hsl(${(((k * 97 + 40) % 360) + 360) % 360} 80% 62%)`, 30);
  g.fillStyle = '#d8714b'; g.fillRect(x0, L.TOP - 8, w, L.BOT - L.TOP + 16);
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = L.n > 16 ? 1.2 : 2;
  for (let k = 0; k <= L.n; k++) { g.beginPath(); g.moveTo(x0, L.TOP + L.LANE * k); g.lineTo(x1, L.TOP + L.LANE * k); g.stroke(); }
  g.lineWidth = 4; g.beginPath(); g.moveTo(L.START, L.TOP); g.lineTo(L.START, L.BOT); g.stroke();
  distanceMarks(L, x0, x1, 'rgba(255,255,255,.55)', '#ffffff', '#33244f');
  for (let y = L.TOP, k = 0; y < L.BOT; y += 12, k++) for (let c = 0; c < 2; c++) {
    g.fillStyle = (k + c) % 2 ? '#fff' : '#33244f'; g.fillRect(L.FIN + c * 12 - 12, y, 12, Math.min(12, L.BOT - y));
  }
  if (tapeUp) { g.strokeStyle = '#ff3d6e'; g.lineWidth = 3; g.beginPath(); g.moveTo(L.FIN + 14, L.TOP - 6); g.lineTo(L.FIN + 14, L.BOT + 6); g.stroke(); }
}

function bgSwim(L, x0, x1) {
  const left = L.START - 44, right = L.FIN + 18, w = x1 - x0;
  g.fillStyle = '#e7f3f6'; g.fillRect(x0, 0, w, RH);
  g.strokeStyle = 'rgba(110,165,185,.3)'; g.lineWidth = 1;   // 데크 타일
  for (let x = Math.floor(x0 / 28) * 28; x < x1; x += 28) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, RH); g.stroke(); }
  for (let y = 0; y < RH; y += 28) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  bunting(x0, x1, .5, 18, 12, k => ['#e63950', '#ffffff', '#2f6fd6'][((k % 3) + 3) % 3], 28);   // 배영 깃발
  // 물
  const a = Math.max(left, x0), b = Math.min(right, x1);
  if (b > a) {
    const wg = g.createLinearGradient(0, L.TOP, 0, L.BOT); wg.addColorStop(0, '#46bde4'); wg.addColorStop(1, '#1d82c2');
    g.fillStyle = wg; g.fillRect(a, L.TOP - 8, b - a, L.BOT - L.TOP + 16);
    g.fillStyle = 'rgba(255,255,255,.07)';   // 레인 구분: 물 색을 옅게 번갈아
    for (let k = 0; k < L.n; k += 2) g.fillRect(a, L.TOP + L.LANE * k, b - a, L.LANE);
    const tt = performance.now() / 1000;   // 물결 반짝임
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2;
    for (let k = 0; k < 80; k++) {
      const x = left + ((k * 173 + tt * 18) % (right - left - 40)), y = L.TOP + 6 + (k * 61) % (L.BOT - L.TOP - 12);
      if (x < x0 - 40 || x > x1) continue;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 9, y - 4, x + 18, y); g.quadraticCurveTo(x + 27, y + 4, x + 36, y); g.stroke();
    }
    g.fillStyle = 'rgba(12,45,100,.32)';   // 레인 바닥 가운데 줄과 끝의 T
    for (let k = 0; k < L.n; k++) {
      const y = laneY(L, k), hh = Math.max(2, L.LANE * .1);
      g.fillRect(Math.max(a, left + 50), y - hh / 2, Math.min(b, right - 50) - Math.max(a, left + 50), hh);
      g.fillRect(right - 54, y - L.LANE * .3, hh, L.LANE * .6);
    }
    g.strokeStyle = '#c9e3ea'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(a, L.TOP - 8); g.lineTo(b, L.TOP - 8); g.moveTo(a, L.BOT + 8); g.lineTo(b, L.BOT + 8); g.stroke();
  }
  distanceMarks(L, x0, x1, 'rgba(255,255,255,.4)', '#ffffff', '#1d82c2');
  for (let k = 0; k < L.n; k++) {   // 출발대
    const y = laneY(L, k), hh = Math.min(26, L.LANE * .7);
    rRect(left - 26, y - hh / 2, 22, hh, 4); g.fillStyle = '#ffffff'; g.fill();
    g.strokeStyle = '#b9cdd5'; g.lineWidth = 1.5; g.stroke();
  }
  g.fillStyle = '#ffd95a'; g.fillRect(right - 6, L.TOP - 8, 6, L.BOT - L.TOP + 16);   // 터치 패드
}

const DOODLES = ['가자!', '쉬잉~', '화이팅', '날아라!', '슝~', '최고!'];   // 기호 대신 글자(윈도우에서 이모지로 바뀌지 않게)
function bgPlane(L, x0, x1) {
  const w = x1 - x0;
  g.fillStyle = '#2f5446'; g.fillRect(x0, 0, w, RH);
  g.fillStyle = '#8b5e3c'; g.fillRect(x0, 0, w, 12); g.fillRect(x0, RH - 12, w, 12);   // 칠판 틀
  g.fillStyle = 'rgba(255,255,255,.04)';   // 분필 자국
  for (let x = Math.floor(x0 / 300) * 300; x < x1; x += 300) for (let k = 0; k < 12; k++) g.fillRect(x + (k * 211) % 300, (k * 97) % (RH - 60) + 14, 130, 2);
  // 칠판 낙서(절반 속도)
  const off = race.camX * .5, ds = Math.floor((x0 - off) / 520) * 520;
  for (let x = ds; x < x1 - off + 520; x += 520) {
    const k = ((Math.round(x / 520) % DOODLES.length) + DOODLES.length) % DOODLES.length;
    rText(DOODLES[k], x + off + 200, 52, 30, 'rgba(255,255,255,.55)');
  }
  g.strokeStyle = 'rgba(255,255,255,.1)'; g.setLineDash([10, 12]); g.lineWidth = 1.5;
  for (let k = 1; k < L.n; k++) { g.beginPath(); g.moveTo(x0, L.TOP + L.LANE * k); g.lineTo(x1, L.TOP + L.LANE * k); g.stroke(); }
  g.setLineDash([]);
  distanceMarks(L, x0, x1, 'rgba(255,255,255,.3)', 'rgba(255,255,255,.9)', '#2f5446');
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; g.setLineDash([4, 7]);
  g.beginPath(); g.moveTo(L.FIN, L.TOP - 6); g.lineTo(L.FIN, L.BOT); g.stroke(); g.setLineDash([]);
  rText('도착', L.FIN + 30, L.TOP - 16, 22, 'rgba(255,255,255,.85)');
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(L.START, L.TOP - 6); g.lineTo(L.START, L.BOT); g.stroke();
}

// ── 주자(원점 기준으로 그리고, 바깥에서 줄 높이만큼 키우고 줄인다) ──
function drawKid(c, ph, e) {
  const still = e && e.s.kind === 'stop', sw = still ? 0 : 8 * Math.sin(ph);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(0, 18, 14, 4, 0, 0, 7); g.fill();
  g.save();
  if (e && e.s.fall) { g.translate(0, 16); g.rotate(-1.25); g.translate(0, -16); }
  g.lineCap = 'round'; g.strokeStyle = '#3b3550'; g.lineWidth = 4.5;
  g.beginPath(); g.moveTo(0, 2); g.lineTo(sw, 17); g.moveTo(0, 2); g.lineTo(-sw, 17); g.stroke();
  rRect(-8, -14, 16, 18, 5); g.fillStyle = '#fff'; g.fill();
  g.strokeStyle = '#f2c49c'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(-6, -10); g.lineTo(-6 - sw, -1); g.moveTo(6, -10); g.lineTo(6 + sw, -1); g.stroke();
  g.fillStyle = '#f5cfa8'; g.beginPath(); g.arc(1, -23, 9.5, 0, 7); g.fill();
  g.fillStyle = '#3b2f2f'; g.beginPath(); g.arc(1, -25, 9.5, Math.PI * 1.05, Math.PI * 1.95); g.fill();
  g.fillStyle = c; g.fillRect(-9, -28, 20, 4.5);
  g.fillStyle = '#33244f'; g.beginPath(); g.arc(5, -22, 1.6, 0, 7); g.fill();
  g.restore();
  if (still && !e.s.fall) { g.fillStyle = '#7fc8ff'; g.beginPath(); g.arc(13, -30, 3, 0, 7); g.fill(); }
}

function drawSwimmer(c, ph, e, t) {
  const still = e && e.s.kind === 'stop', fast = e && e.s.kind === 'dash';
  // 물속 몸(반투명)
  g.fillStyle = 'rgba(255,210,175,.42)'; g.beginPath(); g.ellipse(-12, 4, 19, 6, 0, 0, 7); g.fill();
  // 발차기 물보라
  if (!still) {
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (let k = 0; k < (fast ? 5 : 3); k++) { g.beginPath(); g.arc(-32 - k * 6, 2 + Math.sin(ph * 2 + k) * 3, (fast ? 4 : 3) - k * .5, 0, 7); g.fill(); }
  }
  // 팔 젓기: 두 팔이 번갈아 머리 앞쪽으로 원을 그림(접영이면 두 팔 함께)
  g.lineCap = 'round'; g.strokeStyle = '#f2c49c'; g.lineWidth = 4.5;
  const arms = e && e.s.fly ? [0, 0] : [0, Math.PI];
  for (const off of arms) {
    const a = (still ? 2.4 : ph * .9) + off, up = Math.sin(a) > 0;
    g.globalAlpha = up ? 1 : .35;
    g.beginPath(); g.moveTo(2, -1); g.lineTo(2 + 17 * Math.cos(a), -1 - 13 * Math.sin(a)); g.stroke();
    if (!still && Math.cos(a) > .93) { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(20, 4, 3.5, 0, 7); g.arc(24, 1, 2.5, 0, 7); g.fill(); }
  }
  g.globalAlpha = 1;
  // 머리: 수영모(참가자 색)와 수경
  g.fillStyle = '#f5cfa8'; g.beginPath(); g.arc(10, still ? -4 : 0, 8, 0, 7); g.fill();
  g.fillStyle = c; g.beginPath(); g.arc(10, (still ? -4 : 0) - 1, 8.7, Math.PI * .92, Math.PI * 2.08); g.fill();
  g.fillStyle = e && e.s.fog ? '#eef7ff' : '#33244f';
  g.beginPath(); g.ellipse(15, still ? -3 : 1, 3.4, 2.4, 0, 0, 7); g.fill();
  // 머리 앞 물결
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2;
  g.beginPath(); g.arc(19, 6, 6, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
  if (e && e.s.cough) {   // 물 먹음: 거품이 올라옴
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(20 + k * 5, -14 - ((t * 22 + k * 7) % 16), 2.5 + k * .6, 0, 7); g.fill(); }
  }
}

function drawPlane(c, ph, e, t) {
  let dy = 4 * Math.sin(ph * .45), rot = 0;
  const prog = e ? Math.min(1, (t - e.show) / (e.end - e.show)) : 0;
  if (e && e.s.dip) dy += 12 * Math.sin(Math.PI * prog);
  if (e && e.s.loop) rot = -Math.PI * 2 * prog;
  g.save(); g.translate(0, dy); g.rotate(rot + (e && e.s.kind === 'back' ? .25 : 0));
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(24, 0); g.lineTo(-18, -12); g.lineTo(-10, 0); g.lineTo(-18, 10); g.closePath(); g.fill();
  g.fillStyle = '#dfe5ea'; g.beginPath(); g.moveTo(24, 0); g.lineTo(-10, 0); g.lineTo(-18, 10); g.closePath(); g.fill();
  g.fillStyle = c; g.beginPath(); g.moveTo(24, 0); g.lineTo(10, -5); g.lineTo(10, 3); g.closePath(); g.fill();
  g.restore();
}

function drawEffect(e) {
  if (!e) return;
  if (e.s.kind === 'dash') {
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const yy = -12 + k * 10; g.beginPath(); g.moveTo(-30 - k * 6, yy); g.lineTo(-52 - k * 8, yy); g.stroke(); }
  } else if (e.s.kind === 'back' || e.s.kind === 'slow') {
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(26 + k * 9, -8 + k * 7, 4 + k, 0, 7); g.fill(); }
  }
}

// ── 화면 ──
function rDraw() {
  const L = race.lay, t = race.clock - RLEAD, rs = race.runners;
  if (!L) return;
  const cam = rCamera(t);
  race.slow = cam.z > 1.3 ? .6 : 1;   // 확대 중에는 느리게
  const vx = race.camX + cam.x, x0 = vx, x1 = vx + RW / cam.z;   // 보이는 세상 범위
  g.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, -vx * cam.z * DPR, -cam.y * cam.z * DPR);
  const planned = rs.length && rs[0].track;
  const first = planned ? rs.find(r => r.rank === 0) : null;
  const key = planned ? rs.find(r => r.rank === (race.pick === 'last' ? rs.length - 1 : 0)) : null;
  if (race.theme === 'field') bgField(L, !first || t < first.T, x0, x1);
  else if (race.theme === 'swim') bgSwim(L, x0, x1);
  else bgPlane(L, x0, x1);

  if (!rs.length) { rText('위에서 «참가자 채우기»를 눌러요', RW / 2, RH / 2, 34, '#fff', 'center', ['#33244f', 8]); return; }

  const tagH = Math.max(18, Math.min(40, L.LANE * .98)), tagF = Math.round(tagH * .78);   // 번호가 주인공: 레인 높이만큼
  const active = [];
  for (const r of rs) {
    const p = rPos(r, t), x = L.START + L.TRACK * p, y = laneY(L, r.lane);
    if (race.state !== 'idle') r.phase += (p - rPos(r, t - .05)) / .05 * 2.2;
    const e = r.ev.find(e => t >= e.show && t < e.end && race.state !== 'idle');
    g.save(); g.translate(x, y); g.scale(L.s, L.s);
    drawAura(e, t);
    g.save();
    if (!spriteRunner(race.theme, r.b.plugin.c, r.phase, e, t)) {   // 그림이 없으면 코드 그림
      g.restore(); g.save(); drawEffect(e);
      if (race.theme === 'field') drawKid(r.b.plugin.c, r.phase, e);
      else if (race.theme === 'swim') drawSwimmer(r.b.plugin.c, r.phase, e, t);
      else drawPlane(r.b.plugin.c, r.phase, e, t);
    }
    g.restore();
    drawOverlay(e, t);
    if (r.burst && race.state !== 'idle' && t - r.burst.t >= 0 && t - r.burst.t < .6) drawBurst(r.burst.kind, t - r.burst.t);
    g.restore();
    // 번호(이름) 꼬리표: 주자 왼쪽
    g.font = `${tagF}px ${RFONT}`;
    const back = (race.theme === 'swim' ? 42 : race.theme === 'plane' ? 34 : 28) * L.s;   // 캐릭터 뒤끝
    const label = r.b.plugin.label, tw = Math.max(tagH, g.measureText(label).width + tagH * .55);   // 짧은 번호는 동그라미
    rRect(x - back - tw, y - tagH / 2, tw, tagH, tagH / 2); g.fillStyle = r.b.plugin.c; g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    rText(label, x - back - tw / 2, y + 1, tagF, '#fff', 'center', ['rgba(40,25,60,.6)', 4]);
    if (planned && t >= r.T) {   // 들어온 순위
      const rk = r.rank, w = tagH * 1.6, front = (race.theme === 'swim' ? 42 : 30) * L.s;
      rRect(x + front, y - tagH / 2, w, tagH, tagH / 2); g.fillStyle = rk < 3 ? MEDAL[rk] : 'rgba(255,255,255,.85)'; g.fill();
      rText(`${rk + 1}등`, x + front + w / 2, y + 1, tagF, '#33244f');
    }
    if (e) active.push([x, y, e]);
  }
  // 스킬 말풍선
  const bf = Math.max(15, Math.min(26, L.LANE * .75));
  for (const [x, y, e] of active) {
    g.font = `${bf}px ${RFONT}`;
    const h = bf + 12, ir = h * .36, w = g.measureText(e.s.name).width + h * .5 + ir * 2 + 8;
    const bx = Math.max(x0 + 6, Math.min(x1 - w - 6, x - w / 2)), by = y - L.LANE / 2 - h + 2;
    const age = t - e.show, pop = age < .2 ? 1 + (1 - age / .2) * .45 : 1;   // 처음 뜰 때 톡
    g.save(); g.translate(bx + w / 2, by + h / 2); g.scale(pop, pop); g.translate(-(bx + w / 2), -(by + h / 2));
    rRect(bx, by, w, h, h / 2); g.fillStyle = KIND_COLOR[e.s.kind]; g.fill();
    g.strokeStyle = '#33244f'; g.lineWidth = 2.5; g.stroke();
    drawKindIcon(e.s.kind, bx + h * .25 + ir, by + h / 2, ir);
    rText(e.s.name, bx + h * .25 + ir * 2 + 6, by + h / 2 + 1, bf, '#33244f', 'left');
    g.restore();
  }
  g.setTransform(DPR, 0, 0, DPR, 0, 0);   // 알림판과 출발 글씨는 확대하지 않는다
  if (race.state !== 'idle' && planned) rEdgesAndMap(L, t, vx, cam);
  if (cam.z > 1.05) {   // 클로즈업 중 표시
    rRect(RW / 2 - 92, RH - 52, 184, 38, 19); g.fillStyle = 'rgba(30,22,50,.8)'; g.fill();
    rText('결승선 클로즈업', RW / 2, RH - 32, 22, '#ffd95a');
  }
  // 위쪽 알림판: 지금 1등과 최근 스킬
  if (race.state !== 'idle' && t >= 0 && race.leader) {
    const done = t >= key.T, lb = race.leader.b.plugin, word = race.pick === 'last' ? '꼴찌' : '1등';
    const head = done ? word : `지금 ${word}`, name = lb.title;
    g.font = `34px ${RFONT}`; const nw = g.measureText(name).width;
    const w = 150 + nw, y0 = L.TOP - 58;
    rRect(16, y0, w, 48, 24); g.fillStyle = 'rgba(30,22,50,.85)'; g.fill();
    rText(head, 34, y0 + 25, 22, '#ffd95a', 'left');
    rRect(done ? 92 : 128, y0 + 6, nw + 24, 36, 18); g.fillStyle = lb.c; g.fill();
    rText(name, (done ? 92 : 128) + 12 + nw / 2, y0 + 25, 30, '#fff', 'center', ['rgba(40,25,60,.55)', 4]);
    race.log.forEach((l, k) => {
      g.font = `20px ${RFONT}`;
      const lw = g.measureText(l.text).width + 34, ly = race.log.length > 1 ? y0 - 3 + k * 27 : y0 + 11;
      rRect(RW - 16 - lw, ly, lw, 26, 13); g.fillStyle = 'rgba(30,22,50,.8)'; g.fill();
      g.fillStyle = KIND_COLOR[l.kind]; g.beginPath(); g.arc(RW - 16 - lw + 14, ly + 13, 5, 0, 7); g.fill();
      rText(l.text, RW - 16 - lw + 24, ly + 14, 20, '#fff', 'left');
    });
  }
  // 준비, 차렷, 출발!
  if (race.state !== 'idle' && t < .6) {
    const s = t < -1.6 ? '준비' : t < -.8 ? '차렷' : t < 0 ? '…' : '출발!';
    rText(s, RW / 2, RH / 2, 96, '#ffd95a', 'center', ['#33244f', 12]);
  }
}

// 화면 밖 주자는 가장자리에 «◀ 12» 꼬리표, 아래에는 코스 지도(전원 위치)
function rEdgesAndMap(L, t, vx, cam) {
  const rs = race.runners;
  if (cam.z < 1.05) {
    const h = Math.max(16, Math.min(28, L.LANE * .8)), f = Math.round(h * .66);
    for (const r of rs) {
      const sx = L.START + L.TRACK * rPos(r, t) - vx, y = laneY(L, r.lane);
      if (sx > 70 && sx < RW + 10) continue;   // 왼쪽은 번호표가 잘리기 시작하면(약 70) 꼬리표를 띄운다
      const left = sx <= 70, txt = r.b.plugin.label, tri = h * .42;   // 화살표는 세모를 직접 그림
      g.font = `${f}px ${RFONT}`; const w = g.measureText(txt).width + h * .7 + tri;
      const bx = left ? 6 : RW - 6 - w;
      rRect(bx, y - h / 2, w, h, h / 2); g.fillStyle = r.b.plugin.c; g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
      const tx = left ? bx + h * .3 : bx + w - h * .3;   // 세모 꼭짓점이 바깥(가장자리) 쪽을 가리킴
      g.fillStyle = '#fff'; g.beginPath();
      g.moveTo(tx, y); g.lineTo(tx + (left ? tri : -tri), y - tri * .7); g.lineTo(tx + (left ? tri : -tri), y + tri * .7); g.closePath(); g.fill();
      rText(txt, bx + (left ? tri + h * .25 : 0) + (w - tri - h * .25) / 2 + (left ? 0 : h * .1), y + 1, f, '#fff', 'center', ['rgba(40,25,60,.6)', 3]);
    }
  }
  // 코스 지도
  const mx0 = 200, mx1 = RW - 200, my = RH - 14;
  rRect(mx0 - 16, my - 11, mx1 - mx0 + 32, 22, 11); g.fillStyle = 'rgba(30,22,50,.8)'; g.fill();
  const view0 = mx0 + (mx1 - mx0) * Math.max(0, (vx - L.START) / L.TRACK), view1 = mx0 + (mx1 - mx0) * Math.min(1, (vx + RW / cam.z - L.START) / L.TRACK);
  rRect(view0, my - 9, Math.max(6, view1 - view0), 18, 6); g.fillStyle = 'rgba(255,255,255,.16)'; g.fill();   // 지금 보이는 곳
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(mx0, my); g.lineTo(mx1, my); g.stroke();
  for (const q of [0, ...MARKS, 1]) { const x = mx0 + (mx1 - mx0) * q; g.beginPath(); g.moveTo(x, my - 6); g.lineTo(x, my + 6); g.stroke(); }
  for (const r of rs) {
    const x = mx0 + (mx1 - mx0) * Math.min(1, rPos(r, t));
    g.fillStyle = r.b.plugin.c; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(x, my, 5, 0, 7); g.fill(); g.stroke();
  }
}

let rLast = performance.now();
function rFrame(now) {
  const dt = Math.min(.05, (now - rLast) / 1000); rLast = now;
  if (game === 'race') {
    if (race.state === 'idle' && race.src !== capsules) rPrepare();   // 명단이 바뀌면 다시 줄 세움
    if (race.state !== 'idle') rTick(dt * (race.slow || 1));
    rDraw();
  }
  requestAnimationFrame(rFrame);
}

// ── 룰렛 고르기, 경주 종류 ──
function setGame(gm) {
  if (claw.state !== 'idle' || race.state !== 'idle') return;
  game = gm;
  els.gameClaw.setAttribute('aria-pressed', gm === 'claw');
  els.gameRace.setAttribute('aria-pressed', gm === 'race');
  cv.hidden = gm !== 'claw'; rcv.hidden = gm !== 'race';
  document.getElementById('luckBox').hidden = gm !== 'claw';
  document.getElementById('themeBox').hidden = gm !== 'race';
  els.machine.classList.toggle('race', gm === 'race');
  els.tries.textContent = '준비 완료'; showGauge(0, '');
  updateUI(); save();
}
function setRacePick(p) {
  if (race.state !== 'idle') return;
  race.pick = p;
  document.querySelectorAll('[data-pick]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pick === p));
  if (race.runners.length && race.runners[0].track) rPrepare();   // 지난 결과 화면은 치운다
  showGauge(0, ''); save();
}
function setRaceTheme(th) {
  if (race.state !== 'idle') return;
  race.theme = th;
  document.querySelectorAll('[data-theme]').forEach(b => b.setAttribute('aria-pressed', b.dataset.theme === th));
  rPrepare(); save();
}
els.gameClaw.addEventListener('click', () => setGame('claw'));
els.gameRace.addEventListener('click', () => setGame('race'));
document.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => setRaceTheme(b.dataset.theme)));
document.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => setRacePick(b.dataset.pick)));

(() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem('claw.v2')) || {}; } catch (e) {}
  if (RACE_THEMES[s.theme]) setRaceTheme(s.theme);
  if (s.pick === 'last') setRacePick('last');
  if (s.game === 'race') setGame('race');
})();
requestAnimationFrame(rFrame);
