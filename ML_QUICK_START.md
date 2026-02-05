# ML Pipeline Quick Start Guide

## 5-Minute Setup

### 1. Enable Real Training

In your application initialization:

```typescript
import { getAutomatedRetrainingService } from "./server/services/automatedRetrainingService";

const retrainingService = getAutomatedRetrainingService();
retrainingService.enableRealTraining();
```

### 2. Trigger Training Pipeline

When drift is detected or retraining is needed:

```typescript
import { getModelTrainingOrchestrator } from "./server/services/modelTrainingOrchestrator";

const orchestrator = getModelTrainingOrchestrator();
const result = await orchestrator.executeTrainingPipeline("drift_detected");

if (result.success) {
  console.log(`Training successful! Improvement: ${(result.improvement * 100).toFixed(2)}%`);
  console.log(`Best model: ${result.bestModel?.modelId}`);
} else {
  console.error(`Training failed: ${result.error}`);
}
```

### 3. Monitor Performance

```typescript
import { getMLflowIntegrationService } from "./server/services/mlflowIntegrationService";

const mlflow = getMLflowIntegrationService();

// Get best model
const bestModel = mlflow.getBestModel("ndcg_at_3");
console.log(`Current best NDCG@3: ${bestModel?.metrics.ndcg_at_3.toFixed(4)}`);

// Get statistics
const stats = mlflow.getStatistics();
console.log(`Total experiments: ${stats.totalExperiments}`);
console.log(`Average metric: ${stats.averageMetric.toFixed(4)}`);
```

---

## Common Tasks

### Train a Single Model

```typescript
import { getMLTrainingService } from "./server/services/mlTrainingService";

const trainingService = getMLTrainingService();

// Prepare data
const trainingData = await trainingService.prepareTrainingData(predictions);

// Train CatBoost
const result = await trainingService.trainCatBoostModel(trainingData);

console.log(`NDCG@3: ${result.ndcgAt3.toFixed(4)}`);
console.log(`Win Accuracy: ${result.winAccuracy.toFixed(2)}`);
```

### Optimize Hyperparameters

```typescript
import { getHyperparameterOptimizationService } from "./server/services/hyperparameterOptimizationService";

const hpoService = getHyperparameterOptimizationService();

// Define objective function
const objective = async (params) => {
  const result = await trainingService.trainCatBoostModel(trainingData, params);
  return result.ndcgAt3;
};

// Run optimization
const result = await hpoService.optimizeHyperparameters(objective, 50);

console.log(`Best params:`, result.bestParams);
console.log(`Best score: ${result.bestScore.toFixed(4)}`);
```

### Engineer Features

```typescript
import { getFeatureEngineeringService } from "./server/services/featureEngineeringService";

const featureService = getFeatureEngineeringService();

// Engineer features from race data
const engineered = featureService.engineerFeatures(raceData);

// Update statistics
await featureService.updateFeatureStats(predictions);

// Get statistics
const stats = featureService.getFeatureStats();
console.log(`Weight mean: ${stats.weight.mean}, std: ${stats.weight.std}`);
```

### Log Experiment to MLflow

```typescript
import { getMLflowIntegrationService } from "./server/services/mlflowIntegrationService";

const mlflow = getMLflowIntegrationService();

// Start run
const runId = mlflow.startRun({
  experimentName: "horse_race_predictions",
  runName: "my_experiment",
  tags: { version: "1.0", model: "catboost" },
  params: { learningRate: 0.05, depth: 6 }
});

// Log metrics
mlflow.logMetrics({
  ndcg_at_3: 0.96,
  ndcg_at_5: 0.94,
  win_accuracy: 0.72
});

// End run
mlflow.endRun("FINISHED");

// Register model
const model = mlflow.registerModel("catboost_v1", "model_path", {
  ndcg_at_3: 0.96,
  win_accuracy: 0.72
});

// Promote to production
mlflow.transitionModelStage("catboost_v1", 1, "Production");
```

---

## Performance Targets

### Baseline (Pre-trained Ensemble)
- NDCG@3: 0.95
- Win Accuracy: 70%
- ROI: 5%

### After Real Training (Target)
- NDCG@3: 0.96+ (1%+ improvement)
- Win Accuracy: 72%+
- ROI: 6%+

### Success Criteria
- ✅ NDCG improvement ≥ 1%
- ✅ Training completes in < 5 minutes
- ✅ All 62 tests passing
- ✅ Zero TypeScript errors

---

## Troubleshooting

### "Insufficient data" Error

**Problem:** Training pipeline requires minimum 100 samples

**Solution:**
```typescript
// Check data availability
const predictions = await db.select().from(predictions).limit(100);
if (predictions.length < 100) {
  console.log("Collecting more predictions...");
  // Wait for more predictions to accumulate
}
```

### Low NDCG Scores

**Problem:** Model not improving beyond baseline

**Solutions:**
1. Increase hyperparameter optimization trials:
   ```typescript
   await hpoService.optimizeHyperparameters(objective, 100); // 100 trials
   ```

2. Collect more training data:
   ```typescript
   const predictions = await db.select().from(predictions).limit(500);
   ```

3. Review feature importance:
   ```typescript
   const stats = featureService.getFeatureStats();
   console.log(stats); // Check which features have variance
   ```

### Training Takes Too Long

**Problem:** Pipeline execution exceeds 5 minutes

**Solutions:**
1. Reduce hyperparameter trials:
   ```typescript
   await hpoService.optimizeHyperparameters(objective, 20); // 20 trials
   ```

2. Use single model instead of ensemble:
   ```typescript
   const orchestrator = getModelTrainingOrchestrator({
     trainingStrategy: "single" // Instead of "ensemble"
   });
   ```

3. Reduce training data:
   ```typescript
   const predictions = await db.select().from(predictions).limit(200);
   ```

---

## Next Steps

1. **Enable Real Training** - Run `enableRealTraining()` in production
2. **Monitor Metrics** - Check MLflow dashboard for experiment results
3. **Optimize Hyperparameters** - Run HPO with your actual data
4. **Deploy Models** - Transition best models to Production stage
5. **Set Up Alerts** - Monitor NDCG trends and drift detection

---

## API Cheat Sheet

```typescript
// Feature Engineering
const engineered = featureService.engineerFeatures(raceData);
await featureService.updateFeatureStats(predictions);
const stats = featureService.getFeatureStats();

// Training
const trainingData = await trainingService.prepareTrainingData(predictions);
const result = await trainingService.trainCatBoostModel(trainingData);
const ensembleResult = await trainingService.trainEnsembleModel(trainingData);

// Hyperparameter Optimization
const hpoResult = await hpoService.optimizeHyperparameters(objective, 50);
const validation = hpoService.validateParams(params);

// Orchestration
const orchestrationResult = await orchestrator.executeTrainingPipeline("drift_detected");
const stats = orchestrator.getStatistics();

// MLflow
const runId = mlflow.startRun(config);
mlflow.logMetrics(metrics);
mlflow.endRun("FINISHED");
const model = mlflow.registerModel(name, source, metrics);
mlflow.transitionModelStage(name, version, "Production");

// Retraining
const job = retrainingService.queueRetrainingJob(modelId, "drift_detected");
const status = retrainingService.getJobStatus(jobId);
retrainingService.enableRealTraining();
```

---

## Resources

- **Full Documentation**: See `ML_PIPELINE_IMPLEMENTATION.md`
- **Test Suite**: `server/services/__tests__/ml-pipeline-integration.test.ts`
- **Source Code**: `server/services/ml*.ts`
- **Integration**: `server/services/automatedRetrainingService.ts`

---

**Last Updated:** February 2026
