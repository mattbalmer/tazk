import { describe, it } from 'mocha';
import { expect } from 'chai'
import { TaskInstance, TaskState } from '@tazk/task-instance';
import * as sinon from 'sinon';

const doubleFn = (a: number) => a * 2;

describe('TaskInstance', () => {
  describe('constructor()', () => {
    it('assigns the arguments', () => {
      const fn = doubleFn;
      const args = ['foo', 5];
      const id = 0;

      const taskInstance = new TaskInstance(fn, args, id);

      expect(taskInstance.fn).to.equal(fn);
      expect(taskInstance.args).to.equal(args);
      expect(taskInstance.id).to.equal(id);
    });

    it('should start in IDLE state', () => {
      const taskInstance = new TaskInstance(doubleFn, [], 0);

      expect(taskInstance.state).to.equal(TaskState.IDLE);
    });

    it('should throw an error if a nullish fn is given', () => {
      const callUndefined = () => {
        new TaskInstance(undefined, [], 0);
      }

      const callNull = () => {
        new TaskInstance(null, [], 0);
      }

      expect(callUndefined).to.throw(Error, `Cannot instantiate a TaskInstance with a nullish function`);
      expect(callNull).to.throw(Error, `Cannot instantiate a TaskInstance with a nullish function`);
    });

    it('should throw an error if nullish args is given', () => {
      const callUndefined = () => {
        new TaskInstance(doubleFn, undefined, 0);
      }

      const callNull = () => {
        new TaskInstance(doubleFn, null, 0);
      }

      expect(callUndefined).to.throw(Error, `Cannot instantiate a TaskInstance with nullish arguments`);
      expect(callNull).to.throw(Error, `Cannot instantiate a TaskInstance with nullish arguments`);
    });
  });

  describe('perform()', () => {
    let mockTaskInstance;

    beforeEach(() => {
      sinon.restore();
      mockTaskInstance = new TaskInstance(doubleFn, [], 0);
    });

    it('should update the state to RUNNING', () => {
      mockTaskInstance.perform();

      expect(mockTaskInstance.state).to.equal(TaskState.RUNNING);
    });

    it('should set the promise', () => {
      expect(mockTaskInstance.promise).to.equal(undefined);

      const fakePromise = new Promise(() => {});
      sinon.stub(mockTaskInstance, 'performWrap_').returns(fakePromise);

      mockTaskInstance.perform();

      expect(mockTaskInstance.promise).to.deep.equal(fakePromise);
    });

    it('should set the cancel_ promise', () => {
      expect(mockTaskInstance.cancel_).to.equal(undefined);

      mockTaskInstance.perform();

      expect(mockTaskInstance.cancel_).to.be.a('function');
    });

    it('should set the value_ once the promise resolves', async () => {
      expect(mockTaskInstance.value_).to.equal(undefined);

      let resolve;
      const fakePromise = new Promise(r => (resolve = r));
      sinon.stub(mockTaskInstance, 'performWrap_').returns(fakePromise);

      mockTaskInstance.perform();

      resolve('testString');

      await mockTaskInstance.promise;

      expect(mockTaskInstance.value_).to.deep.equal('testString');
    });

    it('should return the value (1)', async () => {
      expect(mockTaskInstance.value_).to.equal(undefined);

      let resolve;
      const fakePromise = new Promise(r => (resolve = r));
      sinon.stub(mockTaskInstance, 'performWrap_').returns(fakePromise);

      mockTaskInstance.perform();

      resolve('testString');

      const result = await mockTaskInstance.promise;

      expect(result).to.deep.equal('testString');
    });

    it('should return the value (2)', async () => {
      const taskInstance = new TaskInstance<[number], number>(doubleFn, [2], 0);
      // @ts-ignore
      expect(taskInstance.value_).to.equal(undefined);

      const result = await taskInstance.perform();

      expect(result).to.deep.equal(4);
    });

    it('should set the state to COMPLETED once the promise resolves', async () => {
      let resolve;
      const fakePromise = new Promise(r => (resolve = r));
      sinon.stub(mockTaskInstance, 'performWrap_').returns(fakePromise);

      mockTaskInstance.perform();

      resolve('testString');

      await mockTaskInstance.promise;

      expect(mockTaskInstance.state).to.equal(TaskState.COMPLETED);
    });
  });

  describe('value()', () => {
    it('should return the promise', () => {
      const taskInstance = new TaskInstance(doubleFn, [], 0);

      expect(taskInstance.value()).to.deep.equal(undefined);

      const fakePromise = new Promise(() => {});
      // @ts-ignore
      sinon.stub(taskInstance, 'performWrap_').returns(fakePromise);

      taskInstance.perform();

      expect(taskInstance.promise).to.deep.equal(fakePromise);
    });
  });

  describe('drop()', () => {
    it('should set the state to DROPPED', () => {
      const taskInstance = new TaskInstance(doubleFn, [2], 0);

      taskInstance.drop();

      expect(taskInstance.state).to.equal(TaskState.DROPPED);
    });
  });

  describe('enqueue()', () => {
    it('should set the state to WAITING', () => {
      const taskInstance = new TaskInstance(doubleFn, [2], 0);

      taskInstance.enqueue();

      expect(taskInstance.state).to.equal(TaskState.WAITING);
    });
  });

  describe('isCancelable', () => {
    it('should be true for RUNNING', () => {
      const taskInstance = new TaskInstance(doubleFn, [], 0);

      // @ts-ignore
      taskInstance.state_ = TaskState.RUNNING;

      expect(taskInstance.isCancelable).to.equal(true);
    });

    it('should be true for WAITING', () => {
      const taskInstance = new TaskInstance(doubleFn, [], 0);

      // @ts-ignore
      taskInstance.state_ = TaskState.WAITING;

      expect(taskInstance.isCancelable).to.equal(true);
    });

    it('should be false for IDLE', () => {
      const taskInstance = new TaskInstance(doubleFn, [], 0);

      // @ts-ignore
      taskInstance.state_ = TaskState.IDLE;

      expect(taskInstance.isCancelable).to.equal(false);
    });

    it('should be false for COMPLETED', () => {
      const taskInstance = new TaskInstance(doubleFn, [], 0);

      // @ts-ignore
      taskInstance.state_ = TaskState.COMPLETED;

      expect(taskInstance.isCancelable).to.equal(false);
    });

    it('should be false for DROPPED', () => {
      const taskInstance = new TaskInstance(doubleFn, [], 0);

      // @ts-ignore
      taskInstance.state_ = TaskState.DROPPED;

      expect(taskInstance.isCancelable).to.equal(false);
    });

    it('should be false for CANCELED', () => {
      const taskInstance = new TaskInstance(doubleFn, [], 0);

      // @ts-ignore
      taskInstance.state_ = TaskState.CANCELED;

      expect(taskInstance.isCancelable).to.equal(false);
    });
  });

  describe('cancel()', () => {
    it('should throw an error if the state is IDLE', () => {
      const taskInstance = new TaskInstance(doubleFn, [], 0);

      const call = () => {
        taskInstance.cancel();
      };

      expect(call).to.throw(Error, `Cannot cancel promise; task instance is idle`);
    });

    it('should throw an error if the state is COMPLETED', async () => {
      const taskInstance = new TaskInstance(doubleFn, [], 0);

      await taskInstance.perform();

      const call = () => {
        taskInstance.cancel();
      };

      expect(call).to.throw(Error, `Cannot cancel promise; task instance has completed`);
    });

    it('should throw an error if the state is DROPPED', async () => {
      const taskInstance = new TaskInstance(doubleFn, [], 0);

      taskInstance.drop();

      const call = () => {
        taskInstance.cancel();
      };

      expect(call).to.throw(Error, `Cannot cancel promise; task instance was dropped`);
    });

    it('should throw an error if the state is CANCELED', async () => {
      const taskInstance = new TaskInstance(doubleFn, [], 0);

      taskInstance.perform();
      taskInstance.cancel();

      const call = () => {
        taskInstance.cancel();
      };

      expect(call).to.throw(Error, `Cannot cancel promise; task instance was already canceled`);
    });

    it('should throw an error if cancel_ is undefined (should never actually happen)', () => {
      const taskInstance = new TaskInstance(doubleFn, [], 0);

      taskInstance.perform();

      // cancel_ should exist
      // @ts-ignore
      expect(taskInstance.cancel_).to.be.a('function');

      // cancel_ should exist
      // @ts-ignore
      taskInstance.cancel_ = undefined;

      const call = () => {
        taskInstance.cancel();
      };

      expect(call).to.throw(Error, `Cannot cancel promise; no cancel function is provided`);
    });

    it('should set the state to CANCELED', () => {
      const taskInstance = new TaskInstance(doubleFn, [], 0);

      taskInstance.perform();

      taskInstance.cancel();

      expect(taskInstance.state).to.equal(TaskState.CANCELED);
    });

    it('should send an error to perform()', async () => {
      const taskInstance = new TaskInstance(doubleFn, [2], 0);

      let resolve;
      const fakePromise = new Promise(r => (resolve = r));
      // @ts-ignore
      sinon.stub(taskInstance, 'executeWrap_').returns(fakePromise);

      taskInstance.perform();

      taskInstance.cancel();

      try {
        await taskInstance.promise;
        expect(null).to.equal(`This should have thrown`);
      } catch (error) {
        expect(error.message).to.equal(`Task 0 was cancelled`);
      }
    });
  });
});