import {drizzle} from 'drizzle-orm/node-postgres';
import {Pool} from 'pg';
import {config} from "dotenv";

config();

declare global {
	// eslint-disable-next-line no-var
	var __myloPool: Pool | undefined;
}

const pool = globalThis.__myloPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
	globalThis.__myloPool = pool;
}

export const db = drizzle(pool);