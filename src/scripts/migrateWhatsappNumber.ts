/**
 * One-time migration: rename the `phoneNumber` field to
 * `whatsappNumber` on existing Applicant documents.
 *
 * Needed because renaming a field in a Mongoose schema only changes
 * how NEW documents are shaped — it does nothing to documents
 * already sitting in MongoDB. Those still physically have a
 * `phoneNumber` key, not `whatsappNumber`, until this runs.
 *
 * Run with: npx ts-node src/scripts/migrateWhatsappNumber.ts
 * (or: node dist/scripts/migrateWhatsappNumber.js, if you run
 * compiled JS — adjust the import extension/path accordingly)
 *
 * Safe to re-run: $rename on a document that no longer has
 * `phoneNumber` (already migrated) is a silent no-op for that
 * document, it won't error or double-migrate.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function migrate() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI environment variable is not set");

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  // Going straight through the native driver (mongoose.connection.db)
  // rather than the Applicant model on purpose — the Applicant model's
  // schema no longer even declares `phoneNumber`, so Mongoose would
  // strip it from any query/update built through the model. The raw
  // collection still has the field name as stored on disk.
  const db = mongoose.connection.db;
  if (!db) throw new Error("No active database connection");

  const result = await db.collection("applicants").updateMany(
    { phoneNumber: { $exists: true } },
    { $rename: { phoneNumber: "whatsappNumber" } }
  );

  console.log(`Matched ${result.matchedCount} document(s), modified ${result.modifiedCount}.`);

  console.log("Done.");
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});