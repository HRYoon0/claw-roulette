// 달리기 룰렛: 운동회 달리기, 느림보 달팽이, 교실 종이비행기.
// index.html 의 명단(capsules), 설정, 소리, 공개 화면, 기록을 함께 쓴다(일반 <script> 끼리는 맨 위 선언을 공유).
//
// 공정성: 도착 순서를 출발 전에 암호학 난수(index 의 shuffle)로 먼저 정한다. 그다음 스킬이 섞인
// «원래 달리기»를 만들고, 재생 속도만 늘이고 줄여 정해진 순서대로 결승선을 넘게 한다.
// 스킬은 중간 순위를 뒤집는 연출일 뿐 결과를 바꾸지 않는다.

const RW = 1100, RH = 820;
const RMAX = 30;          // 한 경주에 달리는 최대 인원
const RLEAD = 2.4;        // 준비, 차렷, 출발! 시간
const RBASE = 19;         // 1등이 들어오는 시각(초)
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
  snail: [
    { name: '점액 미끄럼', kind: 'dash', dur: 1.7, m: 2.4 },
    { name: '껍질 굴리기!', kind: 'dash', dur: 1.3, m: 3.0, roll: true },
    { name: '꾸벅 낮잠', kind: 'stop', dur: 2.2, zzz: true },
    { name: '상추 냠냠', kind: 'stop', dur: 1.6 },
    { name: '참새다!', kind: 'back', dur: 1.0, m: -.7 },
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
  runners: [], src: null, lay: null, clock: 0, log: [], leader: null,
  leadSndAt: -9, skillSndAt: -9, rolled: false, went: false,
};

// ── 준비: 명단으로 줄 세우기 ──
function rLayout(n) {
  const TOP = n <= 12 ? 160 : 124, BOT = RH - 28, LANE = (BOT - TOP) / Math.max(n, 1);
  return { n, TOP, BOT, LANE, START: 170, FIN: RW - 110, s: Math.max(.6, Math.min(1.35, LANE / 38)) };   // 캐릭터는 줄보다 조금 크게(살짝 겹쳐도 잘 보이게)
}

function rPrepare() {
  let pool = capsules.slice();
  if (pool.length > RMAX) pool = shuffle(pool).slice(0, RMAX);   // 많으면 30명을 무작위로
  pool.sort((a, b) => a.plugin.label.localeCompare(b.plugin.label, 'ko', { numeric: true }));   // 번호 순서대로 줄
  race.runners = pool.map((b, lane) => ({ b, lane, phase: Math.random() * 6, track: null, ev: [], T: 0, rank: 0 }));
  race.lay = rLayout(pool.length);
  race.src = capsules;
  race.clock = 0;
}

