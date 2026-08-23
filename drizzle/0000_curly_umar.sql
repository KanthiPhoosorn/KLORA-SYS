CREATE TABLE "batches" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"flower_count" integer NOT NULL,
	"variety" text,
	"cut_date" text NOT NULL,
	"distance_km" double precision NOT NULL,
	"destination" text,
	"carrier" text,
	"postal_code" text,
	"branch" text,
	"box_material" text,
	"weight_kg" double precision,
	"basket_ids" text[] NOT NULL,
	"entry_date" text NOT NULL,
	"co2e_per_flower" double precision NOT NULL,
	"age_days" integer NOT NULL,
	"status" text NOT NULL,
	"shipment_status" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"invited_at" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"last_active_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" text NOT NULL,
	"read" boolean
);
--> statement-breakpoint
CREATE TABLE "otp" (
	"email" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prints" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"batch_id" text,
	"destination" text,
	"printed_by" text NOT NULL,
	"sorting_point" text,
	"printed_at" text NOT NULL,
	"cancelled" boolean
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"farm_name" text NOT NULL,
	"address" text NOT NULL,
	"province" text,
	"gps_lat" double precision NOT NULL,
	"gps_lng" double precision NOT NULL,
	"owner" text NOT NULL,
	"flower_type" text NOT NULL,
	"highlights" text NOT NULL,
	"contact" text NOT NULL,
	"fuel_litres" double precision,
	"electricity_kwh" double precision,
	"fertilizer_kg" double precision,
	"agri_chemicals_kg" double precision,
	"water_m3" double precision,
	"waste_kg" double precision,
	"flowers_per_month" double precision,
	"contact_name" text,
	"phone" text,
	"line_id" text,
	"varieties" text[],
	"description" text,
	"care_tips" text,
	"photo_url" text,
	"plan" text,
	"status" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"supplier_id" text,
	"company" text,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"salt" text NOT NULL,
	"created_at" text NOT NULL
);
