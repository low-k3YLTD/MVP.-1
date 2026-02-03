# Advanced ML Stack Architecture: NDCG>0.97 with Explainability

## Executive Summary

This document outlines the architecture for achieving **NDCG>0.97** prediction accuracy with **user-facing explainability** to drive premium upsell. The system combines CatBoost and TabNet in a stacking ensemble, integrates SHAP for trustworthy explanations, implements drift detection for auto-retraining, and uses MLflow for experiment orchestration.

---

## 1. Model Architecture

### 1.1 Base Models

#### CatBoost (Categorical Boosting)
- **Why:** Native categorical feature handling, fast training, excellent ranking performance
- **Configuration:**
  - `iterations`: 1000 (auto-tuned via MLflow)
  - `learning_rate`: 0.05 (adaptive)
  - `depth`: 8 (balanced complexity)
  - `loss_function`: "YetiRank" (optimized for ranking)
  - `eval_metric`: "NDCG:top=4" (target metric)
  - `early_stopping_rounds`: 50

#### TabNet (Attention-based Neural Network)
- **Why:** Feature importance transparency, non-linear relationships, ensemble diversity
- **Configuration:**
  - `n_steps`: 5 (sequential attention steps)
  - `n_independent`: 2
  - `n_shared`: 2
  - `mask_type`: "sparsemax" (interpretable masking)
  - `lambda_sparse`: 0.001
  - `optimizer_params`: Adam with lr=0.02

### 1.2 Stacking Ensemble

**Meta-Learner:** Logistic Regression (interpretable, fast)

**Stacking Process:**
1. Base models trained on 80% of data
2. Generate predictions on 20% validation set (meta-features)
3. Meta-learner learns optimal weights:
   - CatBoost: 0.60 (stronger ranking signal)
   - TabNet: 0.40 (complementary non-linearity)

**Output:** Weighted ensemble prediction with confidence bounds

### 1.3 Feature Engineering

**Input Features:**
- Horse attributes (form_rating, speed_figure, jockey_rating, trainer_rating)
- Race context (track_type, distance, field_size, weather)
- Historical performance (wins, places, earnings, consistency)
- Temporal signals (days_since_last_race, seasonal_trend)

**Derived Features:**
- Interaction terms (form × speed, jockey × trainer)
- Polynomial features (rating²)
- Lag features (previous race performance)
- Aggregated features (average_rating, max_rating)

---

## 2. SHAP Explainability Layer

### 2.1 SHAP Integration

**Why SHAP:**
- Theoretically sound (Shapley values from game theory)
- Model-agnostic (works with any model)
- Local explanations (why this specific prediction)
- Global insights (feature importance across dataset)

**Implementation:**
```python
# For CatBoost
explainer = shap.TreeExplainer(catboost_model)
shap_values = explainer.shap_values(X_test)

# For TabNet
explainer = shap.DeepExplainer(tabnet_model, X_background)
shap_values = explainer.shap_values(X_test)

# Ensemble SHAP values (weighted average)
ensemble_shap = 0.6 * catboost_shap + 0.4 * tabnet_shap
```

### 2.2 Explanation Types

#### 1. **Feature Contribution (Why this horse?)**
- Top 5 features pushing prediction up/down
- Magnitude of impact (SHAP value)
- Direction (positive/negative)
- Example: "Speed figure (+0.23) and jockey rating (+0.18) are the main reasons we favor this horse"

#### 2. **Confidence Breakdown**
- Model agreement (CatBoost vs TabNet alignment)
- Prediction variance (uncertainty quantification)
- Confidence score (0-100%)
- Example: "Both models strongly agree (98% alignment), giving us high confidence"

#### 3. **Comparative Explanation**
- Why this horse vs. competitors
- Key differentiators
- Risk factors
- Example: "This horse has superior form (0.45 vs 0.38 average) but slightly worse jockey rating"

#### 4. **Historical Validation**
- Similar past races with outcomes
- Win rate in similar conditions
- Confidence calibration
- Example: "In 12 similar races, horses with this profile won 67% of the time"

---

## 3. Drift Detection & Auto-Retraining

### 3.1 Drift Signals

**Data Drift:**
- Feature distribution changes (Kolmogorov-Smirnov test)
- Covariate shift detection
- Trigger: p-value < 0.05

**Prediction Drift:**
- Model output distribution changes
- Confidence degradation
- Trigger: NDCG drops >2% or accuracy <93%

**Concept Drift:**
- Relationship between features and target changes
- Model performance on recent data vs. historical
- Trigger: Recent NDCG < historical NDCG - 0.03

### 3.2 Auto-Retraining Pipeline

**Trigger:** Any drift signal detected

**Process:**
1. Collect new labeled data (outcomes from past 7 days)
2. Validate data quality (completeness, outliers)
3. Feature engineering on new data
4. Train new CatBoost + TabNet models
5. Validate on holdout test set
6. Compare NDCG: new vs. current
7. If new > current, deploy; else, keep current
8. Log experiment in MLflow

