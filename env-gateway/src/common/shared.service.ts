import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisRef } from './refs/redis.ref';

@Injectable()
export class SharedService implements OnModuleInit {
  redisPub: Redis;
  redisSub: Redis;

  constructor() {}

  onModuleInit() {
    [this.redisPub, this.redisSub] = RedisRef.get();
  }
}
