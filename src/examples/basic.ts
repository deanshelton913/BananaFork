import { bananaFork } from 'banana-fork';

(async () => {
  await bananaFork({
    workerCount: 5,
    getArrayOfItems: async () => [...Array(5).keys()], // Get the FULL list of items to work on.
    workerMain: async ({ id, subsetOfItems }) => {
      for (let i = 0; i < subsetOfItems.length; i++) {
        // do whatever.
        console.log('Worker ID', id, 'just processing some stuff.');
      }
    },
  });
})();
