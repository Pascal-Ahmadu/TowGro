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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const users_service_1 = require("../users/users.service");
const bcrypt = require("bcrypt");
const uuid_1 = require("uuid");
const ioredis_1 = require("ioredis");
let AuthService = AuthService_1 = class AuthService {
    constructor(usersService, jwtService, config, redisCLiient) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.config = config;
        this.logger = new common_1.Logger(AuthService_1.name);
        this.redis = redisCLiient;
    }
    validateUser(identifier, pass) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.usersService.findByEmailOrPhoneNumber(identifier);
            if (user && (yield bcrypt.compare(pass, user.password))) {
                const { password } = user, u = __rest(user, ["password"]);
                return u;
            }
            return null;
        });
    }
    login(user) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = { sub: user.id };
            const accessToken = yield this.jwtService.signAsync(payload, {
                expiresIn: this.config.get('JWT_ACCESS_EXPIRES'),
            });
            const refreshToken = (0, uuid_1.v4)();
            yield this.redis.set(`refresh_token:${user.id}`, refreshToken, 'EX', this.config.get('JWT_REFRESH_EXPIRES_SEC'));
            return { accessToken, refreshToken };
        });
    }
    logout(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.redis.del(`refresh_token:${userId}`);
        });
    }
    validateOAuthLogin(email) {
        return __awaiter(this, void 0, void 0, function* () {
            let user = yield this.usersService.findByEmailOrPhoneNumber(email);
            if (!user) {
                //auto-generate a password for OAuth users.
                const randomPass = (0, uuid_1.v4)();
                user = yield this.usersService.createUser({
                    email,
                    phoneNumber: null,
                    password: randomPass
                });
                this.logger.log(`Created new OAuth user: ${email}`);
            }
            const { password } = user, u = __rest(user, ["password"]);
            return u;
        });
    }
    refreshToken(userId, refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const storedToken = yield this.redis.get(`refresh_token:${userId}`);
            if (!storedToken || storedToken !== refreshToken) {
                throw new common_1.UnauthorizedException('Invalid refresh token');
            }
            const payload = { sub: userId };
            const newAccessToken = yield this.jwtService.signAsync(payload, {
                expiresIn: this.config.get('JWT_ACCESS_EXPIRES'),
            });
            const newRefreshToken = (0, uuid_1.v4)();
            yield this.redis.set(`refresh_token:${userId}`, newRefreshToken, 'EX', this.config.get('JWT_REFRESH_EXPIRES_SEC'));
            return {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            };
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService,
        config_1.ConfigService,
        ioredis_1.Redis])
], AuthService);
