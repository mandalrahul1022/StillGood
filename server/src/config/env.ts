import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(8).default("dev-only-secret"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  SPOONACULAR_API_KEY: z.string().optional(),
  TABSCANNER_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash-lite")
});

export const env = envSchema.parse(process.env);
