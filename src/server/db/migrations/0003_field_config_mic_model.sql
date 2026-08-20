ALTER TABLE `mic_entries` ADD `mic_model` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mic_entries` ADD `frequency` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mic_entries` ADD `pack_model` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shows` ADD `field_config` text;