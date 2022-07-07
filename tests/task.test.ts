import { describe, it } from 'mocha';
import { expect } from 'chai'
import { Task, TaskMode, TaskOptions } from '@tazk/task';
import { TaskState } from '@tazk/task-instance';
import { createMockFetches } from './utils/resolvable';

const doubleFn = (a: number) => a * 2;

describe('Task', () => {
  describe('constructor()', () => {
    it('assigns the arguments', () => {
      const fn = doubleFn;
      const options: TaskOptions = {
        mode: TaskMode.DROP
      };

      const task = new Task(fn, options);

      expect(task.fn).to.equal(fn);
      expect(task.options).to.deep.equal(options);
    });

    it('copies and freezes the options', () => {
      const fn = doubleFn;
      const options: TaskOptions = {
        mode: TaskMode.DROP
      };

      const task = new Task(fn, options);

      expect(task.options).to.deep.equal(options);

      options.mode = TaskMode.ENQUEUE;

      expect(task.options.mode).to.deep.equal(TaskMode.DROP);

      const call = () => {
        task.options.mode = TaskMode.ENQUEUE;
      };

      expect(call).to.throw(TypeError, `Cannot assign to read only property 'mode' of object '#<Object>'`);
    });

    it('should throw an error if a nullish fn is given', () => {
      const options: TaskOptions = {
        mode: TaskMode.DROP
      };

      const callUndefined = () => {
        new Task(undefined, options);
      }

      const callNull = () => {
        new Task(null, options);
      }

      expect(callUndefined).to.throw(Error, `Cannot instantiate a Task with a nullish function`);
      expect(callNull).to.throw(Error, `Cannot instantiate a Task with a nullish function`);
    });
  });

  describe('perform()', () => {
    let mockTask;

    beforeEach(() => {
      mockTask = new Task<[number], number>(doubleFn, {
        mode: TaskMode.CONCURRENT,
      });
    });

    it('should return a TaskInstance', () => {
      // @ts-ignore
      const expectedID = mockTask.nextId;
      const expectedArgs = [2];

      const taskInstance = mockTask.perform(2);

      expect(taskInstance.id).to.equal(expectedID);
      expect(taskInstance.fn).to.equal(doubleFn);
      expect(taskInstance.args).to.deep.equal(expectedArgs);
    });

    it('should add the TaskInstance to the instances list', () => {
      expect(mockTask.instances).to.deep.equal([]);

      const taskInstance = mockTask.perform(2);

      expect(mockTask.instances).to.deep.equal([taskInstance]);
    });

    it('should increment nextID', () => {
      // @ts-ignore
      expect(mockTask.nextId).to.equal(0);

      const taskInstance1 = mockTask.perform(2);

      expect(taskInstance1.id).to.equal(0);
      // @ts-ignore
      expect(mockTask.nextId).to.equal(1);

      const taskInstance2 = mockTask.perform(2);

      expect(taskInstance2.id).to.equal(1);
      // @ts-ignore
      expect(mockTask.nextId).to.equal(2);
    });
  });

  describe('perform() - CONCURRENT', () => {
    let mockTask;

    beforeEach(() => {
      mockTask = new Task<[number], number>(doubleFn, {
        mode: TaskMode.CONCURRENT,
      });
    });

    it('should immediately run all instances', () => {
      const task1 = mockTask.perform();
      const task2 = mockTask.perform();

      expect(task1.state).to.equal(TaskState.RUNNING);
      expect(task2.state).to.equal(TaskState.RUNNING);
    });
  });

  describe('perform() - DROP', () => {
    let mockTask;

    beforeEach(() => {
      mockTask = new Task<[number], number>(doubleFn, {
        mode: TaskMode.DROP,
      });
    });

    it('should immediately drop all extra instances', () => {
      const task1 = mockTask.perform();
      const task2 = mockTask.perform();

      expect(task1.state).to.equal(TaskState.RUNNING);
      expect(task2.state).to.equal(TaskState.DROPPED);
    });
  });

  describe('perform() - ENQUEUE', () => {
    let mockTask;

    beforeEach(() => {
      mockTask = new Task<[number], number>(doubleFn, {
        mode: TaskMode.ENQUEUE,
      });
    });

    it('should immediately enqueue all extra instances', () => {
      const instance1 = mockTask.perform();
      const instance2 = mockTask.perform();
      const instance3 = mockTask.perform();

      expect(instance1.state).to.equal(TaskState.RUNNING);
      expect(instance2.state).to.equal(TaskState.WAITING);
      expect(instance3.state).to.equal(TaskState.WAITING);
    });

    it('should start running the next waiting task once the running task finishes', async () => {
      const {
        resolvers,
        mockFetch
      } = createMockFetches(3);

      const mockFetchTask = async (url: string): Promise<string> => {
        return await mockFetch(url);
      };

      const task = new Task<[string], string>(mockFetchTask, {
        mode: TaskMode.ENQUEUE,
      });

      const instance1 = task.perform('t1');
      const instance2 = task.perform('t2');
      const instance3 = task.perform('t3');

      expect(instance1.state).to.equal(TaskState.RUNNING);
      expect(instance2.state).to.equal(TaskState.WAITING);
      expect(instance3.state).to.equal(TaskState.WAITING);

      resolvers[0].resolve('success');
      await instance1.promise;

      expect(instance1.state).to.equal(TaskState.COMPLETED);
      expect(instance2.state).to.equal(TaskState.RUNNING);
      expect(instance3.state).to.equal(TaskState.WAITING);

      // todo: find a more "chai"-friendly way for this
      try {
        resolvers[1].reject(new Error('Unknown mock endpoint failure'));
        await instance2.promise;
        expect(true).to.equal('Should have thrown');
      } catch (error) {
        expect(error.message).to.deep.equal('Unknown mock endpoint failure')
      }

      expect(instance1.state).to.equal(TaskState.COMPLETED);
      expect(instance2.state).to.equal(TaskState.COMPLETED);
      expect(instance3.state).to.equal(TaskState.RUNNING);
    });
  });

  describe('perform() - RESTART', () => {
    let mockTask;

    beforeEach(() => {
      mockTask = new Task<[number], number>(doubleFn, {
        mode: TaskMode.RESTART,
      });
    });

    it('should immediately cancel any previous instances', async () => {
      const instance1 = mockTask.perform();
      const instance2 = mockTask.perform();

      expect(instance1.state).to.equal(TaskState.CANCELED);
      expect(instance2.state).to.equal(TaskState.RUNNING);

      await instance1.promise;
      await instance2.promise;

      expect(instance1.state).to.equal(TaskState.COMPLETED);
      expect(instance2.state).to.equal(TaskState.COMPLETED);
    });

    it('it should not cancel the previous task if it already finished', async () => {
      const {
        resolvers,
        mockFetch
      } = createMockFetches(2);

      const mockFetchTask = async (url: string): Promise<string> => {
        return await mockFetch(url);
      };

      const task = new Task<[string], string>(mockFetchTask, {
        mode: TaskMode.RESTART,
      });

      const instance1 = task.perform('t1');

      expect(instance1.state).to.equal(TaskState.RUNNING);

      resolvers[0].resolve('success');
      await instance1.promise;

      const instance2 = task.perform('t2');

      expect(instance1.state).to.equal(TaskState.COMPLETED);
      expect(instance2.state).to.equal(TaskState.RUNNING);

      resolvers[1].resolve('success');
      await instance2.promise;

      expect(instance1.state).to.equal(TaskState.COMPLETED);
      expect(instance2.state).to.equal(TaskState.COMPLETED);
    });
  });

  describe('perform() - KEEP_LATEST', () => {
    let mockTask;

    beforeEach(() => {
      mockTask = new Task<[number], number>(doubleFn, {
        mode: TaskMode.KEEP_LATEST,
      });
    });

    it('it should set the latest task to waiting, and drop all previous tasks', async () => {
      const {
        mockFetch
      } = createMockFetches(4);

      const mockFetchTask = async (url: string): Promise<string> => {
        return await mockFetch(url);
      };

      const task = new Task<[string], string>(mockFetchTask, {
        mode: TaskMode.KEEP_LATEST,
      });

      const instance1 = task.perform('t1');
      const instance2 = task.perform('t2');

      expect(instance1.state).to.equal(TaskState.RUNNING);
      expect(instance2.state).to.equal(TaskState.WAITING);

      const instance3 = task.perform('t3');
      const instance4 = task.perform('t4');

      expect(instance1.state).to.equal(TaskState.RUNNING);
      expect(instance2.state).to.equal(TaskState.DROPPED);
      expect(instance3.state).to.equal(TaskState.DROPPED);
      expect(instance4.state).to.equal(TaskState.WAITING);
    });
  });
});