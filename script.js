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
    isAuthenticated: false,
    eventsBound: false // New flag to track if events are bound
  };

  // Check if user is already logged in
  async function checkAuth() {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (session) {
      gameState.user = session.user;
      gameState.isAuthenticated = true;
      console.log('User already logged in:', session.user.email);
      await updateDailyWinsDisplay();
      return true;
    }
    return false;
  }

  // Fetch user's daily wins count
  async function fetchDailyWins() {
    if (!gameState.user) return;

    try {
      const { data, error } = await window.supabase
        .from('daily_winners')
        .select('date')
        .eq('user_id', gameState.user.id);

      if (error) {
        console.error('Error fetching daily wins:', error);
        return 0;
      }

      return data.length;
    } catch (error) {
      console.error('Error fetching daily wins:', error);
      return 0;
    }
  }

  // Update daily wins display
  async function updateDailyWinsDisplay() {
    if (gameState.isAuthenticated) {
      const wins = await fetchDailyWins();
      els.dailyWins.textContent = wins;
      els.dailyWins.parentElement.classList.remove('hidden');
    } else {
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
    setSections({ showLogin: false, showSetup: true, showGame: false, showGameOver: false });
    els.name.focus();
    
    // Ensure events are bound when setup is shown
    if (!gameState.eventsBound) {
      bindEvents();
      gameState.eventsBound = true;
      console.log('Events bound in showSetup');
    }
    
    // Test direct event binding
    console.log('Adding direct click listener to start button');
    els.start.onclick = () => {
      console.log('Direct onclick triggered!');
      startGame();
    };
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

  // Test basic network connectivity to Supabase
  async function testNetworkConnectivity() {
    console.log('🌐 Testing network connectivity to Supabase...');
    
    try {
      // Test 1: Basic fetch to Supabase URL
      const supabaseUrl = window.supabase.supabaseUrl;
      console.log('Testing fetch to:', supabaseUrl);
      
      const response = await fetch(supabaseUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Network response status:', response.status);
      console.log('Network response ok:', response.ok);
      
      if (response.ok) {
        console.log('✓ Network connectivity to Supabase working');
        return true;
      } else {
        console.error('✗ Network response not ok:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('✗ Network connectivity test failed:', error);
      return false;
    }
  }

  // Test Supabase connection
  async function testSupabaseConnection() {
    console.log('Testing Supabase connection...');
    console.log('Supabase URL:', window.supabase.supabaseUrl);
    console.log('Supabase anon key length:', window.supabase.supabaseKey?.length || 'undefined');
    
    // Test network connectivity first
    const networkOk = await testNetworkConnectivity();
    if (!networkOk) {
      console.error('❌ Network connectivity failed - this is likely the root cause');
      return false;
    }
    
    try {
      // Test 1: Basic Supabase client initialization
      console.log('Test 1: Checking Supabase client...');
      if (!window.supabase) {
        console.error('Supabase client not found');
        return false;
      }
      console.log('✓ Supabase client exists');
      
      // Test 2: Authentication check
      console.log('Test 2: Checking authentication...');
      const { data: { user }, error: userError } = await window.supabase.auth.getUser();
      console.log('Auth test - user:', user, 'error:', userError);
      
      if (userError) {
        console.error('✗ Auth test failed:', userError);
        return false;
      }
      console.log('✓ Authentication working');
      
      // Test 3: Basic database connection (simple select)
      console.log('Test 3: Testing basic database connection...');
      const { data: testData, error: testError } = await window.supabase
        .from('users')
        .select('id')
        .limit(1);
      
      console.log('Basic DB test - data:', testData, 'error:', testError);
      
      if (testError) {
        console.error('✗ Basic database connection failed:', testError);
        return false;
      }
      console.log('✓ Basic database connection working');
      
      // Test 4: Check if daily_scores table exists
      console.log('Test 4: Checking daily_scores table...');
      const { data: tableCheck, error: tableError } = await window.supabase
        .from('daily_scores')
        .select('*')
        .limit(0); // Just check if table exists, don't fetch data
      
      console.log('Table check - data:', tableCheck, 'error:', tableError);
      
      if (tableError) {
        console.error('✗ daily_scores table check failed:', tableError);
        console.error('This suggests the table might not exist or you lack permissions');
        return false;
      }
      console.log('✓ daily_scores table accessible');
      
      // Test 5: Check RLS policies by trying to insert a test record
      console.log('Test 5: Testing insert permissions...');
      const testDate = new Date().toISOString().slice(0, 10);
      const { data: insertTest, error: insertError } = await window.supabase
        .from('daily_scores')
        .insert({
          date: testDate,
          user_id: user.id,
          score: 999 // Test score
        })
        .select();
      
      console.log('Insert test - data:', insertTest, 'error:', insertError);
      
      if (insertError) {
        console.error('✗ Insert test failed:', insertError);
        console.error('This suggests RLS policies are blocking the insert');
        return false;
      }
      console.log('✓ Insert permissions working');
      
      // Clean up test record
      if (insertTest && insertTest.length > 0) {
        await window.supabase
          .from('daily_scores')
          .delete()
          .eq('id', insertTest[0].id);
        console.log('✓ Test record cleaned up');
      }
      
      console.log('🎉 All Supabase tests passed!');
      return true;
    } catch (error) {
      console.error('❌ Supabase connection test exception:', error);
      return false;
    }
  }

  // Submit today's score to Supabase
  async function submitTodayScore(score) {
    console.log('submitTodayScore called with score:', score);
    console.log('Current user:', gameState.user);
    
    if (!gameState.user) {
      console.log('No user, cannot submit score');
      return false;
    }

    try {
      const todayUTC = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      console.log('Submitting score for date:', todayUTC);
      console.log('User ID:', gameState.user.id);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Score submission timeout after 10 seconds')), 10000);
      });
      
      // Upsert best-of-day; RLS ensures: only self, only today, only if higher
      const supabasePromise = window.supabase
        .from('daily_scores')
        .upsert({
          date: todayUTC,
          user_id: gameState.user.id,
          score: score
        }, { onConflict: 'date,user_id' });

      console.log('About to await Supabase upsert...');
      const { data, error } = await Promise.race([supabasePromise, timeoutPromise]);
      console.log('Supabase response - data:', data, 'error:', error);

      if (error) {
        console.error('Error submitting score:', error);
        return false;
      }

      console.log('Score submitted successfully');
      return true;
    } catch (error) {
      console.error('Exception in submitTodayScore:', error);
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
    console.log('setSections called with:', { showLogin, showSetup, showGame, showGameOver });
    els.loginModal.classList.toggle('hidden', !showLogin);
    els.setup.classList.toggle('hidden', !showSetup);
    els.game.classList.toggle('hidden', !showGame);
    els.gameOver.classList.toggle('hidden', !showGameOver);
    console.log('Sections updated. Current visibility:');
    console.log('loginModal hidden:', els.loginModal.classList.contains('hidden'));
    console.log('setup hidden:', els.setup.classList.contains('hidden'));
    console.log('game hidden:', els.game.classList.contains('hidden'));
    console.log('gameOver hidden:', els.gameOver.classList.contains('hidden'));
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
    console.log('showQuestion called');
    const q = generateQuestion(gameState.score);
    console.log('Generated question:', q);
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
    console.log('Question displayed, starting timer');
    startTimer();
    console.log('showQuestion completed');
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
    console.log('startGame called');
    const rawName = (els.name.value || '').trim();
    gameState.playerName = rawName || 'Player';
    console.log('Player name:', gameState.playerName);
    
    if (gameState.isAuthenticated) {
      console.log('User authenticated, ensuring profile');
      ensureProfile(gameState.playerName);
    }

    gameState.score = 0;
    gameState.scoreSubmitted = false;
    updateScoreUI();
    console.log('Setting sections to show game');
    setSections({ showLogin: false, showSetup: false, showGame: true, showGameOver: false });
    els.leaderboard.classList.add('hidden');
    console.log('About to show question');
    showQuestion();
    console.log('startGame completed');
  }

  function endGame(reason) {
    clearTimer();
    setSections({ showLogin: false, showSetup: false, showGame: false, showGameOver: true });
    els.finalScore.textContent = String(gameState.score);
    
    els.leaderboard.classList.remove('hidden');
    renderLeaderboard();

    els.submitScore.disabled = false;
    els.submitScore.textContent = 'Submit Score';
    
    // Test Supabase connection when game ends
    if (gameState.isAuthenticated) {
      testSupabaseConnection();
    }
    
    if (reason === 'timeout') {
      els.timeText.textContent = '0.0';
      els.timeBar.style.width = '0%';
    }
  }

  async function handleSubmitScore() {
    console.log('handleSubmitScore called');
    console.log('Score already submitted:', gameState.scoreSubmitted);
    console.log('User authenticated:', gameState.isAuthenticated);
    
    if (gameState.scoreSubmitted) {
      console.log('Score already submitted');
      return;
    }

    if (!gameState.isAuthenticated) {
      console.log('User not authenticated, showing login modal');
      showLoginStatus('Please log in to submit your score', 'error');
      showLoginModal();
      return;
    }

    console.log('Starting score submission...');
    els.submitScore.disabled = true;
    els.submitScore.textContent = 'Submitting...';
    
    try {
      console.log('Calling submitTodayScore...');
      const success = await submitTodayScore(gameState.score);
      console.log('submitTodayScore result:', success);
      
      if (success) {
        console.log('Score submission successful, updating UI');
        els.submitScore.textContent = 'Score Submitted!';
        gameState.scoreSubmitted = true;
        console.log('Refreshing leaderboard...');
        await renderLeaderboard(); // Refresh leaderboard
        console.log('Leaderboard refreshed');
      } else {
        console.log('Score submission failed, re-enabling button');
        els.submitScore.textContent = 'Submit Score (Retry)';
        els.submitScore.disabled = false;
        // Add manual retry button
        addRetryButton();
      }
    } catch (error) {
      console.error('Exception in handleSubmitScore:', error);
      els.submitScore.textContent = 'Submit Score (Retry)';
      els.submitScore.disabled = false;
      // Add manual retry button
      addRetryButton();
    }
  }

  // Manual retry function for score submission
  async function retryScoreSubmission() {
    console.log('Manual retry of score submission');
    if (!gameState.scoreSubmitted) {
      await handleSubmitScore();
    }
  }

  // Add retry button to the game over screen
  function addRetryButton() {
    // Remove existing retry button if it exists
    const existingRetry = document.getElementById('retryScore');
    if (existingRetry) {
      existingRetry.remove();
    }
    
    // Create new retry button
    const retryBtn = document.createElement('button');
    retryBtn.id = 'retryScore';
    retryBtn.className = 'btn secondary';
    retryBtn.textContent = 'Retry Submission';
    retryBtn.addEventListener('click', retryScoreSubmission);
    
    // Insert after the submit score button
    els.submitScore.parentNode.insertBefore(retryBtn, els.submitScore.nextSibling);
    
    // Add diagnostic test button
    const testBtn = document.createElement('button');
    testBtn.id = 'testConnection';
    testBtn.className = 'btn secondary';
    testBtn.textContent = 'Test Connection';
    testBtn.addEventListener('click', () => {
      console.log('Manual connection test triggered');
      testSupabaseConnection();
    });
    
    // Insert after the retry button
    retryBtn.parentNode.insertBefore(testBtn, retryBtn.nextSibling);
  }

  function bindEvents() {
    console.log('bindEvents called');
    console.log('start button element:', els.start);
    
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
    els.start.addEventListener('click', () => {
      console.log('Start button clicked!');
      startGame();
    });
    els.submitScore.addEventListener('click', handleSubmitScore);
    els.playAgain.addEventListener('click', () => {
      console.log('Play again clicked');
      setSections({ showLogin: false, showSetup: true, showGame: false, showGameOver: false });
      els.leaderboard.classList.add('hidden');
      els.name.focus();
    });
    
    console.log('All event listeners attached');
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
      await updateDailyWinsDisplay();
    } else if (event === 'SIGNED_OUT') {
      gameState.user = null;
      gameState.isAuthenticated = false;
      console.log('User signed out');
      await updateDailyWinsDisplay();
    }
  });

  document.addEventListener('DOMContentLoaded', init);
})(); 