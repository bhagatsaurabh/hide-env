import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { promises as fs } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';
import {
  FSExtEvent,
  FSBlock,
  FSResume,
  FSEventBatch,
  FSEvent,
  FSDocUpdateEvent,
  Message,
  FSDocUpdate,
} from 'src/common/message';
import { SocketBroadcast, SocketMessage, SocketMessageType } from 'src/common/message/socket.message';
import { debounce } from 'src/utils';

type DocMeta = { path: string };

@Injectable()
export class FSService {
  constructor(@Inject('FILESYSTEM_SERVICE_REDIS') private redis: ClientProxy) {}

  docs = new Map<string, { doc: Doc; uids: Set<string> }>();
  uidToPath = new Map<string, Set<string>>();
  root = '/home/devuser/workspace';
  cache: EventCache = { events: [], buffer: [], isProcessing: false };
  debounceTime = 250;
  busy: { uids: string[]; path: string } | null = null;
  process = debounce(() => this._process(), this.debounceTime);

  async open(uid: string, path: string) {
    path = this.root + path;
    try {
      const stat = await fs.stat(path);
      if (stat.isDirectory()) {
        return await this.openDir(uid, path);
      }
      return await this.openFile(uid, path);
    } catch (err) {
      console.log(err);
      return [];
    }
  }
  async openDir(uid: string, path: string) {
    this.redis.emit('add-watch', { uid, path });

    try {
      const entries = await fs.readdir(path, { withFileTypes: true });
      const ids = (await Promise.all(entries.map((entry) => fs.lstat(join(path, entry.name))))).map(
        (stat) => stat.ino,
      );
      return entries.map((entry, idx) => ({
        name: entry.name,
        path: join(path, entry.name),
        type: entry.isDirectory() ? 'dir' : 'file',
        id: ids[idx],
      }));
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Failed to read directory');
    }
  }
  async openFile(uid: string, path: string) {
    const doc = await this.getDoc(uid, path);
    (doc.meta as DocMeta).path = path;
    const state = encodeStateAsUpdate(doc);
    this.registerUpdate(doc);
    if (!this.uidToPath.has(uid)) this.uidToPath.set(uid, new Set());
    this.uidToPath.get(uid)?.add(path);
    return Buffer.from(state).toString('base64');
  }
  registerUpdate(doc: Doc) {
    doc.on('update', (update, un, d, tran) => {
      const path = (d.meta as DocMeta).path;
      console.log(un, d.guid, tran.origin, path);
      this.redis.emit<any, SocketBroadcast<FSDocUpdate>>('socket.broadcast', {
        uids: Array.from(this.docs.get(path)!.uids).filter((uid) => uid !== tran.origin),
        type: SocketMessageType.FILESYSTEM,
        data: {
          action: 'update',
          uuid: process.env.WS_UUID!,
          path,
          update,
        },
      });
    });
  }

  async close(uid: string, path: string) {
    path = this.root + path;
    try {
      const stat = await fs.stat(path);
      if (stat.isDirectory()) {
        return this.closeDir(uid, path);
      }
      return this.closeFile(uid, path);
    } catch (err) {
      console.log(err);
      return;
    }
  }
  closeDir(uid: string, path: string) {
    path = this.root + path;
    this.redis.emit('remove-watch', { uid, path });
  }
  closeFile(uid: string, path: string) {
    this.uidToPath.get(uid)?.delete(path);
    const data = this.docs.get(path);
    if (!data) return;

    data.uids.delete(uid);
    if (data.uids.size === 0) {
      data.doc.destroy();
      this.docs.delete(path);
    }
  }

