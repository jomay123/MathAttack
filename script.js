(function() {
  'use strict';

  const QUESTION_TIME_MS = 10000;
  const TIMER_TICK_MS = 100;
  const LEADERBOARD_KEY = 'mathGameLeaderboard_v1';
  const NAME_KEY = 'mathGamePlayerName_v1';
  const LEADERBOARD_LIMIT = 10;
  const MAX_POINTS_PER_QUESTION = 5; // faster answers earn up to this many points
  const MIN_SUBMISSION_INTERVAL = 2000; // 2 seconds between submissions

  const els = {
    setup: document.getElementById('setup'),
    name: document.getElementById('playerName'),
    start: document.getElementById('startBtn'),

    game: document.getElementById('game'),
    questionText: document.getElementById('questionText'),

    score: document.getElementById('score'),
    timeText: document.getElementById('time'),
    timeBar: document.getElementById('timeBar'),

    gameOver: document.getElementById('gameOver'),
    finalScore: document.getElementById('finalScore'),
    submitScore: document.getElementById('submitScore'),
    playAgain: document.getElementById('playAgain'),

    leaderboard: document.getElementById('leaderboard'),
    leaderboardBody: document.getElementById('leaderboardBody')
  };

  let gameState = {
    playerName: 'Player',
    score: 0,
    correctAnswer: null,
    timerId: null,
    deadlineTs: 0,
    lastSubmissionTime: 0, // Track last submission time
    scoreSubmitted: false // Track if score has been submitted
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function now() {
    return performance.now();
  }

  function msToSeconds(ms) {
    return (ms / 1000).toFixed(1);
  }

  function computePoints(remainingMs) {
    const slice = QUESTION_TIME_MS / MAX_POINTS_PER_QUESTION;
    const raw = Math.ceil(remainingMs / slice);
    return Math.max(1, Math.min(MAX_POINTS_PER_QUESTION, raw));
  }

  async function readLeaderboard() {
    try {
      if (!window.db) {
        console.warn('Firebase not initialized, using localStorage fallback');
        return readLeaderboardLocal();
      }

      const q = query(collection(db, "scores"), orderBy("score", "desc"), limit(LEADERBOARD_LIMIT));
      const snapshot = await getDocs(q);
      const entries = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        entries.push({
          name: data.name,
          score: data.score,
          ts: data.timestamp?.toDate?.() || new Date()
        });
      });
      
      return entries;
    } catch (error) {
      console.error("Error reading leaderboard:", error);
      console.warn('Falling back to localStorage');
      return readLeaderboardLocal();
    }
  }

  function readLeaderboardLocal() {
    try {
      const raw = localStorage.getItem(LEADERBOARD_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function writeLeaderboardLocal(entries) {
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
    } catch (_) {
      // ignore
    }
  }

  async function addToLeaderboard(name, score) {
    try {
      // Client-side rate limiting
      const currentTime = Date.now();
      if (currentTime - gameState.lastSubmissionTime < MIN_SUBMISSION_INTERVAL) {
        console.warn('Submission too fast, ignoring');
        return await readLeaderboard();
      }
      gameState.lastSubmissionTime = currentTime;

      // Input validation
      if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 50) {
        console.error('Invalid name provided');
        return await readLeaderboard();
      }

      if (typeof score !== 'number' || score < 0 || score > 1000 || !Number.isInteger(score)) {
        console.error('Invalid score provided');
        return await readLeaderboard();
      }

      if (!window.db) {
        console.warn('Firebase not initialized, using localStorage fallback');
        const entries = readLeaderboardLocal();
        entries.push({ name: name.trim(), score, ts: Date.now() });
        entries.sort((a, b) => b.score - a.score || a.ts - b.ts);
        const trimmed = entries.slice(0, LEADERBOARD_LIMIT);
        writeLeaderboardLocal(trimmed);
        return trimmed;
      }

      console.log('Adding score to Firebase:', { name: name.trim(), score });
      
      // Add to Firebase
      await addDoc(collection(db, "scores"), {
        name: name.trim(),
        score: score,
        timestamp: serverTimestamp()
      });

      console.log('Score added successfully to Firebase');

      // Return updated leaderboard
      return await readLeaderboard();
    } catch (error) {
      console.error("Error adding to leaderboard:", error);
      console.warn('Falling back to localStorage');
      const entries = readLeaderboardLocal();
      entries.push({ name: name.trim(), score, ts: Date.now() });
      entries.sort((a, b) => b.score - a.score || a.ts - b.ts);
      const trimmed = entries.slice(0, LEADERBOARD_LIMIT);
      writeLeaderboardLocal(trimmed);
      return trimmed;
    }
  }

  async function renderLeaderboard() {
    try {
      const entries = await readLeaderboard();
      const tbody = els.leaderboardBody;
      tbody.innerHTML = '';
      
      if (entries.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 4;
        td.textContent = 'No scores yet. Be the first!';
        td.style.color = '#94a3b8';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
      
      entries.forEach((entry, idx) => {
        const tr = document.createElement('tr');

        const rank = document.createElement('td');
        rank.textContent = String(idx + 1);
        tr.appendChild(rank);

        const name = document.createElement('td');
        name.textContent = entry.name;
        tr.appendChild(name);

        const score = document.createElement('td');
        score.textContent = String(entry.score);
        tr.appendChild(score);

        const date = document.createElement('td');
        const d = entry.ts instanceof Date ? entry.ts : new Date(entry.ts);
        date.textContent = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        tr.appendChild(date);

        tbody.appendChild(tr);
      });
    } catch (error) {
      console.error("Error rendering leaderboard:", error);
    }
  }

  function persistName(name) {
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch (_) {
      // ignore
    }
  }

  function restoreName() {
    try {
      const n = localStorage.getItem(NAME_KEY);
      if (n) els.name.value = n;
    } catch (_) {
      // ignore
    }
  }

  function setSections({ showSetup, showGame, showGameOver }) {
    els.setup.classList.toggle('hidden', !showSetup);
    els.game.classList.toggle('hidden', !showGame);
    els.gameOver.classList.toggle('hidden', !showGameOver);
  }

  function updateTimerUI(remainingMs) {
    const clamped = clamp(remainingMs, 0, QUESTION_TIME_MS);
    els.timeText.textContent = msToSeconds(clamped);
    const pct = (clamped / QUESTION_TIME_MS) * 100;
    els.timeBar.style.width = pct + '%';
  }

  function clearTimer() {
    if (gameState.timerId) {
      clearInterval(gameState.timerId);
      gameState.timerId = null;
    }
  }

  function startTimer() {
    clearTimer();
    gameState.deadlineTs = now() + QUESTION_TIME_MS;
    updateTimerUI(QUESTION_TIME_MS);
    gameState.timerId = setInterval(() => {
      const remaining = gameState.deadlineTs - now();
      if (remaining <= 0) {
        updateTimerUI(0);
        endGame('timeout');
        return;
      }
      updateTimerUI(remaining);
    }, TIMER_TICK_MS);
  }

  function difficultyForScore(score) {
    // Start moderately harder than original, ramp up faster
    if (score < 3) return 'medium';
    if (score < 8) return 'hard';
    return 'insane';
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pickFrom(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  function generateWrongAnswers(correct, difficulty) {
    const wrongs = new Set();
    const range = difficulty === 'medium' ? 5 : difficulty === 'hard' ? 8 : 12;
    
    while (wrongs.size < 3) {
      let wrong;
      if (Math.random() < 0.3) {
        // Off-by-one errors
        wrong = correct + (Math.random() < 0.5 ? 1 : -1);
      } else if (Math.random() < 0.4) {
        // Off-by-small amounts
        wrong = correct + randInt(-range, range);
      } else {
        // Completely random in reasonable range
        const min = Math.max(0, correct - range * 2);
        const max = correct + range * 2;
        wrong = randInt(min, max);
      }
      
      if (wrong !== correct && wrong >= 0 && !wrongs.has(wrong)) {
        wrongs.add(wrong);
      }
    }
    
    return Array.from(wrongs);
  }

  function generateQuestion(score) {
    const diff = difficultyForScore(score);
    let ops;
    if (diff === 'medium') ops = ['+','-'];
    else if (diff === 'hard') ops = ['+','-','×'];
    else ops = ['+','-','×','÷'];

    const op = pickFrom(ops);
    let a, b, answer;

    switch (op) {
      case '+': {
        const range = diff === 'medium' ? 15 : diff === 'hard' ? 35 : 80;
        a = randInt(0, range);
        b = randInt(0, range);
        answer = a + b;
        break;
      }
      case '-': {
        const range = diff === 'medium' ? 15 : diff === 'hard' ? 35 : 80;
        a = randInt(range, range * 2);
        b = randInt(0, a); // ensure non-negative
        answer = a - b;
        break;
      }
      case '×': {
        const rangeA = diff === 'medium' ? 6 : diff === 'hard' ? 12 : 15;
        const rangeB = diff === 'medium' ? 6 : diff === 'hard' ? 12 : 15;
        a = randInt(0, rangeA);
        b = randInt(0, rangeB);
        answer = a * b;
        break;
      }
      case '÷': {
        const base = diff === 'medium' ? 8 : diff === 'hard' ? 12 : 15;
        b = randInt(2, base);
        const multiple = diff === 'medium' ? randInt(2, 8) : diff === 'hard' ? randInt(2, 12) : randInt(2, 15);
        answer = multiple;
        a = b * multiple; // ensures integer division
        break;
      }
      default: {
        a = 1; b = 1; answer = 2;
      }
    }

    const symbol = op;
    const questionText = `${a} ${symbol} ${b} = ?`;
    
    // Generate 3 wrong answers
    const wrongAnswers = generateWrongAnswers(answer, diff);
    
    // Create 4 options with correct answer in random position
    const allOptions = [...wrongAnswers, answer];
    for (let i = allOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
    }
    
    return { 
      text: questionText, 
      answer,
      options: allOptions
    };
  }

  function showQuestion() {
    const q = generateQuestion(gameState.score);
    gameState.correctAnswer = q.answer;
    
    // Clear previous options
    const existingOptions = document.querySelectorAll('.option');
    existingOptions.forEach(opt => opt.remove());
    
    els.questionText.textContent = q.text;
    
    // Create multiple choice options
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'options';
    optionsContainer.style.marginTop = '16px';
    
    q.options.forEach((option) => {
      const optionBtn = document.createElement('button');
      optionBtn.className = 'btn option';
      optionBtn.textContent = option;
      optionBtn.dataset.value = option;
      optionBtn.addEventListener('click', () => handleOptionClick(option));
      optionsContainer.appendChild(optionBtn);
    });
    
    // Insert options after the question
    els.questionText.parentNode.insertBefore(optionsContainer, els.questionText.nextSibling);
    
    startTimer();
  }

  function handleOptionClick(selectedValue) {
    const userAnswer = Number(selectedValue);

    if (userAnswer === gameState.correctAnswer) {
      const remaining = Math.max(0, gameState.deadlineTs - now());
      const earned = computePoints(remaining);
      gameState.score += earned;
      updateScoreUI();
      showQuestion();
    } else {
      endGame('wrong');
    }
  }

  function updateScoreUI() {
    els.score.textContent = String(gameState.score);
  }

  function startGame() {
    const rawName = (els.name.value || '').trim();
    gameState.playerName = rawName || 'Player';
    persistName(gameState.playerName);

    gameState.score = 0;
    gameState.scoreSubmitted = false; // Reset submission state
    updateScoreUI();
    setSections({ showSetup: false, showGame: true, showGameOver: false });
    // Hide leaderboard while playing
    els.leaderboard.classList.add('hidden');
    showQuestion();
  }

  function endGame(reason) {
    clearTimer();
    setSections({ showSetup: false, showGame: false, showGameOver: true });
    els.finalScore.textContent = String(gameState.score);
    
    // Show leaderboard at end of game
    els.leaderboard.classList.remove('hidden');

    // Reset submit button state
    els.submitScore.disabled = false;
    els.submitScore.textContent = 'Submit Score';
    
    if (reason === 'timeout') {
      els.timeText.textContent = '0.0';
      els.timeBar.style.width = '0%';
    }
  }

  async function handleSubmitScore() {
    if (gameState.scoreSubmitted) {
      console.log('Score already submitted');
      return;
    }

    // Disable button and show loading state
    els.submitScore.disabled = true;
    els.submitScore.textContent = 'Submitting...';
    
    try {
      // Add score to leaderboard and update display
      await addToLeaderboard(gameState.playerName, gameState.score);
      console.log('Score added, updating leaderboard');
      await renderLeaderboard();
      
      // Update button to show success
      els.submitScore.textContent = 'Score Submitted!';
      gameState.scoreSubmitted = true;
    } catch (error) {
      console.error('Error submitting score:', error);
      // Re-enable button on error
      els.submitScore.disabled = false;
      els.submitScore.textContent = 'Submit Score (Retry)';
    }
  }

  function bindEvents() {
    els.start.addEventListener('click', startGame);
    els.submitScore.addEventListener('click', handleSubmitScore);
    els.playAgain.addEventListener('click', () => {
      console.log('Play again clicked');
      setSections({ showSetup: true, showGame: false, showGameOver: false });
      // Hide leaderboard again when returning to setup
      els.leaderboard.classList.add('hidden');
      els.name.focus();
    });
  }

  function init() {
    restoreName();
    renderLeaderboard();
    bindEvents();
    console.log('Game initialized');
  }

  document.addEventListener('DOMContentLoaded', init);
})(); 