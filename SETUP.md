# SETUP — Smart Hospital Management System on Amazon DynamoDB + Vercel

This guide takes you from a fresh AWS account to a working deployment:

- **Database:** one Amazon DynamoDB table (`HospitalData`) in your AWS account.
- **Backend:** the existing Express API (`backend/`), deployed as a Vercel Function.
- **Frontend:** the existing React/Vite app (`frontend/`), deployed as a separate Vercel project.

Your AWS credentials never reach the browser. Only the backend talks to DynamoDB.

> You create the real `.env` files and enter secrets yourself. Nothing in this repository contains working credentials.

---

## Contents

- [A. Prerequisites](#a-prerequisites)
- [B. AWS Console setup (DynamoDB table)](#b-aws-console-setup-dynamodb-table)
- [C. IAM permissions and credentials](#c-iam-permissions-and-credentials)
- [D. Local environment configuration](#d-local-environment-configuration)
- [E. Install and run the application](#e-install-and-run-the-application)
- [F. Vercel deployment](#f-vercel-deployment)
- [G. Verification checklist](#g-verification-checklist)
- [H. Troubleshooting](#h-troubleshooting)
- [I. Cleanup and cost safety](#i-cleanup-and-cost-safety)
- [Appendix 1 — Data model (how the table is used)](#appendix-1--data-model-how-the-table-is-used)
- [Appendix 2 — API changes compared with the MongoDB version](#appendix-2--api-changes-compared-with-the-mongodb-version)
- [Appendix 3 — Known issues that were intentionally not changed](#appendix-3--known-issues-that-were-intentionally-not-changed)

---

## A. Prerequisites

### Software

| Tool | Version | Check with |
|---|---|---|
| Node.js | **20 or newer** (22 LTS recommended). The AWS SDK v3 and the Vercel OIDC provider need Node 20+. | `node -v` |
| npm | Comes with Node (10+). The repo uses `package-lock.json`, so use npm. | `npm -v` |
| Git | Any recent version | `git --version` |
| AWS CLI v2 | Optional, but needed for IAM Identity Center (SSO) logins and quick permission checks. | `aws --version` |
| Docker **or** Java 17+ | Optional, only for the offline test suite (DynamoDB Local). | `docker --version` / `java -version` |

### AWS account

- An AWS account you can sign in to with an **IAM user or IAM Identity Center user that has administrator rights**. You need these rights only for the one-time setup in sections B and C.
- **Do not use the root user** for day-to-day work, and never create access keys for the root user.
- A Vercel account (Hobby is fine), plus the repository pushed to GitHub, GitLab or Bitbucket.

### Where things are

```
classRoom/                 <- project root (contains SETUP.md, README.md, docker-compose.yml)
├── backend/               <- Express API (package.json, src/, tests/, .env.example)
│   ├── src/app.ts         <- Express app, default export (Vercel entry point)
│   ├── src/server.ts      <- local entry point (app.listen)
│   ├── src/db/table.ts    <- the DynamoDB table definition used everywhere
│   └── .env.example
└── frontend/              <- React + Vite app (package.json, src/, vercel.json, .env.example)
```

Commands in this guide say which directory to run them in, e.g. `backend/`.

---

## B. AWS Console setup (DynamoDB table)

The application uses **one table with three global secondary indexes (GSIs)**. Every record type lives in this table; Appendix 1 explains how. You create it once.

### B1. Sign in

1. Go to <https://console.aws.amazon.com/> and sign in with your administrator IAM / Identity Center user (not root).

### B2. Open DynamoDB

2. In the search bar at the top, type **DynamoDB** and open the **DynamoDB** service.

### B3. Choose the region and keep it consistent

3. In the top-right corner, pick the region the table should live in, e.g. **US East (N. Virginia) `us-east-1`** or **Asia Pacific (Mumbai) `ap-south-1`**. Pick one close to your Vercel function region; Vercel's default is Washington D.C., `iad1`, which is next to `us-east-1`.
4. **Write down the region code** (for example `us-east-1`).

Why this matters:

- DynamoDB tables exist in **one** region only. If the backend's `AWS_REGION` differs from the region where you created the table, every request fails with `ResourceNotFoundException` ("table not found"), even though the table exists.
- The IAM policy in section C also contains the region.

Use the **same region code** in the console, in the IAM policy, in `backend/.env` and in Vercel.

### B4. Create the table

5. In the left menu choose **Tables** and click **Create table**.
6. Fill in exactly the following. Names are case-sensitive.

   | Field | Value |
   |---|---|
   | Table name | `HospitalData` |
   | Partition key | `PK` — type **String** |
   | Sort key | `SK` — type **String** |

7. Under **Table settings**, choose **Customize settings**.
8. **Table class:** `DynamoDB Standard`.
9. **Read/write capacity settings:** choose **On-demand**.
   - You pay per request, with nothing to tune and no idle capacity. This suits a small or student project with unpredictable traffic.
10. **Secondary indexes:** click **Create global index** three times and enter:

    | Index name | Partition key (String) | Sort key (String) | Attribute projections |
    |---|---|---|---|
    | `GSI1` | `GSI1PK` | `GSI1SK` | **All** |
    | `GSI2` | `GSI2PK` | `GSI2SK` | **All** |
    | `GSI3` | `GSI3PK` | `GSI3SK` | **All** |

    With on-demand tables, the indexes are also on-demand automatically.

11. **Encryption at rest:** keep the default **Owned by Amazon DynamoDB**.
    - Data is always encrypted.
    - "AWS managed key" or "customer managed key (KMS)" also work but add KMS cost and permissions. If you pick a customer managed key, the IAM role in section C additionally needs `kms:Decrypt` and `kms:GenerateDataKey` on that key.
12. **Deletion protection:** turn it **on**. This prevents deleting the table by accident.
13. **Tags** (optional): e.g. `project = hospital-management`. Tags help you find costs in Billing.
14. Click **Create table**. Wait until **Status** shows **Active** (about a minute). The indexes show **Active** a little later.

> **Alternative to steps 5–14:** from `backend/`, with administrator credentials configured and `AWS_REGION` set, run `npm run db:create-table`. It creates the identical definition from `src/db/table.ts` (on-demand, 3 GSIs, projection All). Deletion protection and backups must still be set in the console. The application's own runtime role (section C) deliberately cannot create tables, so this script needs administrator credentials.

### B5. Backups (recommended settings)

15. Open the table, then the **Backups** tab.
16. **Point-in-time recovery (PITR):** optional.
    - It lets you restore the table to any second in the last 35 days, and is billed per GB stored.
    - For coursework, turn it on only if you hold data you care about.
    - Alternatively, take an occasional **on-demand backup** (**Create backup**) before risky changes.

### B6. Inspect the table and create a test item

17. Open **Tables → HospitalData**. The **Overview** tab shows the status, capacity mode (**On-demand**), keys (`PK`, `SK`) and region (in the table ARN). The **Indexes** tab must list `GSI1`, `GSI2` and `GSI3`, all **Active**.
18. Click **Explore table items** (top right), then **Create item**. Choose the **JSON view**, turn **View DynamoDB JSON** off, and enter:

    ```json
    { "PK": "HEALTH#CHECK", "SK": "HEALTH", "note": "manual test item" }
    ```

    Click **Create item**. The item now appears in the list, which proves your console user can write to the table.

    The backend's health check (`/api/health?db=1`) reads this exact key. The item is not required, because a successful read of a missing key also passes, but it is a convenient marker. You can delete it whenever you like.

### B7. Verify region, table name and status

19. On the table's **Overview** tab, check:
    - **Table name:** `HospitalData`. This must equal `DYNAMODB_TABLE_NAME`.
    - **Amazon Resource Name (ARN):** looks like `arn:aws:dynamodb:us-east-1:123456789012:table/HospitalData`. The region (`us-east-1`) and account ID (`123456789012`) in it are what you use in sections C and D.
    - **Table status:** `Active`. On the **Indexes** tab, all three GSIs are `Active`.
    - **Capacity mode:** `On-demand`.

---

## C. IAM permissions and credentials

The backend needs **exactly these DynamoDB actions** on this one table and its indexes:

| Action | Used for |
|---|---|
| `dynamodb:GetItem` | Read one record (by id, login lookup, health check) |
| `dynamodb:BatchGetItem` | Load related records for lists (replacement for Mongoose `populate`) |
| `dynamodb:Query` | All lists and searches, on the table and on `GSI1`–`GSI3` |
| `dynamodb:PutItem` | Create or update records |
| `dynamodb:UpdateItem` | Atomic counters (IDs, queue numbers) and statistics |
| `dynamodb:DeleteItem` | Deletes, and releasing locks |

Atomic transactions (`TransactWriteItems`) have no IAM action of their own. AWS authorizes each write inside a transaction with the `PutItem`, `UpdateItem` or `DeleteItem` permission above. There are **no** `Scan`, `CreateTable` or `DeleteTable` permissions: the application never scans and can't drop or create tables.

### C1. Create the least-privilege policy

1. Console, then **IAM**, then **Policies**, then **Create policy**, then the **JSON** tab.
2. Paste this policy. Replace `REGION` and `ACCOUNT_ID` with the values from step B7, and `HospitalData` if you chose another table name.

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "HospitalDataTable",
         "Effect": "Allow",
         "Action": [
           "dynamodb:GetItem",
           "dynamodb:BatchGetItem",
           "dynamodb:Query",
           "dynamodb:PutItem",
           "dynamodb:UpdateItem",
           "dynamodb:DeleteItem"
         ],
         "Resource": "arn:aws:dynamodb:REGION:ACCOUNT_ID:table/HospitalData"
       },
       {
         "Sid": "HospitalDataIndexes",
         "Effect": "Allow",
         "Action": ["dynamodb:Query"],
         "Resource": "arn:aws:dynamodb:REGION:ACCOUNT_ID:table/HospitalData/index/*"
       }
     ]
   }
   ```

3. Click **Next**, name it **`HospitalDataAppAccess`**, then **Create policy**.

You attach this one policy to every identity the app uses: your local developer identity and the Vercel role.

### C2. Local development credentials (no secrets in source code)

Pick **one** option. The backend uses the standard AWS SDK credential chain, so you only set environment variables or a profile. No credentials ever go in code.

**Option 1 (recommended): IAM Identity Center (SSO) profile, with short-lived credentials**

1. Console, then **IAM Identity Center**. Enable it if prompted; this is free.
2. **Permission sets**, then **Create permission set**, then **Custom permission set**.
   - Under **Inline policy**, paste the JSON from C1.
   - Name it `HospitalDataDev` and set the session duration, e.g. 8 hours.
3. **AWS accounts**: select your account, then **Assign users or groups**. Pick your Identity Center user and the `HospitalDataDev` permission set.
4. On your machine, run:

   ```bash
   aws configure sso
   ```

   - Enter the **SSO start URL** (shown on the Identity Center dashboard) and the SSO region.
   - Pick the account and the `HospitalDataDev` role.
   - Set the CLI default region to your table region.
   - Name the profile `hospital-dev`.
5. Each working day, log in:

   ```bash
   aws sso login --profile hospital-dev
   ```

6. In `backend/.env`, set `AWS_PROFILE=hospital-dev`. Leave the access-key variables unset.

**Option 2 (fallback): a restricted IAM user with access keys**

1. **IAM**, then **Users**, then **Create user**. Name it `hospital-app-dev` and **do not** give it console access.
2. **Attach policies directly**: choose `HospitalDataAppAccess` only.
3. Open the user, go to **Security credentials**, then **Create access key**. Choose **Local code**, confirm, and copy the key ID and secret once.
4. Put them **only** in `backend/.env`, which is git-ignored:
   `AWS_ACCESS_KEY_ID=...` and `AWS_SECRET_ACCESS_KEY=...`
5. Rotate (deactivate and recreate) the key periodically, and delete it when you no longer need it.

> Never use root-account access keys. Never paste keys into source files, the frontend, `VITE_*` variables, chat messages or screenshots.

### C3. Vercel production credentials: IAM role via Vercel OIDC (recommended)

With OIDC, the Vercel function exchanges a short-lived Vercel-signed token for temporary AWS credentials (`sts:AssumeRoleWithWebIdentity`). There are **no long-lived AWS keys stored in Vercel**. The code supports this already: when `AWS_ROLE_ARN` is set, `backend/src/config/aws.ts` uses `@vercel/oidc-aws-credentials-provider`.

First find your **Vercel team slug**. It's the part of your Vercel dashboard URL after `vercel.com/`; on a Hobby account, it's your personal account slug. You also need the backend project's name, e.g. `hms-api`, from section F.

1. **Enable OIDC in Vercel.** In the backend project, go to **Settings**, then **Security**, then **Secure backend access with OIDC federation**. Turn it on and choose the **Team** issuer mode. You can also do this after creating the project in F2.
2. **Create the identity provider in AWS.** Go to **IAM**, then **Identity providers**, then **Add provider**:
   - Provider type: **OpenID Connect**
   - Provider URL: `https://oidc.vercel.com/TEAM_SLUG`
   - Audience: `https://vercel.com/TEAM_SLUG`
   - Then **Add provider**.
3. **Create the role.** Go to **IAM**, then **Roles**, then **Create role**:
   - Choose **Web identity** and select the provider and audience from step 2.
   - Attach `HospitalDataAppAccess`.
   - Name it `hospital-api-vercel`, then **Create role**.
4. **Tighten the trust policy.** Open the role, go to **Trust relationships**, then **Edit trust policy**, and replace it with the version below so that **only your backend project's production deployments** can assume it. Replace `ACCOUNT_ID`, `TEAM_SLUG` and `PROJECT_NAME`.

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": { "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/oidc.vercel.com/TEAM_SLUG" },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "oidc.vercel.com/TEAM_SLUG:aud": "https://vercel.com/TEAM_SLUG",
             "oidc.vercel.com/TEAM_SLUG:sub": "owner:TEAM_SLUG:project:PROJECT_NAME:environment:production"
           }
         }
       }
     ]
   }
   ```

   To also allow **preview** deployments, change `StringEquals` on `sub` to a `StringLike` with a list of both values: `...:environment:production` and `...:environment:preview`. Ideally, point previews at a separate table and role.

5. Copy the role's **ARN** (`arn:aws:iam::ACCOUNT_ID:role/hospital-api-vercel`). It becomes the Vercel environment variable `AWS_ROLE_ARN` (section F). The ARN is not a secret.

**Fallback if OIDC is not possible:** create a separate restricted IAM user as in C2 option 2 (e.g. `hospital-app-vercel`, policy `HospitalDataAppAccess` only). Store its `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as **Sensitive** environment variables in the backend Vercel project, and do **not** set `AWS_ROLE_ARN`. Rotate the keys regularly.

### C4. Verify permissions and troubleshoot `AccessDeniedException`

- **Easiest check:** start the backend and open `/api/health?db=1`. You should get `"database": { "status": "ok" }`; the details are in section G.
- **With the AWS CLI** (uses the same credentials as the backend). This read must succeed and returns `{}` if the test item doesn't exist:

  ```bash
  aws dynamodb get-item --table-name HospitalData --region us-east-1 --profile hospital-dev \
    --key '{"PK":{"S":"HEALTH#CHECK"},"SK":{"S":"HEALTH"}}'
  aws sts get-caller-identity --profile hospital-dev   # shows WHICH identity you are using
  ```

  This should fail with AccessDenied, which proves least privilege:

  ```bash
  aws dynamodb scan --table-name HospitalData --region us-east-1 --profile hospital-dev
  ```

- **If you get `AccessDeniedException`:** the error message names the action and the resource. Check, in order:
  1. The region and account ID in the policy ARNs match the table ARN exactly.
  2. The table name is the same.
  3. The index statement ends in `/index/*`.
  4. The policy is attached to the identity that `sts get-caller-identity` shows.
  5. For OIDC: the trust policy's `sub` matches the project name and environment exactly.

  The **IAM policy simulator** (IAM, then the identity, then **Simulate**) can test single actions.

---

## D. Local environment configuration

### D1. Which file goes where

| File | Directory | Committed? | Purpose |
|---|---|---|---|
| `backend/.env.example` | `backend/` | yes (template, no secrets) | Lists every backend variable |
| `backend/.env` | `backend/` | **no** (git-ignored) | Your real local backend values |
| `frontend/.env.example` | `frontend/` | yes | Lists the one optional frontend variable |
| `frontend/.env.local` | `frontend/` | **no** (git-ignored) | Only if you need to override `VITE_API_URL` locally |

Create your backend file from the template:

```bash
cd backend
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

> If you still have an old `backend/.env` from the MongoDB version, edit it. `MONGODB_URI` and the `CLOUDINARY_*` values are no longer used (Cloudinary was never called by the code), and `JWT_SECRET` plus `AWS_REGION` must be present.

### D2. Complete example (`backend/.env`)

```dotenv
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

JWT_SECRET=<paste the 96-character random string you generate below>
JWT_EXPIRES_IN=7d

AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=HospitalData

# choose ONE credential method:
AWS_PROFILE=hospital-dev
# AWS_ACCESS_KEY_ID=<from IAM, only for option 2>
# AWS_SECRET_ACCESS_KEY=<from IAM, only for option 2>

# only for offline tests against DynamoDB Local:
# DYNAMODB_ENDPOINT=http://localhost:8000
```

Generate a strong `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### D3. What each variable means

| Variable | Required | Secret? | Meaning / where to get it |
|---|---|---|---|
| `PORT` | no (default 5000) | no | Local port of the API. Ignored on Vercel. |
| `NODE_ENV` | no | no | `development` locally, `production` on Vercel. `development` adds stack traces to error responses. |
| `CLIENT_URL` | yes in production | no | Comma-separated frontend origins allowed by CORS, without a trailing slash. One `*` wildcard is allowed per entry (for preview URLs). Local: `http://localhost:5173`. Vercel: your frontend URL. |
| `JWT_SECRET` | **yes** | **SECRET** | Signs login tokens. The server refuses to start (locally) or returns 500 (Vercel) without it; there is no fallback. Changing it logs everyone out. |
| `JWT_EXPIRES_IN` | no (default `7d`) | no | Token lifetime, e.g. `8h`, `7d`. |
| `AWS_REGION` | **yes** | no | Region code of the table (step B3/B7). **Must** be set explicitly on Vercel too: Vercel otherwise injects its own function region. |
| `DYNAMODB_TABLE_NAME` | no (default `HospitalData`) | no | Exact table name from step B4. |
| `AWS_PROFILE` | option 1 | no (name only) | Profile name from `aws configure sso`. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | option 2 | **SECRET** | Keys of the restricted IAM user (C2 option 2). |
| `AWS_ROLE_ARN` | Vercel (OIDC) | no | ARN of the `hospital-api-vercel` role (C3). Leave unset locally. |
| `DYNAMODB_ENDPOINT` | no | no | Only for DynamoDB Local (tests / offline). Never set it in production. |
| `VITE_API_URL` (frontend) | Vercel frontend | no (**public**) | Backend URL including `/api`. Leave unset locally (Vite proxies `/api` to `localhost:5000`). Anything prefixed `VITE_` is visible to every browser, so it must never hold a secret. |

**Safe to commit:** the `.env.example` files, region, table name, role ARN (not secret, but no need to commit). **Never commit:** `backend/.env`, `JWT_SECRET`, access keys. `.gitignore` at the project root already excludes `.env`, `.env.local` and `.env.*.local`.

### D4. Verify that the backend loads the variables

```bash
cd backend
npm run dev
```

The start-up banner prints the table, region and (if set) local endpoint. It never prints secrets.

- If `JWT_SECRET` or `AWS_REGION` is missing, it stops with `[Config] Missing required environment variable ...`.
- Then open <http://localhost:5000/api/health?db=1>. `"database": {"status": "ok", "table": "HospitalData", "region": "..."}` means the variables, the credentials and the table all work.

---

## E. Install and run the application

All scripts below exist in the repository's `package.json` files.

### E1. Install

```bash
cd backend && npm install
cd ../frontend && npm install
```

### E2. Backend scripts (`backend/`)

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API with auto-reload on <http://localhost:5000> (uses `backend/.env`) |
| `npm run build` | Compiles TypeScript to `dist/` (`tsc`) |
| `npm start` | Runs the compiled server (`node dist/server.js`), after `npm run build` |
| `npm run typecheck` | Type-checks without writing files |
| `npm run db:create-table` | Creates the `HospitalData` table if it doesn't exist (admin credentials, or DynamoDB Local) |
| `npm run seed` | Inserts the demo data and demo accounts into an **empty** table (see E4) |
| `npm test` | Runs the Jest test suite (needs DynamoDB Local, see E5) |

### E3. Frontend scripts (`frontend/`)

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on <http://localhost:5173>; `/api` is proxied to `localhost:5000` |
| `npm run build` | Type-checks and builds the production bundle into `frontend/dist` |
| `npm run preview` | Serves the built bundle locally |
| `npm run lint` | **Not functional:** the script calls `eslint`, but ESLint and its config were never part of this project. This was also true before the migration. |

Typical local session: run `npm run dev` in `backend/`, and in a second terminal `npm run dev` in `frontend/`, then open <http://localhost:5173>.

### E4. Demo data (optional)

Run this from `backend/`, with your `.env` pointing at the table:

```bash
npm run seed
```

- **What it creates:** the original demo data (departments, doctors, patients, appointments, records, lab data, rooms and beds, medicines, bills, notifications) and 10 demo logins. All use the password `password123`:
  - `admin@smarthospital.org` (hospital admin)
  - `doctor@smarthospital.org`
  - `brody@smarthospital.org`
  - `patient@smarthospital.org`
  - `maria@smarthospital.org`
  - `david@smarthospital.org`
  - `reception@smarthospital.org`
  - `lab@smarthospital.org`
  - `pharmacy@smarthospital.org`
  - `nurse@smarthospital.org`
- **Safety checks:**
  - The seeder **refuses to run if the demo data already exists** (it checks for the demo admin). DynamoDB has no cheap "wipe table", so it never deletes anything.
  - It also refuses to run when `NODE_ENV=production` unless you set `SEED_ALLOW_PRODUCTION=yes`.
- **To start over:** delete and re-create the table (section I), or use a new `DYNAMODB_TABLE_NAME`.
- **Change these passwords** or skip seeding on any deployment other people can reach.

### E5. Tests

The integration tests run against **DynamoDB Local**, so they need no AWS account and cost nothing. Each test file creates and deletes its own temporary table.

1. Start DynamoDB Local in another terminal, using **either**:

   ```bash
   docker run --rm -p 8000:8000 amazon/dynamodb-local
   ```

   **or**, with Java 17+, download the JAR from the AWS docs ("Deploying DynamoDB Local on your computer"), unzip it and run:

   ```bash
   java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -inMemory -sharedDb -port 8000
   ```

2. Then:

   ```bash
   cd backend
   npm test                 # all suites
   npx jest tests/unit.test.ts   # pure unit tests only (no DynamoDB Local needed)
   ```

3. Type-check and build both apps:

   ```bash
   cd backend && npm run typecheck && npm run build
   cd ../frontend && npm run build
   ```

The tests never touch your real AWS table. They force `DYNAMODB_ENDPOINT` to the local endpoint and use dummy credentials.

---

## F. Vercel deployment

The repository is deployed as **two Vercel projects from the same Git repository**:

| Project | Root directory | What it serves | AWS access |
|---|---|---|---|
| `hms-api` (example name) | `backend` | The Express API as one Vercel Function (`/api/...`) | Yes, via the OIDC role |
| `hms-web` (example name) | `frontend` | The static React app | **None** |

### F1. Push the repository

Push this repository to GitHub, GitLab or Bitbucket. Check that `backend/.env` is **not** in the pushed files:

```bash
git status --ignored
```

### F2. Create the backend project

1. On <https://vercel.com/new>, import the repository.
2. **Project name:** e.g. `hms-api`. It must match `PROJECT_NAME` in the C3 trust policy.
3. **Root Directory:** click **Edit** and choose **`backend`**.
4. **Framework Preset:** Vercel detects **Express**. If it shows "Other", that is fine.
   - Vercel finds `src/app.ts`, which default-exports the Express app, and runs the whole app as a single function. No `vercel.json` is needed in `backend/`.
   - Leave **Build Command** and **Output Directory** at their defaults. Vercel runs the existing `npm run build` (`tsc`) as a type-check.
5. **Environment Variables:** add the following before the first deploy. Use the **Production** environment, and mark `JWT_SECRET` as Sensitive.

   | Name | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | a new random string (don't reuse your local one) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `AWS_REGION` | your table region, e.g. `us-east-1` (required) |
   | `DYNAMODB_TABLE_NAME` | `HospitalData` |
   | `AWS_ROLE_ARN` | ARN of `hospital-api-vercel` (C3) |
   | `CLIENT_URL` | leave as `http://localhost:5173` for now; set it in F4 |

   If you use the access-key fallback instead of OIDC, add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (both Sensitive) and do **not** add `AWS_ROLE_ARN`.
6. Click **Deploy**.
7. **Configure OIDC** if you haven't yet. In the backend project, go to **Settings**, then **Security**, then **Secure backend access with OIDC federation**, and turn it on in **Team** mode. Complete C3 with this project's name, then redeploy (**Deployments**, then **⋯**, then **Redeploy**).
8. Note the production URL, e.g. `https://hms-api.vercel.app`. Test it:
   - `https://hms-api.vercel.app/api/health` should show `"status": "online"`.
   - `https://hms-api.vercel.app/api/health?db=1` should show `"database": {"status":"ok"}`.

### F3. Create the frontend project

1. Again on <https://vercel.com/new>, import **the same repository** a second time.
2. **Project name:** e.g. `hms-web`. **Root Directory:** **`frontend`**.
3. **Framework Preset:** **Vite**. The settings are already in `frontend/vercel.json`:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - Every non-file path is rewritten to `index.html`, so deep links like `/admin/beds` work after a refresh.
4. **Environment Variables:** only one is needed:

   | Name | Value |
   |---|---|
   | `VITE_API_URL` | `https://hms-api.vercel.app/api` (your backend URL from F2, **with** `/api`) |

   Never add AWS or JWT variables to the frontend project. Anything here can end up in the public bundle.
5. **Deploy.** Note the URL, e.g. `https://hms-web.vercel.app`.

### F4. Connect the two (CORS) and redeploy

1. Backend project: **Settings**, then **Environment Variables**. Set `CLIENT_URL` to `https://hms-web.vercel.app`.
   - Add any other allowed origins comma-separated.
   - Optionally add a preview pattern like `https://hms-web-*-TEAM_SLUG.vercel.app`.
2. **Redeploy the backend.** Environment-variable changes apply only to new deployments, so after changing any variable in either project, redeploy that project. For the frontend, `VITE_API_URL` is baked in at build time.

### F5. Routing summary

- The browser loads the app from `https://hms-web.vercel.app`.
- The app calls `https://hms-api.vercel.app/api/<route>`. All original routes (`/api/auth`, `/api/patients`, …) are unchanged.
- Auth uses `Authorization: Bearer <token>` headers. There are no cookies, so no cookie or `SameSite` settings are involved.
- CORS allows only the origins in `CLIENT_URL`.

### F6. Logs

- **Build logs:** open a project, then **Deployments**, then a deployment, then **Building**. For the backend, confirm the Express app was detected and the build succeeded.
- **Runtime logs:** **Logs** tab, or open a deployment and go to **Runtime Logs** / **Functions**. API errors are logged as `[Error] METHOD /api/... (status): ErrorName message`. AWS problems show the AWS error name (e.g. `AccessDeniedException`). Secrets are never logged.

### F7. Test the deployed system against DynamoDB

1. Seed demo data into the AWS table from your machine (E4), or register a new account on the deployed frontend.
2. Open the frontend URL and log in (e.g. `admin@smarthospital.org` / `password123` if seeded).
3. Work through section G.

**Not included / not claimed:** there are no WebSockets, cron jobs or background workers in this project. Lab report file uploads were never implemented (the `reportFile` field is never written).

---

## G. Verification checklist

Tick each item. "Local" means `npm run dev` in both apps; "Prod" means the Vercel URLs.

**DynamoDB connectivity**

- [ ] `GET /api/health?db=1` returns HTTP 200 with `"database": {"status":"ok","table":"HospitalData","region":"<yours>"}` (Local and Prod).
- [ ] DynamoDB console, **HospitalData**, **Explore table items**, then **Scan**: after seeding or registering, you see items whose `PK` starts with `USER#`, `PATIENT#` and so on. This scan uses your console user; the app itself never scans.

**Create and read a test record**

- [ ] Register a patient on the frontend (`/register`), or call `POST /api/auth/register`. Then log in. In the console, items `USER#<id>`, `UNIQUE#EMAIL#<email>` and `PATIENT#<id>` appear.
- [ ] Book an appointment as that patient. An `APPT#<id>` item and a `SLOT#...` item appear, and the appointment shows on the patient dashboard.

**Authentication and authorization**

- [ ] A wrong password returns 401. A request without a token to `/api/patients` returns 401.
- [ ] A patient calling an admin route (e.g. `DELETE /api/doctors/<id>`) gets 403.
- [ ] The admin demo account (`hospital_admin`) can open Admin Dashboard, Audit Logs, Beds, Billing stats and patient lists (these returned 403 before the migration).
- [ ] The lab demo account (`lab_staff`) can update a lab report's status and results.

**Existing API routes**

- [ ] Every frontend page loads without errors in the browser console (Network tab: no 404 or 500 on `/api/...`).
- [ ] An unknown route such as `/api/nope` returns JSON 404.

**Hospital-management workflows** (log in with the matching demo account)

- [ ] **Patients/reception:** register a patient from the Receptionist dashboard; the queue shows today's appointments; check-in changes the status.
- [ ] **Appointments:** book a slot. Booking the same doctor, date and time again shows "This time slot is already booked". Cancelling frees the slot.
- [ ] **Doctor:** the doctor dashboard lists their appointments; changing the status notifies the patient (bell icon).
- [ ] **EMR:** as a doctor, save a consultation with medicines. The patient's previous records list updates, and the prescription is linked to the record.
- [ ] **Pharmacy:** the prescription appears in the pharmacy queue; **Dispense** marks it dispensed (twice is rejected). Inventory: add a medicine and adjust stock (stock-out beyond the quantity is rejected).
- [ ] **Lab:** the lab dashboard lists reports; status changes and result entry work.
- [ ] **Beds:** assign a patient to an available bed (assigning an occupied bed is rejected), then discharge.
- [ ] **Billing:** the bill list and stats show; recording a payment updates the balance and status.
- [ ] **Notifications:** unread count, mark-one and mark-all-read.
- [ ] **Audit logs:** the admin audit page lists recent actions with action filter and search; the stats show counts.
- [ ] **Search:** the header search finds patients and doctors by the start of a name word or ID (e.g. "mar" for "Maria"), medicines by part of their name, and appointments and bills by ID prefix.
- [ ] **AI symptom checker:** returns a department and doctors (rule-based, as before).

**Builds and tests**

- [ ] `backend`: `npm run typecheck`, `npm run build`, and `npm test` (with DynamoDB Local) all pass.
- [ ] `frontend`: `npm run build` passes.

**Deployment**

- [ ] Both Vercel deployments show **Ready**. The backend runtime logs show no `AccessDeniedException`, `ResourceNotFoundException` or `Missing required environment variable`.

**No MongoDB left**

- [ ] `grep -ri mongo backend/src backend/package.json` finds nothing. `MONGODB_URI` is not set anywhere in Vercel.

---

## H. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `Database table not found. Check DYNAMODB_TABLE_NAME and AWS_REGION` / `ResourceNotFoundException` | **Wrong region** or table name. Compare `AWS_REGION` and `DYNAMODB_TABLE_NAME` with the table ARN (B7). On Vercel, `AWS_REGION` must be set explicitly. If it's missing, Vercel's own value (the function's region) is used. |
| Table exists but the indexes are missing or `CREATING` | Wait until all three GSIs are **Active**. If you named them differently, recreate them exactly as `GSI1`–`GSI3` with `GSI1PK`/`GSI1SK` and so on. |
| `The server is not allowed to access the database` / `AccessDeniedException` | **Missing IAM permissions.** The policy isn't attached, has the wrong ARN or region, or lacks the `/index/*` statement. See C4. |
| `could not obtain valid AWS credentials`, `ExpiredTokenException`, `CredentialsProviderError` | **Invalid or expired credentials.** Locally, run `aws sso login --profile hospital-dev` again, or check the keys in `.env`. On Vercel, check that `AWS_ROLE_ARN` is set, OIDC is enabled in project **Settings, Security**, and the trust policy `sub` matches `owner:TEAM:project:PROJECT:environment:production`. |
| `Missing required environment variable JWT_SECRET` / `AWS_REGION`, or 500 "Server configuration error" | **Vercel environment variables are missing**, or were added without a redeploy. Add them and redeploy. |
| API returns 404 for every route | The frontend calls the wrong URL. `VITE_API_URL` must end in `/api` and point to the **backend** project; redeploy the frontend after changing it. On the backend project, make sure Root Directory = `backend`. |
| The frontend refresh on `/admin/...` shows Vercel 404 | Root Directory of the frontend project is not `frontend`, so `frontend/vercel.json` isn't used. |
| API returns 500 | Open the backend **Runtime Logs**. The log line shows the AWS error name and the failing route. |
| Browser: "blocked by CORS policy" | `CLIENT_URL` in the backend project doesn't contain the exact frontend origin (scheme + host, no trailing slash). Add it and redeploy the backend. Cookies are not used; auth is Bearer tokens, so no cookie settings apply. |
| `The database rejected the request (key or schema mismatch)` / `ValidationException` | **Key-schema mismatch:** the table's keys aren't exactly `PK`/`SK` (String), or a GSI has a different name or key. The definition must match B4 exactly. Recreate the table if needed. |
| `The database is busy` (503) / throttling | On-demand tables absorb normal spikes. Retry; the SDK already retries 3 times. Sustained throttling is unusual at this scale; check **Monitor** in the DynamoDB console. |
| 409 "changed by another request" | Two users edited the same record at the same moment. This is optimistic locking working as intended. Reload and retry. |
| Vercel function timeout | DynamoDB calls normally take milliseconds. Timeouts usually mean the credentials can't be obtained (OIDC misconfigured) or the wrong region is very far away. Check the runtime logs; the default max duration is ample for this API. |
| `npm test` fails with "DynamoDB Local is not reachable" | Start DynamoDB Local first (E5). |
| Unexpected AWS costs | See section I. Check **Billing, Cost Explorer**, grouped by service. A misbehaving client looping requests is the usual cause; on-demand billing grows with request count. |

---

## I. Cleanup and cost safety

- **Costs depend on your account, region and usage.**
  - DynamoDB on-demand bills per read/write request and per GB stored.
  - Point-in-time recovery and backups are billed separately.
  - Vercel bills under its own plan.
  - Whether you have any AWS Free Tier allowance, Free Plan or credits depends on your account type and age. Check your own account rather than assuming. **This project is not guaranteed to stay free.**
- **Check your current charges:** **Billing and Cost Management**, then **Bills** (per service) and **Cost Explorer** (filter Service = DynamoDB).
- **Check credits and free-tier eligibility:** **Billing and Cost Management**, then **Credits** and **Free Tier**. The latter shows your free-tier usage and limits, if your account has them.
- **Set up a budget alert (recommended):** **Billing and Cost Management**, then **Budgets**, then **Create budget**. Use the **Monthly cost budget** template with a small amount (e.g. USD 5) and your email. AWS emails you when actual or forecast spend crosses it.
- **Watch usage:** **DynamoDB**, then **Tables**, then **HospitalData**, then **Monitor** (read/write request units, throttles). Also check **CloudWatch** metrics.
- **When you're finished with the project**, delete what you created. These steps are manual; nothing here deletes resources for you.
  1. DynamoDB table:
     - Turn off **Deletion protection** (table, **Additional settings**).
     - **Delete table**, and delete any on-demand backups.
  2. IAM:
     - Delete the access keys and IAM users.
     - Delete the `hospital-api-vercel` role, the Vercel OIDC identity provider and the `HospitalDataAppAccess` policy.
     - Remove the Identity Center assignment and permission set.
  3. Vercel: delete or pause both projects.

---

## Appendix 1 — Data model (how the table is used)

All entities share one table. Each record is one item:

- `PK = <TYPE>#<id>` and `SK = <TYPE>`.
- An optimistic-lock `version` number.
- Index keys that make its queries possible.

Every read is a `GetItem`, `BatchGetItem` or `Query`; nothing scans the table.

| Item | PK / SK | GSI1 (list by type) | GSI2 (by patient / parent) | GSI3 (by doctor / user) |
|---|---|---|---|---|
| User | `USER#id` / `USER` | `TYPE#USER` / createdAt | | |
| Patient | `PATIENT#id` | `TYPE#PATIENT` / createdAt | | `USER#userId` / `PROFILE#PATIENT` |
| Doctor | `DOCTOR#id` | `TYPE#DOCTOR` / createdAt | `DEPT#deptId` / `DOCTOR#...` | `USER#userId` / `PROFILE#DOCTOR` |
| Department | `DEPT#id` | `TYPE#DEPT` / name | | |
| Appointment | `APPT#id` | `TYPE#APPT` / date | `PATIENT#id` / `APPT#date` | `DOCTOR#id` / `APPT#date` |
| Medical record | `EMR#id` | `TYPE#EMR` / date | `PATIENT#id` / `EMR#date` | `DOCTOR#id` / `EMR#date` |
| Prescription | `RX#id` | `TYPE#RX` / date | `PATIENT#id` / `RX#date` | `DOCTOR#id` / `RX#date` |
| Lab report | `LAB#id` | `TYPE#LAB` / createdAt | `PATIENT#id` / `LAB#...` | `DOCTOR#id` / `LAB#...` |
| Bill | `BILL#id` | `TYPE#BILL` / createdAt | `PATIENT#id` / `BILL#...` | |
| Medicine | `MED#id` | `TYPE#MED` / name | | |
| Inventory transaction | `INVTX#id` | `TYPE#INVTX` / timestamp | `MED#medicineId` / `INVTX#...` | |
| Lab test | `LABTEST#id` | `TYPE#LABTEST` / category#name | | |
| Room | `ROOM#id` | `TYPE#ROOM` / building#floor#number | | |
| Bed | `BED#id` | `TYPE#BED` / bedNumber | `ROOM#roomId` / `BED#...` | |
| Notification | `NOTIF#id` | | `USER#recipient` / `NOTIF#createdAt` | `UNREAD#recipient` (only while unread) |
| Audit log | `AUDIT#id` | `TYPE#AUDIT` / timestamp | | |

Helper items:

- **Unique values** (no duplicate emails, department names or codes, room or bed numbers, lab test codes): `UNIQUE#<KIND>#<value>`. Written in the same transaction as the record, with "only if it doesn't exist".
- **Appointment slot locks:** `SLOT#<doctorId>#<YYYY-MM-DD>#<timeSlot>`. Only one active appointment can hold a slot, even when two bookings arrive at the same moment.
- **Counters for human-readable IDs:** `COUNTER#<NAME>` (e.g. `APT-2026-00001`, `P-2026-0001`, queue numbers). These come from atomic increments, so there are no duplicates.
- **Statistics:**
  - `STATS#TOTALS` (patient and appointment totals)
  - `STATS#BILLING` (revenue sums and status counts)
  - `STATS#AUDIT_ACTION` / `STATS#AUDIT_ENTITY` (audit stats)
  - `STATS#APPT_DEPT` (appointments per department)

  These are updated in the same transaction as the change, so dashboards never need to read every record.
- **Search tokens:** `SEARCH#<TYPE>` / `<word>#<id>`. Word-prefix search for patients, doctors, appointment IDs and bill IDs.

Concurrent edits of the same record are detected with the `version` attribute; the second writer receives HTTP 409. This also makes stock adjustments, payments, bed assignment and dispensing safe under concurrency.

---

## Appendix 2 — API changes compared with the MongoDB version

All routes, methods, request bodies, roles and response shapes are preserved, except for the following.

| Area | Before (MongoDB) | Now (DynamoDB) |
|---|---|---|
| Record ids (`_id`) | 24-char ObjectId | UUID string (still returned as `_id`) |
| List pagination | `?page=&limit=`, response `pagination: {page, limit, total, pages}` | `?limit=&cursor=`. The response `pagination: {limit, count, nextCursor, hasMore}`; pass `nextCursor` back as `cursor` for the next page. `page` is ignored. The frontend never used either. |
| `?sort=` | any field | `-x` = newest/descending, `x` = ascending, on the list's natural order (date, name, …) |
| Text search | case-insensitive substring regex | patients and doctors: prefix of any word, ID, email or phone. Appointments and bills: ID prefix. Small catalogs (departments, medicines, lab tests): substring, as before. Searching appointments by symptom text is no longer supported. |
| Invalid / unknown ids | 500 (CastError) | 404 |
| Validation errors | 500 with a raw Zod JSON message | 400 with a readable message plus an `errors` array |
| Duplicates / concurrent conflicts | 500 (E11000) or silently lost updates | 409 with a clear message |
| Unique values | Department name exact-match; room/bed numbers case-sensitive | Department names/codes, room numbers, bed numbers, lab test codes and emails are unique **ignoring upper/lower case**. Duplicates return the original 400 message (departments, emails) or 409 (rooms, beds, lab test codes) instead of a 500 |
| Referenced records | Creating a doctor, bed, bill, medical record or prescription with a non-existent department/room/patient/doctor id was stored (or 500 for malformed ids) | Returns 400/404 ("... not found"); lab reports still don't check, as before |
| Admin and lab roles | `hospital_admin`/`super_admin` and `lab_staff` got 403 on routes allowing `admin` / `lab_technician` | treated as `admin` / `lab_technician` |
| `JWT_SECRET` missing | silently fell back to a secret hard-coded in the source | refuses to work (configuration error) |
| Human-readable IDs | `countDocuments()+1` or random (collided after deletes) | atomic counters, same formats (`MED-`, `LAB-`, `INV-`, `LT-` are now sequential) |
| `GET /api/health` | static | add `?db=1` to test the database connection |

Frontend changes:

- `src/api/client.ts` reads `VITE_API_URL`.
- The EMR page now sends `patient` (not `patientId`) and reads `records`/`record` from the top level of the response. Previous records now show, and prescriptions link to their record.
- The pharmacy dashboard reads `prescriptions` from the top level, so the dispense queue fills.

---

## Appendix 3 — Known issues that were intentionally not changed

The migration was scoped to "blockers only". These pre-existing behaviours are unchanged and worth fixing later:

1. Public `POST /api/auth/register` lets anyone choose a privileged role (e.g. `hospital_admin`, `super_admin`, `doctor`).
2. Detail endpoints don't check ownership. Any logged-in user can read any patient, appointment, record, prescription, lab report or bill by id. Patients can change any appointment's status or pay any bill. If a patient or doctor user has no profile, list endpoints aren't narrowed to their own data.
3. Staff can't book appointments for a patient (the booking page sends no patient). Dispensing doesn't reduce medicine stock. There is no UI for creating bills, ordering lab tests, or doctor and department management.
4. The admin dashboard's monthly trend is hard-coded, and departments with zero appointments show random counts.
5. Default passwords `password123` are used for demo accounts and for staff-created patient and doctor accounts.
6. Tokens remain valid until expiry after a password change or deactivation. There is no rate limiting on login (the `express-rate-limit` package is installed but unused).
7. `npm run lint` in `frontend/` has no ESLint installed or configured.
