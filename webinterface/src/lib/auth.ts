import {signIn, signOut} from "next-auth/react";

export async function login(provider:string){
    await signIn(provider, {redirectTo:"/dashboard"});
}

export async function logout(){
    await signOut({})
}

