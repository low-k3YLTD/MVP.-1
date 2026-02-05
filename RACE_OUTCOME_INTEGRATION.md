# Race Outcome Integration & Automated Retraining

## Overview

This document describes the complete race outcome integration system that captures actual race results, validates prediction accuracy, detects performance drift, and automatically retrains models to maintain NDCG>0.97.

## Architecture

### Core Components

1. **LiveRaceDataService** (`server/services/liveRaceDataService.ts`)
   - Fetches upcoming races from The Racing API
   - Fetches actual race results with finishing positions
   - Handles API authentication and fallback to mock data
   - Caches results for 5 minutes

2. **OutcomeValidationService** (`server/services/outcomeValidationService.ts`)
   - Validates predictions against actual race results
   - Calculates NDCG@3, NDCG@5 metrics
   - Computes win/place/show accuracy
   - Calculates ROI from prediction outcomes
   - Matches predictions to race results by race ID and horse name

3. **ModelComparisonService** (`server/services/modelComparisonService.ts`)
   - Tracks metrics for all ensemble models
   - Manages model weights for ensemble predictions
   - Adjusts weights based on NDCG performance
   - Stores and manages drift alerts
   - Handles A/B testing framework

4. **DriftIntegrationService** (`server/services/driftIntegrationService.ts`)
   - Monitors NDCG drift (performance degradation)
   - Detects win/place accuracy drift
   - Implements Kolmogorov-Smirnov test for concept drift
   - Calculates NDCG trends using linear regression
   - Manages retraining cooldown periods

5. **AutomatedRetrainingService** (`server/services/automatedRetrainingService.ts`)
   - Queues retraining jobs based on drift detection
   - Manages concurrent retraining (max 2 jobs)
   - Tracks job status and completion
   - Promotes A/B test winners to production
   - Provides retraining statistics

### API Routes

#### Outcome Validation (`server/routers/outcomeRouter.ts`)

```typescript
// Validate predictions against race results
trpc.outcome.validatePredictions.mutation({
  raceDate: "today" // or specific date
})

// Get user accuracy metrics
trpc.outcome.getAccuracyMetrics.query({
  days: 30 // last 30 days
})

// Get model performance metrics
trpc.outcome.getModelMetrics.query()

// Get model weights for ensemble
trpc.outcome.getModelWeights.query()

// Get drift alerts
trpc.outcome.getDriftAlerts.query()

// Get A/B test results
trpc.outcome.getABTests.query()
```

#### Retraining Management (`server/routers/retrainingRouter.ts`)

```typescript
// Check if models need retraining
trpc.retraining.checkRetrainingNeeds.query()

// Queue manual retraining job
trpc.retraining.queueRetrainingJob.mutation({
  modelId: "model_1",
  reason: "drift_detected"
})

// Get retraining job status
trpc.retraining.getJobStatus.query({
  jobId: "retrain_model_1_1234567890"
})

// Get active retraining jobs
trpc.retraining.getActiveJobs.query()

// Get queue status
trpc.retraining.getQueueStatus.query()

// Get retraining statistics
trpc.retraining.getStatistics.query()

// Get drift summary
trpc.retraining.getDriftSummary.query()

// Get NDCG trend for model
trpc.retraining.getNDCGTrend.query({
  modelId: "model_1"
})

// Promote A/B test winner
trpc.retraining.promoteABTestWinner.mutation({
  testId: "ensemble-v1-vs-v2"
})

// Start/stop retraining service
trpc.retraining.startRetrainingService.mutation()
trpc.retraining.stopRetrainingService.mutation()
```

### UI Components

#### Model Comparison Dashboard (`client/src/pages/ModelComparison.tsx`)

Features:
- **NDCG@3 Trend Chart**: 30-day historical performance visualization
- **Model Performance Table**: Sortable list with NDCG@3, win accuracy, ROI
- **Ensemble Weights Chart**: Bar chart showing model weight distribution
- **Drift Alert System**: Color-coded alerts (critical/high/medium/low)
- **A/B Test Results**: Active test comparison with statistical significance
- **Key Metrics Cards**: Best NDCG, average NDCG, active models, drift alerts

Access at `/models` route.

## Workflow

### 1. Race Result Capture

```
LiveRaceDataService.getRaceResults(raceDate)
  ↓
Fetches completed races from The Racing API
  ↓
Returns RaceResult[] with finishing positions
```

### 2. Outcome Validation

```
OutcomeValidationService.validatePredictions(predictions, raceResults)
  ↓
Matches predictions to actual results
  ↓
Calculates:
  - NDCG@3, NDCG@5
  - Win/Place/Show accuracy
  - ROI
  - Accuracy metrics
```

### 3. Drift Detection

```
DriftIntegrationService.monitorPerformance(modelId, currentMetrics)
  ↓
Compares to baseline metrics
  ↓
Detects:
  - NDCG drift (>2% drop triggers alert)
  - Win accuracy drift (>10% change)
  - Place accuracy drift (>8% change)
  - Concept drift (KS-test >0.15)
  ↓
Creates DriftAlert if threshold exceeded
```

### 4. Automated Retraining

```
AutomatedRetrainingService.processQueue()
  ↓
Checks retraining needs
  ↓
If critical drift detected:
  - Queue retraining job
  - Execute (max 2 concurrent)
  - Simulate training (2 seconds)
  - Calculate NDCG improvement
  ↓
If improvement ≥1%:
  - Mark as completed
  - Update model metrics
  - Release cooldown (1 hour)
```

### 5. A/B Testing & Promotion

