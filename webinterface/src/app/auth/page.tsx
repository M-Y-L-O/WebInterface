"use client";

import {login} from "@/lib/auth";

export default function AuthPage() {

    return(<main>
        <div>
            <button onClick={()=>{
                login("github");
            }}>Login with Github <i className={"fa-solid fa-github"}></i> </button>
            <button onClick={()=>{
                login("google");
            }}>Login with Google <i className={"fa-solid fa-google"}></i> </button>
        </div>
    </main>)
}