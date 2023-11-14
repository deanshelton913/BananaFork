<p align="center">
  <img src="./assets/logo.png" height="200" />
</p>

# Banana Fork

**Easy parallel processing in NodeJS.**

## Description

BananaFork is a lightweight wrapper of the NodeJS cluster module. It's also tiny!! (18.6 kB)


Just define 3 things:

1. How many processes you want to fork.
2. How to get your full list of work-items.
3. What your workers do with each subset of items.

The manager process will evenly distribute your workload amongst worker threads and run them until they either error or complete.

Workloads can be of any type.

If you expect long-running workloads, consider using `reportDurationInMs` in combination with the `messageProcessor` method to log periodically on how many items each worker has completed. See examples below for inspiration.


## Getting Started

```bash
npm i banana-fork
```



### Bare-Bones Example

```typescript
import { bananaFork } from 'banana-fork';

(async () => {
  await bananaFork({
    workerCount: 5,
    getArrayOfItems: async () => {
      // ...Get the full list of items to work on.
      return [...Array(5).keys()]; // ex: [0,1,2,3,4]
    },
    workerMain: async ({ id, subsetOfItems }) => {
      // This code runs in a forked process!
      for (let i = 0; i < subsetOfItems.length; i++) {
        console.log('Worker ID', id, 'just processing some stuff.');
      }
    },
  });
})();
```

## Full-Featured Example

```typescript
(async () => {
  // ^ This function is used just so we can use async/await.

  const cluster = await bananaFork({
    workerCount: 5,
    getArrayOfItems: async () => [...Array(5).keys()], // Do something to get the FULL list of items to work on.
    reportDurationInMs: 3000,
    messageProcessor: async (msg) => {
      if (msg.cmd === 'report')
        logger.info(
          `[WORKER][${msg.data.id}] INTERVAL DRIVEN PROGRESS REPORT: ${msg.data.completedSoFar}/${msg.data.total}`
        );
    },
    workerMain: async ({ id, subsetOfItems, incrementMePerItemProcessed }) => {
      for (let i = 0; i < subsetOfItems.length; i++) {
        const item = subsetOfItems[i];
        logger.info(`[WORKER][${id}] processing item ${item}`);

        // do something computationally expensive.
        await new Promise((resolve) => setTimeout(resolve, 5000)); // wait 5 seconds!

        logger.info(`[WORKER][${id}] processing item ${item} complete`);
        incrementMePerItemProcessed.count += 1; // Track the completeness of each item in the subset!
      }
    },
  });
})();
```
### Configuration Options

| Name               | Type     | Required | Description                                                                                                                                                 |
| ------------------ | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| workerCount        | number   | yes      | The number of processes to fork. Should not exceed number of CPUs on host machine.                                                                          |
| getArrayOfItems    | function | yes      | An async function which resolves a list of items that will be split into equal chunks and distributed amongst worker processes.                             |
| workerMain         | function | yes      | An async function which handles items distributed by the "manager" process. For accurate reporting it should increment `incrementMePerItemProcessed.count`. |
| messageProcessor   | function | no       | This optional method is an async function that handles messages sent from worker processes. The shape and type of each `WorkerMessage` is documented below. |
| reportDurationInMs | number   | no       | The duration in ms which each worker should report it's progress using a `ReportMessage`. If falsy, no reports will be sent.                                |

### `WorkerMessage` Interface

```typescript

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

```


## Sending your own messages from workers

From anywhere within your workerMain function you can send messages to the "messageProcessor" function in the "manager" process by calling:

```typescript
process.send({ cmd: 'whatever', data: 'anything' });
```

## Example output

```txt
$ ts-node ./src/example/all-options.ts
2022-03-08T05:46:02.084Z [info]: [MANAGER] Number of cpus on this machine: 8
2022-03-08T05:46:02.084Z [info]: [MANAGER] Max threads allowed: 5
2022-03-08T05:46:02.084Z [info]: [MANAGER] Progress reporting every: 3000ms
2022-03-08T05:46:02.085Z [info]: [MANAGER] Number of chunks: 5
2022-03-08T05:46:02.085Z [info]: [MANAGER] Chunk[0].length: 1
2022-03-08T05:46:02.085Z [info]: [MANAGER] Chunk[1].length: 1
2022-03-08T05:46:02.086Z [info]: [MANAGER] Chunk[2].length: 1
2022-03-08T05:46:02.086Z [info]: [MANAGER] Chunk[3].length: 1
2022-03-08T05:46:02.086Z [info]: [MANAGER] Chunk[4].length: 1
2022-03-08T05:46:02.086Z [info]: [MANAGER] Forking 0
2022-03-08T05:46:02.094Z [info]: [MANAGER] Forking 1
2022-03-08T05:46:02.100Z [info]: [MANAGER] Forking 2
2022-03-08T05:46:02.106Z [info]: [MANAGER] Forking 3
2022-03-08T05:46:02.116Z [info]: [MANAGER] Forking 4
2022-03-08T05:46:06.055Z [info]: [WORKER][1] starting worker
2022-03-08T05:46:06.062Z [info]: [WORKER][1] processing item 1
2022-03-08T05:46:06.072Z [info]: [WORKER][3] starting worker
2022-03-08T05:46:06.074Z [info]: [WORKER][3] processing item 3
2022-03-08T05:46:06.099Z [info]: [WORKER][0] starting worker
2022-03-08T05:46:06.102Z [info]: [WORKER][0] processing item 0
2022-03-08T05:46:06.113Z [info]: [WORKER][4] starting worker
2022-03-08T05:46:06.115Z [info]: [WORKER][4] processing item 4
2022-03-08T05:46:06.132Z [info]: [WORKER][2] starting worker
2022-03-08T05:46:06.133Z [info]: [WORKER][2] processing item 2
2022-03-08T05:46:09.062Z [info]: [WORKER][1] INTERVAL DRIVEN PROGRESS REPORT: 0/1
2022-03-08T05:46:09.077Z [info]: [WORKER][3] INTERVAL DRIVEN PROGRESS REPORT: 0/1
2022-03-08T05:46:09.101Z [info]: [WORKER][0] INTERVAL DRIVEN PROGRESS REPORT: 0/1
2022-03-08T05:46:09.120Z [info]: [WORKER][4] INTERVAL DRIVEN PROGRESS REPORT: 0/1
2022-03-08T05:46:09.135Z [info]: [WORKER][2] INTERVAL DRIVEN PROGRESS REPORT: 0/1
2022-03-08T05:46:11.068Z [info]: [WORKER][1] processing item 1 complete
2022-03-08T05:46:11.079Z [info]: [WORKER][3] processing item 3 complete
2022-03-08T05:46:11.103Z [info]: [WORKER][0] processing item 0 complete
2022-03-08T05:46:11.122Z [info]: [WORKER][4] processing item 4 complete
2022-03-08T05:46:11.134Z [info]: [WORKER][2] processing item 2 complete
2022-03-08T05:46:11.135Z [info]: [MANAGER] All workers are done. Exiting...
2022-03-08T05:46:11.193Z [info]: [MANAGER] Worker 17583 exited with code 0, and signal null
2022-03-08T05:46:11.194Z [info]: [MANAGER] Worker 17579 exited with code 0, and signal null
2022-03-08T05:46:11.199Z [info]: [MANAGER] Worker 17582 exited with code 0, and signal null
2022-03-08T05:46:11.202Z [info]: [MANAGER] Worker 17580 exited with code 0, and signal null
2022-03-08T05:46:11.212Z [info]: [MANAGER] Worker 17581 exited with code 0, and signal null
```
