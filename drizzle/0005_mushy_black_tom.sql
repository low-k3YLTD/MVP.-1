ALTER TABLE `prediction_accuracy` DROP FOREIGN KEY `prediction_accuracy_automatedPredictionId_automated_predictions_id_fk`;
--> statement-breakpoint
ALTER TABLE `prediction_accuracy` DROP FOREIGN KEY `prediction_accuracy_raceResultId_race_results_id_fk`;
--> statement-breakpoint
ALTER TABLE `prediction_accuracy` ADD `autoPredId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `prediction_accuracy` ADD `raceResId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `prediction_accuracy` ADD CONSTRAINT `prediction_accuracy_autoPredId_automated_predictions_id_fk` FOREIGN KEY (`autoPredId`) REFERENCES `automated_predictions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prediction_accuracy` ADD CONSTRAINT `prediction_accuracy_raceResId_race_results_id_fk` FOREIGN KEY (`raceResId`) REFERENCES `race_results`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prediction_accuracy` DROP COLUMN `automatedPredictionId`;--> statement-breakpoint
ALTER TABLE `prediction_accuracy` DROP COLUMN `raceResultId`;