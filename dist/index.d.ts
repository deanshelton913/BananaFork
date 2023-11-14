/// <reference types="node" />
import { Cluster } from 'cluster';
export declare function bananaFork<T>({ getArrayOfItems, messageProcessor, workerCount, workerMain, reportDurationInMs, logger, }: {
    getArrayOfItems: () => Promise<T[]>;
    workerCount: number;
    reportDurationInMs?: number;
    logger?: any;
    messageProcessor?: (obj: WorkerMessage) => Promise<void>;
    workerMain: (params: {
        id: number;
        subsetOfItems: T[];
        incrementMePerItemProcessed: {
            count: number;
        };
    }) => void;
}): Promise<Cluster>;
declare enum WorkerCmd {
    DONE = "done",
    ERROR = "error",
    STARTING = "starting",
    REPORT = "report",
    WORK = "work"
}
type WorkerMessage<T = unknown> = WorkerDoneMessage | WorkerErrorMessage | WorkerStartMessage | WorkerWorkMessage<T> | WorkerReportMessage;
interface WorkerDoneMessage {
    cmd: WorkerCmd.DONE;
    data: {
        id: number;
    };
}
interface WorkerErrorMessage {
    cmd: WorkerCmd.ERROR;
    data: Error;
}
interface WorkerStartMessage {
    cmd: WorkerCmd.STARTING;
    data: {
        id: number;
        length: number;
    };
}
interface WorkerReportMessage {
    cmd: WorkerCmd.REPORT;
    data: {
        id: number;
        completedSoFar: number;
        total: number;
    };
}
interface WorkerWorkMessage<T> {
    cmd: WorkerCmd.WORK;
    data: {
        id: number;
        subsetOfItems: T[];
    };
}
export {};
