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
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersController = void 0;
const common_1 = require("@nestjs/common");
const users_service_1 = require("./users.service");
const create_user_dto_1 = require("./dto/create-user.dto");
const update_user_dto_1 = require("./dto/update-user.dto");
const swagger_1 = require("@nestjs/swagger");
const user_response_dto_1 = require("./dto/user-response.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");

let usersController = class usersController {
    constructor(usersService) {
        this.usersService = usersService;
    }
    create(dto) {
        return this.usersService.createUser(dto);
    }
    findOne(id) {
        return this.usersService.findById(id);
    }
    update(id, dto) {
        return this.usersService.updateUser(id, dto);
    }
    remove(id) {
        return this.usersService.deleteUser(id);
    }
};
exports.usersController = usersController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new user', description: 'Creates a new user with the provided details' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'User successfully created', type: user_response_dto_1.UserResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request - validation error' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Conflict - email or phone number already in use' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_user_dto_1.CreateUserDto]),
    __metadata("design:returntype", void 0)
], usersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get user by ID', description: 'Retrieves user details by their unique identifier' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User found', type: user_response_dto_1.UserResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'User ID', example: '123e4567-e89b-12d3-a456-426614174000' }),
    (0, swagger_1.ApiSecurity)('bearer'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JWTAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], usersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Update user', description: 'Updates user information with the provided data' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User successfully updated', type: user_response_dto_1.UserResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request - validation error' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'User ID', example: '123e4567-e89b-12d3-a456-426614174000' }),
    (0, swagger_1.ApiSecurity)('bearer'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JWTAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_user_dto_1.UpdateUserDto]),
    __metadata("design:returntype", void 0)
], usersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete user', description: 'Soft deletes a user by setting isActive to false' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User successfully deleted' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'User ID', example: '123e4567-e89b-12d3-a456-426614174000' }),
    (0, swagger_1.ApiSecurity)('bearer'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JWTAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], usersController.prototype, "remove", null);
exports.usersController = usersController = __decorate([
    (0, common_1.Controller)("users"),
    (0, swagger_1.ApiTags)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], usersController);
