CREATE TABLE `ev_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`optimizationRunId` int NOT NULL,
	`signalTimestamp` timestamp NOT NULL DEFAULT (now()),
	`betType` varchar(20) NOT NULL,
	`combination` text NOT NULL,
	`probability` int NOT NULL,
	`expectedValue` int NOT NULL,
	`kellyFraction` int,
	`confidenceScore` int,
	`signalStrength` int,
	`riskLevel` varchar(20),
	`recommendedStake` int,
	`maxLoss` int,
	`potentialProfit` int,
	`isActive` int DEFAULT 1,
	`isProfitable` int DEFAULT 1,
	`alertSent` int DEFAULT 0,
	`actualResult` varchar(20),
	`actualPayout` int,
	`roi` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ev_signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exotic_bet_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`optimizationRunId` int NOT NULL,
	`betType` varchar(20) NOT NULL,
	`combination` text NOT NULL,
	`combinationNames` text,
	`probability` int NOT NULL,
	`payoutOdds` int,
	`expectedValue` int NOT NULL,
	`kellyFraction` int,
	`confidenceScore` int,
	`evRank` int,
	`probabilityRank` int,
	`confidenceRank` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exotic_bet_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `optimization_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`configName` varchar(100) NOT NULL,
	`description` text,
	`marketEfficiencyFactor` int DEFAULT 85,
	`modelWeight` int DEFAULT 70,
	`marketWeight` int DEFAULT 30,
	`minProbabilityThreshold` int DEFAULT 1,
	`maxExactaCombinations` int DEFAULT 20,
	`maxTrifectaCombinations` int DEFAULT 15,
	`maxSuperfectaCombinations` int DEFAULT 10,
	`minEvThreshold` int DEFAULT 5,
	`maxKellyFraction` int DEFAULT 25,
	`confidenceWeight` int DEFAULT 35,
	`maxDailyExposure` int DEFAULT 1000,
	`maxPerBetExposure` int DEFAULT 100,
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `optimization_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `optimization_configs_configName_unique` UNIQUE(`configName`)
);
--> statement-breakpoint
CREATE TABLE `optimization_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`raceId` int NOT NULL,
	`runTimestamp` timestamp NOT NULL DEFAULT (now()),
	`minEvThreshold` int DEFAULT 5,
	`maxExactaCombinations` int DEFAULT 20,
	`maxTrifectaCombinations` int DEFAULT 15,
	`maxSuperfectaCombinations` int DEFAULT 10,
	`totalCombinationsAnalyzed` int,
	`profitableOpportunities` int,
	`profitabilityRate` int,
	`averageExpectedValue` int,
	`maxExpectedValue` int,
	`totalKellyAllocation` int,
	`processingTimeSeconds` int,
	`optimizationVersion` varchar(20) DEFAULT '1.0.0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `optimization_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `performance_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` timestamp NOT NULL,
	`totalRacesAnalyzed` int DEFAULT 0,
	`totalSignalsGenerated` int DEFAULT 0,
	`profitableSignals` int DEFAULT 0,
	`avgExpectedValue` int DEFAULT 0,
	`avgSignalStrength` int DEFAULT 0,
	`avgConfidenceScore` int DEFAULT 0,
	`totalKellyAllocation` int DEFAULT 0,
	`totalBetsPlaced` int DEFAULT 0,
	`winningBets` int DEFAULT 0,
	`totalWagered` int DEFAULT 0,
	`totalReturned` int DEFAULT 0,
	`netProfit` int DEFAULT 0,
	`roiPercentage` int DEFAULT 0,
	`maxDrawdown` int DEFAULT 0,
	`volatility` int DEFAULT 0,
	`sharpeRatio` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `performance_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `race_horses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`raceId` int NOT NULL,
	`horseId` int NOT NULL,
	`horseName` varchar(100) NOT NULL,
	`postPosition` int,
	`jockeyName` varchar(100),
	`trainerName` varchar(100),
	`ownerName` varchar(100),
	`morningLineOdds` int,
	`finalOdds` int,
	`originalWinProbability` int,
	`calibratedWinProbability` int,
	`placeProbability` int,
	`showProbability` int,
	`formRating` int,
	`speedRating` int,
	`classRating` int,
	`paceRating` int,
	`age` int,
	`sex` varchar(10),
	`weight` int,
	`equipmentChange` varchar(200),
	`medication` varchar(200),
	`recentForm` text,
	`lifetimeStats` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `race_horses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `races` (
	`id` int AUTO_INCREMENT NOT NULL,
	`raceId` varchar(100) NOT NULL,
	`raceName` varchar(200),
	`trackName` varchar(100),
	`raceDate` timestamp NOT NULL,
	`raceTime` varchar(10),
	`distance` varchar(20),
	`surface` varchar(20),
	`raceClass` varchar(50),
	`purse` int,
	`fieldSize` int,
	`weatherConditions` varchar(100),
	`trackCondition` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `races_id` PRIMARY KEY(`id`),
	CONSTRAINT `races_raceId_unique` UNIQUE(`raceId`)
);
--> statement-breakpoint
ALTER TABLE `ev_signals` ADD CONSTRAINT `ev_signals_optimizationRunId_optimization_runs_id_fk` FOREIGN KEY (`optimizationRunId`) REFERENCES `optimization_runs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exotic_bet_results` ADD CONSTRAINT `exotic_bet_results_optimizationRunId_optimization_runs_id_fk` FOREIGN KEY (`optimizationRunId`) REFERENCES `optimization_runs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `optimization_runs` ADD CONSTRAINT `optimization_runs_raceId_races_id_fk` FOREIGN KEY (`raceId`) REFERENCES `races`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `race_horses` ADD CONSTRAINT `race_horses_raceId_races_id_fk` FOREIGN KEY (`raceId`) REFERENCES `races`(`id`) ON DELETE no action ON UPDATE no action;