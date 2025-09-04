import { z } from 'zod';

const EnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  PUBLIC_GATEWAY_URL: z.string().url().optional(),
  PUBLIC_WEBAPP_URL: z.string().url().optional(),
  PORT: z.string().default('7778'),
  TELEGRAM_INITDATA_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(600),
  REDIS_URL: z.string().default(''),
  AUTH_API_BASE: z.string().url().optional(),
  AGENTS_API_BASE: z.string().url().optional(),
  DEFAULT_CHAIN_ID: z.coerce.number().int().positive().default(8453),
  DEFAULT_WALLET_ADDRESS: z.string().optional(),
  AGENTS_RESPONSE_MESSAGE_PATH: z.string().optional(),
  AGENTS_DEBUG_SHAPE: z.coerce.boolean().optional().default(false),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(env = process.env): Env {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(`Invalid environment: ${JSON.stringify(formatted)}`);
  }
  return result.data;
}
