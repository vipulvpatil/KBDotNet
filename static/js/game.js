/* ─── KBC .NET Edition — Game Logic ─────────────────────────────────────────
   Features:
   - 5 easy + 5 medium + 5 hard questions selected randomly each new game
   - Progress persisted to localStorage (refresh-safe)
   - New Game button available at any time
   - Correct answer always revealed on wrong answer
   ─────────────────────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'kbc_net_v2';

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  sessionQuestions: [],   // the 15 selected questions for this game
  questionIndex: 0,
  lifelinesUsed: { fiftyFifty: false, phone: false, audience: false },
  eliminatedOptions: [],
  status: 'idle',         // idle | playing | selecting | revealing | done
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function currentQuestion() { return state.sessionQuestions[state.questionIndex]; }

function safeWinnings() {
  for (let i = SAFE_LEVELS.length - 1; i >= 0; i--) {
    if (state.questionIndex > SAFE_LEVELS[i]) return PRIZES[SAFE_LEVELS[i]];
  }
  return '₹0';
}

// ─── Screen & Modal helpers ────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id)  { document.getElementById(id).classList.add('hidden'); }

// ─── localStorage ─────────────────────────────────────────────────────────────

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* quota exceeded — ignore */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Basic shape validation
    if (!Array.isArray(parsed.sessionQuestions) || parsed.sessionQuestions.length !== 15) return null;
    if (typeof parsed.questionIndex !== 'number') return null;
    return parsed;
  } catch (_) { return null; }
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── Question Selection ────────────────────────────────────────────────────────

function selectSessionQuestions() {
  // 5 from each tier — randomised independently
  const easy   = shuffle(EASY_QUESTIONS).slice(0, 5);
  const medium = shuffle(MEDIUM_QUESTIONS).slice(0, 5);
  const hard   = shuffle(HARD_QUESTIONS).slice(0, 5);
  return [...easy, ...medium, ...hard];
}

// ─── Prize Ladder ─────────────────────────────────────────────────────────────

function buildPrizeLadder() {
  const list = document.getElementById('prize-list');
  list.innerHTML = '';
  PRIZES.forEach((prize, i) => {
    const li = document.createElement('li');
    li.id = `prize-${i}`;
    const isSafe = SAFE_LEVELS.includes(i);
    li.innerHTML = `
      <span class="prize-num">${i + 1}</span>
      <span class="prize-amt">${prize}</span>
      ${isSafe ? '<span class="prize-safe" title="Safe level">🛡️</span>' : ''}
    `;
    if (isSafe) li.classList.add('is-safe');
    list.appendChild(li);
  });
}

function updatePrizeLadder() {
  PRIZES.forEach((_, i) => {
    const li = document.getElementById(`prize-${i}`);
    li.classList.remove('is-current', 'is-won');
    if (i === state.questionIndex)     li.classList.add('is-current');
    else if (i < state.questionIndex)  li.classList.add('is-won');
  });
  document.getElementById('current-prize').textContent   = PRIZES[state.questionIndex];
  document.getElementById('question-prize-tag').textContent = `For ${PRIZES[state.questionIndex]}`;
  document.getElementById('safe-amount').textContent     = safeWinnings();
}

// ─── Render Question ──────────────────────────────────────────────────────────

function renderQuestion() {
  const q = currentQuestion();
  state.status = 'playing';

  document.getElementById('question-number').textContent =
    `Question ${state.questionIndex + 1} of 15`;
  document.getElementById('question-text').textContent = q.question;

  ['A','B','C','D'].forEach(key => {
    const btn = document.getElementById(`opt-${key}`);
    btn.className = 'option-btn';
    btn.disabled = false;
    document.getElementById(`opt-${key}-text`).textContent = q.options[key];
  });

  // Re-apply any active 50:50 eliminations
  state.eliminatedOptions.forEach(key => {
    const btn = document.getElementById(`opt-${key}`);
    btn.classList.add('eliminated');
    btn.disabled = true;
  });

  // Restore lifeline button states
  document.getElementById('ll-5050').disabled    = state.lifelinesUsed.fiftyFifty;
  document.getElementById('ll-phone').disabled   = state.lifelinesUsed.phone;
  document.getElementById('ll-audience').disabled = state.lifelinesUsed.audience;

  updatePrizeLadder();
}

function disableOptions() {
  ['A','B','C','D'].forEach(k => { document.getElementById(`opt-${k}`).disabled = true; });
}

function enableOptions() {
  ['A','B','C','D'].forEach(k => {
    const btn = document.getElementById(`opt-${k}`);
    if (!state.eliminatedOptions.includes(k)) btn.disabled = false;
  });
}

