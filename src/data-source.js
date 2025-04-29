"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/data-source.ts
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const dotenv = require("dotenv");
const user_entity_1 = require("./users/user.entity");
dotenv.config();
const AppDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    entities: [user_entity_1.User],
    migrations: ['dist/migrations/*.js'],
    synchronize: false,
    migrationsRun: false,
    logging: false,
});
// 👇 Export as default
exports.default = AppDataSource;
