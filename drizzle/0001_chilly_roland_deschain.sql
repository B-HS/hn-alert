ALTER TABLE `stories` ADD `title_ko` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `story_text_ko` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `content_summary` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `content_summary_ko` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `tags` json DEFAULT ('[]');--> statement-breakpoint
ALTER TABLE `stories` ADD `content_parsed` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `stories` ADD `parse_error` text;