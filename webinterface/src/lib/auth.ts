import {signIn, signOut} from "next-auth/react";


export async function login(provider:string){
    await signIn(provider, {redirectTo:"/home"});
}

export async function logout(){
    await signOut({})
}

export function getUUID():string{
    return crypto.randomUUID()
}