export type SocketMessage<T> = {
  uid: string;
  type: SocketMessageType;
  data: T;
};

export enum SocketMessageType {
  FILESYSTEM = 'fs',
}
