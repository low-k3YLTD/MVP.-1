import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface OutcomeUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prediction: {
    id: number;
    horseName: string;
    predictedRank: number;
    predictedScore: string;
    confidenceScore: string;
  };
  onSuccess?: () => void;
}

export function OutcomeUpdateModal({
  open,
  onOpenChange,
  prediction,
  onSuccess,
}: OutcomeUpdateModalProps) {
  const [actualRank, setActualRank] = useState<string>("");
  const [isCorrect, setIsCorrect] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [raceOutcome, setRaceOutcome] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const updateOutcomeMutation = trpc.prediction.updateOutcome.useMutation();

  const handleSubmit = async () => {
    if (!actualRank || isCorrect === "") {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const raceOutcomeObj = raceOutcome
        ? {
            winner: raceOutcome.split(",")[0]?.trim() || "",
            placings: raceOutcome.split(",").slice(1).map((h) => h.trim()),
            notes: notes,
          }
        : undefined;

      await updateOutcomeMutation.mutateAsync({
        predictionId: prediction.id,
        actualRank: parseInt(actualRank),
        isCorrect: isCorrect === "correct",
        raceOutcome: raceOutcomeObj,
      });

      toast.success("Outcome recorded successfully!");
      onOpenChange(false);
      setActualRank("");
      setIsCorrect("");
      setNotes("");
      setRaceOutcome("");
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update outcome"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Race Outcome</DialogTitle>
          <DialogDescription>
            Update the outcome for {prediction.horseName} (Predicted Rank:{" "}
            {prediction.predictedRank})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Actual Rank */}
          <div className="space-y-2">
            <Label htmlFor="actual-rank">Actual Finishing Rank *</Label>
            <Input
              id="actual-rank"
              type="number"
              min="1"
              placeholder="e.g., 1, 2, 3..."
              value={actualRank}
              onChange={(e) => setActualRank(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Prediction Accuracy */}
          <div className="space-y-2">
            <Label htmlFor="is-correct">Prediction Accuracy *</Label>
            <Select value={isCorrect} onValueChange={setIsCorrect}>
              <SelectTrigger id="is-correct" disabled={loading}>
                <SelectValue placeholder="Select accuracy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="correct">✓ Correct</SelectItem>
                <SelectItem value="incorrect">✗ Incorrect</SelectItem>
                <SelectItem value="partial">◐ Partial (Close)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Race Outcome Summary */}
          <div className="space-y-2">
            <Label htmlFor="race-outcome">
              Race Outcome (Optional - comma separated)
            </Label>
            <Input
              id="race-outcome"
              placeholder="e.g., Winner, 2nd Place, 3rd Place"
              value={raceOutcome}
              onChange={(e) => setRaceOutcome(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Enter the top finishers separated by commas
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this prediction or race..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>

          {/* Prediction Details Summary */}
          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Predicted Rank:</span>
                <p className="font-semibold">{prediction.predictedRank}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Confidence:</span>
                <p className="font-semibold">{prediction.confidenceScore}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Saving..." : "Record Outcome"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