```
ModelComparisonService.createABTest(test)
  ↓
Run control vs treatment models
  ↓
Calculate statistical significance (chi-square)
  ↓
If p-value < 0.05 and treatment better:
  - Promote treatment to 70% weight
  - Demote control to 30% weight
```

## Configuration

### DriftIntegrationService

```typescript
{
  ndcgDriftThreshold: 0.02,        // 2% drop triggers alert
  dataDriftThreshold: 0.05,        // p-value < 0.05
  conceptDriftThreshold: 0.15,     // KS-test magnitude
  windowSize: 100,                 // predictions to analyze
  cooldownPeriod: 3600000          // 1 hour between retraining
}
```

### AutomatedRetrainingService

```typescript
{
  maxConcurrentJobs: 2,            // max parallel retraining
  jobTimeout: 1800000,             // 30 minutes
  minDatapointsForRetraining: 50,  // minimum predictions
  performanceThreshold: 0.01,      // 1% NDCG improvement required
  autoPromoteThreshold: 0.05       // p-value for auto-promotion
}
```

## Metrics & KPIs

### Accuracy Metrics

- **NDCG@3**: Normalized Discounted Cumulative Gain at position 3
  - 1.0 = perfect ranking
  - 0.5 = off by one position
  - 0.0 = incorrect prediction
  - Target: >0.97

- **Win Accuracy**: % of predictions ranked #1 that finished #1
- **Place Accuracy**: % of predictions ranked ≤3 that finished ≤3
- **Show Accuracy**: % of predictions ranked ≤5 that finished ≤5
- **ROI**: Return on investment from predictions

### Drift Metrics

- **NDCG Drift**: (baseline NDCG - current NDCG) / baseline NDCG
  - >2% triggers medium alert
  - >3% triggers high alert
  - >5% triggers critical alert

- **Concept Drift**: KS-test statistic between distributions
  - >0.15 indicates drift
  - >0.25 requires retraining
  - >0.30 triggers critical alert

## Integration Points

### With MLflow

The system integrates with MLflow for:
- Experiment tracking of retraining jobs
- Model registry and versioning
- Drift detection logging
- Performance metric recording

### With Prediction Service

The prediction service uses:
- Model weights from ModelComparisonService
- Ensemble predictions from weighted models
- Confidence scores based on model agreement

### With Automation Service

The automation service:
- Triggers outcome validation after race time
- Feeds accuracy metrics to drift detection
- Queues retraining jobs based on drift alerts

## Usage Examples

### Check Model Performance

```typescript
const { data: metrics } = trpc.outcome.getModelMetrics.useQuery();
console.log(`Best NDCG: ${metrics.summary.bestModel.ndcgAt3}`);
```

### Monitor Drift Alerts

```typescript
const { data: driftData } = trpc.outcome.getDriftAlerts.useQuery();
if (driftData.shouldRetrain) {
  console.log(`Critical drift detected: ${driftData.recommendation.reason}`);
}
```

### Queue Retraining

```typescript
const { mutate: queueJob } = trpc.retraining.queueRetrainingJob.useMutation();
queueJob({
  modelId: "model_1",
  reason: "drift_detected"
});
```

### View Retraining Status

```typescript
const { data: status } = trpc.retraining.getQueueStatus.useQuery();
console.log(`Queue length: ${status.queueLength}`);
console.log(`Active jobs: ${status.activeJobs}`);
```

## Testing

Run integration tests:

```bash
npm test -- server/services/__tests__/race-outcome-integration.test.ts
```

Tests cover:
- Outcome validation (NDCG calculation, accuracy metrics)
- Model comparison (metric tracking, weight adjustment)
- Drift detection (NDCG drift, concept drift, KS-test)
- Automated retraining (job queueing, status tracking)
- End-to-end workflow (full pipeline)

## Future Enhancements

1. **Real ML Pipeline Integration**
   - Connect to actual CatBoost/TabNet training
   - Implement feature engineering pipeline
   - Add hyperparameter optimization

2. **Advanced Drift Detection**
   - Implement ADWIN (Adaptive Windowing)
   - Add change point detection
   - Support for multiple drift types

3. **Explainability Integration**
   - Connect SHAP explanations to drift alerts
   - Show which features caused drift
   - Feature importance tracking

4. **Production Deployment**
   - Deploy MLflow server with PostgreSQL backend
   - Set up S3 artifact storage
   - Implement model serving infrastructure

5. **Advanced A/B Testing**
   - Multi-armed bandit optimization
   - Thompson sampling for traffic allocation
   - Bayesian hypothesis testing

## Troubleshooting

### Models Not Retraining

1. Check drift alerts: `trpc.outcome.getDriftAlerts.query()`
2. Verify cooldown period: `trpc.retraining.getQueueStatus.query()`
3. Check retraining service status: `trpc.retraining.getStatistics.query()`

### NDCG Not Improving

1. Verify baseline metrics are set correctly
2. Check if sufficient data points (min 50)
3. Review model weights and ensemble configuration
4. Check for data quality issues in racing API

### Drift Alerts Too Frequent

1. Increase drift thresholds in DriftIntegrationService config
2. Increase cooldown period to prevent rapid retraining
3. Check for systemic data issues

## References

- [NDCG Metric](https://en.wikipedia.org/wiki/Discounted_cumulative_gain)
- [Kolmogorov-Smirnov Test](https://en.wikipedia.org/wiki/Kolmogorov%E2%80%93Smirnov_test)
- [Concept Drift](https://en.wikipedia.org/wiki/Concept_drift)
- [MLflow Documentation](https://mlflow.org/docs/latest/)
