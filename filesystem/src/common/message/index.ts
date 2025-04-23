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
