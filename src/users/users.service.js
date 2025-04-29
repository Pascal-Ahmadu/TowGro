"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var UsersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("./user.entity");
const bcrypt = require("bcrypt");
let UsersService = UsersService_1 = class UsersService {
    constructor(userRepository) {
        this.userRepository = userRepository;
        this.SALT_ROUNDS = 10;
        this.logger = new common_1.Logger(UsersService_1.name);
    }
    findByEmailOrPhoneNumber(identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.log(`Searching user by identifier: , ${identifier}`);
            return this.userRepository
                .createQueryBuilder('user')
                .where('user.email = :identifier', { identifier: identifier.toLowerCase() })
                .orWhere('user.phoneNumber = :identifier', { identifier: identifier.replace(/\D/g, '') })
                .andWhere('user.isActive = true')
                .cache(true)
                .getOne();
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.log(`Searching user by ID: ${id}`);
            const user = yield this.userRepository
                .createQueryBuilder('user')
                .where('user.id = :id', { id })
                .andWhere('user.isActive = true')
                .cache(true)
                .getOne();
            if (!user) {
                this.logger.warn(`User with ID ${id} not found`);
                throw new common_1.NotFoundException(`User with ID ${id} not found`);
            }
            return user;
        });
    }
    createUser(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            let { email, phoneNumber, password } = dto;
            if (!email && !phoneNumber) {
                throw new common_1.ConflictException('Email or phone number must be provided');
            }
            // normalize
            if (email)
                email = email.toLowerCase().trim();
            if (phoneNumber)
                phoneNumber = phoneNumber.replace(/\D/g, '');
            const exists = yield this.findByEmailOrPhoneNumber(email !== null && email !== void 0 ? email : phoneNumber);
            if (exists) {
                this.logger.warn(`Duplicate registration attempt: ${email !== null && email !== void 0 ? email : phoneNumber}`);
                throw new common_1.ConflictException('Email or phone number already in use');
            }
            const hashed = yield bcrypt.hash(password, this.SALT_ROUNDS);
            const user = this.userRepository.create({
                email,
                phoneNumber,
                password: hashed,
            });
            try {
                this.logger.log(`Creating user: ${email !== null && email !== void 0 ? email : phoneNumber}`);
                return yield this.userRepository.save(user);
            }
            catch (error) {
                this.handleDatabaseError(error);
            }
        });
    }
    updateUser(id, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.findById(id);
            if (updateData.password) {
                updateData.password = yield bcrypt.hash(updateData.password, this.SALT_ROUNDS);
            }
            if (updateData.email) {
                updateData.email = updateData.email.toLowerCase().trim();
            }
            if (updateData.phoneNumber) {
                updateData.phoneNumber = updateData.phoneNumber.replace(/\D/g, '');
            }
            try {
                this.logger.log(`Updating user:${id}`);
                yield this.userRepository.update(id, updateData);
                return yield this.findById(id);
            }
            catch (err) {
                this.handleDatabaseError(err);
            }
        });
    }
    deleteUser(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.findById(id);
            user.isActive = false;
            this.logger.log(`soft deleting user: ${id}`);
            yield this.userRepository.save(user);
        });
    }
    handleDatabaseError(error) {
        if (error.code === '23505') {
            this.logger.error('Duplicate entry', error.stack);
            throw new common_1.ConflictException('Duplicate entry found');
        }
        this.logger.error('Db operation failed', error.stack);
        throw new common_1.InternalServerErrorException('Db operation failed, please try again later or contact support for help');
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UsersService);
