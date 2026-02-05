# Implementation Guide: Race Outcome Integration

## Quick Start

### 1. Enable Outcome Validation

After races complete (typically 90 minutes after race time), validate predictions:

```typescript
import { outcomeRouter } from "./routers/outcomeRouter";

// Call via tRPC
const result = await trpc.outcome.validatePredictions.mutate({
  raceDate: "2026-02-06"
});

console.log(`Validated ${result.validationCount} predictions`);
console.log(`Average NDCG@3: ${result.metrics.ndcgAt3}`);
```

### 2. Monitor Model Performance

Display model metrics on dashboard:

```typescript
const { data: metrics } = trpc.outcome.getModelMetrics.useQuery();

return (
  <div>
    <h2>Best Model: {metrics.summary.bestModel.modelName}</h2>
    <p>NDCG@3: {metrics.summary.bestModel.ndcgAt3.toFixed(3)}</p>
    <p>Win Accuracy: {metrics.summary.bestModel.winAccuracy.toFixed(1)}%</p>
  </div>
);
```

### 3. Set Up Drift Detection

Initialize drift monitoring for your models:

```typescript
import { getDriftIntegrationService } from "./services/driftIntegrationService";

const driftService = getDriftIntegrationService();

// Set baseline metrics (run once per model)
driftService.setBaseline("model_1", {
  ndcgAt3: 0.85,
  ndcgAt5: 0.88,
  winAccuracy: 0.25,
  placeAccuracy: 0.55,
  showAccuracy: 0.70,
  totalPredictions: 100,
  correctPredictions: 25,
  averageConfidence: 0.80,
  totalROI: 5.0
});

// Monitor performance
const alerts = driftService.monitorPerformance("model_1", currentMetrics);
if (alerts.length > 0) {
  console.log(`⚠️ Drift detected: ${alerts[0].message}`);
}
```

### 4. Enable Automated Retraining

Start the retraining orchestrator:

```typescript
import { getAutomatedRetrainingService } from "./services/automatedRetrainingService";

const retrainingService = getAutomatedRetrainingService();
retrainingService.start();

// Check status
const status = retrainingService.getQueueStatus();
console.log(`Queue: ${status.queueLength} | Active: ${status.activeJobs}`);
```

## Integration Checklist

- [ ] **Phase 1: Data Collection**
  - [ ] LiveRaceDataService fetching race results
  - [ ] Predictions stored with race metadata
  - [ ] Race outcomes captured after race time

- [ ] **Phase 2: Outcome Validation**
  - [ ] OutcomeValidationService matching predictions to results
  - [ ] NDCG@3 metrics calculated correctly
  - [ ] Accuracy metrics (win/place/show) computed
  - [ ] ROI calculations working

- [ ] **Phase 3: Model Tracking**
  - [ ] ModelComparisonService registering models
  - [ ] Model weights initialized
  - [ ] Performance summary calculated
  - [ ] A/B test framework ready

- [ ] **Phase 4: Drift Detection**
  - [ ] DriftIntegrationService initialized
  - [ ] Baseline metrics set for each model
  - [ ] NDCG drift detection working
  - [ ] Concept drift detection (KS-test) implemented
  - [ ] Drift alerts created and stored

- [ ] **Phase 5: Automated Retraining**
  - [ ] AutomatedRetrainingService running
  - [ ] Retraining jobs queued on drift
  - [ ] Job status tracking working
  - [ ] Model weights updated after retraining

- [ ] **Phase 6: UI & Monitoring**
  - [ ] ModelComparison dashboard accessible
  - [ ] NDCG trend chart displaying
  - [ ] Drift alerts visible
  - [ ] Retraining status shown

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/services/liveRaceDataService.ts` | Fetch race results from API |
| `server/services/outcomeValidationService.ts` | Validate predictions, calculate metrics |
| `server/services/modelComparisonService.ts` | Track model performance, manage weights |
| `server/services/driftIntegrationService.ts` | Detect performance drift |
| `server/services/automatedRetrainingService.ts` | Queue and manage retraining jobs |
| `server/routers/outcomeRouter.ts` | API endpoints for outcome data |
| `server/routers/retrainingRouter.ts` | API endpoints for retraining management |
| `client/src/pages/ModelComparison.tsx` | Dashboard UI |
| `RACE_OUTCOME_INTEGRATION.md` | Complete documentation |

## Common Tasks

### Task: Check if Model Needs Retraining

```typescript
const driftService = getDriftIntegrationService();
const retrainingService = getAutomatedRetrainingService();

