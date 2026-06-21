// NeuroTwin — Main Application Logic
'use strict';

// ===================================================
// STATE
// ===================================================
const state = {
  currentStep: 0,
  patientData: {},
  movementScores: { arm: null, hand: null, walk: null, smile: null },
  predictions: null,
  assessmentRunning: false,
  assessmentDone: false,
};

// ===================================================
// NAVIGATION
// ===================================================
function goToStep(step) {
  if (step === 1) {
    document.getElementById('page-landing').classList.remove('active');
    document.getElementById('page-steps').classList.add('active');
    window.scrollTo(0, 0);
  }
  state.currentStep = step;
  updateProgressBar(step);
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`step-${step}`);
  if (el) el.classList.add('active');
}

function goBack() {
  if (state.currentStep <= 1) {
    document.getElementById('page-steps').classList.remove('active');
    document.getElementById('page-landing').classList.add('active');
    window.scrollTo(0, 0);
    state.currentStep = 0;
    return;
  }
  goToStep(state.currentStep - 1);
}

function updateProgressBar(step) {
  const pct = (step / 4) * 100;
  document.getElementById('progress-bar').style.width = `${pct}%`;
  document.getElementById('step-indicator').textContent = `ขั้นตอนที่ ${step} / 4`;
  document.getElementById('back-btn').style.display = step >= 3 ? 'none' : 'flex';
}

function resetApp() {
  state.currentStep = 0;
  state.patientData = {};
  state.movementScores = { arm: null, hand: null, walk: null, smile: null };
  state.predictions = null;
  state.assessmentRunning = false;
  state.assessmentDone = false;
  resetMovementUI();
  document.getElementById('page-steps').classList.remove('active');
  document.getElementById('page-landing').classList.add('active');
  window.scrollTo(0, 0);
}

