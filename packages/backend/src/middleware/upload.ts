import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { CustomError } from './errorHandler';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req: any, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadsDir);
  },
  filename: (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter for images only
const fileFilter = (req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile?: boolean) => void) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new CustomError('Only image files are allowed (JPEG, PNG, GIF, WebP)', 400));
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Avatar upload middleware
export const uploadAvatar = upload.single('avatar');
