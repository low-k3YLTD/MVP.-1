import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import { execSync } from 'child_process';
import path from 'path';

const driftCheckSchema = z.object({
  features: z.array(z.number()),
  predictions: z.array(z.number()),
  outcomes: z.array(z.number()),
});

const abTestSchema = z.object({
  test_id: z.string(),
  control_weights: z.record(z.string(), z.number()),
  treatment_weights: z.record(z.string(), z.number()),
});

export const mlflowRouter = router({
  checkDrift: protectedProcedure
    .input(driftCheckSchema)
    .mutation(async ({ input }) => {
      try {
        const pythonScript = path.join(
          __dirname,
          '..',
          'ml',
          'autoRetrainingOrchestrator.py'
        );
        
        const featuresJson = JSON.stringify(input.features);
        const predictionsJson = JSON.stringify(input.predictions);
        const outcomesJson = JSON.stringify(input.outcomes);
        
        const cmd = `python3 ${pythonScript} check_drift '${featuresJson}' '${predictionsJson}' '${outcomesJson}'`;
        const result = execSync(cmd, { encoding: 'utf-8' });
        
        return JSON.parse(result);
      } catch (error) {
        console.error('[MLflow] Drift check failed:', error);
        throw error;
      }
    }),

  createABTest: protectedProcedure
    .input(abTestSchema)
    .mutation(async ({ input }) => {
      try {
        const pythonScript = path.join(
          __dirname,
          '..',
          'ml',
          'autoRetrainingOrchestrator.py'
        );
        
        const controlJson = JSON.stringify(input.control_weights);
        const treatmentJson = JSON.stringify(input.treatment_weights);
        
        const cmd = `python3 ${pythonScript} create_ab_test ${input.test_id} '${controlJson}' '${treatmentJson}'`;
        const result = execSync(cmd, { encoding: 'utf-8' });
        
        return JSON.parse(result);
      } catch (error) {
        console.error('[MLflow] A/B test creation failed:', error);
        throw error;
      }
    }),

  getStatus: publicProcedure.query(() => {
    return {
      mlflow_tracking_uri: process.env.MLFLOW_TRACKING_URI || 'http://localhost:5000',
      status: 'operational',
      features: [
        'experiment_tracking',
        'drift_detection',
        'auto_retraining',
        'ab_testing',
        'model_registry',
      ],
    };
  }),
});
