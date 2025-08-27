# 🎯 Trivia Attack

A comprehensive trivia gaming platform featuring multiple game modes, online leaderboards, currency system, achievements, and user profiles. Challenge yourself across different categories and compete with players worldwide!

## 🎮 Game Modes

### 🧮 Math Attack
- **Challenge**: Solve increasingly difficult math problems
- **Time Limit**: 10 seconds per question
- **Scoring**: More points for faster answers (1-5 points based on remaining time)
- **Difficulty**: Starts moderately challenging and ramps up quickly
- **Format**: Multiple choice with 4 options

### 🏁 Flag Attack
- **Challenge**: Identify countries from their flags
- **Coverage**: 195 countries including all major nations
- **Scoring**: Same time-based scoring system
- **Format**: Multiple choice with 4 country options

### 🏛️ Capital Attack
- **Challenge**: Guess the capital city of displayed countries
- **Coverage**: All 195 countries from Flag Attack
- **Scoring**: Time-based points system
- **Format**: Multiple choice with 4 capital options

### ⚽ Football Badge Attack
- **Challenge**: Identify football teams from their club badges
- **Coverage**: Top 5 European leagues + additional leagues
- **Leagues**: Premier League, LaLiga, Bundesliga, Serie A, Ligue 1, Eredivisie, Liga Portugal, Süper Lig
- **Scoring**: Time-based points system
- **Format**: Multiple choice with 4 team options

## 💰 Currency & Achievement System

### 🪙 Coins
- **Earn Coins**: 5 coins per correct answer
- **High Score Bonus**: 25 coins for new personal best
- **Daily Winner**: 50 coins for winning daily competitions
- **Achievements**: Various coin rewards for milestones

### 🏆 Achievements
- **Math Master**: Answer 100 math questions correctly
- **Flag Explorer**: Answer 50 flag questions correctly
- **Capital Connoisseur**: Answer 50 capital questions correctly
- **Badge Collector**: Answer 50 football badge questions correctly
- **Daily Champion**: Win 5 daily competitions
- **Question Crusher**: Answer 500 total questions correctly
- **Speed Demon**: Answer 10 questions in under 5 seconds total

### 👤 Avatar System
- **Purchase Avatars**: Use coins to buy new avatars
- **Display**: Avatars shown beside usernames on leaderboards
- **Customization**: Personalize your profile with unique avatars

## 🏅 Leaderboards

### 📊 Daily Leaderboards
- **Game-Specific**: Separate leaderboards for each game mode
- **Daily Reset**: New competition every day
- **Top Players**: Compete for daily winner status
- **Real-Time**: Live updates and rankings

### 🏆 Daily Wins Leaderboard
- **Total Wins**: Track cumulative daily victories across all games
- **Game Breakdown**: See wins per game type
- **All-Time**: Historical performance tracking

### 🌐 Online Multiplayer
- **Supabase Backend**: Secure, scalable cloud database
- **User Accounts**: Persistent progress and statistics
- **Global Competition**: Compete with players worldwide
- **Real-Time Updates**: Instant leaderboard updates

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection for online features
- Local web server for development (optional)

### Quick Start
1. **Open the Website**: Navigate to the deployed site
2. **Create Account**: Sign up with email and password
3. **Choose Game**: Select from 4 different game modes
4. **Start Playing**: Answer questions and earn coins
5. **Track Progress**: View achievements and leaderboards

### Local Development
For development or testing, run a local web server:

```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx serve -p 8000

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## 🛠️ Technical Features

### Frontend
- **Pure JavaScript**: No frameworks, lightweight and fast
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Modern CSS**: Grid layouts, custom properties, animations
- **Progressive Web App**: Installable and offline-capable

### Backend
- **Supabase**: PostgreSQL database with real-time subscriptions
- **Authentication**: Secure user management system
- **Row Level Security**: Data protection and privacy
- **Edge Functions**: Automated daily winner processing

### Security
- **User Isolation**: Players can only access their own data
- **Input Validation**: Sanitized user inputs
- **Rate Limiting**: Protection against abuse
- **Secure APIs**: HTTPS-only communication

## 📱 User Experience

### 🎯 Gameplay
- **Immediate Feedback**: Instant scoring and coin rewards
- **Smooth Performance**: No laggy popups or interruptions
- **Visual Indicators**: Time bars, score displays, progress tracking
- **Accessibility**: Keyboard navigation and screen reader support

### 🏠 User Interface
- **Clean Design**: Modern, intuitive interface
- **Theme System**: Color-coded game modes
- **Responsive Layout**: Adapts to any screen size
- **Profile Management**: Easy access to achievements and avatars

### 📊 Statistics
- **Personal Tracking**: Monitor your progress across all games
- **Achievement Progress**: See how close you are to unlocking rewards
- **Performance History**: Track improvement over time
- **Social Features**: Compare scores with other players

## 🔧 Customization

### Game Settings
- **Timer Duration**: Adjustable question time limits
- **Difficulty Curves**: Customize progression rates
- **Scoring Systems**: Modify point calculations
- **Question Types**: Add new question categories

### Visual Themes
- **Color Schemes**: Game-specific color themes
- **Avatar System**: Expandable avatar collection
- **UI Elements**: Customizable interface components
- **Responsive Breakpoints**: Mobile-first design approach

## 🌟 Future Features

### Planned Enhancements
- **New Game Modes**: Science, History, Geography, and more
- **Tournament System**: Seasonal competitions and brackets
- **Social Features**: Friends, teams, and chat
- **Mobile App**: Native iOS and Android applications
- **AI Integration**: Personalized difficulty adjustment

### Community Features
- **User-Generated Content**: Custom question creation
- **Leaderboard Challenges**: Weekly and monthly events
- **Achievement Sharing**: Social media integration
- **Community Forums**: Discussion and strategy sharing

## 🤝 Contributing

### Development
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Bug Reports
- Use GitHub Issues for bug reports
- Include detailed reproduction steps
- Provide browser and device information
- Attach console logs if applicable

### Feature Requests
- Submit through GitHub Issues
- Describe the desired functionality
- Explain the user benefit
- Consider implementation complexity

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **Supabase Team**: For the excellent backend platform
- **Flag CDN**: For country flag images
- **Football Clubs**: For team badge usage
- **Open Source Community**: For inspiration and tools

---

**Ready to attack some trivia?** 🚀 Start playing now and see if you can become the ultimate Trivia Attack champion! 