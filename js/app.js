// ============================================
// 葱蒜的考研日记 — Web 版
// ============================================

// ===== Supabase 配置 =====
const SUPABASE_URL = 'https://phmkjfxvpowbgtxaotir.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobWtqZnh2cG93Ymd0eGFvdGlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTM2MDksImV4cCI6MjA5ODIyOTYwOX0.4XCnkUoDZ1fBaAg-SILIrgay1c09fI4ZdKi25DHUZM4';

let supabase = null;
try {
  if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch(e) {
  console.error('Supabase 初始化失败:', e);
}

// ===== 全局状态 =====
const state = {
  pairCode: localStorage.getItem('pairCode') || '',
  role: localStorage.getItem('role') || '', // 'cong' | 'suan'
  nickname: localStorage.getItem('nickname') || '',
  partner: null, // { role, nickname }
  // 日历
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  // 番茄钟
  timerMode: 'work',
  timerState: 'idle',
  timerRemaining: 25 * 60,
  timerTotal: 25 * 60,
  timerId: null,
};

// ===== 工具函数 =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function today() { return formatDate(new Date()); }

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function generatePairCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function calcStreak(dates) {
  if (!dates.length) return 0;
  const sorted = [...dates].sort().reverse();
  const t = today();
  const y = formatDate(new Date(Date.now() - 86400000));
  if (sorted[0] !== t && sorted[0] !== y) return 0;
  let streak = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const diff = (new Date(sorted[i]) - new Date(sorted[i + 1])) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function firstDayOfMonth(y, m) { return new Date(y, m, 1).getDay(); }

function generateCalendar(y, m) {
  const days = daysInMonth(y, m);
  const first = firstDayOfMonth(y, m);
  const t = today();
  const cal = [];
  for (let i = 0; i < first; i++) {
    const d = new Date(y, m, -first + i + 1);
    cal.push({ date: formatDate(d), day: d.getDate(), current: false, isToday: false });
  }
  for (let i = 1; i <= days; i++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    cal.push({ date: dateStr, day: i, current: true, isToday: dateStr === t });
  }
  while (cal.length < 42) {
    const i = cal.length - days - first + 1;
    const d = new Date(y, m + 1, i);
    cal.push({ date: formatDate(d), day: d.getDate(), current: false, isToday: false });
  }
  return cal;
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1800);
}

// ===== Tab 切换 =====
function switchTab(tab) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.tab-item').forEach(t => t.classList.remove('active'));
  $(`#view-${tab}`).classList.add('active');
  $(`.tab-item[data-tab="${tab}"]`).classList.add('active');
  if (tab === 'calendar') renderCalendar();
  if (tab === 'pomodoro') drawTimerRing();
  if (tab === 'journal') loadJournals();
  if (tab === 'profile') renderProfile();
}

$$('.tab-item').forEach(el => {
  el.addEventListener('click', () => switchTab(el.dataset.tab));
});

// ===== 用户 & 配对 =====
function saveState() {
  localStorage.setItem('pairCode', state.pairCode);
  localStorage.setItem('role', state.role);
  localStorage.setItem('nickname', state.nickname);
}

async function initOrGetUser() {
  if (!supabase) { console.warn('Supabase 未加载，跳过数据库操作'); return; }
  if (!state.pairCode) {
    state.pairCode = generatePairCode();
    saveState();
  }

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('pair_code', state.pairCode);

  const me = data?.find(u => u.role === state.role);
  if (!me && state.role) {
    await supabase.from('users').insert({
      pair_code: state.pairCode,
      role: state.role,
      nickname: state.nickname,
    });
  } else if (me && state.nickname && me.nickname !== state.nickname) {
    await supabase.from('users').update({ nickname: state.nickname }).eq('id', me.id);
  }

  // 获取搭档信息
  const otherRole = state.role === 'cong' ? 'suan' : 'cong';
  const partner = data?.find(u => u.role === otherRole);
  if (partner) {
    state.partner = { role: partner.role, nickname: partner.nickname };
  }
}

async function setRole(role) {
  if (state.partner) { toast('已配对，无法修改身份'); return; }
  state.role = role;
  saveState();
  await initOrGetUser();
  renderProfile();
  toast(role === 'cong' ? '已设置为 🧅 葱' : '已设置为 🧄 蒜');
}