const needs = retrainingService.checkRetrainingNeeds();
if (needs.modelsNeedingRetrain.length > 0) {
  console.log(`Models to retrain: ${needs.modelsNeedingRetrain.join(", ")}`);
  for (const modelId of needs.modelsNeedingRetrain) {
    retrainingService.queueRetrainingJob(modelId, "drift_detected");
  }
}
```

### Task: Get NDCG Trend

```typescript
const driftService = getDriftIntegrationService();
const trend = driftService.calculateNDCGTrend("model_1");

console.log(`Trend: ${trend.trend}`);
console.log(`Change: ${trend.changePercent.toFixed(2)}%`);
console.log(`Slope: ${trend.slope.toFixed(4)}`);
```

### Task: Promote A/B Test Winner

```typescript
const retrainingService = getAutomatedRetrainingService();
const result = retrainingService.promoteABTestWinner("ensemble-v1-vs-v2");

if (result.success) {
  console.log(`✅ Promoted ${result.promotedModel} to production`);
}
```

### Task: Get Retraining Statistics

```typescript
const retrainingService = getAutomatedRetrainingService();
const stats = retrainingService.getStatistics();

console.log(`Total completed: ${stats.totalJobsCompleted}`);
console.log(`Successful: ${stats.successfulJobs}`);
console.log(`Failed: ${stats.failedJobs}`);
console.log(`Avg NDCG improvement: ${(stats.averageNDCGImprovement * 100).toFixed(2)}%`);
```

## Debugging

### Issue: Drift Alerts Not Triggering

1. **Check baseline is set:**
   ```typescript
   const history = driftService.getMetricsHistory("model_1");
   console.log(`History length: ${history.length}`);
   ```

2. **Verify thresholds:**
   ```typescript
   // Default: 2% NDCG drop triggers alert
   // If NDCG only dropped 1%, no alert
   ```

3. **Check alert storage:**
   ```typescript
   const modelService = getModelComparisonService();
   const alerts = modelService.getActiveDriftAlerts();
   console.log(`Active alerts: ${alerts.length}`);
   ```

### Issue: Retraining Jobs Not Processing

1. **Check service is running:**
   ```typescript
   const status = retrainingService.getQueueStatus();
   console.log(`Queue: ${status.queueLength}, Active: ${status.activeJobs}`);
   ```

2. **Check cooldown period:**
   ```typescript
   // Default: 1 hour between retraining same model
   // If last retrain was 30 min ago, job will be skipped
   ```

3. **Check job status:**
   ```typescript
   const job = retrainingService.getJobStatus(jobId);
   console.log(`Status: ${job.status}`);
   if (job.error) console.log(`Error: ${job.error}`);
   ```

## Performance Considerations

### Memory Usage
- DriftIntegrationService stores metrics history (default: 100 predictions)
- AutomatedRetrainingService stores completed jobs (cleaned up after 5 seconds)
- ModelComparisonService stores all model metrics in memory

### API Rate Limiting
- The Racing API has rate limits (2 requests/second)
- LiveRaceDataService implements caching (5 minutes)
- Use mock data for testing to avoid rate limits

### Computation Complexity
- NDCG calculation: O(n log n) for sorting
- KS-test: O(n) for distribution comparison
- Linear regression: O(n) for trend calculation
- All operations complete in <100ms for typical window sizes

## Production Deployment

### Before Going Live

1. **Test with real race data**
   ```bash
   npm test -- race-outcome-integration.test.ts
   ```

2. **Verify API credentials**
   - Set RACING_API_USERNAME and RACING_API_PASSWORD
   - Test The Racing API connection

3. **Configure thresholds**
   - Adjust drift thresholds based on your data
   - Set retraining cooldown period
   - Configure max concurrent jobs

4. **Monitor initial performance**
   - Watch NDCG metrics for first 100 races
   - Check drift alert frequency
   - Verify retraining improves performance

### Monitoring in Production

```typescript
// Daily health check
const stats = retrainingService.getStatistics();
const summary = driftService.getDriftSummary();

if (summary.criticalAlerts > 0) {
  // Send alert to ops team
  notifyOwner({
    title: "Critical Drift Detected",
    content: `${summary.criticalAlerts} critical alerts require attention`
  });
}
```

## Next Steps

1. **Integrate with MLflow**
   - Log experiments and metrics
   - Track model versions
   - Store artifacts

2. **Add Real ML Pipeline**
   - Replace simulation with actual training
   - Implement feature engineering
   - Add hyperparameter optimization

3. **Implement Advanced Drift Detection**
   - ADWIN (Adaptive Windowing)
   - Change point detection
   - Multiple drift type support

4. **Build Explainability**
   - SHAP integration
   - Feature importance tracking
   - Drift root cause analysis
