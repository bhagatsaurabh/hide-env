import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { FSEvent, FSRefinedEvent, FSExtEvent } from 'src/common/message';
import { SocketMessage, SocketMessageType } from 'src/common/message/socket.message';
import { debounce } from 'src/utils';

@Injectable()
export class FSService {
  constructor(@Inject('FILESYSTEM_SERVICE_REDIS') private redis: ClientProxy) {}

  root = '/home/devuser/workspace';
  cache: EventCacheMap = new Map();
  debounceTime = 300;
  process = debounce((uid: string, cache: EventCache) => this._process(uid, cache), this.debounceTime);

  async open(uid: string, path: string) {
    path = this.root + path;
    if (!this.cache.has(uid)) {
      this.cache.set(uid, { events: [], buffer: [], isProcessing: false });
    }

    this.redis.emit('add-watch', { uid, path });
    console.log('Sent add-watch ', { uid, path });

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
  close(uid: string, path: string) {
    path = this.root + path;
    this.redis.emit('remove-watch', { uid, path });
    console.log('Sent remove-watch ', { uid, path });
  }

  handleEvent(event: FSExtEvent) {
    console.log(event);
    for (const uid of event.uids) {
      const cache = this.cache.get(uid);
      if (!cache) return;

      /* if (cache.isProcessing) {
        cache.buffer.push({ type, stats, path, ts: performance.now() });
      } else {
        cache.events.push({ type, stats, path, ts: performance.now() });
      } */
      this.process(uid, cache);
    }
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
  timer?: NodeJS.Timeout;
};
