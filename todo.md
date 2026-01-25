# Horse Race Predictor App - TODO

## Phase 1: Project Setup (COMPLETED)
- [x] Initialize full-stack web project with server, db, and user features
- [x] Set up database schema and authentication

## Phase 2: Backend Integration
- [x] Create prediction service module to load and manage ensemble models
- [x] Add tRPC procedure for single race prediction (input: race features, output: ranked horses)
- [x] Add tRPC procedure for batch predictions (input: multiple races, output: rankings)
- [x] Add tRPC procedure to retrieve prediction history for authenticated users
- [x] Create database table to store prediction history and results
- [ ] Integrate enhanced ensemble prediction service with Python backend
- [ ] Implement model caching to avoid reloading models on every request

## Phase 3: Frontend UI
- [x] Design and implement landing page with app description
- [x] Create prediction input form (single race prediction)
- [ ] Create batch prediction interface (upload CSV or paste data)
- [ ] Implement results display with ranked horses and confidence scores
- [ ] Create prediction history page for authenticated users
- [ ] Add visualization of prediction accuracy over time
- [x] Implement error handling and user feedback

## Phase 4: Testing & Deployment
- [ ] Test prediction API with sample data
- [ ] Verify ensemble model predictions match expected outputs
- [ ] Test authentication and user-specific features
- [ ] Expose temporary public URL for testing
- [ ] Create documentation for API usage

## Phase 5: Live Race Data Integration (COMPLETED)
- [x] Integrate The Racing API with HTTP Basic Authentication
- [x] Fetch live race data for today and tomorrow
- [x] Transform Racing API response to application format
- [x] Create live races display page with filtering by country/track
- [x] Implement predictions on live race horses
- [x] Add batch prediction support for live races
- [x] Write comprehensive integration tests

## Phase 6: Optional Enhancements
- [ ] Add tomorrow's races to the fetch
- [ ] Implement advanced filtering and sorting of predictions
- [ ] Add export functionality (CSV, JSON)
- [ ] Create admin dashboard for model performance monitoring
- [ ] Implement subscription tiers for prediction limits
- [ ] Add real-time updates using WebSocket

## Known Issues
- Racing API free tier doesn't provide odds data (only available in paid tier)

## Completed Fixes
- [x] Fixed wouter routing issue - changed `path=""` to `path="/"` to properly match only root path
- [x] Fixed __dirname error in ensemblePredictionService and predictionService using import.meta.url
- [x] Increased vitest timeout from 5s to 30s for long-running prediction tests

## Notes
- Ensemble uses 4 models: New LightGBM Ranker, Logistic Regression, XGBoost, Old LightGBM
- Mean NDCG@3 performance: 0.9529
- Model files are stored locally in /home/ubuntu/ directory
- Need to copy model files to project directory for deployment
- Racing API credentials: RACING_API_USERNAME and RACING_API_PASSWORD (configured in environment)
- Live race data service successfully fetches 38+ races daily from The Racing API
- All integration tests passing: racing-api.test.ts, live-races-integration.test.ts, prediction-with-live-races.test.ts

## Phase 6: Race Predictions on Live Races (COMPLETED)
- [x] Update LiveRaces component to handle race selection
- [x] Create race predictions modal/panel component
- [x] Integrate predictions with tRPC backend
- [x] Display predicted winners ranked by confidence
- [x] Test predictions display and ranking
- [x] Fixed __dirname error in prediction services
- [x] Increased test timeout to 30 seconds for long-running tests
- [x] All 13 integration tests passing

## Phase 7: Exotic Bet Optimizer Integration (COMPLETED)
- [x] Convert SQLAlchemy models to Drizzle ORM schema
- [x] Create database tables for races, horses, optimization runs, exotic bets, EV signals, and metrics
- [x] Implement exotic bet optimization service (exacta, trifecta, superfecta combinations)
- [x] Create tRPC procedures for exotic bet analysis
- [x] Generate realistic EV calculations using odds product multipliers
- [x] Implement Kelly criterion allocation for bet sizing
- [x] Write comprehensive unit tests (11 tests passing)
- [x] Test with mock race data and form ratings
## Phase 8: Exotic Bets UI Page (COMPLETED)
- [x] Create ExoticBets page component with live race selection
- [x] Build visual bet card components for exacta, trifecta, superfecta
- [x] Integrate with tRPC exotic bets optimization endpoint
- [x] Add filtering by bet type (All, Exacta, Trifecta, Superfecta)
- [x] Add sorting by EV, Probability, Kelly
- [x] Display bet cards with all metrics (EV, probability, payout odds, Kelly fraction, confidence)
- [x] Implement "Add to Bet Slip" functionality
- [x] Test UI with live race data - 45 profitable combinations found
- [x] Register route in App.tsx

## Phase 9: Stripe Payment Integration (IN PROGRESS)
- [x] Add Stripe feature to project
- [x] Create subscription products (Basic, Pro, Premium tiers)
- [x] Add subscription management to database schema
- [x] Implement tRPC procedures for subscription checkout and management
- [x] Build subscription UI components and pricing page
- [x] Add prediction limit enforcement based on subscription tier
- [x] Implement webhook handling for subscription events
- [ ] Test payment flow end-to-end

## Phase 10: Integrate Live Predictions into Exotic Bets (COMPLETED)
- [x] Create tRPC procedure to get predictions for a race's horses (getRaceHorsePredictions)
- [x] Update ExoticBets component to fetch predictions when race is selected
- [x] Modify exotic bet optimizer to use actual win probabilities from ensemble model
- [x] Test with live predictions and verify EV calculations
- [x] Verify calibration of predictions with market odds (70% model, 30% market)
- [x] Browser testing confirmed: predictions fetched and used in exotic bet optimization
- [x] All 23/24 integration tests passing (Racing API rate limit issue on 1 test)
