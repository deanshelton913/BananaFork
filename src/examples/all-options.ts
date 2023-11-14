import { bananaFork } from '../index';
import { logger } from '../util/logger';

// Here we just make an async "main" function for our app to run.
(async () => {
  const cluster = await bananaFork({
    workerCount: 3,
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

        // do something.
        await new Promise((resolve) => setTimeout(resolve, 5000)); // expensive async operation goes here

        logger.info(`[WORKER][${id}] processing item ${item} complete`);
        incrementMePerItemProcessed.count += 1;
      }
    },
  });

  if (cluster.isPrimary) {
    console.log(`Manager Process has resolved. Waiting for workers...`);
  }
})();
