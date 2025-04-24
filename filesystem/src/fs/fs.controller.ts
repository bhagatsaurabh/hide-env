import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, Transport } from '@nestjs/microservices';
import { FSCloseRequest, FSOpenRequest, Message } from 'src/common/message';
import { FSService } from './fs.service';

@Controller('api/fs')
export class FSController {
  constructor(private readonly fsService: FSService) {}

  @MessagePattern('fs:open', Transport.REDIS)
  async fsOpen(@Payload() msg: Message<FSOpenRequest>) {
    return await this.fsService.open(msg.meta.uid, msg.payload.path);
  }

  @MessagePattern('fs:close', Transport.REDIS)
  async fsClose(@Payload() msg: Message<FSCloseRequest>) {
    return await this.fsService.close(msg.meta.uid, msg.payload.path);
  }
}
