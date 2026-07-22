import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import Github from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schemas/nextAuth";

export const authOptions: NextAuthOptions = {
    providers: [
        Google({
            clientId: process.env.GOOGLE_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        Github({
            clientId: process.env.GITHUB_ID!,
            clientSecret: process.env.GITHUB_SECRET!,
        }),
    ],
    adapter: DrizzleAdapter(db, {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
    }),
    session: {
        strategy: "jwt",
    },
    callbacks: {
        session({ session, token }) {
            // @ts-ignore
            session.user!.id = token.sub!;
            return session;
        },
    },
    pages: {
        signIn: "/auth",
    },
};
