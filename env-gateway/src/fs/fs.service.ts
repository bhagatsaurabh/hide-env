import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { FSRefinedEvent, FSExtEvent } from 'src/common/message';
import { SocketMessage, SocketMessageType } from 'src/common/message/socket.message';
import { debounce } from 'src/utils';

@Injectable()
export class FSService {
  constructor(@Inject('FILESYSTEM_SERVICE_REDIS') private redis: ClientProxy) {}

  root = '/home/devuser/workspace';
  cache: EventCache = { events: [], buffer: [], isProcessing: false };
  debounceTime = 250;
  busy = false;
  process = debounce(() => this._process(), this.debounceTime);

  async open(uid: string, path: string) {
    path = this.root + path;

    this.redis.emit('add-watch', { uid, path });

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
  }

  handleEvent(event: FSExtEvent) {
    if (this.busy) return;
    this.cache[this.cache.isProcessing ? 'buffer' : 'events'].push(event);
    this.busy = this.burstProtection(this.cache);
    this.process();
  }
  burstProtection(cache: EventCache) {
    if (
      cache.events.length >= parseInt(process.env.EVENT_QUEUE_SIZE || '100') ||
      cache.buffer.length >= parseInt(process.env.EVENT_QUEUE_SIZE || '100')
    ) {
      // Signal frontend to halt live sync and block interaction with explorer (explorer collapses all ?)
      return true;
    }
    return false;
  }
  _process() {
    if (this.busy) {
      // Signal frontend to resume live sync and allow interaction with explorer
      // Maybe this can be implemented on the folder level, based on number of events threshold per watched path
      // Only those users will see the explorer (or folder) blocked who are watching paths with overloaded events)
      return;
    }
    this.cache.isProcessing = true;
    this.sync(this.cache.events);
    this.cache.events = this.cache.buffer;
    this.cache.buffer = [];
    this.cache.isProcessing = false;
  }
  sync(events: FSExtEvent[]) {
    const uidEvents = new Map<string, FSRefinedEvent[]>();
    for (const event of events) {
      for (const uid of event.uids) {
        if (!uidEvents.has(uid)) uidEvents.set(uid, []);
        uidEvents.get(uid)?.push({ path: event.path, action: event.action, data: event.name });
      }
    }
    for (const uid in uidEvents) {
      this.redis.emit<any, SocketMessage<FSRefinedEvent[]>>('socket.send', {
        uid,
        type: SocketMessageType.FILESYSTEM,
        data: uidEvents.get(uid) || [],
      });
    }
  }
}

type EventCache = {
  events: Array<FSExtEvent>;
  buffer: Array<FSExtEvent>;
  isProcessing: boolean;
  timer?: NodeJS.Timeout;
};
