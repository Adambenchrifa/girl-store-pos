import { hashPassword, verifyPassword } from "../utils/crypto";
import { User } from "../types";
import { AppError } from "../middleware/error";
import { checkRequiredFields } from "../utils/validation";
import { LoggerService } from "./LoggerService";
import {
  needsSetup as dbNeedsSetup,
  clearAdminPassword as dbClearAdminPassword,
  setupAdminPassword as dbSetupAdminPassword,
  getUserByUsername as dbGetUserByUsername,
  getAllUsers as dbGetAllUsers,
  getAdminCount as dbGetAdminCount,
  createUser as dbCreateUser,
  updateUser as dbUpdateUser,
  deleteUser as dbDeleteUser,
  resetDatabase as dbResetDatabase
} from "../database";

/**
 * Verifies the provided admin password against any active Admin operator account.
 */
export function verifyAdminAuthority(adminPassword?: string): void {
  if (!adminPassword || adminPassword.trim() === "") {
    throw new AppError("Administrator password confirmation is required / مطلوب تأكيد كلمة مرور المشرف", 400);
  }

  const users = dbGetAllUsers();
  let isAuthorized = false;

  for (const u of users) {
    if (u.role === "Admin") {
      const acc = dbGetUserByUsername(u.username);
      if (acc && verifyPassword(adminPassword, acc.passwordHash)) {
        isAuthorized = true;
        break;
      }
    }
  }

  if (!isAuthorized) {
    throw new AppError("Invalid administrator password. Security verification failed / كلمة مرور المشرف غير صالحة. فشل التحقق الأمني", 401);
  }
}

export function checkNeedsSetup(): boolean {
  return dbNeedsSetup();
}

export function resetAdminPassword(): void {
  dbClearAdminPassword();
}

export function setupAdminPassword(password: string): void {
  if (!password) {
    throw new AppError("Password is required / كلمة المرور مطلوبة", 400);
  }
  dbSetupAdminPassword(hashPassword(password));
}

export function loginUser(username: string, password: string, clientIp?: string): { user: User } {
  if (!username || !password) {
    throw new AppError("Username and password are required / اسم المستخدم وكلمة المرور مطلوبان", 400);
  }

  const lowerUsername = username.toLowerCase().trim();

  if (lowerUsername === "admin" && dbNeedsSetup()) {
    LoggerService.logLogin(lowerUsername, false, clientIp, "Admin setup required");
    throw new AppError("First Administrator password needs configuration / يجب إعداد كلمة مرور المشرف الأول أولاً", 400);
  }

  const account = dbGetUserByUsername(lowerUsername);
  if (!account) {
    LoggerService.logLogin(lowerUsername, false, clientIp, "User not found in system database");
    throw new AppError("Invalid username or password / اسم المستخدم أو كلمة المرور غير صالحة", 401);
  }

  if (!verifyPassword(password, account.passwordHash)) {
    LoggerService.logLogin(lowerUsername, false, clientIp, "Incorrect password attempt");
    throw new AppError("Invalid username or password / اسم المستخدم أو كلمة المرور غير صالحة", 401);
  }

  LoggerService.logLogin(lowerUsername, true, clientIp);
  return { user: account.user };
}

export function getAllUserAccounts(): User[] {
  return dbGetAllUsers();
}

export interface CreateUserData extends Record<string, unknown> {
  username: string;
  password: string;
  role: string;
  name: string;
  adminPassword?: string;
}

export function createUserAccount(data: CreateUserData): User {
  const { username, password, role, name, adminPassword } = data;
  checkRequiredFields(data, ["username", "password", "role", "name", "adminPassword"]);

  verifyAdminAuthority(adminPassword);

  const lowerUsername = username.toLowerCase().trim();
  if (dbGetUserByUsername(lowerUsername)) {
    throw new AppError("Username already assigned to another active register operator account / اسم المستخدم مستخدم بالفعل لحساب آخر", 400);
  }

  const newUser: User = {
    id: `user-${Date.now()}`,
    username: lowerUsername,
    role: role === "Admin" ? "Admin" : "Staff",
    name: name.trim()
  };

  dbCreateUser(newUser, hashPassword(password));
  return newUser;
}

export interface UpdateUserData extends Record<string, unknown> {
  id: string;
  username?: string;
  password?: string;
  role?: string;
  name?: string;
  adminPassword?: string;
}

export function updateUserAccount(data: UpdateUserData): User | undefined {
  const { id, username, password, role, name, adminPassword } = data;

  verifyAdminAuthority(adminPassword);

  const users = dbGetAllUsers();
  const currentUser = users.find(u => u.id === id);
  if (!currentUser) {
    throw new AppError("Operator not found in registry file / لم يتم العثور على الموظف في السجل", 404);
  }

  const oldUsername = currentUser.username.toLowerCase();
  const newUsername = username ? username.toLowerCase().trim() : oldUsername;

  if (newUsername !== oldUsername && dbGetUserByUsername(newUsername)) {
    throw new AppError("Username already in use by another operator / اسم المستخدم مستخدم بالفعل من قبل موظف آخر", 400);
  }

  if (currentUser.role === "Admin" && role && role !== "Admin") {
    const adminCount = dbGetAdminCount();
    if (adminCount <= 1) {
      throw new AppError("Cannot downgrade the last remaining Administrator account / لا يمكن تنزيل رتبة حساب المشرف الوحيد المتبقي", 400);
    }
  }

  const newHash = password ? hashPassword(password) : undefined;
  dbUpdateUser(id, name ? name.trim() : currentUser.name, role, newUsername, newHash);

  const updatedUsers = dbGetAllUsers();
  return updatedUsers.find(u => u.id === id);
}

export function deleteUserAccount(id: string, adminPassword?: string): void {
  verifyAdminAuthority(adminPassword);

  const users = dbGetAllUsers();
  const targetUser = users.find(u => u.id === id);
  if (!targetUser) {
    throw new AppError("Operator not found in store files / لم يتم العثور على الموظف", 404);
  }

  if (targetUser.role === "Admin") {
    const adminCount = dbGetAdminCount();
    if (adminCount <= 1) {
      throw new AppError("Cannot delete the sole Administrator account / لا يمكن حذف حساب المشرف الوحيد المتبقي", 400);
    }
  }

  dbDeleteUser(id);
  LoggerService.warn("auth", `User operator registration ID '${id}' ('${targetUser.name}') was deleted by administrator`);
}

export function resetStoreDatabase(adminPassword?: string): void {
  verifyAdminAuthority(adminPassword);

  dbResetDatabase();
  LoggerService.warn("database", "CRITICAL ACTION: Database has been reset/formatted by administrator! All transactions and catalogs cleared.");
}
