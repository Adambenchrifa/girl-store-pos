import multer from "multer";
import path from "path";
import { UPLOAD_DIR } from "../config/app";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
});

export const upload = multer({ storage });
export const uploadSingleImage = upload.single("image");
