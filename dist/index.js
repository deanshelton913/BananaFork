"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bananaFork = void 0;
const tslib_1 = require("tslib");
const cluster_1 = tslib_1.__importDefault(require("cluster"));
const os_1 = require("os");
const process_1 = tslib_1.__importDefault(require("process"));
const logger_1 = require("./util/logger");
const chunk_1 = require("./util/chunk");
function bananaFork({ getArrayOfItems, messageProcessor, workerCount, workerMain, reportDurationInMs = null, logger = logger_1.logger, }) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        if (!cluster_1.default.isWorker) {
            // This is the code for the manager process.
            const numThreads = workerCount || (0, os_1.cpus)().length;
            logger.info(`[MANAGER] Number of cpus on this machine: ${(0, os_1.cpus)().length}.`);
            logger.info(`[MANAGER] Max threads allowed: ${numThreads}.`);
            if (reportDurationInMs) {
                logger.info(`[MANAGER] Progress reporting every: ${reportDurationInMs}ms.`);
            }
            else {
                logger.info(`[MANAGER] Progress reports are turned off.`);
            }
            const arrayOfItems = yield getArrayOfItems();
            const chunks = (0, chunk_1.chunk)(arrayOfItems, Math.ceil(arrayOfItems.length / numThreads));
            logger.info(`[MANAGER] Number of chunks: ${chunks.length}.`);
            chunks.forEach((c, i) => logger.info(`[MANAGER] Chunk[${i}].length: ${chunks[i].length}.`));
            const workers = [];
            let doneCount = 0;
            for (let i = 0; i < numThreads; i++) {
                logger.info(`[MANAGER] Forking ${i}.`);
                const worker = cluster_1.default.fork();
                if (messageProcessor)
                    worker.on('message', messageProcessor);
                worker.on('message', ({ cmd, data }) => {
                    if (cmd === WorkerCmd.DONE)
                        doneCount += 1;
                    if (doneCount === workerCount) {
                        logger.info(`[MANAGER] All workers are done. Exiting.`);
                        cluster_1.default.disconnect();
                    }
                });
                workers.push(worker);
                workers[i].send({
                    cmd: WorkerCmd.WORK,
                    data: { id: i, subsetOfItems: chunks[i] },
                });
            }
            cluster_1.default.on('exit', (worker, code, signal) => {
                logger.info(`[MANAGER] Worker ${worker.process.pid} exited with code ${code}, and signal ${signal}.`);
            });
            return cluster_1.default;
        }
        else {
            // Worker code. Each sub-process is executing here.
            let incrementMePerItemProcessed = { count: 0 };
            let interval;
            process_1.default.on('message', function ({ cmd, data }) {
                return tslib_1.__awaiter(this, void 0, void 0, function* () {
                    switch (cmd) {
                        case WorkerCmd.WORK:
                            try {
                                const { id, subsetOfItems } = data;
                                logger.info(`[WORKER][${id}] starting worker.`);
                                if (reportDurationInMs) {
                                    interval = setInterval(() => {
                                        process_1.default.send({
                                            cmd: WorkerCmd.REPORT,
                                            data: {
                                                id,
                                                completedSoFar: incrementMePerItemProcessed.count,
                                                total: subsetOfItems.length,
                                            },
                                        });
                                    }, reportDurationInMs);
                                }
                                process_1.default.send({
                                    cmd: WorkerCmd.STARTING,
                                    data: { id, length: subsetOfItems.length },
                                });
                                yield workerMain({
                                    id,
                                    subsetOfItems,
                                    incrementMePerItemProcessed,
                                });
                                process_1.default.send({
                                    cmd: WorkerCmd.DONE,
                                    data: { id },
                                });
                                if (interval)
                                    clearInterval(interval);
                            }
                            catch (e) {
                                logger.info(e);
                                process_1.default.send({ cmd: WorkerCmd.ERROR, data: e });
                                if (interval)
                                    clearInterval(interval);
                                throw new Error('WorkerDied.');
                            }
                            break;
                    }
                });
            });
            return cluster_1.default;
        }
    });
}
exports.bananaFork = bananaFork;
var WorkerCmd;
(function (WorkerCmd) {
    WorkerCmd["DONE"] = "done";
    WorkerCmd["ERROR"] = "error";
    WorkerCmd["STARTING"] = "starting";
    WorkerCmd["REPORT"] = "report";
    WorkerCmd["WORK"] = "work";
})(WorkerCmd || (WorkerCmd = {}));
