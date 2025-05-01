import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { promises as fs } from 'node:fs';
import path, { join } from 'node:path';
import { FSExtEvent, FSBlock, FSResume, FSEventBatch, FSEvent } from 'src/common/message';
import { SocketMessage, SocketMessageType } from 'src/common/message/socket.message';
import { debounce } from 'src/utils';

@Injectable()
export class FSService {
  constructor(@Inject('FILESYSTEM_SERVICE_REDIS') private redis: ClientProxy) {}

  root = '/home/devuser/workspace';
  cache: EventCache = { events: [], buffer: [], isProcessing: false };
  debounceTime = 250;
  busy: { uids: string[]; path: string } | null = null;
  process = debounce(() => this._process(), this.debounceTime);

  async open(uid: string, path: string) {
    path = this.root + path;

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
  close(uid: string, path: string) {
    path = this.root + path;
    this.redis.emit('remove-watch', { uid, path });
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
        uidEvents.get(uid)?.push({
          action: event.action,
          path: event.path,
          timestamp: event.timestamp,
          watchedPath: event.watchedPath,
          ino: event.ino,
          oldPath: event.oldPath,
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
  commonParent(paths: string[]) {
    const splitPaths = paths.map((p) => path.resolve(p).split(path.sep));

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

    return path.sep + path.join(...common);
  }
}

type EventCache = {
  events: Array<FSExtEvent>;
  buffer: Array<FSExtEvent>;
  isProcessing: boolean;
  timer?: NodeJS.Timeout;
};
