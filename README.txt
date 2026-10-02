Fitness & Sports PDF Website

Requires Node.js 18+ and persistent disk storage.

1. Run npm install
2. Set ADMIN_PASSWORD (12+ characters), MEMBER_PASSWORD (12+ characters), SESSION_SECRET (32+ random characters). Use different admin and member passwords.
3. Run npm start
4. Open http://localhost:3000, log in with ADMIN_PASSWORD, upload PDFs.
5. Deploy this entire folder on a Node.js host with persistent storage for private-pdfs and HTTPS. Share the HTTPS website link and MEMBER_PASSWORD with members. Do not deploy index.html alone or expose private-pdfs as static files.

Changing MEMBER_PASSWORD in the host environment changes future logins. Existing sessions last up to 8 hours; change SESSION_SECRET to invalidate them immediately. Back up private-pdfs regularly. The host must retain that folder after restart and deployment.

"පන්ති ගැනීම" is a separate class PDF section. Admin uploads PDFs in that section; members use the same MEMBER_PASSWORD to view them. Preserve both private-pdfs and private-class-pdfs on your host when deploying updates.
