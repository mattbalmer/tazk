import { TaskInstance, TaskState } from '@tazk/task-instance';

export const enum TaskMode {
  CONCURRENT = 'CONCURRENT',
  RESTART = 'RESTART',
  DROP = 'DROP',
  ENQUEUE = 'ENQUEUE',
  KEEP_LATEST = 'KEEP_LATEST',
}

export type TaskOptions = {
  mode: TaskMode;
}

export type TaskQueueEntry = {
  id: number,
  start: () => void,
}

export class Task<A extends unknown[], R> {
  fn: (...A) => R | Promise<R>;

  instances: TaskInstance<A, R>[] = [];

  last: TaskInstance<A, R>;

  readonly options: TaskOptions;

  private queue: TaskQueueEntry[] = [];

  private nextId: number = 0;

  constructor(fn: (...A) => R | Promise<R>, options: TaskOptions) {
    if (!fn) {
      throw new Error(`Cannot instantiate a Task with a nullish function`);
    }
    this.fn = fn;
    this.options = Object.freeze(Object.assign({}, options));
  }

  perform(...args: A): TaskInstance<A, R> {
    const instance = new TaskInstance<A, R>(this.fn, args, this.nextId++);

    this.instances.push(instance);

    if (this.options.mode === TaskMode.CONCURRENT) {
      this.startInstance_(instance);
    } else if (this.options.mode === TaskMode.DROP) {
      // todo: make this an accessible field
      const hasRunningInstances = this.instances.some(instance => instance.state === TaskState.RUNNING);
      if (hasRunningInstances) {
        instance.drop();
      } else {
        this.startInstance_(instance);
      }
    } else if (this.options.mode === TaskMode.RESTART) {
      if (this.last?.isCancelable) {
        this.last?.cancel();
      }
      this.startInstance_(instance);
    } else if (this.options.mode === TaskMode.ENQUEUE) {
      this.enqueueInstance_(instance);
    } else if (this.options.mode === TaskMode.KEEP_LATEST) {

      // todo: make this an accessible field
      const hasRunningInstances = this.instances.some(instance => instance.state === TaskState.RUNNING);

      // Could there ever be a waiting instance but no running instance?
      if (hasRunningInstances) {
        const waitingInstance = this.instances.find(instance => instance.state === TaskState.WAITING);
        if (waitingInstance) {
          waitingInstance.drop();
        }
        this.enqueueInstance_(instance);
      } else {
        // enqueue or start?
        this.enqueueInstance_(instance);
      }
    }

    return instance;
  }

  private startInstance_(instance: TaskInstance<A, R>): TaskInstance<A, R> {
    this.last = instance;
    instance.perform();
    return instance;
  }

  private enqueueInstance_(instance: TaskInstance<A, R>): TaskInstance<A, R> {
    const entry = (() => {
      let resolve, reject;
      return {
        id: instance.id,
        instance,
        // todo: this currently becomes lost
        promise: new Promise<R>((rs, rj) => {
          resolve = rs;
          reject = rj;
        }),
        start: async () => {
          // remove from queue
          this.queue = this.queue.filter(entry => entry.id !== instance.id);
          try {
            this.startInstance_(instance);
            const result = await instance.value();
            resolve(result)
          } catch (error) {
            reject(error)
          } finally {
            // kick off next
            this.nextInQueue_();
          }
        },
      }
    })();

    instance.enqueue();
    this.queue.push(entry);

    if (this.last?.state !== TaskState.RUNNING) {
      this.nextInQueue_();
    }

    return instance;
  }

  private nextInQueue_() {
    const next = this.queue[0];
    next.start();
  }
}