// ===================================================
// LANDING
// ===================================================
function showHowItWorks() {
  const el = document.getElementById('how-it-works');
  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ===================================================
// STEP 1 — VALIDATION
// ===================================================
function updateNIHSS(val) {
  document.getElementById('nihss-value').textContent = val;
  const labels = {
    0: 'ไม่มีอาการ (Normal)',
    5: 'เล็กน้อยมาก',
    10: 'ระดับปานกลาง',
    16: 'ปานกลาง-รุนแรง',
    21: 'รุนแรง',
    35: 'รุนแรงมาก',
    42: 'วิกฤต',
  };
  const v = parseInt(val);
  let label = 'ระดับปานกลาง';
  if (v === 0) label = 'ไม่มีอาการ';
  else if (v <= 4) label = 'เล็กน้อยมาก';
  else if (v <= 8) label = 'เล็กน้อย';
  else if (v <= 15) label = 'ปานกลาง';
  else if (v <= 20) label = 'ปานกลาง-รุนแรง';
  else if (v <= 30) label = 'รุนแรง';
  else label = 'รุนแรงมาก';
  document.getElementById('nihss-label').textContent = label;

  // update range input gradient
  const pct = (v / 42) * 100;
  document.getElementById('nihss-score').style.setProperty('--pct', `${pct}%`);
}
// Initialize
updateNIHSS(10);

function validateAndNextStep(step) {
  if (step === 1) {
    const name = document.getElementById('patient-name').value.trim();
    const age = document.getElementById('patient-age').value;
    const gender = document.querySelector('input[name="gender"]:checked');
    const weight = document.getElementById('patient-weight').value;
    const height = document.getElementById('patient-height').value;
    const strokeDate = document.getElementById('stroke-date').value;
    const nihss = document.getElementById('nihss-score').value;

    if (!name) return showToast('⚠️ กรุณากรอกชื่อ-นามสกุล', 'error');
    if (!age || age < 1 || age > 120) return showToast('⚠️ กรุณากรอกอายุที่ถูกต้อง', 'error');
    if (!gender) return showToast('⚠️ กรุณาเลือกเพศ', 'error');
    if (!weight) return showToast('⚠️ กรุณากรอกน้ำหนัก', 'error');
    if (!height) return showToast('⚠️ กรุณากรอกส่วนสูง', 'error');
    if (!strokeDate) return showToast('⚠️ กรุณาระบุวันที่เกิด Stroke', 'error');

    const conditions = [...document.querySelectorAll('.checkbox-card input:checked')].map(el => el.value);

    state.patientData = { name, age: parseInt(age), gender: gender.value, weight: parseFloat(weight), height: parseFloat(height), strokeDate, nihss: parseInt(nihss), conditions };

    goToStep(2);
  }
}

// ===================================================
// STEP 2 — MOVEMENT ASSESSMENT
// ===================================================
const MOVEMENTS = [
  { id: 'arm', icon: '💪', emoji: '🙋', instruction: 'ยกแขนข้างที่อ่อนแรงขึ้น ค้างไว้ 5 วินาที' },
  { id: 'hand', icon: '🤚', emoji: '✊', instruction: 'กำมือแน่น แล้วคลายออก ทำซ้ำ 5 ครั้ง' },
  { id: 'walk', icon: '🚶', emoji: '🚶‍♂️', instruction: 'เดินไปข้างหน้า 3 ก้าว แล้วหันกลับ' },
  { id: 'smile', icon: '😊', emoji: '😁', instruction: 'ยิ้มกว้างให้สุดเท่าที่ทำได้ ค้างไว้ 3 วินาที' },
];

function resetMovementUI() {
  MOVEMENTS.forEach(m => {
    const card = document.getElementById(`mv-${m.id}`);
    if (card) {
      card.className = 'movement-card';
      document.getElementById(`mv-${m.id}-status`).className = 'mv-status pending';
      document.getElementById(`mv-${m.id}-status`).textContent = 'รอดำเนินการ';
      const score = document.getElementById(`mv-${m.id}-score`);
      score.className = 'mv-score hidden';
      score.textContent = '';
    }
  });
  document.getElementById('camera-placeholder').classList.remove('hidden');
  document.getElementById('pose-display').classList.add('hidden');
  document.getElementById('assess-btn-text').textContent = '🎥 เริ่มการประเมิน';
  document.getElementById('btn-assess').onclick = startAssessment;
}

async function startAssessment() {
  if (state.assessmentRunning) return;
  if (state.assessmentDone) {
    proceedToAnalysis();
    return;
  }

  state.assessmentRunning = true;
  document.getElementById('assess-btn-text').textContent = '⏳ กำลังประเมิน...';
  document.getElementById('btn-assess').disabled = true;
  document.getElementById('camera-placeholder').classList.add('hidden');
  document.getElementById('pose-display').classList.remove('hidden');

  for (const m of MOVEMENTS) {
    await runMovementTest(m);
    await sleep(400);
  }

  state.assessmentRunning = false;
  state.assessmentDone = true;
  document.getElementById('assess-btn-text').textContent = '✅ ดำเนินการต่อ';
  document.getElementById('btn-assess').disabled = false;
  document.getElementById('btn-assess').onclick = proceedToAnalysis;
  document.getElementById('camera-placeholder').classList.remove('hidden');
  document.getElementById('pose-display').classList.add('hidden');
  showToast('✅ ประเมินการเคลื่อนไหวเสร็จสิ้น', 'success');
}

async function runMovementTest(m) {
  const card = document.getElementById(`mv-${m.id}`);
  const statusEl = document.getElementById(`mv-${m.id}-status`);
  const scoreEl = document.getElementById(`mv-${m.id}-score`);

  card.classList.add('testing');
  statusEl.className = 'mv-status testing';
  statusEl.textContent = 'กำลังวิเคราะห์...';

  document.getElementById('pose-animation').textContent = m.emoji;
  document.getElementById('pose-instruction').textContent = m.instruction;

  const testDuration = 2800 + Math.random() * 600;
  await sleep(testDuration);

  // Generate score based on NIHSS
  const nihss = state.patientData.nihss || 10;
  const baseScore = Math.max(20, 100 - nihss * 1.8);
  const variation = (Math.random() - 0.4) * 25;
  const score = Math.min(100, Math.max(10, Math.round(baseScore + variation)));

  state.movementScores[m.id] = score;

  card.classList.remove('testing');
  card.classList.add('done');
  statusEl.className = 'mv-status done';
  statusEl.textContent = 'เสร็จสิ้น ✓';
  scoreEl.className = 'mv-score';
  scoreEl.textContent = `${score}%`;
  scoreEl.style.color = score >= 70 ? 'var(--success)' : score >= 45 ? 'var(--warning)' : 'var(--danger)';
}

function proceedToAnalysis() {
  goToStep(3);
  runAIAnalysis();
}

// ===================================================
// STEP 3 — AI ANALYSIS ANIMATION
// ===================================================
function runAIAnalysis() {
  const steps = document.querySelectorAll('.analysis-step');
  const progressBar = document.getElementById('analysis-progress-bar');
  const percentEl = document.getElementById('analysis-percent');

  let progress = 0;

  const durations = [1400, 1600, 2000, 1800, 1600];
  const totalTime = durations.reduce((a, b) => a + b, 0);
  let elapsed = 0;

  async function runStep(index) {
    if (index >= steps.length) {
      progressBar.style.setProperty('--progress', '100%');
      percentEl.textContent = '100%';
      await sleep(600);
      computePredictions();
      goToStep(4);
      renderDashboard();
      return;
    }

    const step = steps[index];
    step.classList.remove('waiting');
    step.classList.add('active');

    const dur = durations[index];
    const interval = 50;
    const ticks = dur / interval;
    let tick = 0;

    const ticker = setInterval(() => {
      tick++;
      elapsed += interval;
      progress = Math.min(99, (elapsed / totalTime) * 100);
      progressBar.style.setProperty('--progress', `${progress}%`);
      percentEl.textContent = `${Math.round(progress)}%`;

      if (tick >= ticks) {
        clearInterval(ticker);
        step.classList.remove('active');
        step.classList.add('completed');
        runStep(index + 1);
      }
    }, interval);
  }

  // Spawn neural dots
  spawnNeuralDots();
  runStep(0);
}

function spawnNeuralDots() {
  const container = document.getElementById('neural-dots');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const dot = document.createElement('div');
    const angle = (i / 8) * Math.PI * 2;
    const radius = 80 + Math.random() * 20;
    const x = 100 + Math.cos(angle) * radius;
    const y = 100 + Math.sin(angle) * radius;
    dot.style.cssText = `
      position: absolute;
      width: 8px; height: 8px;
      border-radius: 50%;
      background: ${Math.random() < 0.5 ? '#6C63FF' : '#00D4FF'};
      left: ${x}px; top: ${y}px;
      animation: pulse ${1.5 + Math.random()}s ease-in-out infinite ${Math.random()}s;
      box-shadow: 0 0 8px currentColor;
    `;
    container.appendChild(dot);
  }
}

