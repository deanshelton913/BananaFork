import cluster, { Cluster } from 'cluster';
import { cpus } from 'os';
import process from 'process';
import { logger as winstonLogger } from './util/logger';
import { chunk } from './util/chunk';

export async function bananaFork<T>({
  getArrayOfItems,
  messageProcessor,
  workerCount,
  workerMain,
  reportDurationInMs = null,
  logger = winstonLogger,
}: {
  getArrayOfItems: () => Promise<T[]>;
  workerCount: number;
  reportDurationInMs?: number;
  logger?: any;
  messageProcessor?: (obj: WorkerMessage) => Promise<void>;
  workerMain: (params: {
    id: number;
    subsetOfItems: T[];
    incrementMePerItemProcessed: { count: number };
  }) => void;
}): Promise<Cluster> {
  if (!cluster.isWorker) {
    // This is the code for the manager process.
    const numThreads = workerCount || cpus().length;
    logger.info(`[MANAGER] Number of cpus on this machine: ${cpus().length}.`);
    logger.info(`[MANAGER] Max threads allowed: ${numThreads}.`);
    if (reportDurationInMs) {
      logger.info(`[MANAGER] Progress reporting every: ${reportDurationInMs}ms.`);
    } else {
      logger.info(`[MANAGER] Progress reports are turned off.`);
    }
    const arrayOfItems = await getArrayOfItems();
    const chunks = chunk(arrayOfItems, Math.ceil(arrayOfItems.length / numThreads));
    logger.info(`[MANAGER] Number of chunks: ${chunks.length}.`);
    chunks.forEach((c, i) => logger.info(`[MANAGER] Chunk[${i}].length: ${chunks[i].length}.`));

    const workers = [];
    let doneCount = 0;
    for (let i = 0; i < numThreads; i++) {
      logger.info(`[MANAGER] Forking ${i}.`);
      const worker = cluster.fork();
      if (messageProcessor) worker.on('message', messageProcessor);
      worker.on('message', ({ cmd, data }) => {
        if (cmd === WorkerCmd.DONE) doneCount += 1;
        if (doneCount === workerCount) {
          logger.info(`[MANAGER] All workers are done. Exiting.`);
          cluster.disconnect();
        }
      });
      workers.push(worker);
      workers[i].send({
        cmd: WorkerCmd.WORK,
        data: { id: i, subsetOfItems: chunks[i] },
      });
    }

    cluster.on('exit', (worker, code, signal) => {
      logger.info(
        `[MANAGER] Worker ${worker.process.pid} exited with code ${code}, and signal ${signal}.`
      );
    });
    return cluster;
  } else {
    // Worker code. Each sub-process is executing here.
    let incrementMePerItemProcessed = { count: 0 };
    let interval;

    process.on('message', async function ({ cmd, data }: WorkerWorkMessage<T>) {
      switch (cmd) {
        case WorkerCmd.WORK:
          try {
            const { id, subsetOfItems } = data;
            logger.info(`[WORKER][${id}] starting worker.`);
            if (reportDurationInMs) {
              interval = setInterval(() => {
                process.send({
                  cmd: WorkerCmd.REPORT,
                  data: {
                    id,
                    completedSoFar: incrementMePerItemProcessed.count,
                    total: subsetOfItems.length,
                  },
                } as WorkerReportMessage);
              }, reportDurationInMs);
            }
            process.send({
              cmd: WorkerCmd.STARTING,
              data: { id, length: subsetOfItems.length },
            } as WorkerStartMessage);
            await workerMain({
              id,
              subsetOfItems,
              incrementMePerItemProcessed,
            });
            process.send({
              cmd: WorkerCmd.DONE,
              data: { id },
            } as WorkerDoneMessage);
            if (interval) clearInterval(interval);
          } catch (e) {
            logger.info(e);
            process.send({ cmd: WorkerCmd.ERROR, data: e });
            if (interval) clearInterval(interval);
            throw new Error('WorkerDied.');
          }
          break;
      }
    });
    return cluster;
  }
}

enum WorkerCmd {
  DONE = 'done', // Sent by worker when job has ran to completion without error.
  ERROR = 'error', // Sent by worker when work stopped due to error.
  STARTING = 'starting', // Sent by worker when work begins.
  REPORT = 'report', // Sent by worker when reporting periodically.
  WORK = 'work', // Sent by the manager process when delegating workload.
}

type WorkerMessage<T = unknown> =
  | WorkerDoneMessage
  | WorkerErrorMessage
  | WorkerStartMessage
  | WorkerWorkMessage<T>
  | WorkerReportMessage;

interface WorkerDoneMessage {
  cmd: WorkerCmd.DONE;
  data: { id: number };
}

interface WorkerErrorMessage {
  cmd: WorkerCmd.ERROR;
  data: Error;
}
interface WorkerStartMessage {
  cmd: WorkerCmd.STARTING;
  data: { id: number; length: number };
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
