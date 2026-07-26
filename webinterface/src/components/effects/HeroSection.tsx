"use client";

import { useCallback, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import HeroGraph from "@/components/effects/HeroGraph";

export default function HeroSection() {
    const [loaded, setLoaded] = useState(false);
    const parallaxRef = useRef<HTMLDivElement>(null);

    const onReady = useCallback(() => {
        setLoaded(true);
    }, []);

    const onMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
        const el = parallaxRef.current;
        if (!el) return;
        const dx = (e.clientX - window.innerWidth / 2) / 80;
        const dy = (e.clientY - window.innerHeight / 2) / 80;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
    }, []);

    const onMouseLeave = useCallback(() => {
        const el = parallaxRef.current;
        if (!el) return;
        el.style.transform = "translate(0px, 0px)";
    }, []);

    return (
        <div
            className={`hero${loaded ? " hero-loaded" : ""}`}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
        >
            <div className="hero-parallax" ref={parallaxRef}>
                <div className="hero-graph-frame">
                    <HeroGraph onReady={onReady} className="hero-graph" />
                </div>
            </div>

            <div className="overlay">
                <div className="hero-brand">
                    <img
                        className="hero-wordmark"
                        src="/wordmark.svg"
                        alt="MYLO"
                    />
                    <h2 className="hero-headline">
                        Visual Neural Network Studio
                    </h2>
                    <div className="hero-ctas">
                        <Link href="/auth" className="hero-cta hero-cta-primary">
                            Get started
                        </Link>
                        <Link href="/auth" className="hero-cta hero-cta-ghost">
                            Docs
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