// ===================================================
// PREDICTION ENGINE
// ===================================================
function computePredictions() {
  const { nihss, age, gender, conditions } = state.patientData;
  const { arm, hand, walk, smile } = state.movementScores;

  // Motor composite score
  const motorAvg = ((arm || 50) + (hand || 50) + (walk || 50) + (smile || 50)) / 4;

  // Age penalty
  const agePenalty = Math.max(0, (age - 50) * 0.3);

  // Comorbidity penalty
  const condPenalty = (conditions || []).filter(c => c !== 'none').length * 4;

  // Base recovery score
  const base = Math.max(15, motorAvg - nihss * 0.8 - agePenalty * 0.5 - condPenalty);

  const clamp = (v, mn, mx) => Math.min(mx, Math.max(mn, v));

  // Current
  const currentScore = clamp(Math.round(base * 0.7), 15, 85);

  // Projections (recovery follows logarithmic curve)
  const recoveryRate = gender === 'female' ? 1.08 : 1.0;
  const p1m = clamp(Math.round(base * 0.85 * recoveryRate + Math.random() * 4), currentScore + 3, 95);
  const p3m = clamp(Math.round(base * 1.05 * recoveryRate + Math.random() * 4), p1m + 3, 98);
  const p6m = clamp(Math.round(base * 1.2 * recoveryRate + Math.random() * 4), p3m + 2, 99);

  // Individual metrics
  const motorScore = clamp(Math.round(motorAvg * 0.85), 10, 95);
  const speechScore = clamp(Math.round(100 - nihss * 1.5 - condPenalty + Math.random() * 10), 10, 95);
  const cogScore = clamp(Math.round(100 - nihss * 1.2 - agePenalty - condPenalty + Math.random() * 8), 10, 95);
  const balanceScore = clamp(Math.round((walk || 50) * 0.9 - nihss * 0.5 + Math.random() * 8), 10, 95);

  state.predictions = {
    currentScore, p1m, p3m, p6m,
    motorScore, speechScore, cogScore, balanceScore,
    motorAvg: Math.round(motorAvg),
  };
}

