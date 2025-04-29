export type SocketMessagePayload = {
  action: string;
  [k: string]: any;
};

export type SocketMessage<T extends SocketMessagePayload> = {
  uid: string;
  type: SocketMessageType;
  data: T;
};

export enum SocketMessageType {
  FILESYSTEM = 'fs',
}
