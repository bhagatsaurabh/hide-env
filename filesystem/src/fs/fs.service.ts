import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FSWatcher, watch } from 'chokidar';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

@Injectable()
export class FSService {
  constructor(
    @Inject('FILESYSTEM_SERVICE_REDIS') private redis: ClientProxy,
    @Inject('FILESYSTEM_SERVICE_RMQ') private rmq: ClientProxy,
  ) {}

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
    newWatcher.on('add', (wPath: string) => {
      this.rmq.emit('fs:sync', { uid, path: wPath, action: 'add' });
    });
    newWatcher.on('addDir', (wPath: string) => {
      this.rmq.emit('fs:sync', { uid, path: wPath, action: 'addDir' });
    });
    newWatcher.on('unlink', (wPath: string) => {
      this.rmq.emit('fs:sync', { uid, path: wPath, action: 'unlink' });
    });
    newWatcher.on('unlinkDir', (wPath: string) => {
      this.rmq.emit('fs:sync', { uid, path: wPath, action: 'unlinkDir' });
    });
    newWatcher.on('change', (wPath: string) => {
      this.rmq.emit('fs:sync', { uid, path: wPath, action: 'change' });
    });
  }
}
