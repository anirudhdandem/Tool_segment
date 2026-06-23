import { Router } from "express";
import { signup, verify, login, twofa, forgot, reset, me } from "./controller";
import { requireAuth } from "./middleware";

const router = Router();

router.post("/signup", signup);   // create account → emails verify code
router.post("/verify", verify);   // confirm verify code → session
router.post("/login", login);     // password check → emails 2FA code
router.post("/2fa", twofa);       // confirm 2FA code → session
router.post("/forgot", forgot);   // emails reset code
router.post("/reset", reset);     // confirm reset code + new password → session
router.get("/me", requireAuth, me);

export default router;