async function doPair() {
  if (!state.role) { toast('请先选择身份'); return; }
  if (state.partner) { toast('已经配对过了'); return; }
  const code = $('#partnerCodeInput').value.trim();
  if (code.length < 6) { toast('请输入正确的配对码'); return; }
  if (code === state.pairCode) { toast('不能和自己配对哦'); return; }

  // 查找拥有该配对码的用户
  const { data } = await supabase.from('users').select('*').eq('pair_code', code);
  if (!data?.length) { toast('配对码无效，请检查'); return; }

  const owner = data[0];

  // 检查对方是否已配对（同一个 pair_code 下有两个人就是已配对）
  const { data: alreadyPaired } = await supabase.from('users').select('*').eq('pair_code', code);
  if (alreadyPaired && alreadyPaired.length >= 2) {
    toast('对方已经和别人配对啦');
    return;
  }

  // 检查身份是否冲突
  if (owner.role === state.role) {
    toast('你们选了同一个身份！一个人需要换成另一个哦～');
    return;
  }

  // 更新自己数据库里的 pair_code
  const { data: myData } = await supabase.from('users').select('*').eq('pair_code', state.pairCode).eq('role', state.role);
  if (myData?.length) {
    await supabase.from('users').update({ pair_code: code }).eq('id', myData[0].id);
  }

  state.pairCode = code;
  saveState();
  await initOrGetUser();
  renderProfile();
  renderCalendar();
  loadJournals();
  toast('配对成功！💕');
}

async function unpair() {
  // 找到配对双方在数据库的记录
  const { data } = await supabase.from('users').select('*').eq('pair_code', state.pairCode);

  const myNewCode = generatePairCode();
  const partnerNewCode = generatePairCode();

  if (data?.length >= 2) {
    const me = data.find(u => u.role === state.role);
    const partner = data.find(u => u.role !== state.role);
    if (me) await supabase.from('users').update({ pair_code: myNewCode }).eq('id', me.id);
    if (partner) await supabase.from('users').update({ pair_code: partnerNewCode }).eq('id', partner.id);
  } else if (data?.length === 1) {
    await supabase.from('users').update({ pair_code: myNewCode }).eq('id', data[0].id);
  }

  state.pairCode = myNewCode;
  state.partner = null;
  saveState();
  renderProfile();
  renderCalendar();
  toast('已解除配对，双方已分开');
}

// ============================================
// 📅 日历签到
// ============================================
const EMOJIS = ['😊','🥰','😆','😎','🤩','😇','💪','📚','✍️','🎯','🔥','⭐','😌','🧘','🍃','☕','🌙','🌸','😢','😤','😴','🤔','🥺','😅'];

