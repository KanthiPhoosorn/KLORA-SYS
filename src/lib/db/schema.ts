// Drizzle schema for KLORA (Postgres / Neon).
// Design notes:
//  - All date/time fields are stored as TEXT (ISO strings), matching how the app has
//    always treated them (string .localeCompare sorting, .slice(0,7) on cutDate). Using
//    real timestamp columns would return Date objects and break that downstream code.
//  - JS keys are camelCase (so rows line up with the domain types); columns are snake_case.
//  - Optional domain fields map to nullable columns; store.ts converts null -> undefined.

import { pgTable, text, integer, doublePrecision, boolean, bigint, jsonb } from "drizzle-orm/pg-core";
import type {
  SupplierStatus,
  BatchStatus,
  ShipmentStatus,
  UserRole,
  MemberRole,
  Invite,
  Notification,
} from "../types";

export const suppliers = pgTable("suppliers", {
  id: text("id").primaryKey(),
  farmName: text("farm_name").notNull(),
  address: text("address").notNull(),
  province: text("province"),
  gpsLat: doublePrecision("gps_lat").notNull(),
  gpsLng: doublePrecision("gps_lng").notNull(),
  owner: text("owner").notNull(),
  flowerType: text("flower_type").notNull(),
  highlights: text("highlights").notNull(),
  contact: text("contact").notNull(),
  fuelLitres: doublePrecision("fuel_litres"),
  electricityKwh: doublePrecision("electricity_kwh"),
  fertilizerKg: doublePrecision("fertilizer_kg"),
  agriChemicalsKg: doublePrecision("agri_chemicals_kg"),
  waterM3: doublePrecision("water_m3"),
  wasteKg: doublePrecision("waste_kg"),
  flowersPerMonth: doublePrecision("flowers_per_month"),
  contactName: text("contact_name"),
  phone: text("phone"),
  lineId: text("line_id"),
  varieties: text("varieties").array(),
  flowerTypes: jsonb("flower_types"),
  description: text("description"),
  careTips: text("care_tips"),
  photoUrl: text("photo_url"),
  plan: text("plan").$type<"free" | "pro">(),
  status: text("status").$type<SupplierStatus>().notNull(),
  createdAt: text("created_at").notNull(),
});

export const batches = pgTable("batches", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id").notNull(),
  flowerCount: integer("flower_count").notNull(),
  variety: text("variety"),
  cutDate: text("cut_date").notNull(),
  distanceKm: doublePrecision("distance_km").notNull(),
  destination: text("destination"),
  carrier: text("carrier"),
  provider: text("provider"),
  postalCode: text("postal_code"),
  branch: text("branch"),
  boxMaterial: text("box_material"),
  weightKg: doublePrecision("weight_kg"),
  basketIds: text("basket_ids").array().notNull(),
  // KYN full-spec inputs (optional — a batch without them falls back to the legacy engine)
  packagingItems: jsonb("packaging_items"),
  shippedWeightKg: doublePrecision("shipped_weight_kg"),
  vehicleKey: text("vehicle_key"),
  fuelKey: text("fuel_key"),
  isReeferUsed: boolean("is_reefer_used"),
  carbonBreakdown: jsonb("carbon_breakdown"),
  entryDate: text("entry_date").notNull(),
  co2ePerFlower: doublePrecision("co2e_per_flower").notNull(),
  ageDays: integer("age_days").notNull(),
  status: text("status").$type<BatchStatus>().notNull(),
  shipmentStatus: text("shipment_status").$type<ShipmentStatus>().notNull(),
  createdAt: text("created_at").notNull(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  role: text("role").$type<UserRole>().notNull(),
  supplierId: text("supplier_id"),
  company: text("company"),
  branch: text("branch"),
  email: text("email").notNull(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  createdAt: text("created_at").notNull(),
});

export const members = pgTable("members", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").$type<MemberRole>().notNull(),
  lastActiveAt: text("last_active_at"),
  createdAt: text("created_at").notNull(),
});

export const invites = pgTable("invites", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id").notNull(),
  email: text("email").notNull(),
  role: text("role").$type<MemberRole>().notNull(),
  invitedAt: text("invited_at").notNull(),
  status: text("status").$type<Invite["status"]>().notNull(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  kind: text("kind").$type<Notification["kind"]>().notNull(),
  createdAt: text("created_at").notNull(),
  read: boolean("read"),
});

export const prints = pgTable("prints", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id").notNull(),
  batchId: text("batch_id"),
  destination: text("destination"),
  printedBy: text("printed_by").notNull(),
  sortingPoint: text("sorting_point"),
  printedAt: text("printed_at").notNull(),
  cancelled: boolean("cancelled"),
});

export const otp = pgTable("otp", {
  email: text("email").primaryKey(),
  code: text("code").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
});

// KYN spec: one row per farm per reporting month, used to derive Dynamic_Flower_EF
// (kg CO2e per kg of flower) instead of charging every shipment a full month of farm carbon.
export const farmMonthlyInputs = pgTable("farm_monthly_inputs", {
  id: text("id").primaryKey(), // FMI-NNNN
  supplierId: text("supplier_id").notNull(),
  reportingMonth: text("reporting_month").notNull(), // YYYY-MM
  dieselLitres: doublePrecision("diesel_litres"),
  electricityKwh: doublePrecision("electricity_kwh"),
  fertilizerKg: doublePrecision("fertilizer_kg"),
  agrochemicalKg: doublePrecision("agrochemical_kg"),
  waterM3: doublePrecision("water_m3"),
  organicWasteKg: doublePrecision("organic_waste_kg"),
  totalFlowerYieldKg: doublePrecision("total_flower_yield_kg"),
  createdAt: text("created_at").notNull(),
});

// Fixed-window rate limiter (serverless-safe: shared state lives in Postgres, not memory).
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: bigint("window_start", { mode: "number" }).notNull(),
});
