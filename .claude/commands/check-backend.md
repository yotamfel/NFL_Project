# Check Backend

Run the backend health check suite against the NFL project API.

## Steps

1. **Determine target.** If $ARGUMENTS contains "prod" or "production", add `--prod`. Otherwise test local (default).

2. **Set credentials.** Check if `ADMIN_USERNAME` and `ADMIN_PASSWORD` are already set in the environment. If not, read them from `server/.env` or ask the user.

3. **Run the script:**
   ```
   python scripts/check_backend.py [--prod]
   ```
   Pass `ADMIN_USERNAME` and `ADMIN_PASSWORD` as env vars so the auth/admin checks run.

4. **Report results.** Show the full output. If any checks failed, explain what the failure likely means and suggest a fix.

## Common failures

- **Health / meta fail** → server is down or DB is unreachable (Neon cold start — wait 15s and retry)
- **Login fail** → wrong credentials, or ADMIN_USERNAME/PASSWORD env vars not set
- **Admin endpoints 403** → the logged-in user is not flagged `is_admin` in the DB
- **Trends missing 1970** → ETL hasn't loaded historical data into Neon yet
- **Notifications 500** → `feedback_id` column may be missing from `notifications` table (startup migration should fix on next deploy)