async function renderCalendar() {
  if (!state.pairCode) return;
  const { year, month } = state;
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;

  $('#displayMonth').textContent = `${year}年 ${month + 1}月`;

  // 获取本月签到
  const { data: checkins } = await supabase
    .from('checkins')
    .select('*')
    .eq('pair_code', state.pairCode)
    .like('date', `${ym}-%`);

  const myChecks = checkins?.filter(c => c.role === state.role) || [];
  const partnerChecks = checkins?.filter(c => c.role !== state.role) || [];

  const myDates = new Set(myChecks.map(c => c.date));
  const partnerDates = new Set(partnerChecks.map(c => c.date));
  const myEmoji = {}; myChecks.forEach(c => { if (c.emoji) myEmoji[c.date] = c.emoji; });
  const partnerEmoji = {}; partnerChecks.forEach(c => { if (c.emoji) partnerEmoji[c.date] = c.emoji; });

  const cal = generateCalendar(year, month);
  const t = today();
  const grid = $('#calendarGrid');
  grid.innerHTML = cal.map(c => {
    const both = myDates.has(c.date) && partnerDates.has(c.date);
    const mine = myDates.has(c.date);
    const theirs = partnerDates.has(c.date);
    const isFuture = c.date > t;
    let cls = 'day-cell';
    if (!c.current) cls += ' dimmed';
    if (c.isToday) cls += ' today';
    if (isFuture) cls += ' future';
    let mark = '';
    if (both) mark = `<div class="checkin-marks"><span class="both-mark">💕</span></div>`;
    else if (mine) mark = `<div class="checkin-marks"><span class="checkin-mark">${myEmoji[c.date] || '✅'}</span></div>`;
    else if (theirs) mark = `<div class="checkin-marks"><span class="checkin-mark" style="opacity:0.5">${partnerEmoji[c.date] || '✅'}</span></div>`;
    const clickable = (mine || theirs) && !isFuture;
    return `<div class="${cls}" ${clickable ? `onclick="showDayDetail('${c.date}')"` : ''}>${c.day}${mark}</div>`;
  }).join('');

  // 今日签到状态
  const myToday = myChecks.find(c => c.date === t);
  const partnerToday = partnerChecks.find(c => c.date === t);

  if (myToday) {
    $('#checkinPending').style.display = 'none';
    $('#checkinDone').style.display = 'block';
    $('#myTodayEmoji').textContent = myToday.emoji || '✅';
    if (partnerToday) {
      $('#partnerStatus').innerHTML = `<div class="partner-status checked">💛 ${state.partner?.nickname || 'TA'}也签到啦 ${partnerToday.emoji || '✅'}</div>`;
    } else {
      $('#partnerStatus').innerHTML = `<div class="partner-status waiting">等待 ${state.partner?.nickname || 'TA'} 签到中...</div>`;
    }
  } else {
    $('#checkinPending').style.display = 'flex';
    $('#checkinDone').style.display = 'none';
    $('#todayLabel').textContent = `今天是 ${year}年${month + 1}月${new Date().getDate()}日`;
  }

  // 统计
  const myDatesArr = [...myDates].sort().reverse();
  const partnerDatesArr = [...partnerDates].sort().reverse();
  const bothCount = [...myDates].filter(d => partnerDates.has(d)).length;
  const partnerLabel = state.partner?.nickname || 'TA';

  $('#statMy').textContent = myChecks.length;
  $('#statPartner').textContent = partnerChecks.length;
  $('#statBoth').textContent = bothCount;
  $('#statMyStreak').textContent = `🔥 ${calcStreak(myDatesArr)}天`;
  $('#statPartnerStreak').textContent = `🔥 ${calcStreak(partnerDatesArr)}天`;
  $('#statPartnerLabel').textContent = `${partnerLabel}签了`;
}

// Emoji 选择器
$('#checkinBtn').addEventListener('click', () => {
  $('#emojiOverlay').classList.add('show');
  const grid = $('#emojiGrid');
  grid.innerHTML = EMOJIS.map(e =>
    `<span class="emoji-item" data-emoji="${e}">${e}</span>`
  ).join('');
  grid.querySelectorAll('.emoji-item').forEach(el => {
    el.addEventListener('click', () => doCheckin(el.dataset.emoji));
  });
});

$('#skipEmoji').addEventListener('click', () => doCheckin(''));
$('#emojiOverlay').addEventListener('click', (e) => {
  if (e.target === $('#emojiOverlay')) $('#emojiOverlay').classList.remove('show');
});

async function doCheckin(emoji) {
  $('#emojiOverlay').classList.remove('show');
  const t = today();
  const { data: existing } = await supabase
    .from('checkins')
    .select('*')
    .eq('pair_code', state.pairCode)
    .eq('role', state.role)
    .eq('date', t);

  if (existing?.length) { toast('今天已经签到过了～'); return; }

  const { error } = await supabase.from('checkins').insert({
    pair_code: state.pairCode,
    role: state.role,
    date: t,
    emoji,
  });
  if (error) { toast('签到失败'); return; }
  toast('签到成功！✨');
  renderCalendar();
}

function showDayDetail(date) {
  // 简单弹窗显示当天签到详情
  supabase.from('checkins').select('*').eq('pair_code', state.pairCode).eq('date', date).then(({ data }) => {
    if (!data?.length) return;
    const lines = data.map(c => {
      const label = c.role === state.role ? '我' : (state.partner?.nickname || 'TA');
      const icon = c.role === 'cong' ? '🧅' : '🧄';
      return `${icon} ${label}: ${c.emoji || '没有心情记录'}`;
    }).join('\n');
    showModal(date, lines, false);
  });
}

