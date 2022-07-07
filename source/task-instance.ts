export const enum TaskState {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  DROPPED = 'DROPPED',
  CANCELED = 'CANCELED',
  WAITING = 'WAITING',
}

export class TaskInstance<A extends unknown[], R> {
  id: number;

  fn: (...A) => R | Promise<R>;

  args: A;

  promise: Promise<R>;

  private state_: TaskState = TaskState.IDLE;

  private value_: R | undefined;

  private cancel_: () => void;

  constructor(fn: (...A) => R | Promise<R>, args: A, id: number) {
    if (!fn) {
      throw new Error(`Cannot instantiate a TaskInstance with a nullish function`);
    }
    if (!args) {
      throw new Error(`Cannot instantiate a TaskInstance with nullish arguments`);
    }
    this.fn = fn;
    this.args = args;
    this.id = id;
  }

  get state() {
    return this.state_;
  }

  async perform(): Promise<R> {
    this.state_ = TaskState.RUNNING;
    this.promise = this.performWrap_();
    try {
      this.value_ = await this.promise;
    } finally {
      this.state_ = TaskState.COMPLETED;
    }
    return this.value_;
  }

  value(): Promise<R> {
    return this.promise;
  }

  get isCancelable() {
    return [TaskState.RUNNING, TaskState.WAITING].includes(this.state_)
  }

  cancel() {
    if (this.isCancelable) {
      if (!this.cancel_) {
        throw new Error(`Cannot cancel promise; no cancel function is provided`);
      }
      this.state_ = TaskState.CANCELED;
      this.cancel_();
    } else {
      if (this.state_ === TaskState.IDLE) {
        throw new Error(`Cannot cancel promise; task instance is idle`);
      }
      else if (this.state_ === TaskState.COMPLETED) {
        throw new Error(`Cannot cancel promise; task instance has completed`);
      }
      else if (this.state_ === TaskState.DROPPED) {
        throw new Error(`Cannot cancel promise; task instance was dropped`);
      }
      else if (this.state_ === TaskState.CANCELED) {
        throw new Error(`Cannot cancel promise; task instance was already canceled`);
      } else {
        throw new Error(`Cannot cancel promise; task instance is neither running nor waiting`);
      }
    }
  }

  drop() {
    this.state_ = TaskState.DROPPED;
  }

  enqueue() {
    this.state_ = TaskState.WAITING;
  }

  private performWrap_ = async(): Promise<R> => {
    const actualPromise = this.executeWrap_();
    const cancelPromise: Promise<R> = new Promise((resolve, reject) => {
      this.cancel_ = reject.bind(null, new Error(`Task ${this.id} was cancelled`));
    });

    return Promise.race([actualPromise, cancelPromise]);
  }

  private executeWrap_ = async(): Promise<R> => {
    return this.fn(...this.args);
  }
}