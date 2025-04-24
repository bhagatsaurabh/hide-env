import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FSWatcher, watch } from 'chokidar';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { FSSync, FSSyncActions } from 'src/common/message';
import { SocketMessage, SocketMessageType } from 'src/common/message/socket.message';

@Injectable()
export class FSService {
  constructor(@Inject('FILESYSTEM_SERVICE_REDIS') private redis: ClientProxy) {}

  root = '/home/devuser/workspace';
  watchers: Map<string, Map<string, FSWatcher>> = new Map();

  async open(uid: string, path: string) {
    path = this.root + path;
    if (!this.watchers.has(uid)) {
      this.watchers.set(uid, new Map());
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
    const watcher = this.watchers.get(uid)?.get(path);
    if (!watcher) return;
    await watcher.close();
  }

  addWatch(uid: string, path: string) {
    const watchers = this.watchers.get(uid);
    if (!watchers || watchers.has(path)) return;
    const newWatcher = watch(path, { depth: 1, ignoreInitial: true });
    watchers.set(path, newWatcher);

    newWatcher.on('error', (err) => {
      console.log(err);
    });
    newWatcher.on('add', (wPath: string) => this.sync(uid, wPath, 'add'));
    newWatcher.on('addDir', (wPath: string) => this.sync(uid, wPath, 'addDir'));
    newWatcher.on('unlink', (wPath: string) => this.sync(uid, wPath, 'unlink'));
    newWatcher.on('unlinkDir', (wPath: string) => this.sync(uid, wPath, 'unlinkDir'));
    newWatcher.on('change', (wPath: string) => this.sync(uid, wPath, 'change'));
  }

  sync(uid: string, path: string, action: FSSyncActions) {
    const observable = this.redis.emit<any, SocketMessage<FSSync>>('socket.send', {
      uid,
      type: SocketMessageType.FILESYSTEM,
      data: { uid, path, action },
    });
    observable.subscribe({ complete: () => console.log('sent fssync via Redis') });
  }
}
