import { Router } from "express";
import {
  getNeedsSetup,
  postResetPassword,
  postSetupAdmin,
  postLogin,
  getUsers,
  postCreateUser,
  putUpdateUser,
  deleteUserById,
  postResetDatabase
} from "../controllers/authController";

const router = Router();

router.get("/needs-setup", getNeedsSetup);
router.post("/reset", postResetPassword);
router.post("/setup", postSetupAdmin);
router.post("/login", postLogin);
router.get("/users", getUsers);
router.post("/users", postCreateUser);
router.put("/users/:id", putUpdateUser);
router.delete("/users/:id", deleteUserById);
router.post("/reset-database", postResetDatabase);

export default router;
