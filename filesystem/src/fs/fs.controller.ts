import { Controller } from '@nestjs/common';
import { FSService } from './fs.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FSCloseRequest, FSOpenRequest, Message } from 'src/common/message';

@Controller('api/fs')
export class FSController {
  constructor(private readonly fsService: FSService) {}

  @MessagePattern('fs:open')
  async fsOpen(@Payload() msg: Message<FSOpenRequest>) {
    return await this.fsService.open(msg.meta.uid, msg.data.path);
  }

  @MessagePattern('fs:close')
  async fsClose(@Payload() msg: Message<FSCloseRequest>) {
    return await this.fsService.close(msg.meta.uid, msg.data.path);
  }
}
