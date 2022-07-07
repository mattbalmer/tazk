import { describe, it } from 'mocha';
import { createTask } from '@tazk/index';
import { TaskMode } from '@tazk/task';

describe('playground', () => {
  it('with sync stuff', async () => {
    const double = (baseNum: number) => baseNum * 2;
    const task = createTask(double);

    const result = await task.perform(5);

    console.log('result', result);
  });

  it('with async stuff', async () => {
    let resolveDouble;
    const mockFetch = async (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        resolveDouble = resolve;
      });
    };
    const task = createTask(mockFetch);

    console.log('task', task);

    const resultPromise = task.perform('testUrl');

    console.log('result', resultPromise);
    console.log('task', task);

    resolveDouble('fakeReturnValue');
    const result = await resultPromise;

    console.log('promise', resultPromise);
    console.log('result', result);
    console.log('task', task);

    // done();
  });

  it('cancellation', async () => {
    let resolveFetch;
    // let resolveTask;
    const mockFetch = async (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        resolveFetch = resolve;
      });
    };
    const mockTask = async (url: string): Promise<string> => {
      try {
        return await mockFetch(url);
      } catch (err) {
        console.log('catch', err);
      } finally {
        console.log('finally');
      }
    };
    const task = createTask(mockTask);

    console.log('task', task);

    const resultPromise = task.perform('testUrl');

    console.log('result', resultPromise);
    console.log('task', task);
    console.log('task.last.promise', task.last.promise);

    task.last.cancel();

    resolveFetch('fakeReturnValue');
    const result = await resultPromise;

    console.log('promise', resultPromise);
    console.log('result', result);
    console.log('task', task);

    // done();
  });

  it('queues', () => {
    let resolveFetches = {
      t1: null,
      t2: null,
      t3: null,
    };
    // let resolveTask;
    let stubs = [
      ['t1', new Promise((resolve, reject) => resolveFetches.t1 = { resolve, reject })],
      ['t2', new Promise((resolve, reject) => resolveFetches.t2 = { resolve, reject })],
      ['t3', new Promise((resolve, reject) => resolveFetches.t3 = { resolve, reject })],
    ];
    const mockFetch = async (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        // resolveFetch = resolve;
        const promise = stubs.find(_ => _[0] === url)[1];
        promise
          // @ts-ignore
          .then((_) => {
            console.log('succeed', url, _);
            resolve(_);
          })
          .catch((_) => {
            console.log('throw', url, _);
            reject(_)
          });
      });
    };
    const mockTask = async (url: string): Promise<string> => {
      console.log('task started', url);
      try {
        const result = await mockFetch(url);
        console.log('task success', url, result);
        return result;
      } catch (err) {
        console.log('task catch', url, err);
      } finally {
        console.log('task finally', url);
      }
    };

    const task = createTask(mockTask, {
      mode: TaskMode.ENQUEUE
    });

    console.log('resolves', resolveFetches);

    const instance1 = task.perform('t1');
    const instance2 = task.perform('t2');
    const instance3 = task.perform('t3');

    console.log('instance1', instance1);
    console.log('instance2', instance2);
    console.log('instance3', instance3);
    console.log('task.last', task.last);
    console.log('task', task);
    console.log('resolves', resolveFetches);

    resolveFetches.t2.reject('t2fakeErrMsg');
    resolveFetches.t1.resolve('t1payload');
    // resolveFetches.t1.resolve('t1payload');
  });
});