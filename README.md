# SatoshiFlip - Bitcoin Coinflip Game

A web-based Bitcoin coinflip game where users can bet Bitcoin in 50/50 coinflip contests.

## Features

- 50/50 coinflip game with Bitcoin
- Internal balance system displaying amounts in satoshis
- Real-time updates for active wagers
- Animated coin flip for game results
- Responsive design for desktop and mobile

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript, Tailwind CSS
- **Backend**: Supabase (planned)
- **Bitcoin Integration**: Internal balance system (planned)

## Project Structure

```
satoshiflip/
├── index.html          # Main HTML file
├── src/
│   ├── css/            # Stylesheets
│   │   └── styles.css  # Custom styles
│   └── js/             # JavaScript files
│       └── app.js      # Main application logic
├── public/             # Public assets (images, etc.)
└── README.md           # Project documentation
```

## Getting Started

1. Clone the repository
2. Open `index.html` in your browser to view the project

## Development Roadmap

- [x] Basic UI layout
- [x] Game creation and listing
- [x] Coin flip animation
- [ ] Supabase integration
- [ ] User authentication
- [ ] Bitcoin deposit/withdrawal system
- [ ] Transaction history

## Specifications

- Minimum wager: ₿ 100 (100 satoshis)
- Maximum wager: ₿ 100,000,000 (1 BTC)
- Game timeout: 5 minutes if no opponent joins
- Wagers displayed in satoshis (8 decimal places)
- Example: 0.01405043 BTC = ₿ 1 405 043 