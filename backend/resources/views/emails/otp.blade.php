<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
  <h2 style="color:#01696f">Password Reset OTP</h2>
  <p>Use this code to reset your password. It expires in <strong>10 minutes</strong>.</p>
  <div style="font-size:2.5rem;font-weight:700;letter-spacing:0.5rem;
              text-align:center;padding:1.5rem;background:#f3f4f6;
              border-radius:12px;margin:1.5rem 0;color:#111">
    {{ $otp }}
  </div>
  <p style="color:#6b7280;font-size:0.85rem">
    If you didn't request this, ignore this email.
  </p>
</body>
</html>