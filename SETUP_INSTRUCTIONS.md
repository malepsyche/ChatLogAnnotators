# ChatLogAnnotators — integrated application copy

This folder merges the original uploaded app with both feature patches (conversation filtering and workflow features). It is not a verified production build.

## Run
1. Copy your existing `.env.local` into this folder **locally**. It was intentionally excluded from this archive to avoid distributing credentials.
2. Run `npm ci` (or `npm install` if necessary).
3. Run `npm run build` and resolve any integration errors.
4. Run `npm run dev`.
5. Test against a **separate test MongoDB database**. Copying the application does not isolate the database.

## Data
The workflow patch writes to `audit_events` and `notifications` collections in the default database. MongoDB generally creates these on first write. See `README_WORKFLOW_PATCH.md` and `README_FILTER_PATCH.txt` for details and limitations.

## Known limitations
- The merged code has not been integration-tested against Cosmos DB.
- A build was not verified: npm dependencies were unavailable in the execution environment.
- Existing cookie-based username authorization is not production-grade authentication.
- Audit history does not yet cover every legacy write endpoint.
- The global active-database mechanism remains shared between requests.
- Assignment membership uniqueness is not transactionally enforced.
