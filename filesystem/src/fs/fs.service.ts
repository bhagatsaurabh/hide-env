import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FSWatcher, watch } from 'chokidar';
import { promises as fs, Stats } from 'node:fs';
import { join } from 'node:path';
import { FSEventType, FSEvent, FSRefinedEvent } from 'src/common/message';
import { SocketMessage, SocketMessageType } from 'src/common/message/socket.message';
import { debounce } from 'src/utils';

@Injectable()
export class FSService {
  constructor(@Inject('FILESYSTEM_SERVICE_REDIS') private redis: ClientProxy) {}

  root = '/home/devuser/workspace';
  cache: EventCacheMap = new Map();
  debounceTime = 150;
  process = debounce((uid: string, cache: EventCache) => this._process(uid, cache), this.debounceTime);

  async open(uid: string, path: string) {
    path = this.root + path;
    if (!this.cache.has(uid)) {
      this.cache.set(uid, { events: [], buffer: [], isProcessing: false, watchers: new Map() });
    }
    this.addWatch(uid, path);

    try {
      const entries = await fs.readdir(path, { withFileTypes: true });
      return entries.map((entry) => ({
        name: entry.name,
        path: join(path, entry.name),
        type: entry.isDirectory() ? 'dir' : 'file',
      }));
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Failed to read directory');
    }
  }
  async close(uid: string, path: string) {
    path = this.root + path;
    const watcher = this.cache.get(uid)?.watchers.get(path);
    if (!watcher) return;
    await watcher.close();
  }

  addWatch(uid: string, path: string) {
    const cache = this.cache.get(uid);
    if (!cache || cache.watchers.has(path)) return;
    const newWatcher = watch(path, {
      depth: 0,
      ignoreInitial: true,
      alwaysStat: true,
    });
    cache.watchers.set(path, newWatcher);

    newWatcher.on('error', (err) => {
      console.log(err);
    });
    newWatcher.on('add', (wPath: string, stats?: Stats) => this.handleEvent(uid, wPath, 'add', stats));
    newWatcher.on('addDir', (wPath: string, stats?: Stats) => this.handleEvent(uid, wPath, 'addDir', stats));
    newWatcher.on('change', (wPath: string, stats?: Stats) => this.handleEvent(uid, wPath, 'change', stats));
    newWatcher.on('unlink', (wPath: string, stats?: Stats) => this.handleEvent(uid, wPath, 'unlink', stats));
    newWatcher.on('unlinkDir', (wPath: string, stats?: Stats) =>
      this.handleEvent(uid, wPath, 'unlinkDir', stats),
    );
  }
  handleEvent(uid: string, path: string, type: FSEventType, stats?: Stats) {
    console.log(path, type, stats);
    const cache = this.cache.get(uid);
    if (!cache) return;

    if (cache.isProcessing) {
      cache.buffer.push({ type, stats, path, ts: performance.now() });
    } else {
      cache.events.push({ type, stats, path, ts: performance.now() });
    }
    this.process(uid, cache);
  }
  _process(uid: string, cache: EventCache) {
    cache.isProcessing = true;
    const refinedEvents = this.refineEvents(cache.events);
    this.sync(uid, refinedEvents);
    cache.events = cache.buffer;
    cache.buffer = [];
    cache.isProcessing = false;
  }
  refineEvents(events: FSEvent[]) {
    void events;
    const refinedEvents = [];

    // TODO

    return refinedEvents;
  }
  sync(uid: string, events: FSRefinedEvent[]) {
    this.redis.emit<any, SocketMessage<FSRefinedEvent[]>>('socket.send', {
      uid,
      type: SocketMessageType.FILESYSTEM,
      data: events,
    });
  }
}

type EventCacheMap = Map<string, EventCache>;
type EventCache = {
  events: Array<FSEvent>;
  buffer: Array<FSEvent>;
  isProcessing: boolean;
  watchers: Map<string, FSWatcher>;
  timer?: NodeJS.Timeout;
};
