"use client";
import "./styles.css"
import {motion} from "framer-motion";
import {login} from "@/lib/auth";
import DummyVisualiser from "@/components/effects/DummyVisualiser";
import {useLayoutEffect} from "react";
import {getSession} from "next-auth/react";

export default function AuthPage() {

    async function checkSession(){
        const session = await getSession();
        if(session)
            window.location.href = "/home";
    }

    useLayoutEffect(() => {
        checkSession()
    }, []);

    return(<main className={"authCont"}>
        <div className={"special"}>
            <div className={"fixed top-[5rem] left-[3rem] z-50 flex flex-col items-center gap-2"}>
                <img src={"/wordmark.svg"}/>
                <h2>Visual Neural Network Studio</h2>
            </div>
            <DummyVisualiser interactive={true}></DummyVisualiser>
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