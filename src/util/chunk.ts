export const chunk = <T>(items: T[], perChunk: number): T[][] => {
  const response: T[][] = [];
  for (let i = 0, j = items.length || 0; i < j; i += perChunk)
    response.push(items.slice(i, i + perChunk));
  return response;
};