  handleEvent(event: FSExtEvent) {
    if (this.busy) return;
    this.cache[this.cache.isProcessing ? 'buffer' : 'events'].push(event);
    this.busy = this.burstProtection(this.cache);
    this.process();
  }
  burstProtection(cache: EventCache) {
    const threshold = parseInt(process.env.EVENT_QUEUE_SIZE || '100');
    if (cache.events.length >= threshold || cache.buffer.length >= threshold) {
      const paths = new Set<string>();
      const uids = new Set<string>();
      let events: FSExtEvent[];
      if (cache.events.length >= threshold) events = cache.events;
      else events = cache.buffer;
      for (const event of events) {
        paths.add(event.watchedPath);
        event.uids.forEach((uid) => uids.add(uid));
      }
      const blockedPath = this.commonParent(Array.from(paths));
      for (const uid of uids) {
        this.redis.emit<any, SocketMessage<FSBlock>>('socket.send', {
          uid,
          type: SocketMessageType.FILESYSTEM,
          data: { action: 'block', path: blockedPath },
        });
      }
      return { uids: Array.from(uids), path: blockedPath };
    }
    return null;
  }
  _process() {
    if (this.busy) {
      for (const uid of this.busy.uids) {
        this.redis.emit<any, SocketMessage<FSResume>>('socket.send', {
          uid,
          type: SocketMessageType.FILESYSTEM,
          data: { action: 'resume', path: this.busy.path },
        });
      }
      this.busy = null;
      return;
    }
    this.cache.isProcessing = true;
    this.sync(this.cache.events);
    this.cache.events = this.cache.buffer;
    this.cache.buffer = [];
    this.cache.isProcessing = false;
  }
  sync(events: FSExtEvent[]) {
    const uidEvents = new Map<string, FSEvent[]>();
    for (const event of events) {
      for (const uid of event.uids) {
        if (!uidEvents.has(uid)) uidEvents.set(uid, []);
        this.cleanPaths(event);
        uidEvents.get(uid)?.push({
          action: event.action,
          path: event.path,
          timestamp: event.timestamp,
          watchedPath: event.watchedPath,
          ino: event.ino,
          oldPath: event.oldPath,
          type: event.type,
        });
      }
    }
    for (const uid of uidEvents.keys()) {
      this.redis.emit<any, SocketMessage<FSEventBatch>>('socket.send', {
        uid,
        type: SocketMessageType.FILESYSTEM,
        data: { action: 'batch', events: uidEvents.get(uid) || [] },
      });
    }
  }
  cleanPaths(event: FSExtEvent) {
    event.path = event.path.replace(this.root, '');
    if (event.path === '') event.path = '/';
    event.watchedPath = event.watchedPath.replace(this.root, '');
    if (event.watchedPath === '') event.watchedPath = '/';
    if (event.oldPath) {
      event.oldPath = event.oldPath.replace(this.root, '');
      if (event.oldPath === '') event.oldPath = '/';
    }
  }
  commonParent(paths: string[]) {
    const splitPaths = paths.map((p) => resolve(p).split(sep));

    const common: string[] = [];
    for (let i = 0; ; i++) {
      const segment = splitPaths[0][i];
      if (segment === undefined) break;

      if (splitPaths.every((parts) => parts[i] === segment)) {
        common.push(segment);
      } else {
        break;
      }
    }

    return sep + join(...common);
  }

  async getDoc(uid: string, path: string) {
    path = this.root + path;
    if (!this.docs.has(path)) {
      const doc = new Doc();
      const yText = doc.getText('monaco');
      const text = await fs.readFile(resolve(this.root, path), 'utf-8');
      yText.insert(0, text);
      this.docs.set(path, { doc, uids: new Set([uid]) });
    }
    return this.docs.get(path)!.doc;
  }
  handleFSUpdate(msg: Message<FSDocUpdateEvent>) {
    const data = this.docs.get(msg.payload.path);
    if (!data) return;
    applyUpdate(data.doc, new Uint8Array(JSON.parse(msg.payload.update) as ArrayBufferLike), msg.meta.uid);
  }
}

type EventCache = {
  events: Array<FSExtEvent>;
  buffer: Array<FSExtEvent>;
  isProcessing: boolean;
  timer?: NodeJS.Timeout;
};
