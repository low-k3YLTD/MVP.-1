import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { Link } from "wouter";
import { Zap, TrendingUp, BarChart3 } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
            <h1 className="text-xl font-bold text-white">{APP_TITLE}</h1>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-slate-300">Welcome, {user?.name || "User"}</span>
                <Link href="/predict">
                  <Button variant="default" size="sm">
                    Make Prediction
                  </Button>
                </Link>
              </>
            ) : (
              <a href={getLoginUrl()}>
                <Button variant="default" size="sm">
                  Sign In
                </Button>
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-5xl font-bold text-white mb-6">
            Equine Oracle Predictor
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Advanced machine learning ensemble for accurate horse race predictions. 
            Powered by LightGBM, XGBoost, and Logistic Regression models with 95.3% NDCG@3 accuracy.
          </p>
          {isAuthenticated ? (
            <div className="flex gap-4 justify-center">
              <Link href="/predict">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                  Start Predicting
                </Button>
              </Link>
              <Link href="/live-races">
                <Button size="lg" className="bg-green-600 hover:bg-green-700">
                  View Live Races
                </Button>
              </Link>
            </div>
          ) : (
            <a href={getLoginUrl()}>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Sign In to Predict
              </Button>
            </a>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <Zap className="h-8 w-8 text-blue-400 mb-2" />
              <CardTitle className="text-white">Fast Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300">
                Get instant race predictions powered by optimized ensemble models trained on thousands of races.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <TrendingUp className="h-8 w-8 text-green-400 mb-2" />
              <CardTitle className="text-white">High Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300">
                95.3% NDCG@3 performance achieved through Optuna-optimized hyperparameters and ensemble averaging.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <BarChart3 className="h-8 w-8 text-purple-400 mb-2" />
              <CardTitle className="text-white">Track History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300">
                Save and review your prediction history to analyze trends and improve your betting strategies.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Model Info Section */}
        <Card className="bg-slate-800 border-slate-700 max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-white">Ensemble Model Details</CardTitle>
            <CardDescription className="text-slate-400">
              Our prediction engine combines multiple state-of-the-art models
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <h4 className="font-semibold text-white mb-2">Primary Model</h4>
                  <p className="text-slate-300 text-sm">LightGBM Ranker (Optuna-optimized)</p>
                  <p className="text-blue-400 text-sm font-mono mt-1">NDCG@3: 0.9713</p>
                </div>
                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <h4 className="font-semibold text-white mb-2">Ensemble Strategy</h4>
                  <p className="text-slate-300 text-sm">Average of 4 models</p>
                  <p className="text-green-400 text-sm font-mono mt-1">NDCG@3: 0.9529</p>
                </div>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <h4 className="font-semibold text-white mb-2">Component Models</h4>
                <ul className="text-slate-300 text-sm space-y-1">
                  <li>• LightGBM Ranker (Large Dataset)</li>
                  <li>• Logistic Regression</li>
                  <li>• XGBoost</li>
                  <li>• Legacy LightGBM</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/50 mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-slate-400 text-sm">
          <p>© 2025 Equine Oracle Predictor. All rights reserved.</p>
          <p className="mt-2">Built with React, TypeScript, and advanced ML models.</p>
        </div>
      </footer>
    </div>
  );
}
