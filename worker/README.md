# Feed API (Cloudflare Worker + D1)

1. Install: `npm install`
2. Log in to Cloudflare (one-time): `npx wrangler login`
3. Create D1 database: `npx wrangler d1 create feed` — when prompted, choose **Yes** to add the binding. If you chose No, copy the `database_id` from the output into `wrangler.toml` (replace `REPLACE_WITH_DATABASE_ID`).
4. Set API key secret: `npx wrangler secret put API_KEY` (enter your API key when prompted, e.g. the one in the app’s `.env`).
5. Apply schema to production DB: `npm run db:remote`
6. Deploy: `npm run deploy`

After deploy, Wrangler prints your Worker URL, e.g. `https://feed.<your-subdomain>.workers.dev`. Copy that URL into the app’s `.env` as `EXPO_PUBLIC_API_URL`. Keep `EXPO_PUBLIC_API_KEY` the same value you set for `API_KEY`. Restart the app (`npx expo start`).