// ─── Option Click Handler ─────────────────────────────────────────────────────

async function handleOptionClick(key) {
  if (state.status !== 'playing') return;
  state.status = 'selecting';
  saveState();
  disableOptions();

  const btn = document.getElementById(`opt-${key}`);
  btn.classList.add('selected');

  await sleep(900);

  // KBC-style flashing
  btn.classList.remove('selected');
  btn.classList.add('flashing');
  await sleep(1600);
  btn.classList.remove('flashing');

  const q = currentQuestion();
  const isCorrect = key === q.correct;

  if (isCorrect) {
    btn.classList.add('correct');
    await sleep(1400);
    state.questionIndex++;
    if (state.questionIndex >= 15) {
      state.status = 'done';
      saveState();
      showWinner();
    } else {
      state.eliminatedOptions = [];
      saveState();
      renderQuestion();
      enableOptions();
    }
  } else {
    // Show wrong answer
    btn.classList.add('wrong');
    await sleep(600);
    // Always reveal the correct answer
    document.getElementById(`opt-${q.correct}`).classList.add('correct');
    await sleep(1800);
    state.status = 'done';
    saveState();
    showGameOver(key, q);
  }
}

// ─── Result Screens ────────────────────────────────────────────────────────────

function showGameOver(chosenKey, q) {
  document.getElementById('gameover-message').textContent =
    `You answered "${q.options[chosenKey]}" — that was incorrect.`;
  document.getElementById('correct-reveal').innerHTML =
    `✅ Correct answer: <strong>(${q.correct}) ${q.options[q.correct]}</strong>`;
  document.getElementById('explanation-box').textContent = q.explanation;
  document.getElementById('final-winnings').textContent = safeWinnings();
  showScreen('gameover-screen');
}

function showWinner() {
  showScreen('winner-screen');
  launchConfetti();
}

// ─── Lifelines ────────────────────────────────────────────────────────────────

function useFiftyFifty() {
  if (state.lifelinesUsed.fiftyFifty || state.status !== 'playing') return;
  state.lifelinesUsed.fiftyFifty = true;
  document.getElementById('ll-5050').disabled = true;

  const q = currentQuestion();
  const wrong = shuffle(['A','B','C','D'].filter(k => k !== q.correct));
  state.eliminatedOptions = wrong.slice(0, 2);

  state.eliminatedOptions.forEach(k => {
    const btn = document.getElementById(`opt-${k}`);
    btn.classList.add('eliminated');
    btn.disabled = true;
  });
  saveState();
}

function usePhone() {
  if (state.lifelinesUsed.phone || state.status !== 'playing') return;
  state.lifelinesUsed.phone = true;
  document.getElementById('ll-phone').disabled = true;

  const q = currentQuestion();
  document.getElementById('phone-text').innerHTML =
    `"Hey! ${q.hint}<br><br>I'm fairly confident the answer is <strong>(${q.correct})</strong>."`;
  showModal('phone-modal');
  saveState();
}

function useAudience() {
  if (state.lifelinesUsed.audience || state.status !== 'playing') return;
  state.lifelinesUsed.audience = true;
  document.getElementById('ll-audience').disabled = true;

  const q = currentQuestion();
  const poll = generatePoll(q.correct, state.eliminatedOptions);
  renderPoll(poll);
  showModal('audience-modal');
  saveState();
}

function generatePoll(correctKey, eliminated) {
  const active = ['A','B','C','D'].filter(k => !eliminated.includes(k));
  const poll = { A: 0, B: 0, C: 0, D: 0 };

  const correctPct = 58 + Math.floor(Math.random() * 18);
  poll[correctKey] = correctPct;

  const others = active.filter(k => k !== correctKey);
  let remaining = 100 - correctPct;
  others.forEach((k, i) => {
    if (i === others.length - 1) {
      poll[k] = remaining;
    } else {
      const share = Math.max(1, Math.floor(Math.random() * remaining * 0.6));
      poll[k] = share;
      remaining -= share;
    }
  });
  return poll;
}

function renderPoll(poll) {
  const container = document.getElementById('poll-bars');
  container.innerHTML = '';
  ['A','B','C','D'].forEach(k => {
    const pct = poll[k];
    const row = document.createElement('div');
    row.className = 'poll-row';
    row.innerHTML = `
      <span class="poll-label">${k}</span>
      <div class="poll-bar-wrap">
        <div class="poll-bar-fill" style="width:0%" data-pct="${pct}">${pct}%</div>
      </div>
    `;
    container.appendChild(row);
  });
  requestAnimationFrame(() => {
    container.querySelectorAll('.poll-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
    });
  });
}

// ─── Walk Away ────────────────────────────────────────────────────────────────

