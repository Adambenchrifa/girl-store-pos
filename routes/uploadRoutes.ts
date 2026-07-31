import { Router } from "express";
import { uploadSingleImage } from "../middleware/upload";

const router = Router();

router.post("/", uploadSingleImage, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const relativePath = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    imagePath: relativePath,
    imageUrl: relativePath
  });
});

export default router;
