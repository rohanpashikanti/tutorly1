import { betterAuth, type Auth, type BetterAuthOptions } from 'better-auth';

export interface AuthEnv {
  DB: D1Database;
  APP_ENV: 'local' | 'test' | 'production';
  APP_URL?: string;
  BETTER_AUTH_SECRET: string;
}

const authCache = new WeakMap<D1Database, Auth>();

export function getAuth(env: AuthEnv) {
  const cached = authCache.get(env.DB);
  if (cached) return cached;
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be configured with at least 32 characters');
  }
  if (!env.APP_URL) throw new Error('APP_URL must be configured for the Worker environment');
  const trustedOrigins = Array.from(
    new Set([env.APP_URL, 'https://tutorly1-lyart.vercel.app'].filter(Boolean))
  );
  const options: BetterAuthOptions = {
    appName: 'Tutorly',
    baseURL: env.APP_URL,
    basePath: '/api/auth',
    trustedOrigins,
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: true, storage: 'database' },
    advanced: {
      cookiePrefix: 'tutorly',
      useSecureCookies: env.APP_ENV === 'production',
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
  };
  const auth = betterAuth(options);
  authCache.set(env.DB, auth);
  return auth;
}
