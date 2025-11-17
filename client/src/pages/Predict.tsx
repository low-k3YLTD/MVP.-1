import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import SimplePredictForm from "./SimplePredictForm";

export default function Predict() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800 border-slate-700 max-w-md">
          <CardHeader>
            <CardTitle className="text-white">Authentication Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300 mb-4">
              Please sign in to make predictions.
            </p>
            <Link href="/">
              <Button className="w-full">Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" className="text-white">
              ← Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-white">Race Prediction</h1>
          <div className="w-20" />
        </div>
      </nav>

      <section className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Predict Race Outcomes</h2>
            <p className="text-slate-300">
              Select race parameters and horse names to get AI-powered predictions
            </p>
          </div>

          {/* Simplified Form */}
          <SimplePredictForm />
        </div>
      </section>
    </div>
  );
}
