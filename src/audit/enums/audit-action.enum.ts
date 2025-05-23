export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  REGISTER = 'REGISTER',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  EMAIL_CHANGE = 'EMAIL_CHANGE',
  PHONE_CHANGE = 'PHONE_CHANGE',
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  PAYMENT_PROCESS = 'PAYMENT_PROCESS',
  API_ACCESS = 'API_ACCESS',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  ROLE_CHANGE = 'ROLE_CHANGE',
  ACCOUNT_LOCK = 'ACCOUNT_LOCK',
  ACCOUNT_UNLOCK = 'ACCOUNT_UNLOCK',
  MFA_ENABLE = 'MFA_ENABLE',
  MFA_DISABLE = 'MFA_DISABLE',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  FAILED_LOGIN = 'FAILED_LOGIN',
  PAYMENT = 'PAYMENT',
  DISPATCH = 'DISPATCH',
}
