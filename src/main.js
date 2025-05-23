"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/main.ts
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");

function bootstrap() {
    return __awaiter(this, void 0, void 0, function* () {
        const app = yield core_1.NestFactory.create(app_module_1.AppModule);
        app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
        
        // Setup Swagger documentation
        const config = new swagger_1.DocumentBuilder()
            .setTitle('Auth Service API')
            .setDescription('Authentication and user management service API documentation')
            .setVersion('1.0')
            .addTag('general', 'General endpoints')
            .addTag('auth', 'Authentication endpoints')
            .addTag('users', 'User management endpoints')
            .addBearerAuth(
                { 
                    type: 'http', 
                    scheme: 'bearer', 
                    bearerFormat: 'JWT',
                    description: 'Enter JWT token'
                },
                'bearer'
            )
            .build();
        
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
        
        yield app.listen(process.env.PORT || 3000);
        console.log(`Application is running on: ${yield app.getUrl()}`);
        console.log(`Swagger documentation available at: ${yield app.getUrl()}/api/docs`);
    });
}
bootstrap();
