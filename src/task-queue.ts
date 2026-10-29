import { BILI } from "./contract";
import { state } from "./settings";
import { isLoginGateBlocking } from "./vip";

type ScheduledTask = () => void | Promise<void>;

type ActiveTimeoutEntry = {
    timeout: ReturnType<typeof setTimeout>;
    resolve: () => void;
};

class TaskQueue {
    currentTaskId: number;
    activeTimeouts: Map<string | number, ActiveTimeoutEntry>;
    activeTask: number | null;
    activeTaskToken: object | null;
    scheduleSeq: number;
    loginObserved: boolean;

    constructor() {
        this.currentTaskId = 0;
        this.activeTimeouts = new Map();
        this.activeTask = null;
        this.activeTaskToken = null;
        this.scheduleSeq = 0;
        this.loginObserved = false;
    }

    generateTaskId() {
        return ++this.currentTaskId;
    }

    clearPreviousTasks() {
        this.activeTimeouts.forEach((entry: ActiveTimeoutEntry, key: string | number) => {
            clearTimeout(entry.timeout);
            console.log(`[任务管理] 取消挂起项 ${key}`);
            entry.resolve();
        });
        this.activeTimeouts.clear();

        if (this.activeTask !== null) {
            console.log(`[任务管理] 清理时任务 #${this.activeTask} 仍在运行，它将在下一个取消检查点自行退出`);
            this.activeTask = null;
            this.activeTaskToken = null;
        }
    }

    // 取消指定槽位的挂起任务（清定时器并兑现 Promise）
    cancelSlot(slot: string | number) {
        const entry = this.activeTimeouts.get(slot);
        if (!entry) return;
        clearTimeout(entry.timeout);
        entry.resolve();
        this.activeTimeouts.delete(slot);
        console.log(`[任务管理] 取消槽位 ${slot} 的挂起任务`);
    }

    isTaskCancelled(taskId: number) {
        // 检查任务是否过期
        if (taskId !== this.currentTaskId) {
            console.log(`[任务管理] 任务 #${taskId} 已过期，当前任务 #${this.currentTaskId}`);
            return true;
        }

        // 统一检测登录状态：未登录且未开启未登录模式时取消任务
        if (!state.isLivePage && !this.loginObserved) {
            if (document.querySelector(BILI.header.avatarWrap)) {
                this.loginObserved = true;
            } else if (isLoginGateBlocking()) {
                console.log(`[任务管理] 任务 #${taskId} 取消：检测到未登录且未开启未登录模式`);
                return true;
            }
        }

        return false;
    }

    async scheduleTask(taskId: number, task: ScheduledTask, delay = 0, slot: string | null = null) {
        if (this.isTaskCancelled(taskId)) return;

        if (!(delay > 0)) {
            console.warn(`[任务管理] 任务 #${taskId} 的调度延迟无效（${delay}），已钳到 1 毫秒：` +
                `延迟必须为正数，否则任务不可取消、不参与槽位去重`);
            delay = 1;
        }

        const token = {};
        // 设置当前活动任务
        this.activeTask = taskId;
        this.activeTaskToken = token;

        try {
            const key = slot || `seq-${++this.scheduleSeq}`;
            if (slot) {
                const previous = this.activeTimeouts.get(key);
                if (previous) {
                    clearTimeout(previous.timeout);
                    previous.resolve();
                    console.log(`[任务管理] 槽位 ${slot} 的旧任务被新调度替换`);
                }
            }
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(async () => {
                    this.activeTimeouts.delete(key);
                    if (!this.isTaskCancelled(taskId)) {
                        try {
                            await task();
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    } else {
                        console.log(`[任务管理] 延迟任务 #${taskId} 已取消`);
                        resolve();
                    }
                }, delay);
                this.activeTimeouts.set(key, { timeout, resolve });
            });
        } finally {
            if (this.activeTaskToken === token) {
                this.activeTask = null;
                this.activeTaskToken = null;
            }
        }
    }
}

export const taskQueue = new TaskQueue();
