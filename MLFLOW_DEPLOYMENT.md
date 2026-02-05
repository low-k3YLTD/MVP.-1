# MLflow Deployment Guide

## Quick Start

### 1. Deploy MLflow Stack

```bash
docker-compose -f docker-compose.mlflow.yml up -d
```

This starts:
- **PostgreSQL** (port 5432) - Backend store for experiments/runs
- **MinIO** (port 9000/9001) - S3-compatible artifact storage
- **MLflow Server** (port 5000) - Tracking server UI

### 2. Verify Deployment

```bash
# Check MLflow UI
curl http://localhost:5000

# Check MinIO UI
open http://localhost:9001 (minioadmin/minioadmin)

# Check PostgreSQL
psql -h localhost -U mlflow -d mlflow
```

### 3. Environment Variables

Add to `.env`:

```
MLFLOW_TRACKING_URI=http://localhost:5000
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_S3_ENDPOINT_URL=http://minio:9000
```

## Architecture

### Experiment Tracking Flow

1. **Training Pipeline** logs metrics/params to MLflow
2. **MLflow Server** stores metadata in PostgreSQL
3. **Artifacts** (models, plots) stored in MinIO S3
4. **Model Registry** tracks versions and stages (Staging/Production)

### Drift Detection & Retraining

1. **Prediction Service** captures features/predictions/outcomes
2. **Drift Detector** runs KS-tests on data/prediction distributions
3. **Retraining Orchestrator** triggers retrain if drift > threshold
4. **Auto-Retrain** logs new run to MLflow with improved metrics
5. **Model Promotion** transitions best model to Production

### A/B Testing

1. **Create Test** - Define control/treatment ensemble weights
2. **Route Traffic** - Split predictions between variants
3. **Log Results** - Track NDCG, wins, accuracy per variant
4. **Analyze** - Calculate improvement % and statistical significance
5. **Conclude** - Promote winner to Production

## Key Metrics

- **NDCG@3** - Normalized Discounted Cumulative Gain (ranking quality)
- **Win Rate** - % of predictions that correctly identify winner
- **Concept Drift** - Magnitude of outcome distribution shift
- **Data Drift** - P-value from KS-test on feature distributions

## Retraining Triggers

- Data drift detected (p < 0.05)
- Prediction drift detected (p < 0.05)
- Concept drift > 2% (outcome distribution shift)
- Cooldown: 1 hour between retrains

## Monitoring

View experiments and runs:
```
http://localhost:5000/#/experiments
```

Best run for experiment:
```python
from mlflow.tracking import MlflowClient
client = MlflowClient("http://localhost:5000")
runs = client.search_runs(experiment_ids=["0"], order_by=["metrics.ndcg@3 DESC"])
print(runs[0].data.metrics)
```

## Production Deployment

For production:
1. Use managed PostgreSQL (RDS, Cloud SQL)
2. Use managed S3 (AWS S3, GCS)
3. Deploy MLflow on Kubernetes
4. Enable authentication/SSL
5. Set up monitoring/alerting on drift detection

## Troubleshooting

### MLflow can't connect to PostgreSQL
```bash
docker-compose -f docker-compose.mlflow.yml logs postgres
```

### MinIO bucket not created
```bash
# Create bucket via MinIO UI or CLI
mc mb minio/mlflow-artifacts
```

### Models not being logged
Check MLFLOW_TRACKING_URI environment variable is set correctly
