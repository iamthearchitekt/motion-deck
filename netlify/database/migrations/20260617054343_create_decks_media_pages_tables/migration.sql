CREATE TABLE "decks" (
	"id" text PRIMARY KEY,
	"slug" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY,
	"deck_id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY,
	"deck_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "decks_slug_idx" ON "decks" ("slug");--> statement-breakpoint
CREATE INDEX "media_deck_id_idx" ON "media" ("deck_id");--> statement-breakpoint
CREATE INDEX "pages_deck_id_idx" ON "pages" ("deck_id");