import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error";
import {
  checkNeedsSetup,
  resetAdminPassword,
  setupAdminPassword,
  loginUser,
  getAllUserAccounts,
  createUserAccount,
  updateUserAccount,
  deleteUserAccount,
  resetStoreDatabase
} from "../services/authService";

export const getNeedsSetup = asyncHandler(async (req: Request, res: Response) => {
  res.json({ needsSetup: checkNeedsSetup() });
});

export const postResetPassword = asyncHandler(async (req: Request, res: Response) => {
  resetAdminPassword();
  res.json({
    success: true,
    message: "Admin password has been cleared. You can now configure a new password / تم مسح كلمة مرور المشرف. يمكنك الآن تعيين كلمة مرور جديدة"
  });
});

export const postSetupAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { password } = req.body;
  setupAdminPassword(password);
  res.json({
    success: true,
    message: "First administrator password configured successfully / تم إعداد كلمة مرور المشرف الأول بنجاح"
  });
});

export const postLogin = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const result = loginUser(username, password, req.ip);
  res.json({ status: "success", user: result.user });
});

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  res.json(getAllUserAccounts());
});

export const postCreateUser = asyncHandler(async (req: Request, res: Response) => {
  const newUser = createUserAccount(req.body);
  res.json({ success: true, user: newUser });
});

export const putUpdateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedUser = updateUserAccount({ ...req.body, id });
  res.json({ success: true, user: updatedUser });
});

export const deleteUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { adminPassword } = req.body;
  deleteUserAccount(id, adminPassword);
  res.json({ success: true, message: "Operator unregistered successfully / تم إلغاء تسجيل الموظف بنجاح" });
});

export const postResetDatabase = asyncHandler(async (req: Request, res: Response) => {
  const { adminPassword } = req.body;
  resetStoreDatabase(adminPassword);
  res.json({
    success: true,
    message: "Le point de vente a été formaté avec succès. Tous les articles, ventes, et dépenses ont été effacés."
  });
});
