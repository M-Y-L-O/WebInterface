'use server';

import {initAdmin} from '@/lib/firebase/firebase-admin.config';
import {cookies} from 'next/headers';
import {getAuth} from 'firebase-admin/auth';
import {redirect} from 'next/navigation';
import crypto from 'crypto'

const expiresIn = 60 * 60 * 24 * 14 * 1000;

export async function createSession(token: string) {
    await initAdmin();

    const sessionCookie = await getAuth().createSessionCookie(token, {
        expiresIn
    });

    (await cookies()).set('session', sessionCookie, {
        maxAge: expiresIn,
        httpOnly: true,
        secure: true
    });
}

export async function hash(thing: string) {
    return crypto.createHash('sha256').update(thing).digest('hex');
}

export async function logout() {
    (await cookies()).delete('session');
}

export async function getSession(path?: string): Promise<string> {
    try {
        await initAdmin();
        const sessionCookie = (await cookies()).get('session')?.value;

        if (sessionCookie) {
            try {
                await getAuth().verifySessionCookie(sessionCookie, true);

                if (path) {
                    redirect(path);
                }
                return '200';
            } catch (error) {
                // @ts-ignore
                if (error.code === 'auth/session-cookie-expired') {
                    (await cookies()).delete('session');
                    console.log("Session cookie expired and has been removed.");
                }

                return '401';
            }
        } else {
            return '401';
        }
    } catch (error) {
        console.error("Error while checking session:", error);
        return '500';
    }
}

export async function getSessionTokenHash(): Promise<string> {
    await initAdmin();
    if (
        (await cookies()).get('session') &&
        (await getAuth().verifySessionCookie(
            (await cookies()).get('session')?.value!,
            true
        ))
    ) return hash((await cookies()).get('session')?.value!);
    return '0';
}

export async function getCurrentUser(): Promise<string> {
    await initAdmin();
    const token = (await cookies()).get('session');
    if (!token?.value)
        return "0"
    const user = await getAuth().verifySessionCookie(token?.value!, true);
    if (user != null) {
        return user.uid;
    } else
        return "0";
}
