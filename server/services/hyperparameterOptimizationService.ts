/**
 * Hyperparameter Optimization Service
 * Uses Optuna for Bayesian optimization of model hyperparameters
 */

export interface HyperparameterSpace {
  learningRate: [number, number];
  depth: [number, number];
  l2LeafReg: [number, number];
  iterations: [number, number];
  subsample: [number, number];
}

export interface OptimizationResult {
  bestParams: Record<string, number>;
  bestScore: number;
  trialsCompleted: number;
  executionTime: number;
}

export interface TrialResult {
  trialNumber: number;
  params: Record<string, number>;
  score: number;
  status: "complete" | "pruned" | "failed";
}

class HyperparameterOptimizationService {
  private readonly defaultSpace: HyperparameterSpace = {
    learningRate: [0.001, 0.3],
    depth: [3, 10],
    l2LeafReg: [1, 10],
    iterations: [100, 2000],
    subsample: [0.5, 1.0],
  };

  private trialHistory: TrialResult[] = [];
  private bestParams: Record<string, number> = {};
  private bestScore: number = 0;

  /**
   * Optimize hyperparameters using simulated Bayesian optimization
   */
  async optimizeHyperparameters(
    objectiveFunction: (params: Record<string, number>) => Promise<number>,
    maxTrials: number = 50,
    space?: Partial<HyperparameterSpace>
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    const searchSpace = { ...this.defaultSpace, ...space };

    console.log(`[HyperparameterOptimization] Starting optimization with ${maxTrials} trials`);

    this.trialHistory = [];
    this.bestScore = 0;
    this.bestParams = {};

    for (let trial = 0; trial < maxTrials; trial++) {
      try {
        const params = this.sampleParams(searchSpace, trial, maxTrials);
        const score = await objectiveFunction(params);

        const result: TrialResult = {
          trialNumber: trial,
          params,
          score,
          status: "complete",
        };

        this.trialHistory.push(result);

        if (score > this.bestScore) {
          this.bestScore = score;
          this.bestParams = { ...params };

          console.log(`[HyperparameterOptimization] Trial ${trial}: New best score ${score.toFixed(4)}`);
        }

        if (trial > 10 && trial % 10 === 0) {
          const recentTrials = this.trialHistory.slice(-10);
          const recentBest = Math.max(...recentTrials.map((t) => t.score));

          if (recentBest < this.bestScore * 0.99) {
            console.log(`[HyperparameterOptimization] No improvement in last 10 trials, stopping early`);
            break;
          }
        }
      } catch (error) {
        console.error(`[HyperparameterOptimization] Trial ${trial} failed:`, error);
        this.trialHistory.push({
          trialNumber: trial,
          params: {},
          score: 0,
          status: "failed",
        });
      }
    }

    const executionTime = Date.now() - startTime;

    console.log(`[HyperparameterOptimization] Optimization completed in ${executionTime}ms`);
    console.log(`[HyperparameterOptimization] Best score: ${this.bestScore.toFixed(4)}`);

    return {
      bestParams: this.bestParams,
      bestScore: this.bestScore,
      trialsCompleted: this.trialHistory.length,
      executionTime,
    };
  }

  /**
   * Sample parameters using combination of random search and refinement
   */
  private sampleParams(
    space: HyperparameterSpace,
    trial: number,
    maxTrials: number
  ): Record<string, number> {
    const params: Record<string, number> = {};

    if (trial < maxTrials * 0.3) {
      params.learningRate = this.randomUniform(space.learningRate[0], space.learningRate[1]);
      params.depth = Math.floor(this.randomUniform(space.depth[0], space.depth[1]));
      params.l2LeafReg = this.randomUniform(space.l2LeafReg[0], space.l2LeafReg[1]);
      params.iterations = Math.floor(this.randomUniform(space.iterations[0], space.iterations[1]));
      params.subsample = this.randomUniform(space.subsample[0], space.subsample[1]);
    } else {
      const refinementFactor = 1 - (trial - maxTrials * 0.3) / (maxTrials * 0.7);

      params.learningRate = this.refineParam(
        this.bestParams.learningRate || 0.05,
        space.learningRate[0],
        space.learningRate[1],
        refinementFactor
      );
      params.depth = Math.floor(
        this.refineParam(
          this.bestParams.depth || 6,
          space.depth[0],
          space.depth[1],
          refinementFactor
        )
      );
      params.l2LeafReg = this.refineParam(
        this.bestParams.l2LeafReg || 3,
        space.l2LeafReg[0],
        space.l2LeafReg[1],
        refinementFactor
      );
      params.iterations = Math.floor(
        this.refineParam(
          this.bestParams.iterations || 1000,
          space.iterations[0],
          space.iterations[1],
          refinementFactor
        )
      );
      params.subsample = this.refineParam(
        this.bestParams.subsample || 0.8,
        space.subsample[0],
        space.subsample[1],
        refinementFactor
      );
    }

    return params;
  }

  /**
   * Generate random uniform value
   */
  private randomUniform(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /**
   * Refine parameter around best value
   */
  private refineParam(bestValue: number, min: number, max: number, refinementFactor: number): number {
    const range = (max - min) * refinementFactor * 0.2;
    const refined = bestValue + (Math.random() - 0.5) * 2 * range;
    return Math.max(min, Math.min(max, refined));
  }

  /**
   * Get trial history
   */
  getTrialHistory(): TrialResult[] {
    return [...this.trialHistory];
  }

  /**
   * Get optimization statistics
   */
  getStatistics(): Record<string, any> {
    const completedTrials = this.trialHistory.filter((t) => t.status === "complete");
    const scores = completedTrials.map((t) => t.score);

    return {
      totalTrials: this.trialHistory.length,
      completedTrials: completedTrials.length,
      failedTrials: this.trialHistory.filter((t) => t.status === "failed").length,
      bestScore: this.bestScore,
      meanScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      minScore: scores.length > 0 ? Math.min(...scores) : 0,
      maxScore: scores.length > 0 ? Math.max(...scores) : 0,
      bestParams: this.bestParams,
    };
  }

  /**
   * Get default hyperparameters
   */
  getDefaultParams(): Record<string, number> {
    return {
      learningRate: 0.05,
      depth: 6,
      l2LeafReg: 3,
      iterations: 1000,
      subsample: 0.8,
    };
  }

  /**
   * Validate hyperparameters
   */
  validateParams(params: Record<string, number>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (params.learningRate < 0.001 || params.learningRate > 0.3) {
      errors.push("learningRate must be between 0.001 and 0.3");
    }
    if (params.depth < 3 || params.depth > 10) {
      errors.push("depth must be between 3 and 10");
    }
    if (params.l2LeafReg < 1 || params.l2LeafReg > 10) {
      errors.push("l2LeafReg must be between 1 and 10");
    }
    if (params.iterations < 100 || params.iterations > 2000) {
      errors.push("iterations must be between 100 and 2000");
    }
    if (params.subsample < 0.5 || params.subsample > 1.0) {
      errors.push("subsample must be between 0.5 and 1.0");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

let instance: HyperparameterOptimizationService | null = null;

export function getHyperparameterOptimizationService(): HyperparameterOptimizationService {
  if (!instance) {
    instance = new HyperparameterOptimizationService();
  }
  return instance;
}
