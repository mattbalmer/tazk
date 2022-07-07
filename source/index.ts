import { Task, TaskMode, TaskOptions } from '@tazk/task';

const DEFAULT_TASK_OPTIONS: TaskOptions = {
  mode: TaskMode.CONCURRENT,
}

export const createTask = <A extends unknown[], R>(fn: (...args: A) => R, options: TaskOptions = DEFAULT_TASK_OPTIONS): Task<A, R> => {
  return new Task<A, R>(fn, options);
}