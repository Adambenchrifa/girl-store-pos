import { Request, Response } from "express";
import { hashPassword, verifyPassword } from "../utils/crypto";
import { User } from "../types";
import { AppError, asyncHandler } from "../middleware/error";
import { checkRequiredFields } from "../utils/validation";
import { LoggerService } from "../services/LoggerService";
import {
  needsSetup,
  clearAdminPassword,
  setupAdminPassword,
  getUserByUsername,
  getAllUsers,
  getAdminCount,
  createUser,
  updateUser,
  deleteUser,
  resetDatabase
} from "../database";

/**
 * Common security helper to verify the provided admin password against any active Admin operator account.
 */
function verifyAdminAuthority(adminPassword?: string): void {
  if (!adminPassword || adminPassword.trim() === "") {
    throw new AppError("Administrator password confirmation is required / مطلوب تأكيد كلمة مرور المشرف", 400);
  }

  const users = getAllUsers();
  let isAuthorized = false;

  for (const u of users) {
    if (u.role === "Admin") {
      const acc = getUserByUsername(u.username);
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

export const getNeedsSetup = asyncHandler(async (req: Request, res: Response) => {
  res.json({ needsSetup: needsSetup() });
});

export const postResetPassword = asyncHandler(async (req: Request, res: Response) => {
  clearAdminPassword();
  res.json({
    success: true,
    message: "Admin password has been cleared. You can now configure a new password / تم مسح كلمة مرور المشرف. يمكنك الآن تعيين كلمة مرور جديدة"
  });
});

export const postSetupAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { password } = req.body;
  checkRequiredFields(req.body, ["password"]);

  setupAdminPassword(hashPassword(password));
  res.json({
    success: true,
    message: "First administrator password configured successfully / تم إعداد كلمة مرور المشرف الأول بنجاح"
  });
});

export const postLogin = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;
  checkRequiredFields(req.body, ["username", "password"]);

  const lowerUsername = username.toLowerCase().trim();

  if (lowerUsername === "admin" && needsSetup()) {
    LoggerService.logLogin(lowerUsername, false, req.ip, "Admin setup required");
    throw new AppError("First Administrator password needs configuration / يجب إعداد كلمة مرور المشرف الأول أولاً", 400);
  }

  const account = getUserByUsername(lowerUsername);
  if (!account) {
    LoggerService.logLogin(lowerUsername, false, req.ip, "User not found in system database");
    throw new AppError("Invalid username or password / اسم المستخدم أو كلمة المرور غير صالحة", 401);
  }

  if (!verifyPassword(password, account.passwordHash)) {
    LoggerService.logLogin(lowerUsername, false, req.ip, "Incorrect password attempt");
    throw new AppError("Invalid username or password / اسم المستخدم أو كلمة المرور غير صالحة", 401);
  }

  LoggerService.logLogin(lowerUsername, true, req.ip);
  res.json({ status: "success", user: account.user });
});


export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  res.json(getAllUsers());
});

export const postCreateUser = asyncHandler(async (req: Request, res: Response) => {
  const { username, password, role, name, adminPassword } = req.body;
  checkRequiredFields(req.body, ["username", "password", "role", "name", "adminPassword"]);

  // Authorize using the common verification helper
  verifyAdminAuthority(adminPassword);

  const lowerUsername = username.toLowerCase().trim();
  if (getUserByUsername(lowerUsername)) {
    throw new AppError("Username already assigned to another active register operator account / اسم المستخدم مستخدم بالفعل لحساب آخر", 400);
  }

  const newUser: User = {
    id: `user-${Date.now()}`,
    username: lowerUsername,
    role: role === "Admin" ? "Admin" : "Staff",
    name: name.trim()
  };

  createUser(newUser, hashPassword(password));
  res.json({ success: true, user: newUser });
});

export const putUpdateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { username, password, role, name, adminPassword } = req.body;
  
  verifyAdminAuthority(adminPassword);

  const users = getAllUsers();
  const currentUser = users.find(u => u.id === id);
  if (!currentUser) {
    throw new AppError("Operator not found in registry file / لم يتم العثور على الموظف في السجل", 404);
  }

  const oldUsername = currentUser.username.toLowerCase();
  const newUsername = username ? username.toLowerCase().trim() : oldUsername;

  if (newUsername !== oldUsername && getUserByUsername(newUsername)) {
    throw new AppError("Username already in use by another operator / اسم المستخدم مستخدم بالفعل من قبل موظف آخر", 400);
  }

  if (currentUser.role === "Admin" && role && role !== "Admin") {
    const adminCount = getAdminCount();
    if (adminCount <= 1) {
      throw new AppError("Cannot downgrade the last remaining Administrator account / لا يمكن تنزيل رتبة حساب المشرف الوحيد المتبقي", 400);
    }
  }

  const newHash = password ? hashPassword(password) : undefined;
  updateUser(id, name ? name.trim() : currentUser.name, role, newUsername, newHash);

  const updatedUsers = getAllUsers();
  const updatedUser = updatedUsers.find(u => u.id === id);
  res.json({ success: true, user: updatedUser });
});

export const deleteUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { adminPassword } = req.body;

  verifyAdminAuthority(adminPassword);

  const users = getAllUsers();
  const targetUser = users.find(u => u.id === id);
  if (!targetUser) {
    throw new AppError("Operator not found in store files / لم يتم العثور على الموظف", 404);
  }

  if (targetUser.role === "Admin") {
    const adminCount = getAdminCount();
    if (adminCount <= 1) {
      throw new AppError("Cannot delete the sole Administrator account / لا يمكن حذف حساب المشرف الوحيد المتبقي", 400);
    }
  }

  deleteUser(id);
  LoggerService.warn("auth", `User operator registration ID '${id}' ('${targetUser.name}') was deleted by administrator`);
  res.json({ success: true, message: "Operator unregistered successfully / تم إلغاء تسجيل الموظف بنجاح" });
});

export const postResetDatabase = asyncHandler(async (req: Request, res: Response) => {
  const { adminPassword } = req.body;

  verifyAdminAuthority(adminPassword);

  resetDatabase();
  LoggerService.warn("database", "CRITICAL ACTION: Database has been reset/formatted by administrator! All transactions and catalogs cleared.");
  res.json({
    success: true,
    message: "Le point de vente a été formaté avec succès. Tous les articles, ventes, et dépenses ont été effacés."
  });
});
