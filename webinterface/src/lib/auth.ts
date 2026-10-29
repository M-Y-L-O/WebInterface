import {signIn, signOut} from "next-auth/react";


export async function login(provider:string){
    // next-auth v4 uses callbackUrl (redirectTo is Auth.js v5-only and is ignored here)
    await signIn(provider, { callbackUrl: "/home" });
}

export async function logout(){
    await signOut({})
}

export function getUUID():string{
    return crypto.randomUUID()
}