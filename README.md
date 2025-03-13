# SatoshiFlip - Bitcoin Coinflip Game

A web-based Bitcoin coinflip game where users can bet Bitcoin in 50/50 coinflip contests.

## Features

- 50/50 coinflip game with Bitcoin
- Internal balance system displaying amounts in satoshis
- User authentication with email/password
- Real-time updates for active wagers
- Animated coin flip for game results
- Responsive design for desktop and mobile
- Secure Bitcoin deposit and withdrawal system

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript (ES Modules), Tailwind CSS
- **Backend**: Supabase (Authentication, Database, Realtime Subscriptions)
- **Bitcoin Integration**: Internal balance system with deposit/withdrawal

## Project Structure

```
satoshiflip/
├── index.html              # Main HTML file
├── src/
│   ├── css/                # Stylesheets
│   │   └── styles.css      # Custom styles
│   └── js/                 # JavaScript files
│       ├── app.js          # Main application logic
│       ├── auth.js         # Authentication module
│       ├── supabase.js     # Supabase integration
│       └── transactions.js # Bitcoin transactions module
├── database/
│   └── schema.sql          # Supabase database schema and functions
├── public/                 # Public assets (images, etc.)
└── README.md               # Project documentation
```

## Getting Started

1. Create a Supabase project and run the SQL from `database/schema.sql`
2. Update `src/js/supabase.js` with your Supabase project URL and anon key
3. Deploy your project or run it locally with a web server

### Running Locally

```
# With Python
python -m http.server

# With Node.js
npx serve
```

Then open your browser to http://localhost:8000 or the port shown in your terminal.

## Development Roadmap

- [x] Basic UI layout
- [x] Game creation and listing
- [x] Coin flip animation
- [x] Supabase integration
- [x] User authentication
- [x] Deposit/withdrawal interface
- [ ] Bitcoin transaction processing
- [ ] Transaction history
- [ ] Admin dashboard

## Specifications

- Minimum wager: ₿ 100 (100 satoshis)
- Maximum wager: ₿ 100,000,000 (1 BTC)
- Game timeout: 5 minutes if no opponent joins
- Wagers displayed in satoshis (8 decimal places)
- Example: 0.01405043 BTC = ₿ 1 405 043

## Security Considerations

- Row-level security policies for database tables
- Server-side validation for all transactions
- Secure storage of user balances
- Transaction logging for all deposits/withdrawals
- Rate limiting for game creation 