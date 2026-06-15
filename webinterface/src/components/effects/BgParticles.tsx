"use client";
import Particles from "@tsparticles/react";

export default function BgParticles() {
    return (
        <Particles
            options={{
                background: {
                    color: "#0f1117",
                },
                particles: {
                    number: {
                        value: 60,
                    },
                    color: {
                        value: "#4A90E2",
                    },
                    links: {
                        enable: true,
                        color: "#2a2f3a",
                        distance: 150,
                    },
                    move: {
                        enable: true,
                        speed: 0.4,
                    },
                    size: {
                        value: 2,
                    },
                },
            }}
            className={"w-full h-full"}
        />
    )
}