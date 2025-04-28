import { Stats } from 'node:fs';

export interface Message<T = any> {
  meta: {
    requestId: string;
    timestamp: number;
    uid: string;
    route: string;
  };
  payload: T;
}

export type FSOpenRequest = {
  path: string;
};

export type FSCloseRequest = {
  path: string;
};

export type FSEventType = 'add' | 'addDir' | 'unlink' | 'unlinkDir' | 'change';
export type FSRefinedEventType = 'create' | 'remove' | 'rename' | 'write';

export type FSEvent = {
  path: string;
  type: FSEventType;
  stats?: Stats;
  ts: number;
};

export type FSRefinedEvent = {
  path: string;
  action: FSRefinedEventType;
  data: string;
};

export type FSExtEvent = {
  uids: string[];
  path: string;
  action: 'create' | 'remove' | 'rename' | 'write';
  name: string;
};
