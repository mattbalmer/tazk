export const createMockFetches = (length: number) => {
  const resolvers = [];
  const promises: Promise<any>[] = Array.from({ length }, (_, i) =>
    new Promise((resolve, reject) => resolvers[i] = { resolve, reject })
  );
  let i = 0;

  const mockFetch = async (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const promise = promises[i++];
      promise
        // @ts-ignore
        .then((_) => {
          resolve(_);
        })
        .catch((_) => {
          reject(_)
        });
    });
  };

  return {
    resolvers,
    promises,
    mockFetch
  }
}