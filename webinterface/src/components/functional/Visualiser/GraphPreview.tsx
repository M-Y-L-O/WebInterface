"use client"
import VisualiserCore from "./VisualiserCore";

export default function VisualiserPreview({
                                              visualisation,
                                              className = "w-full h-full",
                                          }: { visualisation: any; className?: string }) {
    return (
        <VisualiserCore
            visualisation={visualisation}
            interactive={false}
            showControls={false}
            showMiniMap={false}
            className={className}
        />
    );
}