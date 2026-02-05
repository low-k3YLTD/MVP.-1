# MLflow Integration Architecture

## Overview

This document outlines the MLflow integration strategy for Equine Oracle Predictor, enabling experiment tracking, model registry management, automated retraining on drift detection, and A/B testing of ensemble weights.

## Architecture Components

### 1. MLflow Server Setup

**Deployment Strategy:**
- MLflow Tracking Server for centralized experiment logging
- Backend Store: PostgreSQL for metadata persistence
- Artifact Store: S3 for model artifacts and training data
- UI: Web-based dashboard for experiment comparison and model management

**Key Endpoints:**
- Tracking: `http://mlflow-server:5000/api/2.0/mlflow/`
- Registry: Model registry for versioning and promotion
- Artifacts: S3 bucket for model binaries and datasets

### 2. Experiment Tracking Service

**Metrics to Log:**
- Model performance: NDCG@3, NDCG@5, MRR, MAP
- Training metrics: loss, validation accuracy, convergence rate
- Data quality: feature completeness, outlier percentage, drift metrics
- Ensemble metrics: component model agreement, weight distribution
- Inference metrics: latency, throughput, cache hit rate

**Parameters to Track:**
- Hyperparameters: learning rate, tree depth, regularization
- Data parameters: train/test split, feature engineering version
- Ensemble weights: component model weights, aggregation method
- Drift thresholds: statistical test parameters, alert thresholds

### 3. Model Registry

**Model Lifecycle:**
1. **Staging**: New model trained and registered
2. **Production**: Model promoted after validation
3. **Archived**: Previous versions retained for rollback
4. **Comparison**: Side-by-side performance analysis

**Versioning Strategy:**
- Semantic versioning: v{major}.{minor}.{patch}
- Major: Significant architecture changes (e.g., new model type)
- Minor: Hyperparameter updates, feature engineering changes
- Patch: Bug fixes, data updates

### 4. Automated Retraining Pipeline

**Drift Detection Triggers:**
- **Data Drift**: Kolmogorov-Smirnov test on feature distributions
- **Prediction Drift**: Chi-square test on prediction distributions
- **Concept Drift**: Performance degradation threshold (NDCG drop >2%)
- **Outcome Drift**: Actual race outcome distribution changes

**Retraining Workflow:**
1. Drift detector identifies anomaly
2. Trigger automated retraining job
3. New model trained on recent data
4. Validation against holdout test set
5. If NDCG > threshold, promote to staging
6. A/B test against production model
7. Promote to production if performance improves

### 5. A/B Testing Framework

**Test Configuration:**
- Control: Current production model
- Treatment: New candidate model
- Traffic split: 10% treatment, 90% control (configurable)
- Duration: Minimum 7 days or 1000 predictions
- Success metric: NDCG@3 improvement ≥1%

**Metrics Collection:**
- Per-user prediction accuracy
- Ensemble weight effectiveness
- Latency and throughput
- User engagement and conversion

### 6. Integration Points

**Training Pipeline:**
```
Raw Data → Feature Engineering → Model Training → MLflow Logging → Model Registry
```

**Inference Pipeline:**
```
Prediction Request → Model Selection → Inference → Metrics Logging → Response
```

**Monitoring Pipeline:**
```
Predictions → Drift Detection → Alert → Retraining Trigger → New Model
```

## Implementation Timeline

| Phase | Component | Duration | Dependencies |
|-------|-----------|----------|--------------|
| 1 | MLflow server setup | 2 days | Infrastructure |
| 2 | Experiment tracking | 3 days | MLflow server |
| 3 | Model registry | 2 days | Experiment tracking |
| 4 | Retraining pipeline | 4 days | Model registry |
| 5 | A/B testing | 3 days | Retraining pipeline |
| 6 | Dashboard UI | 3 days | All components |
| 7 | Testing & validation | 3 days | All components |

## Success Metrics

- **Model Accuracy**: NDCG@3 > 0.97 consistently
- **Retraining Efficiency**: <1 hour from drift detection to new model
- **A/B Test Sensitivity**: Detect 1% NDCG improvement with 95% confidence
- **System Uptime**: 99.9% availability of MLflow server and tracking

## Security & Compliance

- **Access Control**: Role-based access to model registry
- **Audit Trail**: All model changes logged with timestamps
- **Data Privacy**: Encrypted artifact storage, PII masking in logs
- **Model Governance**: Approval workflow for production promotion
