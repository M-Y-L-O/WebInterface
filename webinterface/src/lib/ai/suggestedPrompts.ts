import { useProjectStore } from "@/lib/store";
import { getPrimaryVisualisation } from "@/lib/store/projectStore";

/** Context-aware starter prompts for an empty / new chat thread. */
export function buildSuggestedPrompts(): string[] {
    const { project, csv, visualisations, optimizationRun, descriptorDraft } =
        useProjectStore.getState();
    const visualisation = getPrimaryVisualisation(visualisations);
    const nodes = Array.isArray(visualisation?.nodes)
        ? visualisation!.nodes
        : Array.isArray(project?.modelData?.nodes)
          ? project!.modelData.nodes
          : [];
    const hasConv = nodes.some((n: any) =>
        /conv|convolution/i.test(String(n?.type || n?.op || n?.kind || "")),
    );

    const prompts: string[] = [];

    if (csv) {
        prompts.push("Summarize the loaded dataset and suggest feature/target columns.");
    }
    if (nodes.length || descriptorDraft) {
        prompts.push("Explain the current model graph in plain language.");
    }
    if (hasConv) {
        prompts.push("Insert a BatchNorm layer after the first Conv node and rewire edges.");
    } else if (nodes.length) {
        prompts.push("Propose one concrete improvement to the model graph and apply it.");
    }
    if (optimizationRun?.result || optimizationRun?.report) {
        prompts.push("Summarize the latest optimization results and what changed.");
    } else if (csv && nodes.length) {
        prompts.push("What should I configure before starting an optimization run?");
    }

    prompts.push("What can you help me with in this project?");

    // Unique, max 5
    return [...new Set(prompts)].slice(0, 5);
}
