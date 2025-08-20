# Math Sprint

A fast-paced math game: answer as many questions as you can with 10 seconds per question. One wrong answer (or timeout) ends the game. Your final score is saved to a local leaderboard.

## Features
- 10 seconds per question with a visual time bar
- Starts hard and ramps up; questions may chain multiple operations
- Instant game over on wrong answer or timeout
- Local leaderboard (top 10) stored in your browser
- Keyboard-friendly: press Enter to submit

## Quick start
Just open `index.html` in your browser.

If you prefer a local server (recommended for best experience):

- Python (3.x):
  ```bash
  cd /Users/joemay/Desktop/RandomCoding/math-game
  python3 -m http.server 8080
  ```
  Then open `http://localhost:8080`.

- Node (using npx serve):
  ```bash
  cd /Users/joemay/Desktop/RandomCoding/math-game
  npx --yes serve -p 8080 -s
  ```

## How scoring works
- You earn more points the faster you answer.
- Each correct answer is worth 1 to 5 points based on remaining time.
- The game ends immediately on the first wrong answer or when time reaches zero.
- Your final score is added to the leaderboard with your name and timestamp.

## Resetting the leaderboard
Use the "Reset" button next to the leaderboard title. This only clears scores for your current browser.

## Customization
- Timer length: change `QUESTION_TIME_MS` in `script.js`.
- Points curve: change `MAX_POINTS_PER_QUESTION` and `computePoints()` in `script.js`.
- Leaderboard size: change `LEADERBOARD_LIMIT` in `script.js`.
- Difficulty tuning: adjust `buildChain()` ranges and selection logic in `script.js`. 