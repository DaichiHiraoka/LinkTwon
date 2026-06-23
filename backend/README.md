# Link Town Backend

Node.js + Express + MySQL backend skeleton based on the Link Town basic design document.

## Features
- User register/login
- Email verification by SMTP before user login
- Admin login
- Event participation
- Point grant
- Point exchange
- User point/history lookup
- Admin event/store/service management
- Admin stats

## Setup
1. Copy `.env.example` to `.env`
2. Create the MySQL database and tables using `schema.sql`
3. Configure SMTP values in `.env` (`MAIL_DRIVER=smtp`, `SMTP_HOST`, `SMTP_FROM`, and credentials if required)
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start server:
   ```bash
   npm run dev
   ```

## Entry point
- `src/server.js`
