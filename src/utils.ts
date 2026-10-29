export const Utils = {
    delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    query(selector: string, parent: ParentNode = document): HTMLElement | null {
        return parent.querySelector<HTMLElement>(selector);
    },
    queryAll(selector: string, parent: ParentNode = document): HTMLElement[] {
        return Array.from(parent.querySelectorAll<HTMLElement>(selector));
    }
};

export function runSafely(promise: PromiseLike<unknown> | void, label: string): void {
    void Promise.resolve(promise).catch((error: unknown) => {
        if (error instanceof Error) console.error(`[${label}] 异步任务失败:`, error);
        else console.error(`[${label}] 异步任务失败:`, new Error(String(error)), error);
    });
}
