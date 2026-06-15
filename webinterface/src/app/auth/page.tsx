"use client";
import "./styles.css"
import {motion} from "framer-motion";
import BgParticles from "@/components/effects/BgParticles";
import {login} from "@/lib/auth";

export default function AuthPage() {

    return(<main className={"authCont"}>
        <div className={"special"}>

        </div>

        <div className={"form"}>
            <img src={"/logo.svg"}/>
            <button className={"github"} onClick={()=>{
                login("github");
            }}>Login with Github <i className={"fa-brands fa-github"}></i> </button>
            <button className={"google"} onClick={()=>{
                login("google");
            }}>Login with Google <i className={"fa-brands fa-google"}></i> </button>
        </div>
    </main>)
}