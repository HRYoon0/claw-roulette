// 달리기 룰렛: 운동회 달리기, 수영 경기, 교실 종이비행기.
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
  // 두 주자가 함께 들어오는 만큼만 키운다(최대 2.2배)
  const y1 = laneY(L, key.lane), y2 = laneY(L, rival.lane);
  const zMax = Math.max(1, Math.min(2.2, RH * .8 / (Math.abs(y1 - y2) + L.LANE * 3)));
  const z = 1 + a * (zMax - 1);
  const x = Math.max(0, Math.min(RW - RW / z, L.FIN - RW * .66 / z));
  const y = Math.max(0, Math.min(RH - RH / z, (y1 + y2) / 2 - RH * .55 / z));
  return { z, x, y };
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

function bgSwim(L) {
  const deck = '#e7f3f6', left = L.START - 44, right = L.FIN + 18;
  g.fillStyle = deck; g.fillRect(0, 0, RW, RH);
  g.strokeStyle = 'rgba(110,165,185,.3)'; g.lineWidth = 1;   // 데크 타일
  for (let x = 0; x < RW; x += 28) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, RH); g.stroke(); }
  for (let y = 0; y < RH; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(RW, y); g.stroke(); }
  // 배영 깃발 줄
  g.strokeStyle = '#7a8a96'; g.lineWidth = 1.5; g.beginPath();
  for (let x = 0; x <= RW; x += 8) { const y = 20 + 12 * Math.sin(Math.PI * x / RW); x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  for (let x = 10, k = 0; x < RW - 20; x += 28, k++) {
    const y = 20 + 12 * Math.sin(Math.PI * x / RW);
    g.fillStyle = ['#e63950', '#ffffff', '#2f6fd6'][k % 3];
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20, y + 1); g.lineTo(x + 10, y + 17); g.fill();
  }
  // 물
  const w = g.createLinearGradient(0, L.TOP, 0, L.BOT);
  w.addColorStop(0, '#46bde4'); w.addColorStop(1, '#1d82c2');
  g.fillStyle = w; g.fillRect(left, L.TOP - 8, right - left, L.BOT - L.TOP + 16);
  g.strokeStyle = '#c9e3ea'; g.lineWidth = 6; g.strokeRect(left, L.TOP - 8, right - left, L.BOT - L.TOP + 16);
  // 물결 반짝임(천천히 흐름)
  const tt = performance.now() / 1000;
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2;
  for (let k = 0; k < 22; k++) {
    const x = left + ((k * 173 + tt * 18) % (right - left - 40)), y = L.TOP + 6 + (k * 61) % (L.BOT - L.TOP - 12);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 9, y - 4, x + 18, y); g.quadraticCurveTo(x + 27, y + 4, x + 36, y); g.stroke();
  }
  // 레인 구분: 줄 대신 물 색을 아주 옅게 번갈아 칠함(촘촘한 점 무늬는 눈이 아픔)
  g.fillStyle = 'rgba(255,255,255,.07)';
  for (let k = 0; k < L.n; k += 2) g.fillRect(left, L.TOP + L.LANE * k, right - left, L.LANE);
  // 레인 바닥 가운데 줄과 끝의 T
  g.fillStyle = 'rgba(12,45,100,.32)';
  for (let k = 0; k < L.n; k++) {
    const y = laneY(L, k), hh = Math.max(2, L.LANE * .1);
    g.fillRect(left + 50, y - hh / 2, right - left - 100, hh);
    g.fillRect(right - 54, y - L.LANE * .3, hh, L.LANE * .6);
  }
  // 출발대와 터치 패드
  for (let k = 0; k < L.n; k++) {
    const y = laneY(L, k), hh = Math.min(26, L.LANE * .7);
    rRect(left - 26, y - hh / 2, 22, hh, 4); g.fillStyle = '#ffffff'; g.fill();
    g.strokeStyle = '#b9cdd5'; g.lineWidth = 1.5; g.stroke();
  }
  g.fillStyle = '#ffd95a'; g.fillRect(right - 6, L.TOP - 8, 6, L.BOT - L.TOP + 16);
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
  g.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, -cam.x * cam.z * DPR, -cam.y * cam.z * DPR);
  const planned = rs.length && rs[0].track;
  const first = planned ? rs.find(r => r.rank === 0) : null;
  const key = planned ? rs.find(r => r.rank === (race.pick === 'last' ? rs.length - 1 : 0)) : null;
  if (race.theme === 'field') bgField(L, !first || t < first.T);
  else if (race.theme === 'swim') bgSwim(L);
  else bgPlane(L);

  if (!rs.length) { rText('위에서 «참가자 채우기»를 눌러요', RW / 2, RH / 2, 34, '#fff', 'center', ['#33244f', 8]); return; }

  const tagH = Math.max(18, Math.min(40, L.LANE * .98)), tagF = Math.round(tagH * .78);   // 번호가 주인공: 레인 높이만큼
  const active = [];
  for (const r of rs) {
    const p = rPos(r, t), x = L.START + (L.FIN - L.START) * p, y = laneY(L, r.lane);
    if (race.state !== 'idle') r.phase += (p - rPos(r, t - .05)) / .05 * 2.2;
    const e = r.ev.find(e => t >= e.show && t < e.end && race.state !== 'idle');
    g.save(); g.translate(x, y); g.scale(L.s, L.s);
    drawEffect(e);
    if (race.theme === 'field') drawKid(r.b.plugin.c, r.phase, e);
    else if (race.theme === 'swim') drawSwimmer(r.b.plugin.c, r.phase, e, t);
    else drawPlane(r.b.plugin.c, r.phase, e, t);
    g.restore();
    // 번호(이름) 꼬리표: 주자 왼쪽
    g.font = `${tagF}px ${RFONT}`;
    const label = r.b.plugin.label, tw = Math.max(tagH, g.measureText(label).width + tagH * .55);   // 짧은 번호는 동그라미
    rRect(x - 30 * L.s - tw, y - tagH / 2, tw, tagH, tagH / 2); g.fillStyle = r.b.plugin.c; g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    rText(label, x - 30 * L.s - tw / 2, y + 1, tagF, '#fff', 'center', ['rgba(40,25,60,.6)', 4]);
    if (planned && t >= r.T) {   // 들어온 순위
      const rk = r.rank, w = tagH * 1.6;
      rRect(x + 28 * L.s, y - tagH / 2, w, tagH, tagH / 2); g.fillStyle = rk < 3 ? MEDAL[rk] : 'rgba(255,255,255,.85)'; g.fill();
      rText(`${rk + 1}등`, x + 28 * L.s + w / 2, y + 1, tagF, '#33244f');
    }
    if (e) active.push([x, y, e]);
  }
  // 스킬 말풍선
  const bf = Math.max(13, Math.min(20, L.LANE * .6));
  for (const [x, y, e] of active) {
    g.font = `${bf}px ${RFONT}`;
    const w = g.measureText(e.s.name).width + 16, h = bf + 10;
    const bx = Math.min(RW - w - 6, x - w / 2), by = y - L.LANE / 2 - h + 4;
    rRect(bx, by, w, h, h / 2); g.fillStyle = KIND_COLOR[e.s.kind]; g.fill();
    g.strokeStyle = 'rgba(51,36,79,.35)'; g.lineWidth = 1.5; g.stroke();
    rText(e.s.name, bx + w / 2, by + h / 2 + 1, bf, '#33244f');
  }
  g.setTransform(DPR, 0, 0, DPR, 0, 0);   // 알림판과 출발 글씨는 확대하지 않는다
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
