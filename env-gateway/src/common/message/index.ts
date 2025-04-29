import { SocketMessagePayload } from './socket.message';

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

export type FSEventType = 'create' | 'remove' | 'rename' | 'write';

export type FSEvent = {
  watchedPath: string;
  path: string;
  oldPath?: string;
  ino?: number;
  action: FSEventType;
  timestamp: number;
};
export interface FSEventBatch extends SocketMessagePayload {
  events: FSEvent[];
}

export type FSExtEvent = {
  uids: string[];
  watchedPath: string;
  path: string;
  oldPath?: string;
  ino?: number;
  action: FSEventType;
  timestamp: number;
};

export interface FSBlock extends SocketMessagePayload {
  path: string;
}
export type FSResume = FSBlock;
