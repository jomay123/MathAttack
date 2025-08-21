(function() {
  'use strict';

  const QUESTION_TIME_MS = 10000;
  const TIMER_TICK_MS = 100;
  const LEADERBOARD_LIMIT = 50;
  const MAX_POINTS_PER_QUESTION = 5; // faster answers earn up to this many points
  const MIN_SUBMISSION_INTERVAL = 2000; // 2 seconds between submissions

  const els = {
    loginModal: document.getElementById('loginModal'),
    loginEmail: document.getElementById('loginEmail'),
    loginBtn: document.getElementById('loginBtn'),
    loginStatus: document.getElementById('loginStatus'),
    skipLogin: document.getElementById('skipLogin'),

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
    lastSubmissionTime: 0,
    scoreSubmitted: false,
    user: null,
    isAuthenticated: false
  };

  // Check if user is already logged in
  async function checkAuth() {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (session) {
      gameState.user = session.user;
      gameState.isAuthenticated = true;
      console.log('User already logged in:', session.user.email);
      return true;
    }
    return false;
  }

  // Show login modal
  function showLoginModal() {
    els.loginModal.classList.remove('hidden');
    els.loginEmail.focus();
  }

  // Hide login modal
  function hideLoginModal() {
    els.loginModal.classList.add('hidden');
    els.loginStatus.classList.add('hidden');
    els.loginEmail.value = '';
  }

  // Handle magic link login
  async function handleLogin() {
    const email = els.loginEmail.value.trim();
    if (!email) {
      showLoginStatus('Please enter your email', 'error');
      return;
    }

    els.loginBtn.disabled = true;
    els.loginBtn.textContent = 'Sending...';

    try {
      const { error } = await window.supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) {
        showLoginStatus(error.message, 'error');
      } else {
        showLoginStatus('Check your email for a login link!', 'success');
        els.loginBtn.textContent = 'Link Sent!';
      }
    } catch (error) {
      showLoginStatus('An error occurred. Please try again.', 'error');
    } finally {
      els.loginBtn.disabled = false;
      els.loginBtn.textContent = 'Send Login Link';
    }
  }

  // Show login status message
  function showLoginStatus(message, type) {
    els.loginStatus.textContent = message;
    els.loginStatus.className = `login-status ${type}`;
    els.loginStatus.classList.remove('hidden');
  }

  // Skip login and play as guest
  function skipLogin() {
    hideLoginModal();
    showSetup();
  }

  // Show setup screen
  function showSetup() {
    els.setup.classList.remove('hidden');
    els.name.focus();
  }

  // Ensure user profile exists
  async function ensureProfile(displayName) {
    if (!gameState.user) return;

    try {
      const { error } = await window.supabase
        .from('users')
        .upsert({
          id: gameState.user.id,
          display_name: displayName,
        }, { onConflict: 'id' });

      if (error) {
        console.error('Error ensuring profile:', error);
      }
    } catch (error) {
      console.error('Error ensuring profile:', error);
    }
  }

  // Submit today's score to Supabase
  async function submitTodayScore(score) {
    if (!gameState.user) {
      console.log('No user, cannot submit score');
      return false;
    }

    try {
      const todayUTC = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      
      // Upsert best-of-day; RLS ensures: only self, only today, only if higher
      const { error } = await window.supabase
        .from('daily_scores')
        .upsert({
          date: todayUTC,
          user_id: gameState.user.id,
          score: score
        }, { onConflict: 'date,user_id' });

      if (error) {
        console.error('Error submitting score:', error);
        return false;
      }

      console.log('Score submitted successfully');
      return true;
    } catch (error) {
      console.error('Error submitting score:', error);
      return false;
    }
  }

  // Fetch today's leaderboard
  async function fetchTodayLeaderboard() {
    try {
      const todayUTC = new Date().toISOString().slice(0, 10);
      
      const { data, error } = await window.supabase
        .from('daily_scores')
        .select('score, user_id, created_at')
        .eq('date', todayUTC)
        .order('score', { ascending: false })
        .limit(LEADERBOARD_LIMIT);

      if (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
      }

      // Get user profiles for display names
      const userIds = data.map(d => d.user_id);
      const { data: profiles, error: profileError } = await window.supabase
        .from('user_profiles')
        .select('id, display_name')
        .in('id', userIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        return [];
      }

      const nameById = Object.fromEntries(profiles.map(p => [p.id, p.display_name]));
      
      return data.map((row, i) => ({
        rank: i + 1,
        name: nameById[row.user_id] || 'Player',
        score: row.score,
        time: new Date(row.created_at).toLocaleTimeString(undefined, { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      }));
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  }

  // Render leaderboard
  async function renderLeaderboard() {
    try {
      const entries = await fetchTodayLeaderboard();
      const tbody = els.leaderboardBody;
      tbody.innerHTML = '';
      
      if (entries.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 4;
        td.textContent = 'No scores yet today. Be the first!';
        td.style.color = '#94a3b8';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
      
      entries.forEach((entry) => {
        const tr = document.createElement('tr');

        const rank = document.createElement('td');
        rank.textContent = String(entry.rank);
        tr.appendChild(rank);

        const name = document.createElement('td');
        name.textContent = entry.name;
        tr.appendChild(name);

        const score = document.createElement('td');
        score.textContent = String(entry.score);
        tr.appendChild(score);

        const time = document.createElement('td');
        time.textContent = entry.time;
        tr.appendChild(time);

        tbody.appendChild(tr);
      });
    } catch (error) {
      console.error("Error rendering leaderboard:", error);
    }
  }

  // Game functions
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

  function setSections({ showLogin, showSetup, showGame, showGameOver }) {
    els.loginModal.classList.toggle('hidden', !showLogin);
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
        wrong = correct + (Math.random() < 0.5 ? 1 : -1);
      } else if (Math.random() < 0.4) {
        wrong = correct + randInt(-range, range);
      } else {
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
        b = randInt(0, a);
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
        a = b * multiple;
        break;
      }
      default: {
        a = 1; b = 1; answer = 2;
      }
    }

    const symbol = op;
    const questionText = `${a} ${symbol} ${b} = ?`;
    
    const wrongAnswers = generateWrongAnswers(answer, diff);
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
    
    const existingOptions = document.querySelectorAll('.option');
    existingOptions.forEach(opt => opt.remove());
    
    els.questionText.textContent = q.text;
    
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
    
    if (gameState.isAuthenticated) {
      ensureProfile(gameState.playerName);
    }

    gameState.score = 0;
    gameState.scoreSubmitted = false;
    updateScoreUI();
    setSections({ showLogin: false, showSetup: false, showGame: true, showGameOver: false });
    els.leaderboard.classList.add('hidden');
    showQuestion();
  }

  function endGame(reason) {
    clearTimer();
    setSections({ showLogin: false, showSetup: false, showGame: false, showGameOver: true });
    els.finalScore.textContent = String(gameState.score);
    
    els.leaderboard.classList.remove('hidden');
    renderLeaderboard();

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

    if (!gameState.isAuthenticated) {
      showLoginStatus('Please log in to submit your score', 'error');
      showLoginModal();
      return;
    }

    els.submitScore.disabled = true;
    els.submitScore.textContent = 'Submitting...';
    
    try {
      const success = await submitTodayScore(gameState.score);
      
      if (success) {
        els.submitScore.textContent = 'Score Submitted!';
        gameState.scoreSubmitted = true;
        await renderLeaderboard(); // Refresh leaderboard
      } else {
        els.submitScore.textContent = 'Submit Score (Retry)';
        els.submitScore.disabled = false;
      }
    } catch (error) {
      console.error('Error submitting score:', error);
      els.submitScore.textContent = 'Submit Score (Retry)';
      els.submitScore.disabled = false;
    }
  }

  function bindEvents() {
    // Login events
    els.loginBtn.addEventListener('click', handleLogin);
    els.skipLogin.addEventListener('click', skipLogin);
    els.loginEmail.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });

    // Game events
    els.start.addEventListener('click', startGame);
    els.submitScore.addEventListener('click', handleSubmitScore);
    els.playAgain.addEventListener('click', () => {
      console.log('Play again clicked');
      setSections({ showLogin: false, showSetup: true, showGame: false, showGameOver: false });
      els.leaderboard.classList.add('hidden');
      els.name.focus();
    });
  }

  async function init() {
    try {
      // Check if user is already logged in
      const isLoggedIn = await checkAuth();
      
      if (isLoggedIn) {
        // User is logged in, show setup directly
        showSetup();
      } else {
        // Show login modal
        showLoginModal();
      }
      
      bindEvents();
      console.log('Game initialized');
    } catch (error) {
      console.error('Error during initialization:', error);
      // Fallback to login modal
      showLoginModal();
      bindEvents();
    }
  }

  // Listen for auth state changes
  window.supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      gameState.user = session.user;
      gameState.isAuthenticated = true;
      console.log('User signed in:', session.user.email);
      hideLoginModal();
      showSetup();
    } else if (event === 'SIGNED_OUT') {
      gameState.user = null;
      gameState.isAuthenticated = false;
      console.log('User signed out');
    }
  });

  document.addEventListener('DOMContentLoaded', init);
})(); 