$('#prevMonth').addEventListener('click', () => {
  if (state.month === 0) { state.year--; state.month = 11; }
  else state.month--;
  renderCalendar();
});
$('#nextMonth').addEventListener('click', () => {
  if (state.month === 11) { state.year++; state.month = 0; }
  else state.month++;
  renderCalendar();
});

// ============================================
// 🍅 番茄钟
// ============================================
function drawTimerRing() {
  const canvas = $('#timerCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = 260, h = 260;
  const cx = w / 2, cy = h / 2;
  const r = Math.min(cx, cy) - 12;
  const ratio = state.timerTotal > 0 ? state.timerRemaining / state.timerTotal : 0;

  ctx.clearRect(0, 0, w, h);

  // 背景环
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(245,214,179,.4)';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.stroke();

  // 进度环
  if (ratio > 0) {
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * ratio;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    if (state.timerMode === 'work') {
      grad.addColorStop(0, '#E8916A');
      grad.addColorStop(1, '#F5A623');
    } else {
      grad.addColorStop(0, '#A8C97E');
      grad.addColorStop(1, '#81B29A');
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

function updateTimerDisplay() {
  $('#timerDisplay').textContent = formatTime(state.timerRemaining);
  const modeText = state.timerMode === 'work'
    ? (state.timerState === 'idle' ? '🍅 准备专注' : '🍅 专注中')
    : (state.timerState === 'idle' ? '☕ 准备休息' : '☕ 休息中');
  $('#timerModeText').textContent = modeText;
  drawTimerRing();
}

function timerTick() {
  if (state.timerState !== 'running') return;
  state.timerRemaining--;
  updateTimerDisplay();
  if (state.timerRemaining <= 0) {
    clearInterval(state.timerId);
    state.timerId = null;
    onTimerComplete();
  }
}

function onTimerComplete() {
  state.timerState = 'idle';
  clearInterval(state.timerId);
  state.timerId = null;

  // 尝试震动
  if (navigator.vibrate) navigator.vibrate([500, 200, 500]);

  if (state.timerMode === 'work') {
    showModal('🎉 太棒了！', '专注时间结束，休息一下吧～', true, '开始休息 ☕', '等会儿')
      .then(ok => { if (ok) startBreak(); else updateUIState(); });
  } else {
    showModal('☕ 休息好了吗？', '休息时间结束，继续加油吧！', true, '继续专注 🍅', '等会儿')
      .then(ok => { if (ok) startWork(); else updateUIState(); });
  }
}

function startWork() {
  state.timerMode = 'work';
  state.timerRemaining = parseInt($('#workSlider').value) * 60;
  state.timerTotal = state.timerRemaining;
  state.timerState = 'running';
  state.timerId = setInterval(timerTick, 1000);
  updateTimerDisplay();
  updateUIState();
}

function startBreak() {
  state.timerMode = 'break';
  state.timerRemaining = parseInt($('#breakSlider').value) * 60;
  state.timerTotal = state.timerRemaining;
  state.timerState = 'running';
  state.timerId = setInterval(timerTick, 1000);
  updateTimerDisplay();
  updateUIState();
}

function updateUIState() {
  const { timerState, timerMode } = state;
  const toggle = $('#timerToggle');
  const label = $('#timerToggleLabel');
  const icon = toggle.querySelector('.btn-icon');

  toggle.className = 'main-btn';
  if (timerState === 'running') {
    toggle.classList.add('pause');
    if (timerMode === 'break') toggle.classList.add('break');
    icon.textContent = '⏸️';
    label.textContent = `暂停${timerMode === 'work' ? '专注' : '休息'}`;
  } else {
    toggle.classList.add('start');
    if (timerMode === 'break') toggle.classList.add('break');
    icon.textContent = timerState === 'paused' ? '▶️' : '▶️';
    const action = timerState === 'paused' ? '继续' : '开始';
    label.textContent = `${action}${timerMode === 'work' ? '专注' : '休息'}`;
  }

  $('#subControls').style.display = timerState !== 'idle' ? 'flex' : 'none';
  $('#skipTimer').style.display = (timerState === 'running' && timerMode === 'work') ? 'block' : 'none';
  // 运行中禁用滑块
  $('#workSlider').disabled = timerState === 'running';
  $('#breakSlider').disabled = timerState === 'running';
}

$('#timerToggle').addEventListener('click', () => {
  if (state.timerState === 'running') {
    state.timerState = 'paused';
    clearInterval(state.timerId);
    state.timerId = null;
    updateTimerDisplay();
    updateUIState();
  } else {
    if (state.timerState === 'idle') {
      state.timerRemaining = state.timerMode === 'work'
        ? parseInt($('#workSlider').value) * 60
        : parseInt($('#breakSlider').value) * 60;
      state.timerTotal = state.timerRemaining;
    }
    state.timerState = 'running';
    state.timerId = setInterval(timerTick, 1000);
    updateTimerDisplay();
    updateUIState();
  }
});

$('#resetTimer').addEventListener('click', () => {
  clearInterval(state.timerId);
  state.timerId = null;
  state.timerState = 'idle';
  state.timerRemaining = state.timerMode === 'work'
    ? parseInt($('#workSlider').value) * 60
    : parseInt($('#breakSlider').value) * 60;
  state.timerTotal = state.timerRemaining;
  updateTimerDisplay();
  updateUIState();
});

$('#skipTimer').addEventListener('click', () => {
  clearInterval(state.timerId);
  state.timerId = null;
  state.timerState = 'idle';
  startBreak();
});

$('#workSlider').addEventListener('input', function() {
  const v = parseInt(this.value);
  $('#workValue').textContent = `${v} 分钟`;
  if (state.timerState === 'idle' && state.timerMode === 'work') {
    state.timerRemaining = v * 60;
    state.timerTotal = v * 60;
    updateTimerDisplay();
  }
  // 保存设置
  savePomodoroSettings();
});

$('#breakSlider').addEventListener('input', function() {
  const v = parseInt(this.value);
  $('#breakValue').textContent = `${v} 分钟`;
  if (state.timerState === 'idle' && state.timerMode === 'break') {
    state.timerRemaining = v * 60;
    state.timerTotal = v * 60;
    updateTimerDisplay();
  }
  savePomodoroSettings();
});

let _savePomTimer;
function savePomodoroSettings() {
  clearTimeout(_savePomTimer);
  _savePomTimer = setTimeout(async () => {
    if (!state.pairCode || !state.role) return;
    const wm = parseInt($('#workSlider').value);
    const bm = parseInt($('#breakSlider').value);
    const { data } = await supabase.from('pomodoro_settings')
      .select('*').eq('pair_code', state.pairCode).eq('role', state.role);
    if (data?.length) {
      await supabase.from('pomodoro_settings').update({ work_minutes: wm, break_minutes: bm }).eq('id', data[0].id);
    } else {
      await supabase.from('pomodoro_settings').insert({ pair_code: state.pairCode, role: state.role, work_minutes: wm, break_minutes: bm });
    }
  }, 500);
}

async function loadPomodoroSettings() {
  if (!state.pairCode || !state.role) return;
  const { data } = await supabase.from('pomodoro_settings')
    .select('*').eq('pair_code', state.pairCode).eq('role', state.role);
  if (data?.length) {
    $('#workSlider').value = data[0].work_minutes;
    $('#workValue').textContent = `${data[0].work_minutes} 分钟`;
    $('#breakSlider').value = data[0].break_minutes;
    $('#breakValue').textContent = `${data[0].break_minutes} 分钟`;
    state.timerRemaining = data[0].work_minutes * 60;
    state.timerTotal = state.timerRemaining;
    updateTimerDisplay();
  }
}

$('#toggleSettings').addEventListener('click', () => {
  const body = $('#settingsBody');
  const arrow = $('#settingsArrow');
  body.classList.toggle('open');
  arrow.classList.toggle('open');
});

// ============================================
// 📝 学习日记
// ============================================
let journalSkip = 0;
let journalHasMore = true;
const JOURNAL_LIMIT = 20;

async function loadJournals(reset = true) {
  if (!state.pairCode) return;
  if (reset) { journalSkip = 0; journalHasMore = true; }

  const { data, error } = await supabase
    .from('journals')
    .select('*')
    .eq('pair_code', state.pairCode)
    .order('created_at', { ascending: false })
    .range(journalSkip, journalSkip + JOURNAL_LIMIT - 1);

  if (error || !data) return;

  journalSkip += data.length;
  journalHasMore = data.length >= JOURNAL_LIMIT;

  if (reset) $('#journalTimeline').innerHTML = '';

  if (data.length === 0 && reset) {
    $('#journalEmpty').style.display = 'block';
    return;
  }
  $('#journalEmpty').style.display = 'none';

  data.forEach(item => {
    const isMe = item.role === state.role;
    const displayName = isMe ? '我' : (state.partner?.nickname || 'TA');
    const time = new Date(item.created_at);
    const timeStr = `${time.getMonth() + 1}月${time.getDate()}日 ${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}`;
    const imagesHtml = item.images?.length
      ? `<div class="journal-images">${item.images.map(img => `<img class="journal-img" src="${img}" onclick="previewImage('${img}')">`).join('')}</div>`
      : '';

    const el = document.createElement('div');
    el.className = 'timeline-item fade-in';
    el.innerHTML = `
      <div class="timeline-line">
        <div class="timeline-dot ${isMe ? 'dot-me' : 'dot-partner'}"></div>
        <div class="timeline-connector"></div>
      </div>
      <div class="journal-card card">
        <div class="journal-header">
          <div class="journal-author">
            ${isMe ? '🧅' : '🧄'} ${displayName}
            <span class="${isMe ? 'tag-cong' : 'tag-suan'}">${item.role === 'cong' ? '葱' : '蒜'}</span>
          </div>
          <span class="journal-time">${timeStr}</span>
        </div>
        ${item.content ? `<div class="journal-body">${escapeHtml(item.content)}</div>` : ''}
        ${imagesHtml}
      </div>`;
    if (reset) {
      $('#journalTimeline').appendChild(el);
    } else {
      // 不用 prepend，追加到末尾（因为前面有旧数据）
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function previewImage(url) {
  window.open(url, '_blank');
}

// 滚动加载更多
window.addEventListener('scroll', () => {
  if ($('#view-journal').classList.contains('active') && journalHasMore) {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight > scrollHeight - 200) {
      loadJournals(false);
    }
  }
});

// 写日记
$('#openEditor').addEventListener('click', () => {
  if (!state.role) { toast('请先在"我的"页面设置身份'); return; }
  $('#editorOverlay').classList.add('show');
  $('#editorContent').value = '';
  $('#charCount').textContent = '0';
  $('#imagePreviewRow').innerHTML = '';
  selectedImages = [];
});

$('#closeEditor').addEventListener('click', () => {
  $('#editorOverlay').classList.remove('show');
});
$('#editorOverlay').addEventListener('click', (e) => {
  if (e.target === $('#editorOverlay')) $('#editorOverlay').classList.remove('show');
});

$('#editorContent').addEventListener('input', function() {
  $('#charCount').textContent = this.value.length;
});

let selectedImages = [];
$('#chooseImage').addEventListener('click', () => $('#imageInput').click());

$('#imageInput').addEventListener('change', function() {
  const files = Array.from(this.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      selectedImages.push({ file, preview: e.target.result });
      renderImagePreviews();
    };
    reader.readAsDataURL(file);
  });
  this.value = '';
});

function renderImagePreviews() {
  $('#imagePreviewRow').innerHTML = selectedImages.map((img, i) => `
    <div class="image-preview-wrap">
      <img class="image-preview" src="${img.preview}">
      <span class="image-delete-btn" onclick="removeImage(${i})">✕</span>
    </div>
  `).join('');
}

window.removeImage = function(i) {
  selectedImages.splice(i, 1);
  renderImagePreviews();
};

$('#publishJournal').addEventListener('click', async () => {
  const content = $('#editorContent').value.trim();
  if (!content && selectedImages.length === 0) { toast('写点什么吧～'); return; }

  $('#publishJournal').disabled = true;
  $('#publishJournal').textContent = '发布中...';

  // 上传图片
  const imageUrls = [];
  for (const img of selectedImages) {
    const filename = `journals/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { data, error } = await supabase.storage.from('journals').upload(filename, img.file);
    if (!error) {
      const { data: publicUrl } = supabase.storage.from('journals').getPublicUrl(filename);
      imageUrls.push(publicUrl.publicUrl);
    }
  }

  const { error } = await supabase.from('journals').insert({
    pair_code: state.pairCode,
    role: state.role,
    content,
    images: imageUrls,
  });

  $('#publishJournal').disabled = false;
  $('#publishJournal').textContent = '📝 发布';

  if (error) { toast('发布失败'); return; }

  toast('发布成功！');
  $('#editorOverlay').classList.remove('show');
  loadJournals();
});

// ============================================
// 👤 个人中心
// ============================================
function renderProfile() {
  const avatar = $('#profileAvatar');
  if (state.role === 'cong') { avatar.textContent = '🧅'; }
  else if (state.role === 'suan') { avatar.textContent = '🧄'; }
  else { avatar.textContent = '💛'; }

  $('#nicknameInput').value = state.nickname;

  const tag = $('#roleTag');
  if (state.role === 'cong') { tag.textContent = '🧅 我是葱'; tag.className = 'role-tag cong'; }
  else if (state.role === 'suan') { tag.textContent = '🧄 我是蒜'; tag.className = 'role-tag suan'; }
  else { tag.textContent = '👆 选择身份'; tag.className = 'role-tag'; }

  // 身份选择卡片
  if (!state.role) {
    $('#roleSelectCard').style.display = 'block';
  } else {
    $('#roleSelectCard').style.display = 'none';
  }

  // 配对状态
  if (state.partner) {
    const pRole = state.partner.role;
    $('#pairedInfo').innerHTML = `
      <div class="partner-card">
        <div class="avatar-sm">${pRole === 'cong' ? '🧅' : '🧄'}</div>
        <div>
          <span class="partner-name">${state.partner.nickname || 'TA'}</span>
          <span class="${pRole === 'cong' ? 'tag-cong' : 'tag-suan'}">${pRole === 'cong' ? '葱' : '蒜'}</span>
        </div>
      </div>
      <div class="unpair-btn" onclick="unpair()">解除配对</div>
    `;
    $('#unpairedInfo').style.display = 'none';
    $('#pairedInfo').style.display = 'block';
  } else {
    $('#pairedInfo').style.display = 'none';
    $('#unpairedInfo').style.display = 'block';
    $('#myPairCode').textContent = state.pairCode;
    if (state.role) {
      $('#pairCodeArea').style.display = 'block';
    } else {
      $('#pairCodeArea').style.display = 'none';
    }
  }
}

$('#roleTag').addEventListener('click', () => {
  if (state.partner) { toast('已配对，无法修改身份'); return; }
  $('#roleSelectCard').style.display = $('#roleSelectCard').style.display === 'none' ? 'block' : 'none';
});

$$('.role-option').forEach(btn => {
  btn.addEventListener('click', () => setRole(btn.dataset.role));
});

$('#nicknameInput').addEventListener('blur', function() {
  state.nickname = this.value.trim();
  saveState();
  initOrGetUser();
});

$('#copyPairCode').addEventListener('click', () => {
  navigator.clipboard.writeText(state.pairCode).then(() => toast('配对码已复制'))
    .catch(() => toast('复制失败，请手动记录'));
});

$('#doPair').addEventListener('click', doPair);

// ===== Modal =====
function showModal(title, content, hasCancel = false, confirmText = '确定', cancelText = '取消') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box bounce-in">
        <div class="modal-title">${title}</div>
        <div class="modal-content">${content}</div>
        <div class="modal-actions">
          ${hasCancel ? `<button class="btn btn-ghost cancel">${cancelText}</button>` : ''}
          <button class="btn btn-primary confirm">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.confirm').addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });
    if (hasCancel) {
      overlay.querySelector('.cancel').addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });
    }
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.remove(); resolve(false); }
    });
  });
}

// ============================================
// 🚀 初始化
// ============================================
async function init() {
  if (!supabase) {
    console.warn('Supabase 未加载，请在网络正常的环境下使用');
    renderProfile();
    updateTimerDisplay();
    return;
  }
  await initOrGetUser();
  await loadPomodoroSettings();
  renderCalendar();
  renderProfile();
  updateTimerDisplay();

  // 初始设置默认值
  if (!state.timerRemaining) {
    state.timerRemaining = 25 * 60;
    state.timerTotal = 25 * 60;
    updateTimerDisplay();
  }
}

// 注册 Service Worker (PWA)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

init();
