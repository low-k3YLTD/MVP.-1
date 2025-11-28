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
- Live races page component not rendering in browser (routing issue - needs investigation)
- Racing API free tier doesn't provide odds data (only available in paid tier)

## Notes
- Ensemble uses 4 models: New LightGBM Ranker, Logistic Regression, XGBoost, Old LightGBM
- Mean NDCG@3 performance: 0.9529
- Model files are stored locally in /home/ubuntu/ directory
- Need to copy model files to project directory for deployment
- Racing API credentials: RACING_API_USERNAME and RACING_API_PASSWORD (configured in environment)
- Live race data service successfully fetches 38+ races daily from The Racing API
- All integration tests passing: racing-api.test.ts, live-races-integration.test.ts, prediction-with-live-races.test.ts
