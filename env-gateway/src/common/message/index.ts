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
  type: 'file' | 'dir';
};
export interface FSEventBatch extends SocketMessagePayload {
  events: FSEvent[];
}

export interface FSExtEvent extends FSEvent {
  uids: string[];
}

export interface FSBlock extends SocketMessagePayload {
  path: string;
}
export type FSResume = FSBlock;

export interface FSDocUpdate extends SocketMessagePayload {
  uuid: string;
  path: string;
  buf: string;
}

export type FSDocSyncEvent = {
  path: string;
  buf: string;
};
