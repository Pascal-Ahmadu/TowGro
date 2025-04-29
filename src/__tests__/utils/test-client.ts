import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../app.module';

export class TestClient {
  app: INestApplication;
  module: TestingModule;

  async setup() {
    this.module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = this.module.createNestApplication();
    await this.app.init();
  }

  async teardown() {
    await this.app.close();
  }
}