**Frequency:**
- Daily drift checks
- Weekly retraining (if drift detected)
- Monthly full retraining (regardless)

---

## 4. MLflow Integration

### 4.1 Experiment Tracking

**Logged Metrics:**
- NDCG@4, NDCG@3, NDCG@2
- Accuracy, Precision, Recall
- Calibration error
- Inference latency

**Logged Artifacts:**
- Model files (CatBoost, TabNet, meta-learner)
- Feature importance plots
- SHAP summary plots
- Confusion matrices

**Logged Parameters:**
- Model hyperparameters
- Feature engineering settings
- Train/val/test split ratios
- Drift detection thresholds

### 4.2 Model Registry

**Stages:**
- `Staging`: New model, validated but not live
- `Production`: Current live model
- `Archived`: Previous models

**Transitions:**
- New model → Staging (automatic)
- Staging → Production (manual approval + validation)
- Production → Archived (when new model promoted)

---

## 5. User-Facing Explainability

### 5.1 "Why This Horse?" UI Component

**Layout:**
```
┌─────────────────────────────────────────┐
│ Why We Picked: Thunder Strike           │
├─────────────────────────────────────────┤
│ Confidence: 87% (High)                  │
│ Model Agreement: 94% (Very Strong)      │
├─────────────────────────────────────────┤
│ TOP REASONS:                            │
│ ✓ Speed Figure: Excellent (+0.34)       │
│ ✓ Form Rating: Strong (+0.28)           │
│ ✓ Jockey Rating: Above Average (+0.15)  │
│ ✗ Recent Performance: Slight concern    │
├─────────────────────────────────────────┤
│ HISTORICAL VALIDATION:                  │
│ In 23 similar races, horses with this   │
│ profile won 71% of the time             │
├─────────────────────────────────────────┤
│ [Learn More] [See Comparison]           │
└─────────────────────────────────────────┘
```

### 5.2 Premium Feature Gating

**Free Tier:**
- Predictions only
- Confidence score

**Premium Tier (Upsell Trigger):**
- Full "Why this horse?" explanations
- Historical validation
- Comparative analysis
- Model agreement breakdown
- SHAP feature importance visualization

**Conversion Path:**
1. User makes prediction
2. See teaser: "Premium: See why we picked this horse"
3. Click → Premium signup modal
4. Unlock full explanations
5. Track conversion rate (target: 15-20%)

---

## 6. Real-Time Edge Optimization

### 6.1 Inference Pipeline

**Latency Targets:**
- Feature engineering: <10ms
- Model inference: <50ms
- SHAP explanation: <100ms
- Total: <200ms (p95)

**Optimization Strategies:**
1. **Model Quantization:** Convert to ONNX for faster inference
2. **Feature Caching:** Pre-compute common features
3. **Batch Processing:** Process multiple predictions together
4. **GPU Acceleration:** Use CUDA for TabNet inference
5. **Lazy SHAP:** Compute explanations asynchronously

### 6.2 Serving Architecture

```
┌─────────────────┐
│  Client Request │
└────────┬────────┘
         │
    ┌────▼────────────────────────┐
    │  Feature Engineering (10ms)  │
    └────┬───────────────────────┘
         │
    ┌────▼──────────────────────────┐
    │  Model Inference (50ms)        │
    │  - CatBoost (20ms)             │
    │  - TabNet (25ms)               │
    │  - Ensemble (5ms)              │
    └────┬───────────────────────────┘
         │
    ┌────▼──────────────────────────┐
    │  SHAP Explanation (async)      │
    │  (returned in next request)    │
    └────┬───────────────────────────┘
         │
    ┌────▼─────────────────┐
    │  Response (200ms)    │
    └──────────────────────┘
```

---

## 7. Performance Targets

| Metric | Target | Current | Gap |
|--------|--------|---------|-----|
| NDCG@4 | >0.97 | 0.95 | +0.02 |
| NDCG@3 | >0.96 | 0.94 | +0.02 |
| Accuracy | >93% | 91% | +2% |
| Inference Latency (p95) | <200ms | 250ms | -50ms |
| Model Agreement | >90% | 87% | +3% |
| Explanation Accuracy | >85% | N/A | TBD |

---

## 8. Implementation Roadmap

**Phase 1 (Week 1):** CatBoost + TabNet training, SHAP integration
**Phase 2 (Week 2):** Drift detection, MLflow orchestration
**Phase 3 (Week 3):** User-facing UI, premium gating
**Phase 4 (Week 4):** Edge optimization, production deployment
**Phase 5 (Ongoing):** Monitoring, retraining, upsell optimization

---

## 9. Success Metrics

**Technical:**
- NDCG > 0.97
- Inference latency < 200ms
- Drift detection accuracy > 95%

**Business:**
- Premium conversion rate > 15%
- User trust score > 4.2/5 (from surveys)
- Prediction accuracy validation > 90%

**Operational:**
- Auto-retraining success rate > 98%
- Model deployment time < 5 minutes
- Zero downtime during updates