// ── 경주 계획: 도착 순서 먼저, 그다음 스킬 섞인 달리기 ──
function rPlan() {
  const rs = race.runners, sk = RACE_THEMES[race.theme];
  shuffle([...rs.keys()]).forEach((ri, rank) => { rs[ri].rank = rank; });
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const bad = sk.filter(s => s.kind !== 'dash'), good = sk.filter(s => s.kind === 'dash');
  for (const r of rs) {
    let ev;
    if (r.rank === 0) {        // 1등: 초반에 손해, 막판에 질주 → 역전
      ev = [{ at: 3 + Math.random() * 4, s: pick(bad) }, { at: 9 + Math.random() * 2, s: pick(sk) },
            { at: 13.5 + Math.random() * 1.5, s: pick(good) }];
    } else if (r.rank === 1) { // 2등도 막판에 따라붙어 사진 판정처럼
      ev = [{ at: 2 + Math.random() * 8, s: pick(sk) }, { at: 14 + Math.random() * 1.5, s: pick(good) }];
    } else {
      ev = Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => ({ at: 1.5 + Math.random() * 14, s: pick(sk) }));
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
    const gap = r.rank === 0 ? 0 : r.rank === 1 ? .3 : .65 + (r.rank - 2) * .3;
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
  Object.assign(race, { state: 'run', clock: 0, log: [], leader: null, rolled: false, went: false, leadSndAt: -9, skillSndAt: -9 });
  sound.bgm('play');
  sound.roll(RLEAD - .3);
  els.tries.textContent = '준비!';
  updateUI();
}

function rWinners() {
  return [...race.runners].sort((a, b) => a.rank - b.rank).slice(0, round.total).map(r => r.b);
}

function rShowResult() {
  race.state = 'result';
  const ws = rWinners(), many = ws.length > 1;
  showReveal({ race: true, winners: ws }, {
    c: ws[0].plugin.c, c2: ws[0].plugin.c2, who: ws[0].plugin.title,
    tag: '1등으로 들어왔어요!',
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
      race.log.unshift({ text: `${r.b.plugin.title} ${e.s.name}`, kind: e.s.kind });
      race.log.length = Math.min(race.log.length, 2);
      if (t - race.skillSndAt > .35) { race.skillSndAt = t; sound.skill(e.s.kind); }
    }
  }
  // 선두: 아직 안 들어온 주자 중 가장 앞(모두 들어왔으면 1등)
  const running = rs.filter(r => t < r.T);
  const lead = running.length ? running.reduce((a, b) => rPos(b, t) > rPos(a, t) ? b : a) : rs.find(r => r.rank === 0);
  const first = rs.find(r => r.rank === 0);
  const shown = t >= first.T ? first : lead;
  if (shown !== race.leader) {
    if (race.leader && t - race.leadSndAt > .5 && t < first.T) { race.leadSndAt = t; sound.lead(); }
    race.leader = shown;
  }
  const lp = Math.min(1, rPos(lead, t));
  showGauge(Math.max(1, Math.ceil(lp * 5)), t >= first.T ? `1등 ${first.b.plugin.title}` : `선두 ${shown.b.plugin.title}`);
  els.tries.textContent = t >= first.T ? '결승!' : '달리는 중';
  if (!race.rolled && lp > .86) { race.rolled = true; sound.roll(2.2); }   // 막판 드럼롤
  if (race.state === 'run') {
    const lastWinner = Math.max(...rs.filter(r => r.rank < round.total).map(r => r.T));
    if (t >= lastWinner + 1) rShowResult();
  }
}

// ── 그리기 도움 ──
function rRect(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function rText(s, x, y, size, color, align = 'center', stroke) {
  g.font = `${size}px ${RFONT}`; g.textAlign = align; g.textBaseline = 'middle';
  if (stroke) { g.lineJoin = 'round'; g.lineWidth = stroke[1]; g.strokeStyle = stroke[0]; g.strokeText(s, x, y); }
  g.fillStyle = color; g.fillText(s, x, y);
}
const laneY = (L, i) => L.TOP + L.LANE * (i + .5);

// ── 배경 ──
function bgField(L, tapeUp) {
  let gr = g.createLinearGradient(0, 0, 0, L.TOP); gr.addColorStop(0, '#bfe6ff'); gr.addColorStop(1, '#eaf8ff');
  g.fillStyle = gr; g.fillRect(0, 0, RW, L.TOP);
  g.fillStyle = '#8fd07a'; g.beginPath(); g.moveTo(0, L.TOP - 26);
  for (let x = 0; x <= RW; x += 60) g.quadraticCurveTo(x + 30, L.TOP - 46, x + 60, L.TOP - 26);
  g.lineTo(RW, RH); g.lineTo(0, RH); g.fill();
  for (const [y0, sag] of [[14, 24], [36, 16]]) {   // 만국기
    g.strokeStyle = '#7a6a5a'; g.lineWidth = 1.5; g.beginPath();
    for (let x = 0; x <= RW; x += 8) { const y = y0 + sag * Math.sin(Math.PI * x / RW); x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    for (let x = 12, k = 0; x < RW - 20; x += 30, k++) {
      const y = y0 + sag * Math.sin(Math.PI * x / RW);
      g.fillStyle = `hsl(${(k * 53) % 360} 80% 62%)`;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 22, y + 1); g.lineTo(x + 11, y + 18); g.fill();
    }
  }
  g.fillStyle = '#d8714b'; g.fillRect(0, L.TOP - 8, RW, L.BOT - L.TOP + 16);
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = L.n > 16 ? 1.2 : 2;
  for (let k = 0; k <= L.n; k++) { g.beginPath(); g.moveTo(0, L.TOP + L.LANE * k); g.lineTo(RW, L.TOP + L.LANE * k); g.stroke(); }
  g.lineWidth = 4; g.beginPath(); g.moveTo(L.START, L.TOP); g.lineTo(L.START, L.BOT); g.stroke();
  for (let y = L.TOP, k = 0; y < L.BOT; y += 12, k++) for (let c = 0; c < 2; c++) {
    g.fillStyle = (k + c) % 2 ? '#fff' : '#33244f'; g.fillRect(L.FIN + c * 12 - 12, y, 12, Math.min(12, L.BOT - y));
  }
  if (tapeUp) { g.strokeStyle = '#ff3d6e'; g.lineWidth = 3; g.beginPath(); g.moveTo(L.FIN + 14, L.TOP - 6); g.lineTo(L.FIN + 14, L.BOT + 6); g.stroke(); }
}

function bgSnail(L) {
  g.fillStyle = '#d7f0c6'; g.fillRect(0, 0, RW, L.TOP);
  for (let x = 6; x < RW; x += 26) { rRect(x, 14, 16, L.TOP - 22, [8, 8, 0, 0]); g.fillStyle = '#fffdf5'; g.fill(); }
  g.fillStyle = '#f4ead2'; g.fillRect(0, 50, RW, 7);
  for (let k = 0; k < 11; k++) {
    const x = 36 + k * 102, y = L.TOP - 26;
    g.strokeStyle = '#4f9a4a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + 20); g.lineTo(x, y); g.stroke();
    g.fillStyle = `hsl(${(k * 67 + 330) % 360} 85% 70%)`;
    for (let a = 0; a < 5; a++) { g.beginPath(); g.arc(x + 7 * Math.cos(a * 1.26), y + 7 * Math.sin(a * 1.26), 6, 0, 7); g.fill(); }
    g.fillStyle = '#ffd95a'; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill();
  }
  for (let k = 0; k < L.n; k++) { g.fillStyle = k % 2 ? '#b98658' : '#c99568'; g.fillRect(0, L.TOP + L.LANE * k, RW, L.LANE); }
  g.fillStyle = '#5fae4f';
  for (let k = 0; k <= L.n; k++) for (let x = 14; x < RW; x += 46) {
    const y = L.TOP + L.LANE * k;
    g.beginPath(); g.moveTo(x, y + 3); g.lineTo(x + 4, y - 6); g.lineTo(x + 8, y + 3); g.lineTo(x + 12, y - 4); g.lineTo(x + 15, y + 3); g.fill();
  }
  for (let k = 0; k < L.n; k++) {   // 결승선 너머 상추
    const y = laneY(L, k), s = L.s;
    g.fillStyle = '#6cc24a'; g.beginPath(); g.ellipse(L.FIN + 46, y, 22 * s, 15 * s, .3, 0, 7); g.fill();
    g.fillStyle = '#9be36f'; g.beginPath(); g.ellipse(L.FIN + 54, y - 4 * s, 15 * s, 10 * s, -.4, 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.setLineDash([8, 8]); g.lineWidth = 3;
  g.beginPath(); g.moveTo(L.FIN, L.TOP); g.lineTo(L.FIN, L.BOT); g.stroke(); g.setLineDash([]);
}

function bgPlane(L) {
  g.fillStyle = '#8b5e3c'; g.fillRect(0, 0, RW, RH);
  g.fillStyle = '#2f5446'; g.fillRect(12, 12, RW - 24, RH - 24);
  g.fillStyle = 'rgba(255,255,255,.04)';
  for (let k = 0; k < 50; k++) g.fillRect((k * 211) % RW, (k * 97) % (RH - 60) + 14, 130, 2);
  g.strokeStyle = 'rgba(255,255,255,.1)'; g.setLineDash([10, 12]); g.lineWidth = 1.5;
  for (let k = 1; k < L.n; k++) { g.beginPath(); g.moveTo(30, L.TOP + L.LANE * k); g.lineTo(RW - 30, L.TOP + L.LANE * k); g.stroke(); }
  g.setLineDash([]);
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

function drawSnail(c, ph, e, t) {
  const still = e && e.s.kind === 'stop', st = still ? 1 : 1 + .08 * Math.sin(ph * .8);
  g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(0, 15, 22, 4, 0, 0, 7); g.fill();
  if (!(e && e.s.roll)) {
    g.save(); g.scale(st, 1);
    g.fillStyle = '#dbe8a6'; g.strokeStyle = '#a9b96f'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-22, 12); g.quadraticCurveTo(-6, 2, 14, 4); g.quadraticCurveTo(22, 2, 22, 10); g.quadraticCurveTo(20, 15, 0, 15); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(16, 4); g.lineTo(19, -10); g.moveTo(19, 5); g.lineTo(25, -7); g.stroke();
    g.fillStyle = '#33244f'; g.beginPath(); g.arc(19, -11, 2.4, 0, 7); g.arc(25, -8, 2.4, 0, 7); g.fill();
    g.restore();
  }
  g.save(); g.translate(-4, -2); g.rotate(e && e.s.roll ? t * 14 : 0);
  g.fillStyle = c; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2.2; g.beginPath();
  for (let a = 0; a < 12; a += .3) { const r = 2 + a * .95; a ? g.lineTo(r * Math.cos(a), r * Math.sin(a)) : g.moveTo(r, 0); }
  g.stroke(); g.restore();
  if (e && e.s.zzz) for (let k = 0; k < 3; k++) rText('z', 16 + k * 7, -22 - k * 8 - (t * 8 % 6), 13 + k * 3, '#33244f', 'center', ['#fff', 3]);
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
  const planned = rs.length && rs[0].track;
  const first = planned ? rs.find(r => r.rank === 0) : null;
  if (race.theme === 'field') bgField(L, !first || t < first.T);
  else if (race.theme === 'snail') bgSnail(L);
  else bgPlane(L);

  if (!rs.length) { rText('위에서 «참가자 채우기»를 눌러요', RW / 2, RH / 2, 34, '#fff', 'center', ['#33244f', 8]); return; }

  const tagH = Math.max(16, Math.min(30, L.LANE * .88)), tagF = Math.round(tagH * .7);
  const active = [];
  for (const r of rs) {
    const p = rPos(r, t), x = L.START + (L.FIN - L.START) * p, y = laneY(L, r.lane);
    if (race.state !== 'idle') r.phase += (p - rPos(r, t - .05)) / .05 * 2.2;
    const e = r.ev.find(e => t >= e.show && t < e.end && race.state !== 'idle');
    g.save(); g.translate(x, y); g.scale(L.s, L.s);
    drawEffect(e);
    if (race.theme === 'field') drawKid(r.b.plugin.c, r.phase, e);
    else if (race.theme === 'snail') drawSnail(r.b.plugin.c, r.phase, e, t);
    else drawPlane(r.b.plugin.c, r.phase, e, t);
    g.restore();
    // 번호(이름) 꼬리표: 주자 왼쪽
    g.font = `${tagF}px ${RFONT}`;
    const label = r.b.plugin.label, tw = g.measureText(label).width + tagH * .7;
    rRect(x - 30 * L.s - tw, y - tagH / 2, tw, tagH, tagH / 2); g.fillStyle = r.b.plugin.c; g.fill();
    rText(label, x - 30 * L.s - tw / 2, y + 1, tagF, '#fff', 'center', ['rgba(40,25,60,.55)', 3]);
    if (planned && t >= r.T) {   // 들어온 순위
      const rk = r.rank, w = tagH * 1.6;
      rRect(x + 28 * L.s, y - tagH / 2, w, tagH, tagH / 2); g.fillStyle = rk < 3 ? MEDAL[rk] : 'rgba(255,255,255,.85)'; g.fill();
      rText(`${rk + 1}등`, x + 28 * L.s + w / 2, y + 1, tagF, '#33244f');
    }
    if (e) active.push([x, y, e]);
  }
  // 스킬 말풍선
  const bf = Math.max(12, Math.min(18, L.LANE * .5));
  for (const [x, y, e] of active) {
    g.font = `${bf}px ${RFONT}`;
    const w = g.measureText(e.s.name).width + 16, h = bf + 10;
    const bx = Math.min(RW - w - 6, x - w / 2), by = y - L.LANE / 2 - h + 4;
    rRect(bx, by, w, h, h / 2); g.fillStyle = KIND_COLOR[e.s.kind]; g.fill();
    g.strokeStyle = 'rgba(51,36,79,.35)'; g.lineWidth = 1.5; g.stroke();
    rText(e.s.name, bx + w / 2, by + h / 2 + 1, bf, '#33244f');
  }
  // 위쪽 알림판: 지금 1등과 최근 스킬
  if (race.state !== 'idle' && t >= 0 && race.leader) {
    const done = t >= first.T, lb = race.leader.b.plugin;
    const head = done ? '1등' : '지금 1등', name = lb.title;
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

let rLast = performance.now();
function rFrame(now) {
  const dt = Math.min(.05, (now - rLast) / 1000); rLast = now;
  if (game === 'race') {
    if (race.state === 'idle' && race.src !== capsules) rPrepare();   // 명단이 바뀌면 다시 줄 세움
    if (race.state !== 'idle') rTick(dt);
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
function setRaceTheme(th) {
  if (race.state !== 'idle') return;
  race.theme = th;
  document.querySelectorAll('[data-theme]').forEach(b => b.setAttribute('aria-pressed', b.dataset.theme === th));
  rPrepare(); save();
}
els.gameClaw.addEventListener('click', () => setGame('claw'));
els.gameRace.addEventListener('click', () => setGame('race'));
document.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => setRaceTheme(b.dataset.theme)));

(() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem('claw.v2')) || {}; } catch (e) {}
  if (RACE_THEMES[s.theme]) setRaceTheme(s.theme);
  if (s.game === 'race') setGame('race');
})();
requestAnimationFrame(rFrame);
