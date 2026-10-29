/**
 * Structured reasons for why a ModelEditor action cannot complete.
 * Logged to the console today; `userMessage` is ready for future UI (toasts/tooltips).
 */

export type ActionBlock = {
    action: string;
    reason: string;
    /** Same as reason for now — swap to friendlier copy later without changing call sites. */
    userMessage: string;
    details?: Record<string, unknown>;
};

const PREFIX = "[ModelEditor]";

export function blockAction(
    action: string,
    reason: string,
    details?: Record<string, unknown>,
): ActionBlock {
    const block: ActionBlock = {
        action,
        reason,
        userMessage: reason,
        details,
    };
    if (details && Object.keys(details).length > 0) {
        console.warn(`${PREFIX} blocked "${action}": ${reason}`, details);
    } else {
        console.warn(`${PREFIX} blocked "${action}": ${reason}`);
    }
    return block;
}

/**
 * Run ordered gate checks. Returns the first block (and logs it), or null if allowed.
 */
export function whyBlocked(
    action: string,
    checks: Array<{ when: boolean; reason: string; details?: Record<string, unknown> }>,
): ActionBlock | null {
    for (const check of checks) {
        if (check.when) return blockAction(action, check.reason, check.details);
    }
    return null;
}

/**
 * First matching disabled reason — no console log (safe for render / title attrs).
 */
export function disabledReason(
    checks: Array<{ when: boolean; reason: string }>,
): string | undefined {
    for (const check of checks) {
        if (check.when) return check.reason;
    }
    return undefined;
}

/** Non-blocking note (best-effort paths, skipped lifecycle work). */
export function noteAction(
    action: string,
    message: string,
    details?: Record<string, unknown>,
): void {
    if (details && Object.keys(details).length > 0) {
        console.info(`${PREFIX} "${action}": ${message}`, details);
    } else {
        console.info(`${PREFIX} "${action}": ${message}`);
    }
}