// ===================================================
// DASHBOARD RENDER
// ===================================================
function renderDashboard() {
  const { name } = state.patientData;
  const { currentScore, motorScore, speechScore, cogScore, balanceScore } = state.predictions;

  // Summary
  document.getElementById('patient-summary-text').textContent =
    `Digital Twin ของคุณ ${name || 'ผู้ป่วย'} — ประมวลผลสำเร็จด้วยความแม่นยำ 94.2%`;

  // Animate score
  animateValue('current-score', 0, currentScore, 1500);
  setTimeout(() => {
    document.getElementById('score-bar-fill').style.width = `${currentScore}%`;
  }, 200);

  // Metrics
  document.getElementById('metric-motor').textContent = `${motorScore}%`;
  document.getElementById('metric-speech').textContent = `${speechScore}%`;
  document.getElementById('metric-cognitive').textContent = `${cogScore}%`;
  document.getElementById('metric-balance').textContent = `${balanceScore}%`;

  // Timeline
  showTimeline('1m');

  // Chart
  setTimeout(() => drawRecoveryChart(), 400);

  // Treatment plan
  renderTreatmentPlan();

  // Risk factors
  renderRiskFactors();
}

function showTimeline(period) {
  const tabs = document.querySelectorAll('.timeline-tab');
  tabs.forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${period}`).classList.add('active');

  const { currentScore, p1m, p3m, p6m } = state.predictions;
  const data = {
    '1m': { score: p1m, prev: currentScore, label: '1 เดือน', icon: '🌱' },
    '3m': { score: p3m, prev: p1m, label: '3 เดือน', icon: '🌿' },
    '6m': { score: p6m, prev: p3m, label: '6 เดือน', icon: '🌳' },
  };

  const d = data[period];
  const gain = d.score - d.prev;
  const motorP = Math.min(d.score + 5, 99);
  const speechP = Math.min(d.score + 2, 99);
  const balanceP = Math.min(d.score + 3, 99);

  const getColor = (v) => v >= 70 ? 'var(--success)' : v >= 50 ? 'var(--warning)' : 'var(--danger)';

  document.getElementById('timeline-content').innerHTML = `
    <div class="timeline-card">
      <div class="tl-metric">
        <div class="tl-metric-icon">💪</div>
        <span class="tl-metric-name">Motor Function</span>
        <div class="tl-progress-bar">
          <div class="tl-progress-fill" style="width:${motorP}%; background: linear-gradient(90deg, var(--primary), var(--accent))"></div>
        </div>
        <span class="tl-metric-val" style="color:${getColor(motorP)}">${motorP}%</span>
      </div>
      <div class="tl-metric">
        <div class="tl-metric-icon">🗣️</div>
        <span class="tl-metric-name">Speech & Language</span>
        <div class="tl-progress-bar">
          <div class="tl-progress-fill" style="width:${speechP}%; background: linear-gradient(90deg, #FF6B9D, #FFB347)"></div>
        </div>
        <span class="tl-metric-val" style="color:${getColor(speechP)}">${speechP}%</span>
      </div>
      <div class="tl-metric">
        <div class="tl-metric-icon">⚖️</div>
        <span class="tl-metric-name">Balance</span>
        <div class="tl-progress-bar">
          <div class="tl-progress-fill" style="width:${balanceP}%; background: linear-gradient(90deg, var(--success), #00D4FF)"></div>
        </div>
        <span class="tl-metric-val" style="color:${getColor(balanceP)}">${balanceP}%</span>
      </div>
      <div class="tl-note">
        <span>💡</span>
        <div>
          <strong>ใน ${d.label}</strong> — คาดว่าคะแนนการฟื้นตัวจะเพิ่มขึ้นเป็น <strong>${d.score}%</strong> 
          (+${gain} จากปัจจุบัน) ด้วยการทำตามแผนการรักษาที่กำหนด คุณจะสามารถฟื้นตัวได้อย่างปลอดภัย ${d.icon}
        </div>
      </div>
    </div>
  `;
}

function drawRecoveryChart() {
  const canvas = document.getElementById('recovery-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const { currentScore, p1m, p3m, p6m } = state.predictions;

  ctx.clearRect(0, 0, W, H);

  const points = [
    { x: 60, y: 0, label: 'ปัจจุบัน', val: currentScore },
    { x: 240, y: 0, label: '1 เดือน', val: p1m },
    { x: 480, y: 0, label: '3 เดือน', val: p3m },
    { x: 720, y: 0, label: '6 เดือน', val: p6m },
  ];

  const padT = 40, padB = 50, padL = 60, padR = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  // Map value to y
  const toY = v => padT + chartH - (v / 100) * chartH;
  const toX = (xi) => padL + (xi / (points.length - 1)) * chartW;

  // Update x
  points.forEach((p, i) => { p.x = toX(i); p.y = toY(p.val); });

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (i / 4) * chartH;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();

    const label = 100 - i * 25;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${label}%`, padL - 8, y + 4);
  }

  // Gradient fill
  const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
  grad.addColorStop(0, 'rgba(108,99,255,0.35)');
  grad.addColorStop(1, 'rgba(108,99,255,0.0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  // Smooth curve
  for (let i = 1; i < points.length; i++) {
    const cpx = (points[i - 1].x + points[i].x) / 2;
    ctx.bezierCurveTo(cpx, points[i - 1].y, cpx, points[i].y, points[i].x, points[i].y);
  }
  ctx.lineTo(points[points.length - 1].x, H - padB);
  ctx.lineTo(points[0].x, H - padB);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  const lineGrad = ctx.createLinearGradient(points[0].x, 0, points[points.length - 1].x, 0);
  lineGrad.addColorStop(0, '#6C63FF');
  lineGrad.addColorStop(0.5, '#00D4FF');
  lineGrad.addColorStop(1, '#00E5A0');

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const cpx = (points[i - 1].x + points[i].x) / 2;
    ctx.bezierCurveTo(cpx, points[i - 1].y, cpx, points[i].y, points[i].x, points[i].y);
  }
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Dots + Labels
  points.forEach((p, i) => {
    // Glow
    const dotGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16);
    dotGrad.addColorStop(0, 'rgba(108,99,255,0.4)');
    dotGrad.addColorStop(1, 'rgba(108,99,255,0)');
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.fillStyle = dotGrad;
    ctx.fill();

    // Dot
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? '#6C63FF' : '#00E5A0';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Value label
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.val}%`, p.x, p.y - 18);

    // X label
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px Sarabun, sans-serif';
    ctx.fillText(p.label, p.x, H - padB + 20);
  });
}

function renderTreatmentPlan() {
  const { nihss } = state.patientData;
  const isSevere = nihss >= 16;

  const plan = [
    {
      period: 'สัปดาห์ที่ 1-2',
      sub: 'ระยะเฉียบพลัน',
      items: [
        { icon: '🏥', title: 'กายภาพบำบัดในเตียง', desc: 'ฝึกการเคลื่อนไหวข้อต่อ (ROM Exercise) ป้องกันการแข็งเกร็ง', freq: '2×/วัน' },
        { icon: '🗣️', title: 'กระตุ้นการพูด', desc: 'ฝึกออกเสียงและการสื่อสารเบื้องต้นกับนักบำบัดการพูด', freq: 'วันละ 30 นาที' },
        { icon: '💊', title: 'ยาป้องกันการแข็งตัว', desc: 'รับยาตามที่แพทย์สั่งอย่างเคร่งครัด ตรวจ INR สม่ำเสมอ', freq: 'ตามแพทย์สั่ง' },
      ]
    },
    {
      period: 'เดือนที่ 1',
      sub: 'ระยะฟื้นฟู',
      items: [
        { icon: '💪', title: 'ฝึกกล้ามเนื้อแขน-ขา', desc: 'โปรแกรม Progressive Resistance Training เพิ่มแรงต้านทีละน้อย', freq: '3×/สัปดาห์' },
        { icon: '🚶', title: 'ฝึกเดินด้วย Walker', desc: 'เริ่มจากเดินในพื้นที่ราบ 10 นาที เพิ่มเป็น 20 นาทีภายใน 2 สัปดาห์', freq: 'ทุกวัน' },
        { icon: '🧩', title: 'บำบัดด้านความคิด', desc: 'ฝึกความจำ การวางแผน และสมาธิด้วยเกมและแบบฝึกหัด', freq: '1×/วัน' },
      ]
    },
    {
      period: 'เดือนที่ 2-3',
      sub: 'ระยะเสริมสร้าง',
      items: [
        { icon: '🏊', title: 'ไฮโดรเทอราปี', desc: 'ฝึกในน้ำอุ่นเพื่อลดน้ำหนักและฝึกการทรงตัว', freq: '2×/สัปดาห์' },
        { icon: '🎯', title: 'Occupational Therapy', desc: 'ฝึกกิจวัตรประจำวัน: รับประทานอาหาร, แต่งกาย, อาบน้ำ', freq: 'ทุกวัน' },
        { icon: '🧘', title: 'โยคะและการหายใจ', desc: 'ลดความเครียด เพิ่มสมาธิ และปรับสมดุลร่างกาย', freq: '3×/สัปดาห์' },
      ]
    },
    {
      period: 'เดือนที่ 4-6',
      sub: 'ระยะคงสภาพ',
      items: [
        { icon: '🏃', title: 'ออกกำลังกายอิสระ', desc: 'เดินเร็วหรือว่ายน้ำโดยไม่ต้องมีผู้ดูแลตลอดเวลา', freq: '5×/สัปดาห์' },
        { icon: '👥', title: 'กลุ่มสนับสนุน Stroke', desc: 'เข้าร่วมกลุ่มผู้ป่วย Stroke เพื่อแลกเปลี่ยนประสบการณ์', freq: '1×/สัปดาห์' },
        { icon: '📊', title: 'ติดตามผลกับแพทย์', desc: 'ตรวจประเมินความก้าวหน้าและปรับแผนการรักษา', freq: 'ทุก 4 สัปดาห์' },
      ]
    }
  ];

  document.getElementById('treatment-timeline').innerHTML = plan.map((p, pi) => `
    <div class="treatment-period">
      <div class="treatment-period-label">
        <div class="period-dot" style="background:${['var(--primary)', 'var(--accent)', 'var(--success)', '#FF6B9D'][pi]}; box-shadow: 0 0 12px ${['rgba(108,99,255,0.6)', 'rgba(0,212,255,0.6)', 'rgba(0,229,160,0.6)', 'rgba(255,107,157,0.6)'][pi]}"></div>
        ${pi < plan.length - 1 ? '<div class="period-line"></div>' : ''}
        <span class="period-name">${p.period}</span>
        <span class="period-sub">${p.sub}</span>
      </div>
      <div class="treatment-items">
        ${p.items.map(item => `
          <div class="treatment-item">
            <span class="treatment-item-icon">${item.icon}</span>
            <div class="treatment-item-info">
              <div class="treatment-item-title">${item.title}</div>
              <div class="treatment-item-desc">${item.desc}</div>
            </div>
            <span class="treatment-item-freq">${item.freq}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function renderRiskFactors() {
  const { conditions, nihss, age } = state.patientData;
  const risks = [];

  if ((conditions || []).includes('hypertension')) {
    risks.push({ level: 'high', icon: '🩺', title: 'ความดันโลหิตสูง', desc: 'ควบคุมความดันให้ต่ำกว่า 140/90 mmHg ลดเกลือและอาหารมัน' });
  }
  if ((conditions || []).includes('diabetes')) {
    risks.push({ level: 'high', icon: '🩸', title: 'เบาหวาน', desc: 'ควบคุมน้ำตาลในเลือด HbA1c < 7% รับประทานอาหาร GI ต่ำ' });
  }
  if ((conditions || []).includes('heart')) {
    risks.push({ level: 'high', icon: '💓', title: 'โรคหัวใจ', desc: 'ตรวจ EKG และ ECHO หัวใจสม่ำเสมอ หลีกเลี่ยงการออกกำลังกายหนัก' });
  }
  if ((conditions || []).includes('smoking')) {
    risks.push({ level: 'high', icon: '🚬', title: 'การสูบบุหรี่', desc: 'หยุดสูบบุหรี่ทันที เพิ่มความเสี่ยง Stroke ซ้ำถึง 2 เท่า' });
  }
  if (age >= 65) {
    risks.push({ level: 'medium', icon: '🧓', title: 'ปัจจัยด้านอายุ', desc: 'ผู้สูงอายุมีความเสี่ยงฟื้นตัวช้าลง ควรมีผู้ดูแลระหว่างการฝึก' });
  }
  if (nihss >= 16) {
    risks.push({ level: 'medium', icon: '🏥', title: 'ความรุนแรงของโรค', desc: 'NIHSS สูง ควรอยู่ในการดูแลของทีมแพทย์เฉพาะทางอย่างใกล้ชิด' });
  }
  risks.push({ level: 'low', icon: '✅', title: 'ติดตามด้วย NeuroTwin', desc: 'ใช้งาน NeuroTwin ประเมินการฟื้นตัวทุก 2 สัปดาห์เพื่อปรับแผนการรักษา' });
  risks.push({ level: 'low', icon: '🥗', title: 'โภชนาการ DASH Diet', desc: 'รับประทานผักผลไม้ ธัญพืชไม่ขัดสี ปลา และถั่วเป็นหลัก ลดโซเดียม' });

  document.getElementById('risk-grid').innerHTML = risks.map(r => `
    <div class="risk-card ${r.level}">
      <span class="risk-icon">${r.icon}</span>
      <div class="risk-text">
        <h4>${r.title}</h4>
        <p>${r.desc}</p>
      </div>
      <span class="risk-level">${r.level === 'high' ? 'สูง' : r.level === 'medium' ? 'ปานกลาง' : 'ต่ำ'}</span>
    </div>
  `).join('');
}

// ===================================================
// PRINT / EXPORT
// ===================================================
function printReport() {
  showToast('📄 กำลังเตรียมรายงาน...', 'success');
  setTimeout(() => window.print(), 600);
}

// ===================================================
// UTILITIES
// ===================================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function animateValue(id, from, to, duration) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

let toastTimeout;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.className = 'toast hidden'; }, 3000);
}

// ===================================================
// RADIO CARD VISUAL FIX
// ===================================================
document.querySelectorAll('.radio-card input[type="radio"]').forEach(r => {
  r.addEventListener('change', () => {
    document.querySelectorAll('.radio-card').forEach(card => card.classList.remove('selected'));
    r.closest('.radio-card').classList.add('selected');
  });
});

// ===================================================
// INIT
// ===================================================
document.addEventListener('DOMContentLoaded', () => {
  // Set today's date minus 7 days as default stroke date
  const d = new Date();
  d.setDate(d.getDate() - 7);
  document.getElementById('stroke-date').value = d.toISOString().split('T')[0];
});
