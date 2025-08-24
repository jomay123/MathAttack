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
    gameSetup: document.getElementById('gameSetup'),

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
    backToHome: document.getElementById('backToHome'),

    mathLeaderboard: document.getElementById('mathLeaderboard'),
    mathLeaderboardBody: document.getElementById('mathLeaderboardBody'),
    flagsLeaderboard: document.getElementById('flagsLeaderboard'),
    flagsLeaderboardBody: document.getElementById('flagsLeaderboardBody'),
    capitalsLeaderboard: document.getElementById('capitalsLeaderboard'),
    capitalsLeaderboardBody: document.getElementById('capitalsLeaderboardBody'),
    dailyWinsLeaderboard: document.getElementById('dailyWinsLeaderboard'),
    dailyWinsLeaderboardBody: document.getElementById('dailyWinsLeaderboardBody'),
    refreshMathLeaderboard: document.getElementById('refreshMathLeaderboard'),
    refreshFlagsLeaderboard: document.getElementById('refreshFlagsLeaderboard'),
    refreshCapitalsLeaderboard: document.getElementById('refreshCapitalsLeaderboard'),
    refreshDailyWins: document.getElementById('refreshDailyWins')
  };

  let gameState = {
    playerName: 'Player',
    currentGame: null, // 'math' or 'flags'
    score: 0,
    correctAnswer: null,
    timerId: null,
    deadlineTs: 0,
    lastSubmissionTime: 0,
    scoreSubmitted: false,
    user: null,
    isAuthenticated: false,
    eventsBound: false
  };

  // Check if user is already logged in
  async function checkAuth() {
    try {
      const { data: { session }, error } = await window.supabase.auth.getSession();
      if (error) {
        console.error('Error checking auth session:', error);
        return false;
      }
      
      if (session && session.user) {
        gameState.user = session.user;
        gameState.isAuthenticated = true;
        console.log('User already logged in:', session.user.email);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Exception in checkAuth:', error);
      return false;
    }
  }



  // Fetch user's daily wins count
  async function fetchDailyWins() {
    if (!gameState.user) {
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

      return data ? data.length : 0;
    } catch (error) {
      console.error('Exception in fetchDailyWins:', error);
      return 0;
    }
  }

  // Update daily wins display
  async function updateDailyWinsDisplay() {
    try {
      if (gameState.isAuthenticated && gameState.user) {
        const wins = await fetchDailyWins();
        els.dailyWins.textContent = wins;
        els.dailyWins.parentElement.classList.remove('hidden');
      } else {
        els.dailyWins.parentElement.classList.add('hidden');
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

  // Handle game selection
  function selectGame(gameType) {
    console.log('Game selected:', gameType);
    gameState.currentGame = gameType;
    
    // Hide game selection, show game setup
    document.querySelector('.game-selection').classList.add('hidden');
    els.gameSetup.classList.remove('hidden');
    
    // Update hint text based on game type
    const hint = document.querySelector('.hint');
    if (gameType === 'math') {
      hint.textContent = 'Answer as many math problems as you can. You have 10 seconds per question. Faster answers earn more points. One wrong answer or a timeout ends the game.';
    } else if (gameType === 'flags') {
      hint.textContent = 'Identify as many country flags as you can. You have 10 seconds per question. Faster answers earn more points. One wrong answer or a timeout ends the game.';
    } else if (gameType === 'capitals') {
      hint.textContent = 'Guess as many capital cities as you can. You have 10 seconds per question. Faster answers earn more points. One wrong answer or a timeout ends the game.';
    }
    
    // Focus on name input
    els.name.focus();
  }

  // Show setup screen
  function showSetup() {
    setSections({ showLogin: false, showSetup: true, showGame: false, showGameOver: false });
    
    // Reset game selection
    document.querySelector('.game-selection').classList.remove('hidden');
    els.gameSetup.classList.add('hidden');
    gameState.currentGame = null;
    
    // Ensure events are bound when setup is shown
    if (!gameState.eventsBound) {
      bindEvents();
      gameState.eventsBound = true;
    }
    
    // Show leaderboards for logged-in users on home page
    if (gameState.isAuthenticated) {
      els.mathLeaderboard.classList.remove('hidden');
      els.flagsLeaderboard.classList.remove('hidden');
      els.capitalsLeaderboard.classList.remove('hidden');
      els.dailyWinsLeaderboard.classList.remove('hidden');
      // Load leaderboards asynchronously without blocking the UI
      renderLeaderboard('math');
      renderLeaderboard('flags');
      renderLeaderboard('capitals');
      renderDailyWinsLeaderboard();
    } else {
      els.mathLeaderboard.classList.add('hidden');
      els.flagsLeaderboard.classList.add('hidden');
      els.capitalsLeaderboard.classList.add('hidden');
      els.dailyWinsLeaderboard.classList.add('hidden');
    }
  }

  // Ensure user profile exists
  async function ensureProfile(displayName) {
    if (!gameState.user) return;

    try {
      // If no display name provided, use email prefix
      const fallbackName = displayName || gameState.user.email.split('@')[0] || 'Player';
      
      const { error } = await window.supabase
        .from('users')
        .upsert({
          id: gameState.user.id,
          display_name: fallbackName,
        }, { onConflict: 'id' });

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
      }
    } catch (error) {
      console.error('Exception in ensureProfile:', error);
    }
  }

  // Submit today's score to Supabase
  async function submitTodayScore(score) {
    if (!gameState.user || !gameState.currentGame) {
      console.log('No user or game type, cannot submit score');
      return false;
    }

    try {
      const todayUTC = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      
      // Submit to appropriate game leaderboard
      const { error } = await window.supabase
        .from('daily_scores')
        .upsert({
          date: todayUTC,
          user_id: gameState.user.id,
          game_type: gameState.currentGame,
          score: score
        }, { onConflict: 'date,user_id,game_type' });

      if (error) {
        console.error('Error submitting score:', error);
        return false;
      }

      console.log('Score submitted successfully for', gameState.currentGame);
      return true;
    } catch (error) {
      console.error('Error submitting score:', error);
      return false;
    }
  }

  // Fetch today's leaderboard for a specific game
  async function fetchTodayLeaderboard(gameType) {
    try {
      const todayUTC = new Date().toISOString().slice(0, 10);
      
      const { data, error } = await window.supabase
        .from('daily_scores')
        .select('score, user_id, created_at')
        .eq('date', todayUTC)
        .eq('game_type', gameType)
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

  // Render leaderboard for a specific game
  async function renderLeaderboard(gameType) {
    try {
      const entries = await fetchTodayLeaderboard(gameType);
      let tbody;
      
      if (gameType === 'math') {
        tbody = els.mathLeaderboardBody;
      } else if (gameType === 'flags') {
        tbody = els.flagsLeaderboardBody;
      } else if (gameType === 'capitals') {
        tbody = els.capitalsLeaderboardBody;
      } else {
        return;
      }
      
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

  function updateScoreUI() {
    els.score.textContent = String(gameState.score);
    // Also update game score if game is active
    const gameScore = document.getElementById('gameScore');
    if (gameScore) {
      gameScore.textContent = String(gameState.score);
    }
  }

  function updateTimerUI(remainingMs) {
    const clamped = clamp(remainingMs, 0, QUESTION_TIME_MS);
    els.timeText.textContent = msToSeconds(clamped);
    // Also update game time if game is active
    const gameTime = document.getElementById('gameTime');
    if (gameTime) {
      gameTime.textContent = msToSeconds(clamped);
    }
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

  // Show math question
  function showMathQuestion() {
    const q = generateMathQuestion(gameState.score);
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

  // Show flag question
  function showFlagQuestion() {
    const q = generateFlagQuestion(gameState.score);
    gameState.correctAnswer = q.answer;
    
    const existingOptions = document.querySelectorAll('.option');
    existingOptions.forEach(opt => opt.remove());
    
    // Clear previous question text and add flag image
    els.questionText.innerHTML = '';
    
    const flagImg = document.createElement('img');
    flagImg.src = q.flagUrl;
    flagImg.alt = 'Country flag';
    flagImg.style.width = '200px';
    flagImg.style.height = 'auto';
    flagImg.style.marginBottom = '16px';
    flagImg.style.border = '2px solid rgba(244,63,94,0.3)';
    flagImg.style.borderRadius = '8px';
    
    els.questionText.appendChild(flagImg);
    
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

  // Generate math question
  function generateMathQuestion(score) {
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

  // Generate flag question
  function generateFlagQuestion(score) {
    // Exact list of countries as specified by user
    const flagData = [
      { country: 'Afghanistan', flagUrl: 'https://flagcdn.com/w320/af.png' },
      { country: 'Albania', flagUrl: 'https://flagcdn.com/w320/al.png' },
      { country: 'Algeria', flagUrl: 'https://flagcdn.com/w320/dz.png' },
      { country: 'Andorra', flagUrl: 'https://flagcdn.com/w320/ad.png' },
      { country: 'Angola', flagUrl: 'https://flagcdn.com/w320/ao.png' },
      { country: 'Antigua and Barbuda', flagUrl: 'https://flagcdn.com/w320/ag.png' },
      { country: 'Argentina', flagUrl: 'https://flagcdn.com/w320/ar.png' },
      { country: 'Armenia', flagUrl: 'https://flagcdn.com/w320/am.png' },
      { country: 'Australia', flagUrl: 'https://flagcdn.com/w320/au.png' },
      { country: 'Austria', flagUrl: 'https://flagcdn.com/w320/at.png' },
      { country: 'Azerbaijan', flagUrl: 'https://flagcdn.com/w320/az.png' },
      { country: 'Bahamas', flagUrl: 'https://flagcdn.com/w320/bs.png' },
      { country: 'Bahrain', flagUrl: 'https://flagcdn.com/w320/bh.png' },
      { country: 'Bangladesh', flagUrl: 'https://flagcdn.com/w320/bd.png' },
      { country: 'Barbados', flagUrl: 'https://flagcdn.com/w320/bb.png' },
      { country: 'Belarus', flagUrl: 'https://flagcdn.com/w320/by.png' },
      { country: 'Belgium', flagUrl: 'https://flagcdn.com/w320/be.png' },
      { country: 'Belize', flagUrl: 'https://flagcdn.com/w320/bz.png' },
      { country: 'Benin', flagUrl: 'https://flagcdn.com/w320/bj.png' },
      { country: 'Bhutan', flagUrl: 'https://flagcdn.com/w320/bt.png' },
      { country: 'Bolivia', flagUrl: 'https://flagcdn.com/w320/bo.png' },
      { country: 'Bosnia and Herzegovina', flagUrl: 'https://flagcdn.com/w320/ba.png' },
      { country: 'Botswana', flagUrl: 'https://flagcdn.com/w320/bw.png' },
      { country: 'Brazil', flagUrl: 'https://flagcdn.com/w320/br.png' },
      { country: 'Brunei', flagUrl: 'https://flagcdn.com/w320/bn.png' },
      { country: 'Bulgaria', flagUrl: 'https://flagcdn.com/w320/bg.png' },
      { country: 'Burkina Faso', flagUrl: 'https://flagcdn.com/w320/bf.png' },
      { country: 'Burundi', flagUrl: 'https://flagcdn.com/w320/bi.png' },
      { country: 'Cabo Verde', flagUrl: 'https://flagcdn.com/w320/cv.png' },
      { country: 'Cambodia', flagUrl: 'https://flagcdn.com/w320/kh.png' },
      { country: 'Cameroon', flagUrl: 'https://flagcdn.com/w320/cm.png' },
      { country: 'Canada', flagUrl: 'https://flagcdn.com/w320/ca.png' },
      { country: 'Central African Republic', flagUrl: 'https://flagcdn.com/w320/cf.png' },
      { country: 'Chad', flagUrl: 'https://flagcdn.com/w320/td.png' },
      { country: 'Chile', flagUrl: 'https://flagcdn.com/w320/cl.png' },
      { country: 'China', flagUrl: 'https://flagcdn.com/w320/cn.png' },
      { country: 'Colombia', flagUrl: 'https://flagcdn.com/w320/co.png' },
      { country: 'Comoros', flagUrl: 'https://flagcdn.com/w320/km.png' },
      { country: 'Congo, Democratic Republic of the', flagUrl: 'https://flagcdn.com/w320/cd.png' },
      { country: 'Congo, Republic of the', flagUrl: 'https://flagcdn.com/w320/cg.png' },
      { country: 'Costa Rica', flagUrl: 'https://flagcdn.com/w320/cr.png' },
      { country: 'Croatia', flagUrl: 'https://flagcdn.com/w320/hr.png' },
      { country: 'Cuba', flagUrl: 'https://flagcdn.com/w320/cu.png' },
      { country: 'Cyprus', flagUrl: 'https://flagcdn.com/w320/cy.png' },
      { country: 'Czech Republic (Czechia)', flagUrl: 'https://flagcdn.com/w320/cz.png' },
      { country: 'Denmark', flagUrl: 'https://flagcdn.com/w320/dk.png' },
      { country: 'Djibouti', flagUrl: 'https://flagcdn.com/w320/dj.png' },
      { country: 'Dominica', flagUrl: 'https://flagcdn.com/w320/dm.png' },
      { country: 'Dominican Republic', flagUrl: 'https://flagcdn.com/w320/do.png' },
      { country: 'Ecuador', flagUrl: 'https://flagcdn.com/w320/ec.png' },
      { country: 'Egypt', flagUrl: 'https://flagcdn.com/w320/eg.png' },
      { country: 'El Salvador', flagUrl: 'https://flagcdn.com/w320/sv.png' },
      { country: 'Equatorial Guinea', flagUrl: 'https://flagcdn.com/w320/gq.png' },
      { country: 'Eritrea', flagUrl: 'https://flagcdn.com/w320/er.png' },
      { country: 'Estonia', flagUrl: 'https://flagcdn.com/w320/ee.png' },
      { country: 'Eswatini', flagUrl: 'https://flagcdn.com/w320/sz.png' },
      { country: 'Ethiopia', flagUrl: 'https://flagcdn.com/w320/et.png' },
      { country: 'Fiji', flagUrl: 'https://flagcdn.com/w320/fj.png' },
      { country: 'Finland', flagUrl: 'https://flagcdn.com/w320/fi.png' },
      { country: 'France', flagUrl: 'https://flagcdn.com/w320/fr.png' },
      { country: 'Gabon', flagUrl: 'https://flagcdn.com/w320/ga.png' },
      { country: 'Gambia', flagUrl: 'https://flagcdn.com/w320/gm.png' },
      { country: 'Georgia', flagUrl: 'https://flagcdn.com/w320/ge.png' },
      { country: 'Germany', flagUrl: 'https://flagcdn.com/w320/de.png' },
      { country: 'Ghana', flagUrl: 'https://flagcdn.com/w320/gh.png' },
      { country: 'Greece', flagUrl: 'https://flagcdn.com/w320/gr.png' },
      { country: 'Grenada', flagUrl: 'https://flagcdn.com/w320/gd.png' },
      { country: 'Guatemala', flagUrl: 'https://flagcdn.com/w320/gt.png' },
      { country: 'Guinea', flagUrl: 'https://flagcdn.com/w320/gn.png' },
      { country: 'Guinea-Bissau', flagUrl: 'https://flagcdn.com/w320/gw.png' },
      { country: 'Guyana', flagUrl: 'https://flagcdn.com/w320/gy.png' },
      { country: 'Haiti', flagUrl: 'https://flagcdn.com/w320/ht.png' },
      { country: 'Honduras', flagUrl: 'https://flagcdn.com/w320/hn.png' },
      { country: 'Hungary', flagUrl: 'https://flagcdn.com/w320/hu.png' },
      { country: 'Iceland', flagUrl: 'https://flagcdn.com/w320/is.png' },
      { country: 'India', flagUrl: 'https://flagcdn.com/w320/in.png' },
      { country: 'Indonesia', flagUrl: 'https://flagcdn.com/w320/id.png' },
      { country: 'Iran', flagUrl: 'https://flagcdn.com/w320/ir.png' },
      { country: 'Iraq', flagUrl: 'https://flagcdn.com/w320/iq.png' },
      { country: 'Ireland', flagUrl: 'https://flagcdn.com/w320/ie.png' },
      { country: 'Israel', flagUrl: 'https://flagcdn.com/w320/il.png' },
      { country: 'Italy', flagUrl: 'https://flagcdn.com/w320/it.png' },
      { country: 'Jamaica', flagUrl: 'https://flagcdn.com/w320/jm.png' },
      { country: 'Japan', flagUrl: 'https://flagcdn.com/w320/jp.png' },
      { country: 'Jordan', flagUrl: 'https://flagcdn.com/w320/jo.png' },
      { country: 'Kazakhstan', flagUrl: 'https://flagcdn.com/w320/kz.png' },
      { country: 'Kenya', flagUrl: 'https://flagcdn.com/w320/ke.png' },
      { country: 'Kiribati', flagUrl: 'https://flagcdn.com/w320/ki.png' },
      { country: 'Korea, North', flagUrl: 'https://flagcdn.com/w320/kp.png' },
      { country: 'Korea, South', flagUrl: 'https://flagcdn.com/w320/kr.png' },
      { country: 'Kuwait', flagUrl: 'https://flagcdn.com/w320/kw.png' },
      { country: 'Kyrgyzstan', flagUrl: 'https://flagcdn.com/w320/kg.png' },
      { country: 'Laos', flagUrl: 'https://flagcdn.com/w320/la.png' },
      { country: 'Latvia', flagUrl: 'https://flagcdn.com/w320/lv.png' },
      { country: 'Lebanon', flagUrl: 'https://flagcdn.com/w320/lb.png' },
      { country: 'Lesotho', flagUrl: 'https://flagcdn.com/w320/ls.png' },
      { country: 'Liberia', flagUrl: 'https://flagcdn.com/w320/lr.png' },
      { country: 'Libya', flagUrl: 'https://flagcdn.com/w320/ly.png' },
      { country: 'Liechtenstein', flagUrl: 'https://flagcdn.com/w320/li.png' },
      { country: 'Lithuania', flagUrl: 'https://flagcdn.com/w320/lt.png' },
      { country: 'Luxembourg', flagUrl: 'https://flagcdn.com/w320/lu.png' },
      { country: 'Madagascar', flagUrl: 'https://flagcdn.com/w320/mg.png' },
      { country: 'Malawi', flagUrl: 'https://flagcdn.com/w320/mw.png' },
      { country: 'Malaysia', flagUrl: 'https://flagcdn.com/w320/my.png' },
      { country: 'Maldives', flagUrl: 'https://flagcdn.com/w320/mv.png' },
      { country: 'Mali', flagUrl: 'https://flagcdn.com/w320/ml.png' },
      { country: 'Malta', flagUrl: 'https://flagcdn.com/w320/mt.png' },
      { country: 'Marshall Islands', flagUrl: 'https://flagcdn.com/w320/mh.png' },
      { country: 'Mauritania', flagUrl: 'https://flagcdn.com/w320/mr.png' },
      { country: 'Mauritius', flagUrl: 'https://flagcdn.com/w320/mu.png' },
      { country: 'Mexico', flagUrl: 'https://flagcdn.com/w320/mx.png' },
      { country: 'Micronesia', flagUrl: 'https://flagcdn.com/w320/fm.png' },
      { country: 'Moldova', flagUrl: 'https://flagcdn.com/w320/md.png' },
      { country: 'Monaco', flagUrl: 'https://flagcdn.com/w320/mc.png' },
      { country: 'Mongolia', flagUrl: 'https://flagcdn.com/w320/mn.png' },
      { country: 'Montenegro', flagUrl: 'https://flagcdn.com/w320/me.png' },
      { country: 'Morocco', flagUrl: 'https://flagcdn.com/w320/ma.png' },
      { country: 'Mozambique', flagUrl: 'https://flagcdn.com/w320/mz.png' },
      { country: 'Myanmar (Burma)', flagUrl: 'https://flagcdn.com/w320/mm.png' },
      { country: 'Namibia', flagUrl: 'https://flagcdn.com/w320/na.png' },
      { country: 'Nauru', flagUrl: 'https://flagcdn.com/w320/nr.png' },
      { country: 'Nepal', flagUrl: 'https://flagcdn.com/w320/np.png' },
      { country: 'Netherlands', flagUrl: 'https://flagcdn.com/w320/nl.png' },
      { country: 'New Zealand', flagUrl: 'https://flagcdn.com/w320/nz.png' },
      { country: 'Nicaragua', flagUrl: 'https://flagcdn.com/w320/ni.png' },
      { country: 'Niger', flagUrl: 'https://flagcdn.com/w320/ne.png' },
      { country: 'Nigeria', flagUrl: 'https://flagcdn.com/w320/ng.png' },
      { country: 'North Macedonia', flagUrl: 'https://flagcdn.com/w320/mk.png' },
      { country: 'Norway', flagUrl: 'https://flagcdn.com/w320/no.png' },
      { country: 'Oman', flagUrl: 'https://flagcdn.com/w320/om.png' },
      { country: 'Pakistan', flagUrl: 'https://flagcdn.com/w320/pk.png' },
      { country: 'Palau', flagUrl: 'https://flagcdn.com/w320/pw.png' },
      { country: 'Panama', flagUrl: 'https://flagcdn.com/w320/pa.png' },
      { country: 'Papua New Guinea', flagUrl: 'https://flagcdn.com/w320/pg.png' },
      { country: 'Paraguay', flagUrl: 'https://flagcdn.com/w320/py.png' },
      { country: 'Peru', flagUrl: 'https://flagcdn.com/w320/pe.png' },
      { country: 'Philippines', flagUrl: 'https://flagcdn.com/w320/ph.png' },
      { country: 'Poland', flagUrl: 'https://flagcdn.com/w320/pl.png' },
      { country: 'Portugal', flagUrl: 'https://flagcdn.com/w320/pt.png' },
      { country: 'Qatar', flagUrl: 'https://flagcdn.com/w320/qa.png' },
      { country: 'Romania', flagUrl: 'https://flagcdn.com/w320/ro.png' },
      { country: 'Russia', flagUrl: 'https://flagcdn.com/w320/ru.png' },
      { country: 'Rwanda', flagUrl: 'https://flagcdn.com/w320/rw.png' },
      { country: 'Saint Kitts and Nevis', flagUrl: 'https://flagcdn.com/w320/kn.png' },
      { country: 'Saint Lucia', flagUrl: 'https://flagcdn.com/w320/lc.png' },
      { country: 'Saint Vincent and the Grenadines', flagUrl: 'https://flagcdn.com/w320/vc.png' },
      { country: 'Samoa', flagUrl: 'https://flagcdn.com/w320/ws.png' },
      { country: 'San Marino', flagUrl: 'https://flagcdn.com/w320/sm.png' },
      { country: 'Sao Tome and Principe', flagUrl: 'https://flagcdn.com/w320/st.png' },
      { country: 'Saudi Arabia', flagUrl: 'https://flagcdn.com/w320/sa.png' },
      { country: 'Senegal', flagUrl: 'https://flagcdn.com/w320/sn.png' },
      { country: 'Serbia', flagUrl: 'https://flagcdn.com/w320/rs.png' },
      { country: 'Seychelles', flagUrl: 'https://flagcdn.com/w320/sc.png' },
      { country: 'Sierra Leone', flagUrl: 'https://flagcdn.com/w320/sl.png' },
      { country: 'Singapore', flagUrl: 'https://flagcdn.com/w320/sg.png' },
      { country: 'Slovakia', flagUrl: 'https://flagcdn.com/w320/sk.png' },
      { country: 'Slovenia', flagUrl: 'https://flagcdn.com/w320/si.png' },
      { country: 'Solomon Islands', flagUrl: 'https://flagcdn.com/w320/sb.png' },
      { country: 'Somalia', flagUrl: 'https://flagcdn.com/w320/so.png' },
      { country: 'South Africa', flagUrl: 'https://flagcdn.com/w320/za.png' },
      { country: 'South Sudan', flagUrl: 'https://flagcdn.com/w320/ss.png' },
      { country: 'Spain', flagUrl: 'https://flagcdn.com/w320/es.png' },
      { country: 'Sri Lanka', flagUrl: 'https://flagcdn.com/w320/lk.png' },
      { country: 'Sudan', flagUrl: 'https://flagcdn.com/w320/sd.png' },
      { country: 'Suriname', flagUrl: 'https://flagcdn.com/w320/sr.png' },
      { country: 'Sweden', flagUrl: 'https://flagcdn.com/w320/se.png' },
      { country: 'Switzerland', flagUrl: 'https://flagcdn.com/w320/ch.png' },
      { country: 'Syria', flagUrl: 'https://flagcdn.com/w320/sy.png' },
      { country: 'Tajikistan', flagUrl: 'https://flagcdn.com/w320/tj.png' },
      { country: 'Tanzania', flagUrl: 'https://flagcdn.com/w320/tz.png' },
      { country: 'Thailand', flagUrl: 'https://flagcdn.com/w320/th.png' },
      { country: 'Timor-Leste', flagUrl: 'https://flagcdn.com/w320/tl.png' },
      { country: 'Togo', flagUrl: 'https://flagcdn.com/w320/tg.png' },
      { country: 'Tonga', flagUrl: 'https://flagcdn.com/w320/to.png' },
      { country: 'Trinidad and Tobago', flagUrl: 'https://flagcdn.com/w320/tt.png' },
      { country: 'Tunisia', flagUrl: 'https://flagcdn.com/w320/tn.png' },
      { country: 'Turkey', flagUrl: 'https://flagcdn.com/w320/tr.png' },
      { country: 'Turkmenistan', flagUrl: 'https://flagcdn.com/w320/tm.png' },
      { country: 'Tuvalu', flagUrl: 'https://flagcdn.com/w320/tv.png' },
      { country: 'Uganda', flagUrl: 'https://flagcdn.com/w320/ug.png' },
      { country: 'Ukraine', flagUrl: 'https://flagcdn.com/w320/ua.png' },
      { country: 'United Arab Emirates', flagUrl: 'https://flagcdn.com/w320/ae.png' },
      { country: 'United Kingdom', flagUrl: 'https://flagcdn.com/w320/gb.png' },
      { country: 'United States', flagUrl: 'https://flagcdn.com/w320/us.png' },
      { country: 'Uruguay', flagUrl: 'https://flagcdn.com/w320/uy.png' },
      { country: 'Uzbekistan', flagUrl: 'https://flagcdn.com/w320/uz.png' },
      { country: 'Vanuatu', flagUrl: 'https://flagcdn.com/w320/vu.png' },
      { country: 'Venezuela', flagUrl: 'https://flagcdn.com/w320/ve.png' },
      { country: 'Vietnam', flagUrl: 'https://flagcdn.com/w320/vn.png' },
      { country: 'Yemen', flagUrl: 'https://flagcdn.com/w320/ye.png' },
      { country: 'Zambia', flagUrl: 'https://flagcdn.com/w320/zm.png' },
      { country: 'Zimbabwe', flagUrl: 'https://flagcdn.com/w320/zw.png' },
      { country: 'Vatican City', flagUrl: 'https://flagcdn.com/w320/va.png' },
      { country: 'Palestine', flagUrl: 'https://flagcdn.com/w320/ps.png' },
      { country: 'Taiwan', flagUrl: 'https://flagcdn.com/w320/tw.png' },
      { country: 'Kosovo', flagUrl: 'https://flagcdn.com/w320/xk.png' }
    ];
    
    const correctFlag = pickFrom(flagData);
    const correctAnswer = correctFlag.country;
    
    // Generate wrong answers from other countries
    const wrongCountries = flagData.filter(f => f.country !== correctAnswer).map(f => f.country);
    const wrongAnswers = [];
    
    for (let i = 0; i < 3; i++) {
      if (wrongCountries.length > 0) {
        const randomIndex = Math.floor(Math.random() * wrongCountries.length);
        wrongAnswers.push(wrongCountries.splice(randomIndex, 1)[0]);
      }
    }
    
    const allOptions = [...wrongAnswers, correctAnswer];
    
    // Shuffle options
    for (let i = allOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
    }
    
    return {
      flagUrl: correctFlag.flagUrl,
      answer: correctAnswer,
      options: allOptions
    };
  }

  // Show capital question
  function showCapitalQuestion() {
    const q = generateCapitalQuestion(gameState.score);
    gameState.correctAnswer = q.answer;
    
    const existingOptions = document.querySelectorAll('.option');
    existingOptions.forEach(opt => opt.remove());
    
    // Clear previous question text and add country name
    els.questionText.innerHTML = '';
    
    const countryName = document.createElement('div');
    countryName.textContent = `What is the capital of ${q.country}?`;
    countryName.style.fontSize = '32px';
    countryName.style.fontWeight = '700';
    countryName.style.marginBottom = '16px';
    countryName.style.color = 'var(--text)';
    
    els.questionText.appendChild(countryName);
    
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'options';
    optionsContainer.style.marginTop = '16px';
    
    q.options.forEach((option) => {
      const optionBtn = document.createElement('button');
      optionBtn.className = 'btn option capital-theme';
      optionBtn.textContent = option;
      optionBtn.dataset.value = option;
      optionBtn.addEventListener('click', () => handleOptionClick(option));
      optionsContainer.appendChild(optionBtn);
    });
    
    els.questionText.parentNode.insertBefore(optionsContainer, els.questionText.nextSibling);
    startTimer();
  }

  // Generate capital question
  function generateCapitalQuestion(score) {
    // Capital data for the countries specified by user
    const capitalData = [
      { country: 'Afghanistan', capital: 'Kabul' },
      { country: 'Albania', capital: 'Tirana' },
      { country: 'Algeria', capital: 'Algiers' },
      { country: 'Andorra', capital: 'Andorra la Vella' },
      { country: 'Angola', capital: 'Luanda' },
      { country: 'Antigua and Barbuda', capital: 'Saint John\'s' },
      { country: 'Argentina', capital: 'Buenos Aires' },
      { country: 'Armenia', capital: 'Yerevan' },
      { country: 'Australia', capital: 'Canberra' },
      { country: 'Austria', capital: 'Vienna' },
      { country: 'Azerbaijan', capital: 'Baku' },
      { country: 'Bahamas', capital: 'Nassau' },
      { country: 'Bahrain', capital: 'Manama' },
      { country: 'Bangladesh', capital: 'Dhaka' },
      { country: 'Barbados', capital: 'Bridgetown' },
      { country: 'Belarus', capital: 'Minsk' },
      { country: 'Belgium', capital: 'Brussels' },
      { country: 'Belize', capital: 'Belmopan' },
      { country: 'Benin', capital: 'Porto-Novo' },
      { country: 'Bhutan', capital: 'Thimphu' },
      { country: 'Bolivia', capital: 'La Paz' },
      { country: 'Bosnia and Herzegovina', capital: 'Sarajevo' },
      { country: 'Botswana', capital: 'Gaborone' },
      { country: 'Brazil', capital: 'Brasília' },
      { country: 'Brunei', capital: 'Bandar Seri Begawan' },
      { country: 'Bulgaria', capital: 'Sofia' },
      { country: 'Burkina Faso', capital: 'Ouagadougou' },
      { country: 'Burundi', capital: 'Gitega' },
      { country: 'Cabo Verde', capital: 'Praia' },
      { country: 'Cambodia', capital: 'Phnom Penh' },
      { country: 'Cameroon', capital: 'Yaoundé' },
      { country: 'Canada', capital: 'Ottawa' },
      { country: 'Central African Republic', capital: 'Bangui' },
      { country: 'Chad', capital: 'N\'Djamena' },
      { country: 'Chile', capital: 'Santiago' },
      { country: 'China', capital: 'Beijing' },
      { country: 'Colombia', capital: 'Bogotá' },
      { country: 'Comoros', capital: 'Moroni' },
      { country: 'Congo, Democratic Republic of the', capital: 'Kinshasa' },
      { country: 'Congo, Republic of the', capital: 'Brazzaville' },
      { country: 'Costa Rica', capital: 'San José' },
      { country: 'Croatia', capital: 'Zagreb' },
      { country: 'Cuba', capital: 'Havana' },
      { country: 'Cyprus', capital: 'Nicosia' },
      { country: 'Czech Republic (Czechia)', capital: 'Prague' },
      { country: 'Denmark', capital: 'Copenhagen' },
      { country: 'Djibouti', capital: 'Djibouti' },
      { country: 'Dominica', capital: 'Roseau' },
      { country: 'Dominican Republic', capital: 'Santo Domingo' },
      { country: 'Ecuador', capital: 'Quito' },
      { country: 'Egypt', capital: 'Cairo' },
      { country: 'El Salvador', capital: 'San Salvador' },
      { country: 'Equatorial Guinea', capital: 'Malabo' },
      { country: 'Eritrea', capital: 'Asmara' },
      { country: 'Estonia', capital: 'Tallinn' },
      { country: 'Eswatini', capital: 'Mbabane' },
      { country: 'Ethiopia', capital: 'Addis Ababa' },
      { country: 'Fiji', capital: 'Suva' },
      { country: 'Finland', capital: 'Helsinki' },
      { country: 'France', capital: 'Paris' },
      { country: 'Gabon', capital: 'Libreville' },
      { country: 'Gambia', capital: 'Banjul' },
      { country: 'Georgia', capital: 'Tbilisi' },
      { country: 'Germany', capital: 'Berlin' },
      { country: 'Ghana', capital: 'Accra' },
      { country: 'Greece', capital: 'Athens' },
      { country: 'Grenada', capital: 'Saint George\'s' },
      { country: 'Guatemala', capital: 'Guatemala City' },
      { country: 'Guinea', capital: 'Conakry' },
      { country: 'Guinea-Bissau', capital: 'Bissau' },
      { country: 'Guyana', capital: 'Georgetown' },
      { country: 'Haiti', capital: 'Port-au-Prince' },
      { country: 'Honduras', capital: 'Tegucigalpa' },
      { country: 'Hungary', capital: 'Budapest' },
      { country: 'Iceland', capital: 'Reykjavik' },
      { country: 'India', capital: 'New Delhi' },
      { country: 'Indonesia', capital: 'Jakarta' },
      { country: 'Iran', capital: 'Tehran' },
      { country: 'Iraq', capital: 'Baghdad' },
      { country: 'Ireland', capital: 'Dublin' },
      { country: 'Israel', capital: 'Jerusalem' },
      { country: 'Italy', capital: 'Rome' },
      { country: 'Jamaica', capital: 'Kingston' },
      { country: 'Japan', capital: 'Tokyo' },
      { country: 'Jordan', capital: 'Amman' },
      { country: 'Kazakhstan', capital: 'Nur-Sultan' },
      { country: 'Kenya', capital: 'Nairobi' },
      { country: 'Kiribati', capital: 'South Tarawa' },
      { country: 'Korea, North', capital: 'Pyongyang' },
      { country: 'Korea, South', capital: 'Seoul' },
      { country: 'Kuwait', capital: 'Kuwait City' },
      { country: 'Kyrgyzstan', capital: 'Bishkek' },
      { country: 'Laos', capital: 'Vientiane' },
      { country: 'Latvia', capital: 'Riga' },
      { country: 'Lebanon', capital: 'Beirut' },
      { country: 'Lesotho', capital: 'Maseru' },
      { country: 'Liberia', capital: 'Monrovia' },
      { country: 'Libya', capital: 'Tripoli' },
      { country: 'Liechtenstein', capital: 'Vaduz' },
      { country: 'Lithuania', capital: 'Vilnius' },
      { country: 'Luxembourg', capital: 'Luxembourg' },
      { country: 'Madagascar', capital: 'Antananarivo' },
      { country: 'Malawi', capital: 'Lilongwe' },
      { country: 'Malaysia', capital: 'Kuala Lumpur' },
      { country: 'Maldives', capital: 'Male' },
      { country: 'Mali', capital: 'Bamako' },
      { country: 'Malta', capital: 'Valletta' },
      { country: 'Marshall Islands', capital: 'Majuro' },
      { country: 'Mauritania', capital: 'Nouakchott' },
      { country: 'Mauritius', capital: 'Port Louis' },
      { country: 'Mexico', capital: 'Mexico City' },
      { country: 'Micronesia', capital: 'Palikir' },
      { country: 'Moldova', capital: 'Chișinău' },
      { country: 'Monaco', capital: 'Monaco' },
      { country: 'Mongolia', capital: 'Ulaanbaatar' },
      { country: 'Montenegro', capital: 'Podgorica' },
      { country: 'Morocco', capital: 'Rabat' },
      { country: 'Mozambique', capital: 'Maputo' },
      { country: 'Myanmar (Burma)', capital: 'Naypyidaw' },
      { country: 'Namibia', capital: 'Windhoek' },
      { country: 'Nauru', capital: 'Yaren' },
      { country: 'Nepal', capital: 'Kathmandu' },
      { country: 'Netherlands', capital: 'Amsterdam' },
      { country: 'New Zealand', capital: 'Wellington' },
      { country: 'Nicaragua', capital: 'Managua' },
      { country: 'Niger', capital: 'Niamey' },
      { country: 'Nigeria', capital: 'Abuja' },
      { country: 'North Macedonia', capital: 'Skopje' },
      { country: 'Norway', capital: 'Oslo' },
      { country: 'Oman', capital: 'Muscat' },
      { country: 'Pakistan', capital: 'Islamabad' },
      { country: 'Palau', capital: 'Ngerulmud' },
      { country: 'Panama', capital: 'Panama City' },
      { country: 'Papua New Guinea', capital: 'Port Moresby' },
      { country: 'Paraguay', capital: 'Asunción' },
      { country: 'Peru', capital: 'Lima' },
      { country: 'Philippines', capital: 'Manila' },
      { country: 'Poland', capital: 'Warsaw' },
      { country: 'Portugal', capital: 'Lisbon' },
      { country: 'Qatar', capital: 'Doha' },
      { country: 'Romania', capital: 'Bucharest' },
      { country: 'Russia', capital: 'Moscow' },
      { country: 'Rwanda', capital: 'Kigali' },
      { country: 'Saint Kitts and Nevis', capital: 'Basseterre' },
      { country: 'Saint Lucia', capital: 'Castries' },
      { country: 'Saint Vincent and the Grenadines', capital: 'Kingstown' },
      { country: 'Samoa', capital: 'Apia' },
      { country: 'San Marino', capital: 'San Marino' },
      { country: 'Sao Tome and Principe', capital: 'São Tomé' },
      { country: 'Saudi Arabia', capital: 'Riyadh' },
      { country: 'Senegal', capital: 'Dakar' },
      { country: 'Serbia', capital: 'Belgrade' },
      { country: 'Seychelles', capital: 'Victoria' },
      { country: 'Sierra Leone', capital: 'Freetown' },
      { country: 'Singapore', capital: 'Singapore' },
      { country: 'Slovakia', capital: 'Bratislava' },
      { country: 'Slovenia', capital: 'Ljubljana' },
      { country: 'Solomon Islands', capital: 'Honiara' },
      { country: 'Somalia', capital: 'Mogadishu' },
      { country: 'South Africa', capital: 'Pretoria' },
      { country: 'South Sudan', capital: 'Juba' },
      { country: 'Spain', capital: 'Madrid' },
      { country: 'Sri Lanka', capital: 'Colombo' },
      { country: 'Sudan', capital: 'Khartoum' },
      { country: 'Suriname', capital: 'Paramaribo' },
      { country: 'Sweden', capital: 'Stockholm' },
      { country: 'Switzerland', capital: 'Bern' },
      { country: 'Syria', capital: 'Damascus' },
      { country: 'Tajikistan', capital: 'Dushanbe' },
      { country: 'Tanzania', capital: 'Dodoma' },
      { country: 'Thailand', capital: 'Bangkok' },
      { country: 'Timor-Leste', capital: 'Dili' },
      { country: 'Togo', capital: 'Lomé' },
      { country: 'Tonga', capital: 'Nuku\'alofa' },
      { country: 'Trinidad and Tobago', capital: 'Port of Spain' },
      { country: 'Tunisia', capital: 'Tunis' },
      { country: 'Turkey', capital: 'Ankara' },
      { country: 'Turkmenistan', capital: 'Ashgabat' },
      { country: 'Tuvalu', capital: 'Funafuti' },
      { country: 'Uganda', capital: 'Kampala' },
      { country: 'Ukraine', capital: 'Kyiv' },
      { country: 'United Arab Emirates', capital: 'Abu Dhabi' },
      { country: 'United Kingdom', capital: 'London' },
      { country: 'United States', capital: 'Washington, D.C.' },
      { country: 'Uruguay', capital: 'Montevideo' },
      { country: 'Uzbekistan', capital: 'Tashkent' },
      { country: 'Vanuatu', capital: 'Port Vila' },
      { country: 'Venezuela', capital: 'Caracas' },
      { country: 'Vietnam', capital: 'Hanoi' },
      { country: 'Yemen', capital: 'Sana\'a' },
      { country: 'Zambia', capital: 'Lusaka' },
      { country: 'Zimbabwe', capital: 'Harare' },
      { country: 'Vatican City', capital: 'Vatican City' },
      { country: 'Palestine', capital: 'East Jerusalem' },
      { country: 'Taiwan', capital: 'Taipei' },
      { country: 'Kosovo', capital: 'Pristina' }
    ];
    
    const correctCountry = pickFrom(capitalData);
    const correctAnswer = correctCountry.capital;
    
    // Generate wrong answers from other capitals
    const wrongCapitals = capitalData.filter(c => c.capital !== correctAnswer).map(c => c.capital);
    const wrongAnswers = [];
    
    for (let i = 0; i < 3; i++) {
      if (wrongCapitals.length > 0) {
        const randomIndex = Math.floor(Math.random() * wrongCapitals.length);
        wrongAnswers.push(wrongCapitals.splice(randomIndex, 1)[0]);
      }
    }
    
    const allOptions = [...wrongAnswers, correctAnswer];
    
    // Shuffle options
    for (let i = allOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
    }
    
    return {
      country: correctCountry.country,
      answer: correctAnswer,
      options: allOptions
    };
  }

  function showQuestion() {
    if (gameState.currentGame === 'math') {
      showMathQuestion();
    } else if (gameState.currentGame === 'flags') {
      showFlagQuestion();
    } else if (gameState.currentGame === 'capitals') {
      showCapitalQuestion();
    }
  }

  function handleOptionClick(selectedValue) {
    const userAnswer = selectedValue; // For flags, this is the country name

    if (gameState.currentGame === 'math') {
      // Math game logic
      if (Number(userAnswer) === gameState.correctAnswer) {
        const remaining = Math.max(0, gameState.deadlineTs - now());
        const earned = computePoints(remaining);
        gameState.score += earned;
        updateScoreUI();
        showMathQuestion();
      } else {
        endGame('wrong');
      }
    } else if (gameState.currentGame === 'flags') {
      // Flag game logic
      if (userAnswer === gameState.correctAnswer) {
        const remaining = Math.max(0, gameState.deadlineTs - now());
        const earned = computePoints(remaining);
        gameState.score += earned;
        updateScoreUI();
        showFlagQuestion();
      } else {
        endGame('wrong');
      }
    } else if (gameState.currentGame === 'capitals') {
      // Capital game logic
      if (userAnswer === gameState.correctAnswer) {
        const remaining = Math.max(0, gameState.deadlineTs - now());
        const earned = computePoints(remaining);
        gameState.score += earned;
        updateScoreUI();
        showCapitalQuestion();
      } else {
        endGame('wrong');
      }
    }
  }

  function startGame() {
    if (!gameState.currentGame) {
      console.error('No game selected');
      return;
    }
    
    const rawName = (els.name.value || '').trim();
    gameState.playerName = rawName || 'Player';
    
    if (gameState.isAuthenticated) {
      ensureProfile(gameState.playerName);
    }

    gameState.score = 0;
    gameState.scoreSubmitted = false;
    updateScoreUI();
    setSections({ showLogin: false, showSetup: false, showGame: true, showGameOver: false });
    els.mathLeaderboard.classList.add('hidden');
    els.flagsLeaderboard.classList.add('hidden');
    els.dailyWinsLeaderboard.classList.add('hidden');
    
    // Show appropriate question based on game type
    if (gameState.currentGame === 'math') {
      showMathQuestion();
    } else if (gameState.currentGame === 'flags') {
      showFlagQuestion();
    } else if (gameState.currentGame === 'capitals') {
      showCapitalQuestion();
    }
  }

  function endGame(reason) {
    clearTimer();
    setSections({ showLogin: false, showSetup: false, showGame: false, showGameOver: true });
    els.finalScore.textContent = String(gameState.score);
    
    // Show appropriate leaderboard based on game type
    if (gameState.currentGame === 'math') {
      els.mathLeaderboard.classList.remove('hidden');
      els.flagsLeaderboard.classList.add('hidden');
      els.capitalsLeaderboard.classList.add('hidden');
      renderLeaderboard('math');
    } else if (gameState.currentGame === 'flags') {
      els.flagsLeaderboard.classList.remove('hidden');
      els.mathLeaderboard.classList.add('hidden');
      els.capitalsLeaderboard.classList.add('hidden');
      renderLeaderboard('flags');
    } else if (gameState.currentGame === 'capitals') {
      els.capitalsLeaderboard.classList.remove('hidden');
      els.mathLeaderboard.classList.add('hidden');
      els.flagsLeaderboard.classList.add('hidden');
      renderLeaderboard('capitals');
    }
    
    els.dailyWinsLeaderboard.classList.remove('hidden');
    renderDailyWinsLeaderboard();

    els.submitScore.disabled = false;
    els.submitScore.textContent = 'Submit Score';
    
    if (reason === 'timeout') {
      els.timeText.textContent = '0.0';
      els.timeBar.style.width = '0%';
      // Also update game time if game is active
      const gameTime = document.getElementById('gameTime');
      if (gameTime) {
        gameTime.textContent = '0.0';
      }
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
        // Refresh appropriate leaderboard based on game type
        if (gameState.currentGame === 'math') {
          await renderLeaderboard('math');
        } else if (gameState.currentGame === 'flags') {
          await renderLeaderboard('flags');
        } else if (gameState.currentGame === 'capitals') {
          await renderLeaderboard('capitals');
        }
        await renderDailyWinsLeaderboard();
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

    // Game selection events
    document.querySelector('[data-game="math"] button').addEventListener('click', () => selectGame('math'));
    document.querySelector('[data-game="flags"] button').addEventListener('click', () => selectGame('flags'));
    document.querySelector('[data-game="capitals"] button').addEventListener('click', () => selectGame('capitals'));

    // Game events
    els.start.addEventListener('click', startGame);
    els.submitScore.addEventListener('click', handleSubmitScore);
    els.playAgain.addEventListener('click', () => {
      console.log('Play again clicked');
      setSections({ showLogin: false, showSetup: true, showGame: false, showGameOver: false });
      els.mathLeaderboard.classList.add('hidden');
      els.flagsLeaderboard.classList.add('hidden');
      els.capitalsLeaderboard.classList.add('hidden');
      els.dailyWinsLeaderboard.classList.add('hidden');
      document.body.className = ''; // Reset theme
      els.name.focus();
    });
    els.backToHome.addEventListener('click', () => {
      console.log('Back to home clicked');
      setSections({ showLogin: false, showSetup: true, showGame: false, showGameOver: false });
      els.mathLeaderboard.classList.add('hidden');
      els.flagsLeaderboard.classList.add('hidden');
      els.capitalsLeaderboard.classList.add('hidden');
      els.dailyWinsLeaderboard.classList.add('hidden');
      // Reset game selection to show both options
      document.querySelector('.game-selection').classList.remove('hidden');
      els.gameSetup.classList.add('hidden');
      gameState.currentGame = null;
      els.name.focus();
    });
    
    // Leaderboard refresh events
    els.refreshMathLeaderboard.addEventListener('click', () => renderLeaderboard('math'));
    els.refreshFlagsLeaderboard.addEventListener('click', () => renderLeaderboard('flags'));
    els.refreshCapitalsLeaderboard.addEventListener('click', () => renderLeaderboard('capitals'));
    els.refreshDailyWins.addEventListener('click', renderDailyWinsLeaderboard);
  }

  async function init() {
    try {
      console.log('Initializing game...');
      
      // Check if all required elements are found
      if (!els.setup || !els.loginModal || !els.game || !els.gameOver) {
        console.error('Some required DOM elements are missing!');
        return;
      }
      
      // Check if user is already logged in
      const isLoggedIn = await checkAuth();
      
      if (isLoggedIn) {
        // User is logged in, show setup directly
        console.log('User is logged in, showing setup');
        try {
          await showSetup();
        } catch (setupError) {
          console.error('Error in showSetup, using fallback:', setupError);
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
      showLoginModal();
    }
  });

  document.addEventListener('DOMContentLoaded', init);
})(); 