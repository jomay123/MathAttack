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
    loginPassword: document.getElementById('loginPassword'),
    loginBtn: document.getElementById('loginBtn'),
    signupBtn: document.getElementById('signupBtn'),
    loginStatus: document.getElementById('loginStatus'),
    skipLogin: document.getElementById('skipLogin'),

    setup: document.getElementById('setup'),
    name: document.getElementById('playerName'),
    start: document.getElementById('startBtn'),
    refreshData: document.getElementById('refreshData'),

    game: document.getElementById('game'),
    questionText: document.getElementById('questionText'),

    score: document.getElementById('score'),
    timeText: document.getElementById('time'),
    timeBar: document.getElementById('timeBar'),
    dailyWins: document.getElementById('dailyWins'),

    gameOver: document.getElementById('gameOver'),
    finalScore: document.getElementById('finalScore'),
    submitScore: document.getElementById('submitScore'),
    playAgain: document.getElementById('playAgain'),

    leaderboard: document.getElementById('leaderboard'),
    leaderboardBody: document.getElementById('leaderboardBody'),
    dailyWinsLeaderboard: document.getElementById('dailyWinsLeaderboard'),
    dailyWinsLeaderboardBody: document.getElementById('dailyWinsLeaderboardBody'),
    debugShowSetup: document.getElementById('debugShowSetup')
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
    isAuthenticated: false,
    eventsBound: false // New flag to track if events are bound
  };

  // Check if user is already logged in
  async function checkAuth() {
    try {
      console.log('checkAuth: Starting auth check...');
      const { data: { session }, error } = await window.supabase.auth.getSession();
      if (error) {
        console.error('Error checking auth session:', error);
        return false;
      }
      
      if (session && session.user) {
        console.log('checkAuth: Session found, setting user state...');
        gameState.user = session.user;
        gameState.isAuthenticated = true;
        console.log('User already logged in:', session.user.email);
        
        // Try to ensure profile and update display, but don't let failures block auth
        try {
          console.log('checkAuth: Ensuring profile...');
          await ensureProfile(session.user.email.split('@')[0]);
        } catch (profileError) {
          console.error('Profile creation failed, but continuing:', profileError);
        }
        
        try {
          console.log('checkAuth: Updating daily wins display...');
          await updateDailyWinsDisplay();
        } catch (displayError) {
          console.error('Daily wins display update failed, but continuing:', displayError);
        }
        
        console.log('checkAuth: Completed successfully, returning true');
        return true;
      }
      console.log('checkAuth: No session found, returning false');
      return false;
    } catch (error) {
      console.error('Exception in checkAuth:', error);
      return false;
    }
  }

  // Refresh all user data and display
  async function refreshUserData() {
    if (!gameState.isAuthenticated || !gameState.user) {
      console.log('Cannot refresh user data - not authenticated');
      return;
    }
    
    try {
      console.log('Refreshing user data...');
      
      // Update daily wins display
      await updateDailyWinsDisplay();
      
      // Refresh leaderboards if they're visible
      if (!els.leaderboard.classList.contains('hidden')) {
        await renderLeaderboard();
      }
      if (!els.dailyWinsLeaderboard.classList.contains('hidden')) {
        await renderDailyWinsLeaderboard();
      }
      
      console.log('User data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  }

  // Fetch user's daily wins count
  async function fetchDailyWins() {
    if (!gameState.user) {
      console.log('No user, cannot fetch daily wins');
      return 0;
    }

    try {
      const { data, error } = await window.supabase
        .from('daily_winners')
        .select('date')
        .eq('user_id', gameState.user.id);

      if (error) {
        console.error('Error fetching daily wins:', error);
        return 0;
      }

      const wins = data ? data.length : 0;
      console.log('Fetched daily wins:', wins, 'for user:', gameState.user.id);
      return wins;
    } catch (error) {
      console.error('Exception in fetchDailyWins:', error);
      return 0;
    }
  }

  // Update daily wins display
  async function updateDailyWinsDisplay() {
    try {
      if (gameState.isAuthenticated && gameState.user) {
        console.log('updateDailyWinsDisplay: Starting update...');
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Daily wins update timeout after 5 seconds')), 5000);
        });
        
        const winsPromise = fetchDailyWins();
        const wins = await Promise.race([winsPromise, timeoutPromise]);
        
        els.dailyWins.textContent = wins;
        els.dailyWins.parentElement.classList.remove('hidden');
        console.log('Daily wins display updated:', wins);
      } else {
        els.dailyWins.parentElement.classList.add('hidden');
        console.log('Hiding daily wins display - user not authenticated');
      }
    } catch (error) {
      console.error('Error updating daily wins display:', error);
      // Hide display on error
      els.dailyWins.parentElement.classList.add('hidden');
    }
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
    els.loginPassword.value = '';
  }

  // Handle password-based login
  async function handleLogin() {
    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value.trim();
    
    if (!email || !password) {
      showLoginStatus('Please enter both email and password', 'error');
      return;
    }

    els.loginBtn.disabled = true;
    els.loginBtn.textContent = 'Signing In...';

    try {
      const { error } = await window.supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        showLoginStatus(error.message, 'error');
      } else {
        hideLoginModal();
        showSetup();
      }
    } catch (error) {
      showLoginStatus('An error occurred. Please try again.', 'error');
    } finally {
      els.loginBtn.disabled = false;
      els.loginBtn.textContent = 'Sign In';
    }
  }

  // Handle user signup
  async function handleSignup() {
    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value.trim();
    
    if (!email || !password) {
      showLoginStatus('Please enter both email and password', 'error');
      return;
    }

    if (password.length < 6) {
      showLoginStatus('Password must be at least 6 characters', 'error');
      return;
    }

    els.signupBtn.disabled = true;
    els.signupBtn.textContent = 'Creating Account...';

    try {
      const { error } = await window.supabase.auth.signUp({
        email: email,
        password: password
      });

      if (error) {
        showLoginStatus(error.message, 'error');
      } else {
        showLoginStatus('Account created! Please check your email to verify your account, then sign in.', 'success');
        els.signupBtn.textContent = 'Create Account';
      }
    } catch (error) {
      showLoginStatus('An error occurred. Please try again.', 'error');
    } finally {
      els.signupBtn.disabled = false;
      els.signupBtn.textContent = 'Create Account';
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
    console.log('showSetup called');
    console.log('Current sections state before setSections:');
    console.log('setup hidden:', els.setup.classList.contains('hidden'));
    console.log('loginModal hidden:', els.loginModal.classList.contains('hidden'));
    console.log('game hidden:', els.game.classList.contains('hidden'));
    console.log('gameOver hidden:', els.gameOver.classList.contains('hidden'));
    
    setSections({ showLogin: false, showSetup: true, showGame: false, showGameOver: false });
    
    console.log('After setSections:');
    console.log('setup hidden:', els.setup.classList.contains('hidden'));
    console.log('loginModal hidden:', els.loginModal.classList.contains('hidden'));
    console.log('game hidden:', els.game.classList.contains('hidden'));
    console.log('gameOver hidden:', els.gameOver.classList.contains('hidden'));
    
    els.name.focus();
    
    // Ensure events are bound when setup is shown
    if (!gameState.eventsBound) {
      console.log('Binding events in showSetup');
      bindEvents();
      gameState.eventsBound = true;
    }
    
    // Show leaderboards for logged-in users
    if (gameState.isAuthenticated) {
      console.log('User authenticated, showing leaderboards');
      els.leaderboard.classList.remove('hidden');
      els.dailyWinsLeaderboard.classList.remove('hidden');
      renderLeaderboard();
      renderDailyWinsLeaderboard();
    } else {
      console.log('User not authenticated, hiding leaderboards');
      els.leaderboard.classList.add('hidden');
      els.dailyWinsLeaderboard.classList.add('hidden');
    }
    
    console.log('showSetup completed');
  }

  // Ensure user profile exists
  async function ensureProfile(displayName) {
    if (!gameState.user) return;

    try {
      // If no display name provided, use email prefix
      const fallbackName = displayName || gameState.user.email.split('@')[0] || 'Player';
      
      console.log('ensureProfile: Creating/updating profile for:', fallbackName);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile creation timeout after 5 seconds')), 5000);
      });
      
      const profilePromise = window.supabase
        .from('users')
        .upsert({
          id: gameState.user.id,
          display_name: fallbackName,
        }, { onConflict: 'id' });

      const { error } = await Promise.race([profilePromise, timeoutPromise]);

      if (error) {
        console.error('Error ensuring profile:', error);
        // Try to create profile with just the user ID
        const { error: createError } = await window.supabase
          .from('users')
          .insert({
            id: gameState.user.id,
            display_name: fallbackName,
          });
        
        if (createError) {
          console.error('Error creating profile:', createError);
        }
      } else {
        console.log('ensureProfile: Profile ensured successfully');
      }
    } catch (error) {
      console.error('Exception in ensureProfile:', error);
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

  // Fetch daily wins leaderboard
  async function fetchDailyWinsLeaderboard() {
    try {
      const { data, error } = await window.supabase
        .from('daily_winners')
        .select('user_id, date')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching daily wins leaderboard:', error);
        return [];
      }

      // Count wins per user
      const winsByUser = {};
      data.forEach(win => {
        winsByUser[win.user_id] = (winsByUser[win.user_id] || 0) + 1;
      });

      // Get user profiles for display names
      const userIds = Object.keys(winsByUser);
      const { data: profiles, error: profileError } = await window.supabase
        .from('user_profiles')
        .select('id, display_name')
        .in('id', userIds);

      if (profileError) {
        console.error('Error fetching profiles for daily wins:', profileError);
        return [];
      }

      const nameById = Object.fromEntries(profiles.map(p => [p.id, p.display_name]));
      
      // Convert to array and sort by wins
      const leaderboardData = Object.entries(winsByUser).map(([userId, wins]) => ({
        userId,
        name: nameById[userId] || 'Player',
        wins
      })).sort((a, b) => b.wins - a.wins);

      return leaderboardData;
    } catch (error) {
      console.error('Error fetching daily wins leaderboard:', error);
      return [];
    }
  }

  // Render daily wins leaderboard
  async function renderDailyWinsLeaderboard() {
    try {
      const entries = await fetchDailyWinsLeaderboard();
      const tbody = els.dailyWinsLeaderboardBody;
      tbody.innerHTML = '';
      
      if (entries.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 3;
        td.textContent = 'No daily wins yet. Be the first!';
        td.style.color = '#94a3b8';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
      
      entries.forEach((entry, index) => {
        const tr = document.createElement('tr');

        const rank = document.createElement('td');
        rank.textContent = String(index + 1);
        tr.appendChild(rank);

        const name = document.createElement('td');
        name.textContent = entry.name;
        tr.appendChild(name);

        const wins = document.createElement('td');
        wins.textContent = String(entry.wins);
        tr.appendChild(wins);

        tbody.appendChild(tr);
      });
    } catch (error) {
      console.error("Error rendering daily wins leaderboard:", error);
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
    console.log('setSections called with:', { showLogin, showSetup, showGame, showGameOver });
    
    // Check if elements exist before trying to modify them
    if (!els.loginModal) console.error('loginModal element not found');
    if (!els.setup) console.error('setup element not found');
    if (!els.game) console.error('game element not found');
    if (!els.gameOver) console.error('gameOver element not found');
    
    els.loginModal.classList.toggle('hidden', !showLogin);
    els.setup.classList.toggle('hidden', !showSetup);
    els.game.classList.toggle('hidden', !showGame);
    els.gameOver.classList.toggle('hidden', !showGameOver);
    
    console.log('Sections updated. Current visibility:');
    console.log('loginModal hidden:', els.loginModal?.classList.contains('hidden'));
    console.log('setup hidden:', els.setup?.classList.contains('hidden'));
    console.log('game hidden:', els.game?.classList.contains('hidden'));
    console.log('gameOver hidden:', els.gameOver?.classList.contains('hidden'));
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
    els.dailyWinsLeaderboard.classList.add('hidden');
    showQuestion();
  }

  function endGame(reason) {
    clearTimer();
    setSections({ showLogin: false, showSetup: false, showGame: false, showGameOver: true });
    els.finalScore.textContent = String(gameState.score);
    
    els.leaderboard.classList.remove('hidden');
    els.dailyWinsLeaderboard.classList.remove('hidden');
    renderLeaderboard();
    renderDailyWinsLeaderboard();

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
        await renderLeaderboard(); // Refresh daily scores leaderboard
        await renderDailyWinsLeaderboard(); // Refresh daily wins leaderboard
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
    els.signupBtn.addEventListener('click', handleSignup);
    els.skipLogin.addEventListener('click', skipLogin);
    els.loginEmail.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
    els.loginPassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });

    // Game events
    els.start.addEventListener('click', startGame);
    els.submitScore.addEventListener('click', handleSubmitScore);
    els.playAgain.addEventListener('click', () => {
      console.log('Play again clicked');
      setSections({ showLogin: false, showSetup: true, showGame: false, showGameOver: false });
      els.leaderboard.classList.add('hidden');
      els.dailyWinsLeaderboard.classList.add('hidden');
      els.name.focus();
    });
    els.refreshData.addEventListener('click', refreshUserData);
    els.debugShowSetup.addEventListener('click', () => {
      console.log('Debug button clicked - forcing setup display');
      console.log('Current game state:', gameState);
      console.log('Current section visibility:');
      console.log('setup hidden:', els.setup.classList.contains('hidden'));
      console.log('loginModal hidden:', els.loginModal.classList.contains('hidden'));
      console.log('game hidden:', els.game.classList.contains('hidden'));
      console.log('gameOver hidden:', els.gameOver.classList.contains('hidden'));
      
      // Method 1: Try setSections
      console.log('Trying setSections method...');
      setSections({ showLogin: false, showSetup: true, showGame: false, showGameOver: false });
      
      // Method 2: Direct DOM manipulation
      console.log('Trying direct DOM manipulation...');
      els.setup.classList.remove('hidden');
      els.loginModal.classList.add('hidden');
      els.game.classList.add('hidden');
      els.gameOver.classList.add('hidden');
      
      // Method 3: Force focus on name input
      if (els.name) {
        els.name.focus();
        console.log('Name input focused');
      } else {
        console.error('Name input not found!');
      }
      
      // Method 4: Check if setup is now visible
      setTimeout(() => {
        console.log('After debug actions - setup hidden:', els.setup.classList.contains('hidden'));
        if (!els.setup.classList.contains('hidden')) {
          console.log('SUCCESS: Setup screen should now be visible!');
        } else {
          console.error('FAILED: Setup screen is still hidden after all attempts');
        }
      }, 100);
      
      console.log('Setup should now be visible');
    });
  }

  async function init() {
    try {
      console.log('Initializing game...');
      
      // Check if all required elements are found
      console.log('Checking DOM elements:');
      console.log('setup element:', els.setup);
      console.log('loginModal element:', els.loginModal);
      console.log('game element:', els.game);
      console.log('gameOver element:', els.gameOver);
      
      if (!els.setup || !els.loginModal || !els.game || !els.gameOver) {
        console.error('Some required DOM elements are missing!');
        return;
      }
      
      // Check if user is already logged in
      const isLoggedIn = await checkAuth();
      console.log('Auth check result:', isLoggedIn);
      
      if (isLoggedIn) {
        // User is logged in, show setup directly
        console.log('User is logged in, showing setup');
        try {
          await showSetup();
          console.log('showSetup completed successfully');
        } catch (setupError) {
          console.error('Error in showSetup, trying fallback:', setupError);
          // Fallback: manually show setup
          setSections({ showLogin: false, showSetup: true, showGame: false, showGameOver: false });
          els.name.focus();
        }
      } else {
        // Show login modal
        console.log('User not logged in, showing login modal');
        showLoginModal();
        bindEvents();
        gameState.eventsBound = true;
      }
      
      console.log('Game initialized');
    } catch (error) {
      console.error('Error during initialization:', error);
      // Fallback to login modal
      showLoginModal();
      bindEvents();
      gameState.eventsBound = true;
    }
  }

  // Listen for auth state changes
  window.supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state change:', event, session?.user?.email);
    
    if (event === 'SIGNED_IN' && session) {
      gameState.user = session.user;
      gameState.isAuthenticated = true;
      console.log('User signed in:', session.user.email);
      hideLoginModal();
      
      // Ensure profile and update display
      await ensureProfile();
      await updateDailyWinsDisplay();
      
      // Only show setup if we're not already on it
      if (els.setup.classList.contains('hidden')) {
        console.log('About to call showSetup from auth listener...');
        showSetup();
      } else {
        console.log('Setup already visible, not calling showSetup again');
      }
      
    } else if (event === 'SIGNED_OUT') {
      gameState.user = null;
      gameState.isAuthenticated = false;
      console.log('User signed out');
      await updateDailyWinsDisplay();
      
      // Show login modal when signed out
      showLoginModal();
    } else if (event === 'TOKEN_REFRESHED' && session) {
      // Handle token refresh (important for page reloads)
      console.log('Token refreshed for user:', session.user.email);
      gameState.user = session.user;
      gameState.isAuthenticated = true;
      
      // Update display after token refresh
      await updateDailyWinsDisplay();
      
      // If we're on the setup screen, refresh leaderboards
      if (!els.setup.classList.contains('hidden')) {
        await renderLeaderboard();
        await renderDailyWinsLeaderboard();
      }
    }
  });

  document.addEventListener('DOMContentLoaded', init);
})(); 