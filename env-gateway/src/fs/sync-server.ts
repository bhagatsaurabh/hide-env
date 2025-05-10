import { Doc, Transaction } from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as map from 'lib0/map';

type AwarenessUpdate = { added: number[]; updated: number[]; removed: number[] };

const gcEnabled = process.env.GC !== 'false' && process.env.GC !== '0';
const messageSync = 0;
const messageAwareness = 1;
export const docs = new Map<string, WSSharedDoc>();
let contentInitializor = (_ydoc: unknown) => Promise.resolve();
export const setContentInitializor = (f: typeof contentInitializor) => (contentInitializor = f);

export class WSSharedDoc extends Doc {
  awareness: awarenessProtocol.Awareness;
  conns: Map<WebSocket, Set<number>>;
  whenInitialized: Promise<void>;

  constructor(public name: string) {
    super({ gc: gcEnabled });
    this.name = name;
    this.conns = new Map();
    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);

    this.awareness.on('update', (update: AwarenessUpdate, conn: WebSocket) =>
      this.awarenessChangeHandler(update, conn),
    );
    this.on('update', (update: Uint8Array, origin: unknown, doc: WSSharedDoc, tran: Transaction) =>
      this.updateHandler(update, origin, doc, tran),
    );

    this.whenInitialized = contentInitializor(this);
  }

  awarenessChangeHandler({ added, updated, removed }: AwarenessUpdate, conn: WebSocket) {
    const changedClients = added.concat(updated, removed);
    if (conn !== null) {
      const connControlledIDs = this.conns.get(conn);
      if (connControlledIDs !== undefined) {
        added.forEach((clientID) => {
          connControlledIDs.add(clientID);
        });
        removed.forEach((clientID) => {
          connControlledIDs.delete(clientID);
        });
      }
    }

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
    );
    const buf = encoding.toUint8Array(encoder);
    this.conns.forEach((_, c) => c.send(buf));
  }
  updateHandler(update: Uint8Array, _origin: unknown, doc: WSSharedDoc, _tr: unknown) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const buf = encoding.toUint8Array(encoder);
    doc.conns.forEach((_, conn) => conn.send(buf));
  }
}

const messageListener = (conn: WebSocket, doc: WSSharedDoc, message: Uint8Array) => {
  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);
    switch (messageType) {
      case messageSync:
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
        if (encoding.length(encoder) > 1) {
          conn.send(encoding.toUint8Array(encoder));
        }
        break;
      case messageAwareness: {
        awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn);
        break;
      }
    }
  } catch (err) {
    console.error(err);
  }
};
const closeConn = (doc: WSSharedDoc, conn: WebSocket) => {
  if (doc.conns.has(conn)) {
    const controlledIds = doc.conns.get(conn)!;
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null);
    if (doc.conns.size === 0) {
      doc.destroy();
      docs.delete(doc.name);
    }
  }
  conn.close();
};
export const setupWSConnection = (
  conn: WebSocket,
  { docName, gc = true }: { docName: string; gc?: boolean },
) => {
  const doc = map.setIfUndefined(docs, docName, () => {
    const doc = new WSSharedDoc(docName);
    doc.gc = gc;
    docs.set(docName, doc);
    return doc;
  });
  doc.conns.set(conn, new Set());
  conn.onmessage = (message) => messageListener(conn, doc, new Uint8Array(message.data as ArrayBufferLike));
  conn.onclose = () => closeConn(doc, conn);

  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    conn.send(encoding.toUint8Array(encoder));
    const awarenessStates = doc.awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())),
      );
      conn.send(encoding.toUint8Array(encoder));
    }
  }
};