function promptWalkAway() {
  if (state.status !== 'playing') return;
  const safe = safeWinnings();
  document.getElementById('walkaway-text').innerHTML =
    `You are playing for <strong>${PRIZES[state.questionIndex]}</strong>.<br>
     Safe amount: <strong>${safe}</strong>.<br><br>
     Walk away with your safe winnings?`;
  showModal('walkaway-modal');
}

function confirmWalkAway() {
  hideModal('walkaway-modal');
  state.status = 'done';
  saveState();
  document.getElementById('walkaway-winnings').textContent = safeWinnings();
  showScreen('walkaway-screen');
}

// ─── New Game ─────────────────────────────────────────────────────────────────

function promptNewGame() {
  // If idle or done, start directly
  if (state.status === 'idle' || state.status === 'done') {
    startFreshGame();
    return;
  }
  // Mid-game — confirm first
  document.getElementById('newgame-progress').textContent =
    `${state.questionIndex + 1} of 15`;
  document.getElementById('newgame-safe').textContent = safeWinnings();
  showModal('newgame-modal');
}

function startFreshGame() {
  clearState();
  state = {
    sessionQuestions: selectSessionQuestions(),
    questionIndex: 0,
    lifelinesUsed: { fiftyFifty: false, phone: false, audience: false },
    eliminatedOptions: [],
    status: 'playing',
  };
  saveState();
  buildPrizeLadder();
  renderQuestion();
  showScreen('game-screen');
}

// ─── Restore saved game on page load ─────────────────────────────────────────

function tryRestoreGame() {
  const saved = loadState();
  if (!saved || saved.status === 'idle') {
    showStartStats();
    showScreen('start-screen');
    return;
  }

  // Restore the state object
  state = saved;

  if (state.status === 'done') {
    // Game ended — show start screen (they can start a new game)
    showStartStats();
    showScreen('start-screen');
    return;
  }

  // Active mid-game — restore the game screen
  buildPrizeLadder();
  renderQuestion();
  showScreen('game-screen');
}

function showStartStats() {
  const el = document.getElementById('start-stats');
  const total = EASY_QUESTIONS.length + MEDIUM_QUESTIONS.length + HARD_QUESTIONS.length;
  el.innerHTML = `Question bank: <strong>${EASY_QUESTIONS.length}</strong> Easy · <strong>${MEDIUM_QUESTIONS.length}</strong> Medium · <strong>${HARD_QUESTIONS.length}</strong> Hard · <strong>${total}</strong> total — 5 from each tier per game`;
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

function launchConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const colors = ['#f5c518','#e8640a','#00c853','#2196f3','#e91e63','#9c27b0'];
  for (let i = 0; i < 120; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left:${Math.random() * 100}%;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      width:${6 + Math.random() * 8}px;
      height:${6 + Math.random() * 8}px;
      animation-duration:${2 + Math.random() * 3}s;
      animation-delay:${Math.random() * 2}s;
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    container.appendChild(piece);
  }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

document.getElementById('start-btn').addEventListener('click', startFreshGame);
document.getElementById('play-again-btn').addEventListener('click', startFreshGame);
document.getElementById('play-again-walkaway-btn').addEventListener('click', startFreshGame);
document.getElementById('play-again-winner-btn').addEventListener('click', startFreshGame);

// Options
['A','B','C','D'].forEach(key => {
  document.getElementById(`opt-${key}`).addEventListener('click', () => handleOptionClick(key));
});

// Lifelines
document.getElementById('ll-5050').addEventListener('click', useFiftyFifty);
document.getElementById('ll-phone').addEventListener('click', usePhone);
document.getElementById('ll-audience').addEventListener('click', useAudience);

// New game & walk away
document.getElementById('newgame-btn').addEventListener('click', promptNewGame);
document.getElementById('newgame-confirm').addEventListener('click', () => {
  hideModal('newgame-modal');
  startFreshGame();
});
document.getElementById('newgame-cancel').addEventListener('click', () => hideModal('newgame-modal'));

document.getElementById('walkaway-btn').addEventListener('click', promptWalkAway);
document.getElementById('walkaway-confirm').addEventListener('click', confirmWalkAway);
document.getElementById('walkaway-cancel').addEventListener('click', () => hideModal('walkaway-modal'));

// Modal closes
document.getElementById('phone-close').addEventListener('click', () => hideModal('phone-modal'));
document.getElementById('audience-close').addEventListener('click', () => hideModal('audience-modal'));

// Backdrop click closes modals
['phone-modal','audience-modal','walkaway-modal','newgame-modal'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target === e.currentTarget) hideModal(id);
  });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

tryRestoreGame();
