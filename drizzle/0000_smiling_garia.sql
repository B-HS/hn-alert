CREATE TABLE `comments` (
	`id` bigint NOT NULL,
	`story_id` bigint NOT NULL,
	`parent_id` bigint,
	`by` varchar(100),
	`comment_text` text,
	`time` bigint,
	`depth` int NOT NULL DEFAULT 0,
	`dead` boolean DEFAULT false,
	`deleted` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`digest_type` varchar(20) NOT NULL,
	`digest_key` varchar(20) NOT NULL,
	`title` varchar(200) NOT NULL,
	`content` text NOT NULL,
	`story_ids` json DEFAULT ('[]'),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `digests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` bigint NOT NULL,
	`type` varchar(20) NOT NULL,
	`hn_type` varchar(20) NOT NULL,
	`by` varchar(100),
	`title` text,
	`url` text,
	`story_text` text,
	`score` int DEFAULT 0,
	`descendants` int DEFAULT 0,
	`time` bigint,
	`dead` boolean DEFAULT false,
	`deleted` boolean DEFAULT false,
	`last_synced_at` timestamp DEFAULT (now()),
	`needs_resummarize` boolean DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`story_id` bigint NOT NULL,
	`summary` text NOT NULL,
	`tags` json DEFAULT ('[]'),
	`summary_type` varchar(20) NOT NULL DEFAULT 'daily',
	`model` varchar(50) DEFAULT 'gemini-2.5-flash',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `summaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `summaries_story_id_unique` UNIQUE(`story_id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`category` varchar(50),
	`usage_count` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `webhook_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhook_id` int,
	`provider` varchar(20) NOT NULL,
	`digest_type` varchar(20),
	`status` varchar(20) NOT NULL,
	`payload` json,
	`response` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `webhook_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(20) NOT NULL DEFAULT 'discord',
	`url` text NOT NULL,
	`name` varchar(100),
	`is_active` boolean DEFAULT true,
	`digest_types` json DEFAULT ('["daily","weekly","monthly"]'),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_comments_story_id` ON `comments` (`story_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_parent_id` ON `comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_digests_type_key` ON `digests` (`digest_type`,`digest_key`);--> statement-breakpoint
CREATE INDEX `idx_stories_type` ON `stories` (`type`);--> statement-breakpoint
CREATE INDEX `idx_stories_time` ON `stories` (`time`);--> statement-breakpoint
CREATE INDEX `idx_stories_needs_resummarize` ON `stories` (`needs_resummarize`);--> statement-breakpoint
CREATE INDEX `idx_summaries_story_id` ON `summaries` (`story_id`);--> statement-breakpoint
CREATE INDEX `idx_summaries_type` ON `summaries` (`summary_type`);--> statement-breakpoint
CREATE INDEX `idx_webhook_logs_webhook_id` ON `webhook_logs` (`webhook_id`);--> statement-breakpoint
CREATE INDEX `idx_webhooks_provider` ON `webhooks` (`provider`);--> statement-breakpoint
CREATE INDEX `idx_webhooks_active` ON `webhooks` (`is_active`);