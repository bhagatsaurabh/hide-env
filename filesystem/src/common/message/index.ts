export interface Message<T = any> {
  meta: {
    requestId: string;
    timestamp: number;
    uid: string;
    route: string;
  };
  data: T;
}

export type FSOpenRequest = {
  path: string;
};

export type FSCloseRequest = {
  path: string;
};
