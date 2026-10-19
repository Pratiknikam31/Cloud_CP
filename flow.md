# flow.md — Smart Hospital: Workflows, Role Testing and Permission Audit

> **Status of this document (2026-10-17).** It was written after reading the code and running real tests.
> Every PASS/FAIL below comes from a request that was actually sent to the backend. Anything that was only
> read in the code is marked **Reviewed, not executed** or **NOT TESTED**. Nothing here was invented to fill a template.
>
> **Headline:** the application *works* end-to-end, but its server-side authorization is **not safe for real patient
> data**. 43 of 126 executed checks failed, including several critical issues (anyone can sign up as an administrator,
> and any logged-in user can read other patients' records by id). See [§27](#27-bugs-and-security-findings).

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [How to run the application](#2-how-to-run-the-application)
3. [Actual role inventory](#3-actual-role-inventory)
4. [Actual feature inventory](#4-actual-feature-inventory)
5. [Authentication and session flow](#5-authentication-and-session-flow)
6. [Role-based access control explanation](#6-role-based-access-control-explanation)
7. [Permission matrix (8 roles × 8 features)](#7-permission-matrix-8-roles--8-features)
8. [Role-by-role instructions](#8-role-by-role-instructions)
9. [Feature-by-feature instructions](#9-feature-by-feature-instructions)
10. [Complete patient appointment lifecycle (Workflow A)](#10-complete-patient-appointment-lifecycle-workflow-a)
11. [Receptionist workflow (Workflow B)](#11-receptionist-workflow-workflow-b)
12. [Doctor workflow (Workflow C)](#12-doctor-workflow-workflow-c)
13. [Nurse workflow (Workflow D)](#13-nurse-workflow-workflow-d)
14. [Laboratory workflow (Workflow E)](#14-laboratory-workflow-workflow-e)
15. [Pharmacy workflow (Workflow F)](#15-pharmacy-workflow-workflow-f)
16. [Billing and payment workflow (Workflow G)](#16-billing-and-payment-workflow-workflow-g)
17. [Hospital Admin workflow (Workflow H, part 1)](#17-hospital-admin-workflow-workflow-h-part-1)
18. [Super Admin workflow (Workflow H, part 2)](#18-super-admin-workflow-workflow-h-part-2)
19. [Database and DynamoDB data flow](#19-database-and-dynamodb-data-flow)
20. [API endpoint and permission reference](#20-api-endpoint-and-permission-reference)
21. [Positive manual test cases](#21-positive-manual-test-cases)
22. [Negative and unauthorized access tests](#22-negative-and-unauthorized-access-tests)
23. [Missing capability tests](#23-missing-capability-tests)
24. [Role escalation and cross-user access tests](#24-role-escalation-and-cross-user-access-tests)
25. [End-to-end integration test scenarios](#25-end-to-end-integration-test-scenarios)
26. [Test results and evidence](#26-test-results-and-evidence)
27. [Bugs and security findings](#27-bugs-and-security-findings)
28. [Missing features and recommended fixes](#28-missing-features-and-recommended-fixes)
29. [Final role permission audit summary](#29-final-role-permission-audit-summary)
30. [Retesting checklist after fixes](#30-retesting-checklist-after-fixes)

---

## 1. Project overview

**What it is.** A hospital management web application. Staff and patients log in to one website and see a dashboard that
depends on their role.

| Layer | Technology (verified in code) | Where |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind, React Router 6, axios | `frontend/` |
| Backend | Node.js (≥ 20) + Express 4 + TypeScript, zod validation, JWT auth, bcrypt | `backend/` |
| Database | **Amazon DynamoDB, single table** (`HospitalData` by default) with 3 global secondary indexes | `backend/src/db/` |
| Hosting | Vercel config for both apps (`frontend/vercel.json`, backend `src/app.ts` default export); Docker Compose optional | repo root |

**Verified current environment (not assumed):**

| Setting | Value | Evidence |
|---|---|---|
| Table name | `HospitalData` | `backend/.env` → `DYNAMODB_TABLE_NAME` |
| Region | `ap-southeast-2` | `backend/.env` → `AWS_REGION`; `/api/health?db=1` returned `"region":"ap-southeast-2"` |
| Credentials | AWS named profile (`AWS_PROFILE`) | `backend/.env` (values not reproduced here) |
| `NODE_ENV` | `development` | `backend/.env` |
| Live table contents | Demo (synthetic) data created by `npm run seed` on 2026-10-17 | the table was empty before that |

The live table is a **development** table holding only seeded demo data. Even so, **all tests in this document were run against an isolated DynamoDB Local copy**. No AWS data was written while testing. See [§26](#26-test-results-and-evidence).

**Data model in one sentence.** Everything (users, patients, doctors, appointments, records, bills …) lives in **one**
DynamoDB table. Each item type has its own key prefix, and three indexes let the app list "all items of a type", "everything of one
patient" and "everything of one doctor / user" without scanning ([§19](#19-database-and-dynamodb-data-flow)).

---

## 2. How to run the application

### 2.1 Normal local run (uses the real AWS table from `backend/.env`)

```bash
# terminal 1
cd backend
npm install
npm run dev            # http://localhost:5000  (health: /api/health?db=1)

# terminal 2
cd frontend
npm install
npm run dev            # http://localhost:5173  (Vite proxies /api -> :5000)
```

Open <http://localhost:5173/login>. The login page has demo-account buttons. All demo accounts use password `password123`. That is the seeder's public demo password, not a secret.

| Role | Demo e-mail (synthetic) |
|---|---|
| Hospital Admin | `admin@smarthospital.org` |
| Doctor | `doctor@smarthospital.org` (Dr. Eleanor Vance, Cardiology) |
| Doctor (second) | `brody@smarthospital.org` (Dr. Marcus Brody) |
| Patient | `patient@smarthospital.org` (Robert Chen) |
| Patient (second) | `maria@smarthospital.org`, `david@smarthospital.org` |
| Receptionist | `reception@smarthospital.org` |
| Laboratory Staff | `lab@smarthospital.org` |
| Pharmacist | `pharmacy@smarthospital.org` |
| Nurse | `nurse@smarthospital.org` |
| Super Admin | **not seeded** — see [§18](#18-super-admin-workflow-workflow-h-part-2) |

If logins fail with "Invalid credentials", the table is empty. Seed it once with `cd backend && npm run seed`. The seeder refuses to run twice, and it refuses when `NODE_ENV=production`.

### 2.2 Safe, isolated test environment (recommended for everything in this document)

No AWS account or cost is needed. Docker *or* Java works. This is exactly how the results in §26 were produced.

```bash
# 1. Start DynamoDB Local (pick one)
docker run -p 8000:8000 amazon/dynamodb-local:2.5.4 -jar DynamoDBLocal.jar -inMemory -sharedDb
#   or, with Java and the official JAR:
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -inMemory -sharedDb -port 8000

# 2. Point the backend at it (these override backend/.env), create a table, seed, run on another port
cd backend
export DYNAMODB_ENDPOINT=http://localhost:8000 AWS_REGION=us-east-1 \
       DYNAMODB_TABLE_NAME=HospitalData-audit JWT_SECRET=local-test-only-secret PORT=5055 AWS_PROFILE=
npm run db:create-table
npm run seed
npm run dev            # http://localhost:5055/api/health?db=1 must show "table":"HospitalData-audit"
```

The frontend's dev proxy targets port 5000. For UI testing against the isolated backend, run that backend on `PORT=5000`, after stopping the normal one.

### 2.3 Automated test suite

```bash
cd backend
npm test               # needs DynamoDB Local on :8000; each test file creates and deletes its own table
```

Result when run on 2026-10-17: **7 suites, 87 tests, all passed.** These tests check functional correctness: atomic
booking, counters, pagination, seed integrity and so on. They do **not** check record ownership, which is why they pass while
the authorization audit below fails.

---

## 3. Actual role inventory

The backend type `UserRole` (`backend/src/types/entities.ts`) declares **11** role strings. In practice there are **8 usable roles**, which match the checklist. The other 3 are aliases or unused.

| # | Role (checklist) | Role string in code | Can be created by | Seeded demo user | Landing page after login |
|---|---|---|---|---|---|
| 1 | Super Admin | `super_admin` | public sign-up API ⚠ | none | `/admin/dashboard` |
| 2 | Hospital Admin | `hospital_admin` | public sign-up page **and** API ⚠ | yes | `/admin/dashboard` |
| 3 | Doctor | `doctor` | admin (`POST /api/doctors`, creates login + profile); public sign-up (login **without** doctor profile ⚠) | yes (2) | `/doctor/dashboard` |
| 4 | Nurse | `nurse` | public sign-up API only | yes | `/dashboard` → renders the **Patient** dashboard (no nurse dashboard exists) |
| 5 | Receptionist | `receptionist` | public sign-up page | yes | `/reception/dashboard` |
| 6 | Laboratory Staff | `lab_staff` | public sign-up page | yes | `/lab/dashboard` |
| 7 | Pharmacist | `pharmacist` | public sign-up page | yes | `/pharmacy/dashboard` |
| 8 | Patient | `patient` | public sign-up (also creates a patient profile); receptionist/admin (`POST /api/patients`) | yes (3) | `/patient/dashboard` |

**Discrepancies (explained, not hidden):**

- **`admin`** and **`lab_technician`** are *permission aliases*, not separate accounts. Routes say `authorizeRoles('admin')` or
  `'lab_technician'`. `backend/src/middleware/rbac.ts` expands `admin` to `super_admin` and `hospital_admin`, and expands
  `lab_technician` to `lab_staff`. No account can register with these strings, because the register validator rejects them.
- **`billing_staff`** is declared and has a sidebar menu in `frontend/src/layouts/DashboardLayout.tsx`. However, no route grants it
  anything, it cannot be registered, and it is not seeded. **It is a dead role.**
- **Super Admin and Hospital Admin have identical server permissions.** Both pass every `admin` check, and no endpoint is
  restricted to `super_admin`. The only place they differ is the audit-log route, which lists both explicitly.

---

## 4. Actual feature inventory

The code contains **8 core modules** and **3 supporting services**. Each module below names its route file.

| # | Module (as implemented) | Backend routes | Main frontend pages |
|---|---|---|---|
| F1 | **Authentication & accounts** (sign-up, login, profile, password, notifications) | `authRoutes.ts`, `notificationRoutes.ts` | `Login.tsx`, `Register.tsx`, header bell in `DashboardLayout.tsx` |
| F2 | **Patient registration & records** (patient profiles, timeline, search) | `patientRoutes.ts`, `analyticsRoutes.ts` (`/search`) | `ReceptionistDashboard.tsx` (register modal), `BedManager.tsx` (picker) |
| F3 | **Appointments & queue** | `appointmentRoutes.ts`, `doctorRoutes.ts` (`/:id/slots`), `departmentRoutes.ts` (read) | `AppointmentBooking.tsx`, `MyAppointments.tsx`, `ReceptionistDashboard.tsx`, `DoctorDashboard.tsx` |
| F4 | **Clinical consultation: EMR & prescriptions** | `emrRoutes.ts` | `EMRConsultation.tsx`, `PatientDashboard.tsx` |
| F5 | **Laboratory** (test catalog, orders/reports, results) | `labRoutes.ts` | `LabDashboard.tsx` |
| F6 | **Pharmacy & inventory** (medicines, stock ledger, dispensing, forecasts) | `pharmacyRoutes.ts`, `aiRoutes.ts` (`/inventory-forecast`) | `PharmacyDashboard.tsx`, `InventoryManager.tsx` |
| F7 | **Beds & wards / inpatient care** (rooms, beds, admit/discharge) | `bedRoutes.ts`, `aiRoutes.ts` (`/bed-forecast`) | `BedManager.tsx` |
| F8 | **Billing & payments** | `billingRoutes.ts` | `BillingInvoice.tsx` |

**Supporting services, documented under the Admin and Patient workflows:**

- **S1 Administration & reporting.** Covers analytics overview, audit logs, department and doctor management: `analyticsRoutes.ts`, `auditRoutes.ts`, `departmentRoutes.ts`, `doctorRoutes.ts`. Pages: `AdminDashboard.tsx`, `AuditLogViewer.tsx`.
- **S2 Notifications.** These are created automatically on booking and status changes, and an admin can create one manually.
- **S3 AI assistance.** A rule-based symptom-to-department matcher (public, `/patient/ai-recommendation`) plus stock and bed forecasts.

**Discrepancy with the checklist.** The checklist names "Nursing and patient care" as a module. **No nursing module exists**: there is no
vitals, nursing-notes or care-task endpoint or page. Today a nurse's only workspace is Beds & wards (F7). That is why F7 takes the
nursing slot here. "Administration and reports" is real, but it is implemented as supporting endpoints rather than one
module. **User and role management does not exist at all** ([§28](#28-missing-features-and-recommended-fixes)).

---

## 5. Authentication and session flow

```text
Sign-up  POST /api/auth/register {name,email,password,role?,phone?}
  ├─ zod: email valid, password ≥ 6, role ∈ {super_admin, hospital_admin, doctor, nurse,
  │        receptionist, lab_staff, pharmacist, patient} (default patient)        ⚠ client chooses role
  ├─ email uniqueness guard item  UNIQUE#EMAIL#<email> (transaction)
  ├─ role = patient → also creates PATIENT#<uuid> profile (placeholder dob/address)
  └─ returns 201 + JWT  (no e-mail verification)

Login    POST /api/auth/login {email,password}
  ├─ unknown e-mail or wrong password → 401 "Invalid credentials" (same message: no user enumeration)
  ├─ user.isActive === false → 403 (there is no API to set isActive=false)
  └─ 200 + JWT {id,email,role,name}, expiry JWT_EXPIRES_IN (7d)

Every protected request
  Authorization: Bearer <JWT>  → authenticateJWT verifies signature/expiry only
  → req.user = token claims (role is taken from the token, not re-read from the DB)
  → authorizeRoles(...) checks req.user.role (with admin / lab_technician aliases)
```

**Frontend side.** `AuthContext.tsx` stores the token and user in `localStorage` (`smarthospital_token`, `smarthospital_user`).
On load it calls `GET /api/auth/me` to refresh the user. A 401 from any call clears storage (`api/client.ts`). Logout is
**client-side only**: it deletes the token, but the token itself stays valid until it expires.

| Item | Implemented? | Notes |
|---|---|---|
| Sign-up / login / logout | Yes | Logout is client-side only |
| Change password | Yes, `POST /api/auth/change-password` | Requires the current password. There is no UI for it. |
| Forgot / reset password | **No** | `Login.tsx` links to `/forgot-password`. No such route exists, so the catch-all redirects to `/`. |
| Login rate limiting | **No** | `express-rate-limit` is installed but never used |
| Token revocation / deactivation | **No** | `isActive` is checked only at login, not on each request |

---

## 6. Role-based access control explanation

There are **three layers**. Only the first one is real security.

1. **Backend role check (feature/action level).** Implemented with `authorizeRoles()` on individual routes (`backend/src/routes/*.ts`).
   Many routes have **no role check at all**: any logged-in user may call them ([§20](#20-api-endpoint-and-permission-reference)).
2. **Backend record scoping (record level).** Implemented **only for list endpoints**:
   - patients see their own appointments, EMR records, prescriptions, lab reports and bills;
   - doctors see their own appointments, EMR records and prescriptions. They do **not** get scoped lab reports.
   - **Fetch-by-id, update and pay endpoints never check ownership.** If the user is a doctor or patient *without* a profile
     (for example a self-registered "doctor"), the scoping is skipped and they see **everything**.
3. **Frontend menus.** `DashboardLayout.tsx` shows a role-specific sidebar. However, `ProtectedRoute` is used **without**
   `allowedRoles`, so **any logged-in user can open any page by typing its URL**. The page then loads whatever the API allows.

Tenant level: the system is **single-hospital**. There is no tenant or hospital id on any item, so cross-tenant isolation does not apply.

---

## 7. Permission matrix (8 roles × 8 features)

Legend: **C** create · **R** read · **U** update · **D** delete · **A** administrative action · **S** restricted to own/assigned
records · **—** no access · **⚠** permitted by the server but should not be (verified FAIL or code-confirmed).
Each cell shows what is **implemented on the server today**.

| Role ↓ / Feature → | F1 Auth & accounts | F2 Patients | F3 Appointments | F4 EMR & Rx | F5 Lab | F6 Pharmacy | F7 Beds | F8 Billing |
|---|---|---|---|---|---|---|---|---|
| **Patient** | C (sign-up) · R/U self (S) | R any by id ⚠ · U any ⚠ · list — | C (for any patient ⚠) · R list (S) · R any by id ⚠ · U status any ⚠ · D — | R list (S) · R any by id ⚠ | R list (S) · R any by id ⚠ · catalog R | R medicines, forecasts ⚠ | R all beds incl. occupant name/phone ⚠ | R list (S) · R any by id ⚠ · **pay any bill** ⚠ |
| **Doctor** | R/U self | R list · R any · U any ⚠ | C · R list (S, own) · R any by id ⚠ · U status any ⚠ | C (as any doctor ⚠) · R list (S) · R any by id ⚠ | C orders · R all | R | R · assign/discharge | R all bills ⚠ |
| **Nurse** | R/U self | R list · R any | C · R all · U status any ⚠ | R all ⚠ · C — | R all | R · ledger — · dispense — | R · U status · assign/discharge | R all bills ⚠ |
| **Receptionist** | R/U self | C · R · U · D — | C · R all · U status · D | R all ⚠ · C — | R all · C — | R | R · U · assign/discharge · rooms — | C · R all · pay · stats · D — |
| **Laboratory Staff** | R/U self | list — · R any by id ⚠ | R all ⚠ · U status any ⚠ | R all ⚠ | C/U catalog · C/U reports (incl. reopening completed ⚠) · D — | R | R | R all bills ⚠ |
| **Pharmacist** | R/U self | list — · R any by id ⚠ | R all ⚠ · U status any ⚠ | R all · C — | R all | C · R · U · stock adjust · ledger · dispense · D — | R | R all bills ⚠ |
| **Hospital Admin** | R/U self · **no user/role management** | C R U D (A) | C R U D (A) | C R | C R U D (A) | C R U D (A) | C R U D (A) | C R U D, pay (A) |
| **Super Admin** | identical to Hospital Admin | identical | identical | identical | identical | identical | identical | identical |

**How each kind of permission is enforced (or not):**

| Level | Implemented? | Where |
|---|---|---|
| Feature level (which roles reach a module) | Partly. Many routes have no role list. | `routes/*.ts` |
| Action level (create vs update vs delete) | Yes for create/delete in most modules. Missing for appointment status, patient update, bill pay, doctor update. | `routes/*.ts` |
| Record level (own/assigned records) | **List endpoints only** | `emrController.listByScope`, `appointmentController.getAppointments`, `labController.getLabReports`, `billingController.getBills` |
| Hospital/tenant level | Not applicable (single tenant) | — |

**Intended policy, the reference the ⚠ marks are judged against:** a patient reaches only their own records. A doctor reaches their own
appointments, plus the records of patients they treat. Clinical notes are visible to clinicians only. Financial data is visible to billing roles and the bill's patient. Status changes follow
a workflow owned by specific roles. Administrators are not self-assignable.

---

## 8. Role-by-role instructions

Each role section follows the same pattern. **A** covers overview, menu and landing page. **B** lists allowed capabilities with route, API and database effect. **C** lists forbidden capabilities and whether
they are actually blocked. **D** gives a numbered test checklist. Test IDs refer to the executed results in [§26](#26-test-results-and-evidence).

### 8.1 Patient (`patient`)

**A. Overview.** The patient books appointments and views their own care: prescriptions, lab reports and bills. After login they land on `/patient/dashboard`.
Their sidebar has these items:

| Menu item | Route | Page component |
|---|---|---|
| Health Portal | `/patient/dashboard` | `PatientDashboard` |
| AI Symptom Assister | `/patient/ai-recommendation` | `SymptomChecker` |
| Book Appointment | `/patient/book-appointment` | `AppointmentBooking` |
| My Appointments | `/patient/appointments` | `MyAppointments` |
| Medical History | `/patient/medical-records` | `EMRConsultation`, which loads the patient's own profile through `/auth/me` |
| Prescriptions | `/patient/prescriptions` | `EMRConsultation` (same page as Medical History) |
| Lab Reports | `/patient/lab-reports` | `LabDashboard` |
| Billing & Receipts | `/patient/bills` | `BillingInvoice` |

**B. Allowed capabilities**

| Capability | UI location | API | DB effect | Expected result |
|---|---|---|---|---|
| Book appointment | Book Appointment → dept → doctor → date/slot → reason → *Confirm* | `POST /api/appointments` (no `patient` field; the server fills in the caller's profile) | new `APPT#<uuid>`, `SLOT#…` lock, counters, notification for doctor, audit log | confirmation screen with `APT-YYYY-NNNNN` and queue number |
| See own appointments | My Appointments | `GET /api/appointments` (server forces own patient id) | none | Upcoming / Past tabs |
| See own records & prescriptions | Medical History / Prescriptions | `GET /api/emr/records?patient=<own>`, `GET /api/emr/prescriptions` | none | list of own items |
| See own lab reports | Lab Reports | `GET /api/lab/reports` (scoped) | none | own reports |
| See own bills | Billing & Receipts | `GET /api/billing` (scoped) | none | own bills |
| Record a payment on own bill | Billing → bill → *Record Payment* | `POST /api/billing/:id/pay` | bill `paidAmount`/`balance`/`status`, `STATS#BILLING` | status partially_paid / paid. **This is a mock: no money moves.** |
| Update own profile | no page (API only) | `PUT /api/patients/:id`, `PUT /api/auth/profile` | patient / user item | 200 |
| Symptom checker | AI Symptom Assister | `POST /api/ai/symptoms` (public) | none | suggested department and doctors |
| Notifications | header bell | `GET /api/notifications`, `PATCH …/read` | `read=true`, removed from the UNREAD index | — |

**C. Forbidden capabilities.** Each row states whether the server actually blocks it.

| Must not | Server blocks it? | Evidence |
|---|---|---|
| List the patient directory | **Yes** (403) | PAT-02 |
| Read another patient's appointment / EMR / prescription / lab report / bill / timeline / profile by id | **No** (200) | APPT-10, EMR-07, EMR-08, LAB-06, BILL-04, EMR-09, PAT-03 |
| Edit another patient's profile | **No** (200, data changed) | PAT-04 |
| Book for another patient | **No** (201) | APPT-05 |
| Cancel / complete any appointment | **No** (200) | APPT-13, APPT-14 |
| Pay or mark paid another patient's bill | **No** (200, paidAmount changed) | BILL-05 |
| Search other patients' names, phones, e-mails | **No** (200) | PAT-08 |
| See bed occupants | **No** (200) | PAT-09 |
| Delete appointments, discharge beds, edit lab catalog, send notifications | **Yes** (403) | APPT-17, BED-03, LAB-10, ADM-08 |
| Open admin pages by URL | Page opens (no route guard), and the data calls return 403 | Reviewed, not executed (FE-03) |

**D. Test checklist (Patient).**

1. Log in as `patient@smarthospital.org`. Expect `/patient/dashboard` and the name "Robert Chen" (AUTH-01-patient, PASS).
2. Log in with a wrong password. Expect a red "Invalid credentials" message (AUTH-02, PASS).
3. Book an appointment ([§10](#10-complete-patient-appointment-lifecycle-workflow-a)) (APPT-01..03, PASS).
4. Open My Appointments. The new item appears under Upcoming. Refresh the page and it is still there (APPT-02, PASS).
5. Open Medical History. Only Robert's records appear (EMR-06, PASS).
6. Direct URL test: open `/admin/audit-logs`. **Expected:** redirect away. **Actual by code:** the page renders and its API call
   returns 403, so the page shows empty data (FE-03, NOT TESTED in a browser).
7. API test with Robert's token: `GET /api/patients`. Expect 403 (PAT-02, PASS).
8. Cross-user test: copy one of Maria's ids (see [§22](#22-negative-and-unauthorized-access-tests)) and call
   `GET /api/emr/records/<maria-record-id>`. Expect 403/404. **Actual: 200** (EMR-07, FAIL).
9. Log out. `localStorage` no longer holds `smarthospital_token`. Pressing Back shows the login page (FE-08, NOT TESTED).

### 8.2 Doctor (`doctor`)

**A. Overview.** The doctor runs consultations and orders tests. After login they land on `/doctor/dashboard`. Their sidebar has these items:

| Menu item | Route | Page component |
|---|---|---|
| Doctor Dashboard | `/doctor/dashboard` | `DoctorDashboard` |
| My Schedule | `/doctor/appointments` | `DoctorDashboard` |
| Patient Consultations | `/doctor/consultations` | `EMRConsultation` |
| Prescriptions | `/doctor/prescriptions` | `EMRConsultation` |
| Lab Reports | `/doctor/lab-reports` | `LabDashboard` |

A doctor's identity in the data is their **doctor profile**: `DOCTOR#<id>`, linked through `GSI3 USER#<userId> / PROFILE#DOCTOR`.

**B. Allowed capabilities**

| Capability | UI | API | DB effect |
|---|---|---|---|
| See own appointment list | Doctor Dashboard table | `GET /api/appointments` (forced to own doctor id) | — |
| Change appointment status | status dropdown in the table (pending, confirmed, checked_in, in_consultation, completed, cancelled) | `PATCH /api/appointments/:id/status` | `status`, slot lock released or re-acquired, patient notification, audit |
| Write consultation (vitals, symptoms, diagnosis, notes, follow-up) | Patient Consultations → *Save* | `POST /api/emr/records` | `EMR#<uuid>`, counter `COUNTER#MEDICAL_RECORD` |
| Prescribe | same page, medicines list | `POST /api/emr/prescriptions` | `RX#<uuid>` status `active` |
| Order a lab test | **no UI**, API only | `POST /api/lab/reports` | `LAB#<uuid>` status `requested` |
| View lab reports | Lab Reports page / dashboard panel | `GET /api/lab/reports` | — |
| Admit / discharge a bed | URL `/admin/beds` (not in the doctor's menu) | `POST /api/beds/beds/:id/assign` / `discharge` | bed item |
| Analytics overview | URL only | `GET /api/analytics/overview` | — |

**C. Forbidden capabilities**

| Must not | Blocked? | Evidence |
|---|---|---|
| Open or change another doctor's appointment | **No** | APPT-25, APPT-26 |
| Write a record or prescription in another doctor's name | **No**. The UI also defaults the "consulting doctor" to the *first* doctor in the list. | EMR-03; `EMRConsultation.tsx` sets `selectedDoctorId` to `fetchedDocs[0]` |
| Read unrelated patients' records by id | **No** | EMR-12 |
| Edit another doctor's profile or fee | **No** | ADM-07 |
| Edit lab results | **Yes** (403) | LAB-07 |
| Create bills / adjust stock / read audit logs / delete patients | **Yes** (403) | BILL-02, PHA-06, ADM-03, PAT-06 |
| See all bills | **No** (200) | BILL-10-doctor |

**D. Test checklist (Doctor).**

1. Log in as `doctor@smarthospital.org`. Expect `/doctor/dashboard` (AUTH-01-doctor, PASS).
2. The table shows only Dr. Vance's appointments (APPT-23, PASS).
3. Log in as `brody@smarthospital.org`. Vance's appointment is not listed (APPT-24, PASS). Calling `GET /api/appointments/<id>` with Brody's token still returns 200 (APPT-25, FAIL).
4. Run the full consultation flow in [§12](#12-doctor-workflow-workflow-c) (EMR-01, EMR-02, APPT-27, APPT-28, PASS).
5. Negative test: `PUT /api/lab/reports/<id>` with a doctor token. Expect 403 (LAB-07, PASS).
6. Log out.

### 8.3 Nurse (`nurse`)

**A. Overview.** The nurse handles ward and bed care. After login they go to `/dashboard`, which renders `PatientDashboard`: there is **no nurse dashboard**.
Their sidebar has these items:

| Menu item | Route | Page component |
|---|---|---|
| Nurse Station | `/dashboard` | `PatientDashboard` |
| Bed & Ward Status | `/admin/beds` | `BedManager` |
| Patient Queue | `/reception/queue` | `ReceptionistDashboard` |
| EMR Records | `/doctor/consultations` | `EMRConsultation`. Saving fails with 403. |

**B. Allowed capabilities**

| Capability | UI | API |
|---|---|---|
| View beds/rooms, admit, discharge, change bed status | Bed & Ward Status | `GET /api/beds/*`, `POST …/assign`, `POST …/discharge`, `PUT /api/beds/beds/:id` |
| List patients (for admission) | Bed manager picker | `GET /api/patients` |
| View queue / check in | Patient Queue | `GET /api/appointments`, `PATCH …/status` |
| Read EMR records | EMR Records | `GET /api/emr/records` (hospital-wide) |

**C. Forbidden capabilities**

| Must not | Blocked? | Evidence |
|---|---|---|
| Create diagnoses or prescriptions | **Yes** (403) | EMR-04 |
| Dispense / read the inventory ledger | **Yes** (403) | PHA-02, PHA-10 |
| Read all bills | **No** | BILL-10-nurse |
| Change any appointment's status | **No** (any authenticated user can) | APPT-13/15 show the rule is global |

**Missing legitimate capability.** A nurse cannot record vital signs or nursing observations, because no endpoint or page exists for it (NUR-01, FAIL).

**D. Test checklist (Nurse).**

1. Log in as `nurse@smarthospital.org`. You land on a page titled "Patient Health Portal". That is a defect: the wrong dashboard (FE-05, NOT TESTED in a browser, but confirmed in `App.tsx` `DashboardDispatcher`).
2. Go to Bed & Ward Status, pick an available bed, choose *Assign*, and pick a patient. The bed turns occupied (BED-01, PASS).
3. Try to assign the same bed again. Expect "Bed is already occupied" (BED-02, PASS).
4. Choose *Discharge*. The bed becomes available (BED-04, PASS).
5. Open EMR Records and press Save. Expect an error message, because the server returns 403 (EMR-04, PASS).
6. Log out.

### 8.4 Receptionist (`receptionist`)

**A. Overview.** The receptionist runs the front desk: registration, check-in and beds. After login they land on `/reception/dashboard`.
Their sidebar has these items:

| Menu item | Route | Page component |
|---|---|---|
| Reception Desk | `/reception/dashboard` | `ReceptionistDashboard` |
| Live Queue Counter | `/reception/queue` | `ReceptionistDashboard` |
| Bookings & Check-in | `/reception/appointments` | `AppointmentBooking` |
| Bed Allocation | `/reception/beds` | `BedManager` |

**B. Allowed capabilities**

| Capability | UI | API | DB effect |
|---|---|---|---|
| Register walk-in patient | Reception Desk → *Register Patient* modal | `POST /api/patients` | user + `PATIENT#…` + e-mail guard + `STATS#TOTALS` (one transaction). ⚠ Every staff-created patient gets the same hard-coded initial password `password123`, with no forced change (see `patientController.createPatient`; S18). |
| Check in a patient | queue table → *Check In* | `PATCH /api/appointments/:id/status {checked_in}` | status + notification |
| Confirm / cancel / no-show | **no UI**, API only | same endpoint | status |
| Book for a patient | **broken in UI**, works through the API with a `patient` id | `POST /api/appointments` | APPT-08 FAIL, APPT-09 PASS |
| Delete appointment | **no UI**, API only | `DELETE /api/appointments/:id` | removes item, releases slot, decrements counters |
| Create bill | **no UI**, API only | `POST /api/billing` | `BILL#…` |
| Record payment, view billing stats | URL `/admin/billing` | `POST /api/billing/:id/pay`, `GET /api/billing/stats` | bill |
| Beds | Bed Allocation | assign / discharge / status | bed |

**C. Forbidden capabilities**

| Must not | Blocked? | Evidence |
|---|---|---|
| Issue prescriptions | **Yes** (403) | APPT-22 |
| Order lab tests | **Yes** (403) | LAB-09 |
| Create rooms / departments | **Yes** (403) | BED-05, ADM-05 |
| Delete bills | **Yes** (403) | BILL-11 |
| Read every clinical note and diagnosis | **No** (200) | EMR-11 |

**D. Test checklist (Receptionist).**

1. Log in as `reception@smarthospital.org`. Expect `/reception/dashboard` (AUTH-01-reception, PASS).
2. Choose *Register Patient* and fill the form with synthetic data. The new patient appears in the list (PAT-01, PASS).
3. Find the patient's pending appointment and choose *Check In*. The status becomes Checked In (APPT-19, PASS).
4. Open Bookings & Check-in, choose a doctor and slot, and press *Confirm*. **Actual:** an error, "patient: Required" (APPT-08, FAIL; missing patient picker).
5. Negative test: `POST /api/emr/prescriptions` with this token. Expect 403 (APPT-22, PASS).
6. Log out.

### 8.5 Laboratory Staff (`lab_staff`)

**A. Overview.** Lab staff process test orders. After login they land on `/lab/dashboard`. Their sidebar has these items:

| Menu item | Route | Page component |
|---|---|---|
| Lab Dashboard | `/lab/dashboard` | `LabDashboard` |
| Pending Tests | `/lab/tests` | `LabDashboard` |
| Completed Reports | `/lab/reports` | `LabDashboard` |

**B. Allowed capabilities**

| Capability | UI | API | DB effect |
|---|---|---|---|
| See all lab orders, filter by status | status filter buttons | `GET /api/lab/reports?status=` | — |
| Move status requested → sample_collected → processing → completed | row actions | `PUT /api/lab/reports/:id {status}` | `status`, `performedBy` |
| Enter results | report drawer → *Save results* | `PUT /api/lab/reports/:id {results[],status}` | `results[]` |
| Manage the test catalog | API only | `POST/PUT /api/lab/tests` | `LABTEST#…` + name guard |

**C. Forbidden capabilities**

| Must not | Blocked? | Evidence |
|---|---|---|
| Change prescriptions or diagnoses | **Yes**, because no route lets lab staff do it | route review |
| Delete reports or tests | **Yes** (admin only) | route review |
| Reopen a completed report and wipe its results | **No** (200) | LAB-08 |
| Read all clinical notes / all bills | **No** (200) | EMR-10, BILL-10-lab |
| Change appointment status | **No** (200) | APPT-15 |

**D. Test checklist (Lab).**

1. Log in as `lab@smarthospital.org`. Expect `/lab/dashboard` (AUTH-01-lab, PASS).
2. The order a doctor created via the API is listed under Requested (LAB-02, PASS).
3. Move it through Sample Collected, Processing and Completed, entering results (LAB-03, PASS).
4. Negative test: set the status back to `requested` with empty results. **Expected:** refused. **Actual:** 200 (LAB-08, FAIL).
5. Log out.

### 8.6 Pharmacist (`pharmacist`)

**A. Overview.** The pharmacist manages stock and dispenses prescriptions. After login they land on `/pharmacy/dashboard`. Their sidebar has these items:

| Menu item | Route | Page component |
|---|---|---|
| Pharmacy Dashboard | `/pharmacy/dashboard` | `PharmacyDashboard` |
| Medicine Catalog | `/pharmacy/inventory` | `InventoryManager` |
| Dispense Prescriptions | `/pharmacy/dispense` | `InventoryManager` |
| Stock Predictions | `/pharmacy/alerts` | `InventoryManager` |

The *Dispense* button lives on the dashboard page, not on the "Dispense Prescriptions" page.

**B. Allowed capabilities**

| Capability | UI | API | DB effect |
|---|---|---|---|
| See active prescriptions | dashboard list | `GET /api/emr/prescriptions` | — |
| Dispense | dashboard → *Dispense* | `POST /api/pharmacy/dispense {prescriptionId}` | prescription `status=dispensed`. **Stock is not changed.** |
| Add medicine | Medicine Catalog → *Add* | `POST /api/pharmacy/medicines` | `MED#…` + initial `INVTX#…` |
| Adjust stock (stock_in / stock_out / adjustment / expired) | catalog → *Adjust* | `POST /api/pharmacy/medicines/:id/adjust-stock` | medicine quantity and status + ledger entry (one transaction) |
| Ledger, forecasts | — | `GET /api/pharmacy/transactions`, `/medicines/predictions` | — |

**C. Forbidden capabilities**

| Must not | Blocked? | Evidence |
|---|---|---|
| Create prescriptions | **Yes** (403) | EMR-05 |
| Change a diagnosis | **Yes**, because no update route exists (404) | PHA-09 |
| Delete medicines | **Yes** (admin only) | route review |
| List the patient directory | **Yes** (403) | PAT-07 |
| See the whole appointment book / all bills | **No** (200) | APPT-16, BILL-10-pharmacy |

**D. Test checklist (Pharmacist).**

1. Log in as `pharmacy@smarthospital.org`. Expect `/pharmacy/dashboard` (AUTH-01-pharmacy, PASS).
2. Find Robert Chen's active prescription (PHA-01, PASS).
3. Choose *Dispense*. The status becomes dispensed (PHA-03, PASS). Choose *Dispense* again and expect "Prescription already dispensed" (PHA-04, PASS).
4. Check the stock of the dispensed medicine. **Expected:** reduced. **Actual:** unchanged (PHA-05, FAIL).
5. Adjust stock with type Stock Out and a quantity larger than the stock. Expect "Insufficient stock available" (PHA-07, PASS).
6. Log out.

### 8.7 Hospital Admin (`hospital_admin`)

**A. Overview.** The hospital admin manages the whole hospital. After login they land on `/admin/dashboard`. Their sidebar has these items:

| Menu item | Route | Page component |
|---|---|---|
| Admin Analytics | `/admin/dashboard` | `AdminDashboard` |
| Patients Directory | `/admin/patients` | `AdminDashboard` (no directory page) |
| Doctors Directory | `/admin/doctors` | `AdminDashboard` (no directory page) |
| Departments | `/admin/departments` | `AdminDashboard` (no directory page) |
| Appointments | `/admin/appointments` | `AppointmentBooking` |
| Live Queue Manager | `/admin/queue` | `ReceptionistDashboard` |
| Bed Management | `/admin/beds` | `BedManager` |
| Pharmacy Inventory | `/admin/pharmacy` | `InventoryManager` |
| Laboratory Tests | `/admin/laboratory` | `LabDashboard` |
| Billing & Invoices | `/admin/billing` | `BillingInvoice` |
| Audit Security Logs | `/admin/audit-logs` | `AuditLogViewer` |

The three "Directory" and "Departments" items render the analytics dashboard: there is no directory or management page behind them.

**B. Allowed capabilities.** The admin passes every `admin` route check: create, update and delete for patients, doctors, departments, rooms, beds, medicines, lab tests, reports and bills.
They can also read the analytics overview and the audit logs, and send notifications.

**C. Forbidden or missing.** There is no user list, no role change and no deactivation, because those endpoints don't exist (AUTH-14, FAIL as a missing capability). The admin is not
prevented from anything a super admin can do, because no super-admin-only action exists.

**D. Test checklist.** See [§17](#17-hospital-admin-workflow-workflow-h-part-1).

### 8.8 Super Admin (`super_admin`)

The Super Admin has the same menu and server permissions as the Hospital Admin. No account is seeded. The only way to get one today is the
**public sign-up API** (AUTH-07, FAIL, critical). See [§18](#18-super-admin-workflow-workflow-h-part-2).

---

## 9. Feature-by-feature instructions

For each feature, "Who" uses the permission notation from §7. The endpoint details are in §20.

### F1 Authentication & accounts

- **Purpose:** identity, sessions, profile and notifications.
- **Pages:** `/login`, `/register`, the header bell.
- **API:** `/api/auth/{register,login,me,profile,change-password}` and `/api/notifications/*`.
- **Data:** `USER#<uuid>` (SK `USER`, password is a bcrypt hash and never returned), guard `UNIQUE#EMAIL#<email>`. Notifications are stored as `NOTIF#<uuid>`, with GSI2 `USER#<recipient>` and sparse GSI3 `UNREAD#<recipient>`.
- **Validation:** e-mail format, password ≥ 6, role enum (client-chosen ⚠).
- **Business rules:** e-mail is unique (transactional guard), login errors are generic, and `role` in a profile update is ignored (AUTH-12, PASS).
- **Defects:** self-assigned admin roles (AUTH-07/08), no reset or rate limit, a profile-less doctor sees all records (AUTH-10/11).
- **Automated tests:** `backend/tests/identity.test.ts`.

### F2 Patient registration & records

- **Purpose:** patient demographics and history.
- **API:** `GET/POST /api/patients`, `GET/PUT/DELETE /api/patients/:id`, `GET /api/patients/:id/timeline`, and `GET /api/analytics/search`.
- **Data:** `PATIENT#<uuid>`, with GSI1 `TYPE#PATIENT` (by creation date) and GSI3 `USER#<userId>/PROFILE#PATIENT`. Search tokens are stored as separate items (see `db/search.ts`).
- **Validation:** `createPatientSchema`. Gender is an enum, blood group is an enum, and emergency contact is required.
- **Who:** list is open to admin, doctor, receptionist and nurse. Create is admin and receptionist. Update is admin, receptionist, doctor and patient (no ownership check ⚠). Delete is admin only (removes the profile only).
- **Defects:** PAT-03, PAT-04, EMR-09, PAT-08.
- **Automated tests:** `backend/tests/identity.test.ts`, `clinical.test.ts`.

### F3 Appointments & queue

- **Purpose:** booking, queue numbers, status workflow.
- **API:** `GET /api/appointments`, `GET /api/appointments/stats`, `GET /api/appointments/:id`, `POST /api/appointments`, `PATCH /api/appointments/:id/status`, `DELETE /api/appointments/:id`.
- **Data:** `APPT#<uuid>` plus slot lock `SLOT#<doctorId>#<YYYY-MM-DD>#<timeSlot>`. Details are in §19.
- **Validation:** `createAppointmentSchema`. Patient, doctor, department, date and slot are required, and symptoms must be ≥ 3 characters.
- **Business rules:** double booking is blocked atomically (APPT-04, PASS). The queue number restarts per doctor per day.
- **Defects:** no ownership checks, no state machine, past dates are accepted, the patient id is not validated (APPT-05/06/07/10/13/14/15/25/26/29).
- **Automated tests:** `backend/tests/appointments.test.ts`.

### F4 Clinical consultation: EMR & prescriptions

- **API:** `GET/POST /api/emr/records`, `GET /api/emr/records/:id`, and the same three for `/api/emr/prescriptions`. **There are no update or delete routes**, so records are immutable once written, which is good.
- **Data:** `EMR#<uuid>` and `RX#<uuid>`, with GSI2 `PATIENT#…` and GSI3 `DOCTOR#…`.
- **Validation:** vitals are required for a record (oxygen 0–100). A prescription needs at least one medicine.
- **Who:** create is doctor and admin only (EMR-04/05 and APPT-22 PASS). Reads are open to all roles ⚠.
- **Defects:** EMR-03, EMR-07, EMR-08, EMR-10, EMR-11, EMR-12.
- **Automated tests:** `backend/tests/clinical.test.ts`.

### F5 Laboratory

- **API:** `/api/lab/tests` (catalog) and `/api/lab/reports` (orders and results).
- **Data:** `LABTEST#…` (code `LT-NNN`, unique name guard) and `LAB#<uuid>` (id `LAB-NNNNNN`, status `requested | sample_collected | processing | completed`).
- **Who:** orders are created by doctor, lab and admin. Updates are lab and admin. Delete is admin only.
- **Rules:** none on transitions, so any status can be set from any status (LAB-08 FAIL). `performedBy` is overwritten with the last editor.
- **Missing:** a doctor's "order test" button. There is also no automatic bill line for tests.
- **Automated tests:** `backend/tests/pharmacyLab.test.ts`.

### F6 Pharmacy & inventory

- **Data:** `MED#…` (stock status is computed from `minStockLevel` and expiry), the ledger `INVTX#…` (GSI2 `MED#<id>`), and prescriptions (`RX#…`).
- **Rules:** stock adjustment and its ledger entry are written in one transaction. Stock can't go negative (PHA-07). Dispensing twice is refused (PHA-04).
- **Defects:** dispensing does not deduct stock or write a ledger entry (PHA-05).
- **Automated tests:** `backend/tests/pharmacyLab.test.ts`.

### F7 Beds & wards / inpatient care

- **Data:** `ROOM#…` and `BED#…` (GSI2 `ROOM#<id>`), with unique room and bed number guards.
- **Rules:** assigning an occupied bed is refused, and the check runs inside a versioned write (BED-02).
- **Who:** assign and discharge are admin, receptionist, nurse and doctor. Rooms are admin only.
- **Defects:** occupant names and phones are visible to every role, including patients (PAT-09). There is no link to a bill for the room rate.
- **Automated tests:** `backend/tests/facilitiesFinance.test.ts`.

### F8 Billing & payments

- **Data:** `BILL#…` (id `INV-NNNNNN`) with `items[]`, `totalAmount`, `paidAmount`, `balance`, and `status` (`pending | partially_paid | paid`), plus `STATS#BILLING`.
- **Payment:** there is no payment gateway. "Pay" just records an amount. The patient role is allowed to call it.
- **Defects:** BILL-04, BILL-05, BILL-08 (paidAmount can exceed the total), BILL-09, BILL-10.
- **Missing:** a UI for creating bills.
- **Automated tests:** `backend/tests/facilitiesFinance.test.ts`.

### Supporting: administration, notifications, AI

- **Administration:** analytics `GET /api/analytics/overview` (admin, doctor, receptionist), audit `GET /api/audit-logs` and `/stats` (super_admin, hospital_admin). Departments are public read with admin create, update and delete. Doctors are public read with admin create and delete; update is admin **and any doctor** ⚠ (ADM-07).
- **Audit:** an `AUDIT#…` item is written on logins, registrations and every create, update and delete. Rejected requests are **not** logged.
- **AI:** the symptom checker is public. The forecasts are open to any logged-in user (AI-03 ⚠).

---

## 10. Complete patient appointment lifecycle (Workflow A)

**Plain-language summary.** A patient picks a department, a doctor, a date and a slot. The server creates the appointment
as **pending**, gives it a human-readable number and a queue number, and locks that doctor's slot so nobody else can take it.

**Steps.** Executed through the API in the isolated environment. The UI path was reviewed in code, not clicked in a browser.

1. Log in as **Patient** (`patient@smarthospital.org`).
2. You land on `/patient/dashboard`.
3. Choose **Book Appointment** (`/patient/book-appointment`).
4. Step 1: choose a department, then a doctor. Departments come from `GET /api/departments` and doctors from `GET /api/doctors`, both public.
5. Step 2: choose a date and a time slot. **The slots are a fixed list in the page.** `GET /api/doctors/:id/slots` exists but is not used, so a
   doctor's `availableDays` are **not enforced**, on the server or in the UI.
6. Choose the visit type (in person / emergency) and enter a reason. It becomes `symptoms`, and must be at least 3 characters on the server.
7. Step 3: press **Confirm Booking**. The page sends `POST /api/appointments` with `{doctor, department, date, timeSlot, type, symptoms}`.
8. The confirmation shows `APT-2026-NNNNN`, the queue number and the status. Executed result: `201`, `status=pending` (APPT-01, PASS).
   - ⚠ If the response shape were unexpected, `AppointmentBooking.tsx` would show a **made-up** id built with `Math.random()`. This is a bug: the UI can show a confirmation that doesn't exist (Reviewed, not executed).
9. Open **My Appointments** (`/patient/appointments`).
10. The new appointment is under *Upcoming* (APPT-02, PASS).
11. Refresh the page. The appointment is still there, re-read from the server (APPT-03, PASS).
12. **API response.** `appointment._id` is a UUID, `appointmentId` is `APT-…`, and `patient`, `doctor` and `department` are populated with name fields.
13. **Ownership.** The server sets `patient` to the caller's own profile, found through `findPatientByUser`, **only when the body has no `patient` field**.
    A patient who sends `patient: <someone else>` books for that person (APPT-05, FAIL).

**How the identifiers are generated** (`backend/src/utils/ids.ts`):

- `_id` = `crypto.randomUUID()`
- `appointmentId` = `APT-<year>-<5-digit counter>`, using an atomic `ADD` on `COUNTER#APPOINTMENT`. It is never reused.
- `queueNumber` = an atomic counter `COUNTER#QUEUE#<doctorId>#<YYYY-MM-DD>`, so it restarts per doctor per day.

**What is written to the database, in one DynamoDB transaction:**

| Item | PK / SK | Purpose |
|---|---|---|
| Appointment | `APPT#<uuid>` / `APPT` + GSI1 `TYPE#APPT`/`<dateISO>#<uuid>`, GSI2 `PATIENT#<patientId>`/`APPT#<date>#<uuid>`, GSI3 `DOCTOR#<doctorId>`/`APPT#<date>#<uuid>` | the booking |
| Slot lock | `SLOT#<doctorId>#<day>#<timeSlot>` / `SLOT`, condition `attribute_not_exists(PK)` | blocks double booking (APPT-04 → 409) |
| Stats | `STATS#TOTALS` (+appointments), `STATS#DEPT#<id>` | dashboards |

**Written after the transaction:** a notification for the doctor (`NOTIF#…`) and an audit log entry (`AUDIT#…`).

---

## 11. Receptionist workflow (Workflow B)

1. Log out of the patient account and log in as **Receptionist**.
2. Open `/reception/dashboard`. It loads `GET /api/appointments?limit=50` and `GET /api/patients?limit=50`.
3. Find the appointment from Workflow A (APPT-18, PASS).
4. Check its details in the table: patient, doctor, slot, queue number and status.
5. Actions that exist:

   | Action | In the UI? | API | Executed result |
   |---|---|---|---|
   | Check in | **Yes**, *Check In* button (shown unless the status is already checked_in, in_consultation or completed) | `PATCH …/status {checked_in}` | APPT-19, PASS |
   | Confirm | No, API only | `PATCH …/status {confirmed}` | APPT-19, PASS |
   | Cancel / no-show | No, API only | same | not separately executed |
   | Reschedule | **Not implemented**: no endpoint changes date or slot | — | — |
   | Delete | No, API only | `DELETE /api/appointments/:id` (admin, receptionist) | route review |

6. Verify the status. `GET /api/appointments/:id` returns `checked_in`.
7. Back in the patient account, My Appointments shows "checked in" (APPT-20, PASS). A notification was created for the patient (APPT-21, PASS).
8. **Database change:** the appointment item's `status` and `version` change. The slot lock stays, because `checked_in` is still an active status.

**What belongs to the receptionist:** registration, scheduling, check-in, billing and beds.
**What must stay restricted:** clinical writes. These are correctly blocked: prescriptions (APPT-22), lab orders (LAB-09) and EMR create (route check).
Reading clinical notes is **not** blocked (EMR-11, FAIL).

---

## 12. Doctor workflow (Workflow C)

1. Log in as the **assigned doctor** (`doctor@smarthospital.org`, Dr. Vance).
2. `/doctor/dashboard` lists appointments from `GET /api/appointments`, which the server limits to `doctor = own profile`.
3. The appointment from Workflow A is present (APPT-23, PASS).
4. Patient details: the table shows the patient's name and symptoms. Full demographics come from `GET /api/appointments/:id`, which returns dob, allergies and history.
5. Start the consultation by setting the status dropdown to *In Consultation* (APPT-27, PASS).
6. Go to **Patient Consultations** (`/doctor/consultations?patientId=<id>`). Choose the patient. **Check the "consulting doctor" field**: it defaults to the first doctor in the list, not to you.
   Enter vitals, symptoms, diagnosis and notes, then press *Save*. This sends `POST /api/emr/records` (EMR-01, PASS).
7. In the same save, the listed medicines become a prescription through `POST /api/emr/prescriptions`, linked through `medicalRecord` (EMR-02, PASS).
8. Lab test request: **there is no button.** Use the API instead, `POST /api/lab/reports {patient, doctor, labTest, notes}` (LAB-01, PASS).
9. Complete the appointment by setting the status to *Completed* (APPT-28, PASS). The slot lock is released.
10. Who can see the result:

    | Who | What they see | Test |
    |---|---|---|
    | The patient | The record in Medical History | EMR-06 |
    | The pharmacist | The prescription | PHA-01 |
    | The lab | The order | LAB-02 |

**How doctor assignment is enforced.** It is enforced **only in the list endpoint**, and only when the doctor has a profile. Dr. Brody cannot *see* Vance's appointment in his list
(APPT-24, PASS), but he **can open it by id** (APPT-25, FAIL) and **change its status** (APPT-26, FAIL). He can also write a record
attributed to Vance (EMR-03, FAIL).

---

## 13. Nurse workflow (Workflow D)

1. Log in as **Nurse**. You land on the Patient dashboard, because no nurse workspace exists.
2. Open **Bed & Ward Status** (`/admin/beds`) or **Patient Queue** (`/reception/queue`).
3. Find the patient. The queue shows all appointments, and the bed manager shows patients through `GET /api/patients`.
4. Permitted information: the patient list, appointments, and EMR records hospital-wide (more than necessary, ⚠).
5. Record vital signs or observations: **not supported.** The only place vitals are stored is an EMR record, and creating one needs the doctor or admin role (NUR-01, FAIL, missing feature).
6. Nursing statuses: only bed status, admit and discharge (BED-01, BED-04, PASS).
7. Restricted actions are correctly blocked: diagnosis (EMR-04), dispensing (PHA-02) and the ledger (PHA-10). Appointment status is **not** restricted.
8. Persistence: bed assignment persists on the bed item, in `status`, `currentPatient` and `assignedDate`.

---

## 14. Laboratory workflow (Workflow E)

1. Log in as **Laboratory Staff**.
2. The doctor's order from Workflow C appears in `/lab/dashboard` under *Requested* (LAB-02, PASS).
3. Verify the patient, the ordering doctor and the test. They are populated from `patient`, `doctor` and `labTest`.
4. Move the status through `requested → sample_collected → processing → completed` (LAB-03, PASS). **The server enforces no order of steps.**
5. Enter the results (`results[]`: parameter, result, unit, normal range, abnormal flag) and save.
6. The report is "finalized" just by having the status `completed`. There is no separate sign-off.
7. Visibility:

   | Who | Can see the report? | Test |
   |---|---|---|
   | The patient | Yes, in their own list | LAB-04, PASS |
   | Another patient | Not in their list | LAB-05, PASS |
   | Another patient, by id | **Yes** | LAB-06, FAIL |

8. Changes after finalization: lab staff can set a completed report back to `requested` and wipe its results (LAB-08, FAIL). The audit log
   records *that* an update happened, but not the previous values. Doctors cannot edit results (LAB-07, PASS).

---

## 15. Pharmacy workflow (Workflow F)

1. Log in as **Pharmacist**.
2. `/pharmacy/dashboard` lists prescriptions from `GET /api/emr/prescriptions`, hospital-wide.
3. The prescription from Workflow C is shown, and the patient is Robert Chen (PHA-01, PASS).
4. Availability: the catalog shows stock levels, but **the dispense action does not check or reserve stock.**
5. Press **Dispense**. This sends `POST /api/pharmacy/dispense {prescriptionId}` and the status becomes `dispensed` (PHA-03, PASS). A second dispense is refused (PHA-04, PASS).
6. Inventory is **not** decremented by dispensing (PHA-05, FAIL). Stock only changes through a manual *Adjust stock* (PHA-07, PHA-08, PASS).
7. The pharmacist cannot create prescriptions (EMR-05) or change a diagnosis (PHA-09). Both are PASS.
8. Records: the prescription item's `status` changes and an audit log `DISPENSE` is written. No `INVTX` ledger entry is created.

---

## 16. Billing and payment workflow (Workflow G)

1. **Who owns billing:** the receptionist and admin create bills and view stats. The patient, receptionist and admin can record payments. Delete is admin only.
2. Log in as **Receptionist** or **Admin**.
3. Find the patient. **There is no "create bill" form**, so use the API instead:
   `POST /api/billing {patient, items[{description, category, amount, quantity}], tax, discount, dueDate}` (BILL-01, PASS).
4. `/admin/billing` lists the invoice with its total, paid amount and balance.
5. Charges: `totalAmount = Σ(amount×quantity) + tax − discount`. The status starts as `pending`.
6. Test payment: **no real payment gateway exists, so nothing is charged.** Use *Record Payment* with a small amount.
   - Partial payment → `partially_paid` (BILL-07, PASS).
   - A zero payment is refused (BILL-06, PASS).
   - A payment larger than the balance is **accepted**, and `paidAmount` goes above the total (BILL-08, FAIL).
   - Paying an already paid bill is accepted (BILL-09, FAIL).
7. Status updates: `paid` when the balance reaches 0. `STATS#BILLING` is updated in the same transaction.
8. Unauthorized modification:
   - The doctor cannot create bills (BILL-02, PASS).
   - The receptionist cannot delete bills (BILL-11, PASS).
   - **A patient can record payments on anyone's bill** (BILL-05, FAIL).
   - **Any patient can mark their own bill paid without paying**, because "pay" is just a field update.
9. Exposure: doctors, nurses, lab staff and pharmacists can list every bill (BILL-10-*, FAIL). Any user can open any bill by id (BILL-04, FAIL).

---

## 17. Hospital Admin workflow (Workflow H, part 1)

| # | Step | API | Executed result |
|---|---|---|---|
| 1 | Log in as `admin@smarthospital.org` and land on `/admin/dashboard` | `GET /api/analytics/overview` | ADM-01, PASS |
| 2 | Staff management: onboard a doctor (creates the login, doctor profile and e-mail guard). There is **no UI** for this. | `POST /api/doctors` | ADM-06, PASS |
| 3 | Hospital configuration: create a department | `POST /api/departments` | ADM-04, PASS |
| 4 | Reports: audit log viewer at `/admin/audit-logs` | `GET /api/audit-logs` | ADM-02, PASS. Workflow actions such as `APPOINTMENT_STATUS_CHANGED` appear. |
| 5 | User management: list users, change a role, deactivate an account | — | **Not implemented**: `GET /api/users` returns 404 (AUTH-14) |
| 6 | Super-admin-only capabilities are not granted | — | Not applicable, because none exist ([§18](#18-super-admin-workflow-workflow-h-part-2)) |

Other admin abilities were reviewed in the routes but not separately executed: create, update and delete for rooms and beds, delete patients, bills, medicines, lab tests and reports, and send notifications.

---

## 18. Super Admin workflow (Workflow H, part 2)

1. **Getting a Super Admin account.** None is seeded, and no admin screen can create one. The **only** way today is
   `POST /api/auth/register {…, "role":"super_admin"}`, which any anonymous visitor can call (AUTH-07, FAIL, critical).
2. Log in as that account. The landing page is `/admin/dashboard`, the same as the Hospital Admin.
3. **Global user management, role management and configuration: not implemented.** Super Admin has exactly the Hospital Admin's powers. The executed test shows
   the self-registered super admin reading the audit logs (AUTH-09).
4. Role changes are validated and recorded: **no role-change feature exists**, so there is nothing to validate.
5. Ordinary staff cannot raise their own privileges through the profile endpoint, because `role` is ignored (AUTH-12, PASS). However, **anyone can create a fresh
   admin account through sign-up**, which makes that protection moot.

---

## 19. Database and DynamoDB data flow

### 19.1 Table layout (verified in `backend/src/db/table.ts`, `repositories/index.ts`)

| Key | Format | Used for |
|---|---|---|
| Base PK / SK | `<TYPE>#<uuid>` / `<TYPE>` | get / update / delete by id |
| GSI1PK / GSI1SK | `TYPE#<type>` / `<date or name>#<uuid>` | "list all X", sorted |
| GSI2PK / GSI2SK | `PATIENT#<patientId>` / `<TYPE>#<date>#<uuid>`, or a parent (`DEPT#`, `ROOM#`, `MED#`, `USER#`) | "everything of one patient", children of a parent |
| GSI3PK / GSI3SK | `DOCTOR#<doctorId>` / `<TYPE>#<date>#<uuid>`, `USER#<userId>` / `PROFILE#…`, `UNREAD#<userId>` | "everything of one doctor", profile lookup, unread notifications |

Entity type prefixes: `USER PATIENT DOCTOR DEPT APPT EMR RX MED INVTX LABTEST LAB ROOM BED BILL NOTIF AUDIT`.

Helper items (these are **not** login records):

| Prefix | Purpose |
|---|---|
| `UNIQUE#<kind>#<value>` | Uniqueness guards for e-mail, department name and code, room, bed and lab test |
| `SLOT#…` | Booking locks |
| `COUNTER#…` | Human-readable ids and queue numbers |
| `STATS#…` | Dashboard totals |

Every entity item also carries `entityType` and a `version` number. Every update is a conditional write on `version`, so concurrent edits get a 409 instead of silently overwriting each other.
The app never runs a Scan. All reads are GetItem, BatchGetItem or Query.

### 19.2 How the records link together

```text
USER#u1 ──(GSI3 USER#u1/PROFILE#PATIENT)──► PATIENT#p1
USER#u2 ──(GSI3 USER#u2/PROFILE#DOCTOR)───► DOCTOR#d1 ──(GSI2 DEPT#k)──► DEPT#k
APPT#a1   {patient:p1, doctor:d1, department:k}   GSI2 PATIENT#p1, GSI3 DOCTOR#d1
EMR#e1    {patient:p1, doctor:d1, appointment:a1} GSI2 PATIENT#p1, GSI3 DOCTOR#d1
RX#r1     {patient:p1, doctor:d1, medicalRecord:e1}
LAB#l1    {patient:p1, doctor:d1, labTest:t1}
BILL#b1   {patient:p1}   (no link to appointment / lab / rx)
BED#x     {currentPatient:p1, room:ROOM#…}
```

### 19.3 Per-workflow trace

| Workflow | API → controller | Authorization actually checked | Items written | Frontend re-reads via | Who can read the result |
|---|---|---|---|---|---|
| Book | `POST /appointments` → `appointmentController.createAppointment` | logged in only | APPT, SLOT, STATS ×2, COUNTER ×2, NOTIF, AUDIT | `GET /appointments` | patient & doctor (lists), everyone else (lists), **anyone by id** |
| Status change | `PATCH /appointments/:id/status` → `updateAppointmentStatus` | logged in only | APPT (+SLOT delete/put), NOTIF, AUDIT | page state + reload | as above |
| Consultation | `POST /emr/records`, `/emr/prescriptions` → `emrController` | role doctor/admin | EMR, RX, COUNTER, AUDIT | `GET /emr/records?patient=` | patient (own list), doctor (own list), all staff lists, anyone by id |
| Lab | `POST/PUT /lab/reports` → `labController` | role doctor/lab/admin (create), lab/admin (update) | LAB, COUNTER, AUDIT | `GET /lab/reports` | patient (own list), all staff, anyone by id |
| Dispense | `POST /pharmacy/dispense` → `pharmacyController.dispensePrescription` | role pharmacist/admin | RX (status), AUDIT | `GET /emr/prescriptions` | as RX |
| Billing | `POST /billing`, `POST /billing/:id/pay` → `billingController` | create: receptionist/admin; pay: +patient | BILL, STATS#BILLING, COUNTER, AUDIT | `GET /billing` | patient (own list), all staff, anyone by id |
| Admit | `POST /beds/beds/:id/assign` → `bedController.assignBed` | admin/receptionist/nurse/doctor | BED, AUDIT | `GET /beds/beds` | everyone logged in (incl. patients) |

### 19.4 Appointment status transitions (as implemented)

Statuses: `pending, confirmed, checked_in, in_consultation, completed, cancelled, no_show`.

| Fact | Detail |
|---|---|
| Who can trigger a change | **any authenticated user** |
| Which changes are allowed | **any status → any status** |
| Validation | Only that the status is one of the seven values |
| Slot lock | Held while active (pending, confirmed, checked_in, in_consultation). Released when the status becomes completed, cancelled or no_show. Re-acquired when it becomes active again, which fails with a 409 if someone else took the slot meanwhile. |

```text
Designed path used by the UI:  pending → (confirmed) → checked_in → in_consultation → completed
UI triggers:                   receptionist "Check In" button; doctor status dropdown (all except no_show)
Patient UI:                    no status controls
Server rules:                  none (APPT-29: completed → pending accepted)
```

| Problem | Result | Evidence |
|---|---|---|
| Invalid transitions | accepted | APPT-29 |
| Duplicate booking | correctly blocked | APPT-04 |
| Missing ownership | everywhere outside lists | §27 |
| Stale frontend data | `DoctorDashboard` updates its own state optimistically, even if the request fails (the error is only logged to the console) | code review |

---

## 20. API endpoint and permission reference

All paths start with `/api`. 82 endpoints were reviewed: 81 route handlers plus `GET /api/health`.

The "Allowed roles" column uses these terms:

- **public:** no token needed.
- **auth:** any logged-in user.
- **admin:** `super_admin` or `hospital_admin`.
- **lab:** `lab_staff`.

The **Ownership check** column says whether the server checks that the record belongs to the caller.

| Method & path | Allowed roles | Ownership check | Notes |
|---|---|---|---|
| GET /health | public | — | `?db=1` checks the table |
| POST /auth/register | public | — | ⚠ client picks role incl. super_admin |
| POST /auth/login | public | — | no rate limit |
| GET /auth/me | auth | self | |
| PUT /auth/profile | auth | self | role ignored ✔ |
| POST /auth/change-password | auth | self | |
| GET /patients | admin, doctor, receptionist, nurse | — | |
| GET /patients/:id | auth | **none** ⚠ | |
| GET /patients/:id/timeline | auth | **none** ⚠ | full history |
| POST /patients | admin, receptionist | — | |
| PUT /patients/:id | admin, receptionist, doctor, patient | **none** ⚠ | |
| DELETE /patients/:id | admin | — | |
| GET /doctors, /doctors/:id, /doctors/:id/slots | public | — | |
| POST /doctors | admin | — | |
| PUT /doctors/:id | admin, doctor | **none** ⚠ | any doctor edits any doctor |
| DELETE /doctors/:id | admin | — | |
| GET /departments, /departments/:id | public | — | |
| POST/PUT/DELETE /departments(/:id) | admin | — | |
| GET /appointments | auth | list scoped for patient/doctor (if profile exists) | others see all |
| GET /appointments/stats | auth | — | hospital-wide counts |
| GET /appointments/:id | auth | **none** ⚠ | returns patient dob/allergies/history |
| POST /appointments | auth | **none** ⚠ | patient id from body; not validated |
| PATCH /appointments/:id/status | auth | **none** ⚠ | no transition rules |
| DELETE /appointments/:id | admin, receptionist | — | |
| GET /emr/records, /emr/prescriptions | auth | list scoped for patient/doctor | others see all |
| GET /emr/records/:id, /emr/prescriptions/:id | auth | **none** ⚠ | |
| POST /emr/records, /emr/prescriptions | doctor, admin | doctor field not tied to caller ⚠ | |
| GET /pharmacy/medicines, /medicines/:id, /medicines/predictions | auth | — | |
| POST/PUT /pharmacy/medicines(/:id) | admin, pharmacist | — | |
| DELETE /pharmacy/medicines/:id | admin | — | |
| POST /pharmacy/medicines/:id/adjust-stock | admin, pharmacist | — | |
| GET /pharmacy/transactions | admin, pharmacist | — | |
| POST /pharmacy/dispense | admin, pharmacist | — | no stock deduction |
| GET /lab/tests, /lab/tests/:id | auth | — | |
| POST/PUT /lab/tests(/:id) | admin, lab | — | |
| DELETE /lab/tests/:id | admin | — | |
| GET /lab/reports | auth | list scoped for patient only | doctors see all |
| GET /lab/reports/:id | auth | **none** ⚠ | |
| POST /lab/reports | admin, doctor, lab | — | |
| PUT /lab/reports/:id | admin, lab | — | no transition rules |
| DELETE /lab/reports/:id | admin | — | |
| GET /beds/rooms, /beds/beds, /beds/beds/:id | auth | — | occupant PII to all ⚠ |
| POST/PUT/DELETE /beds/rooms(/:id) | admin | — | |
| POST /beds/beds, DELETE /beds/beds/:id | admin | — | |
| PUT /beds/beds/:id | admin, nurse, receptionist | — | |
| POST /beds/beds/:id/assign, /discharge | admin, receptionist, nurse, doctor | — | |
| GET /billing/stats | admin, receptionist | — | |
| GET /billing | auth | list scoped for patient | all staff see all ⚠ |
| GET /billing/:id | auth | **none** ⚠ | |
| POST /billing | admin, receptionist | — | |
| POST /billing/:id/pay | admin, receptionist, patient | **none** ⚠ | no overpay guard |
| DELETE /billing/:id | admin | — | |
| GET /notifications, PATCH /notifications/read-all, PATCH /notifications/:id/read | auth | self ✔ | |
| POST /notifications | admin | — | |
| GET /audit-logs, /audit-logs/stats | super_admin, hospital_admin | — | |
| POST /ai/symptoms | public | — | |
| GET /ai/inventory-forecast, /ai/bed-forecast | auth | — | |
| GET /analytics/overview | admin, doctor, receptionist | — | |
| GET /analytics/search | auth | **none** ⚠ | patient names, phones, e-mails |

---

## 21. Positive manual test cases

Format: one card per test. Every case lists its account, data, steps, expected results, actual result and status. The actual
results come from the executed run (§26). "FE" lines describe the UI path, which was reviewed in code but not clicked in a browser.

| ID | Role / Feature | Purpose | Prerequisites & data | Steps | Expected FE | Expected API | Expected DB | Actual | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| AUTH-01-* | each role / F1 | Valid login | seeded accounts, pw `password123` | Login page → e-mail + password → *Sign in* | role landing page (§3) | 200 + token + `user.role` | `lastLogin` set, `AUDIT USER_LOGIN` | 200 for all 9 accounts | PASS | `authController.login` |
| AUTH-06 | anonymous / F1 | Patient sign-up | unique synthetic e-mail | `/register` → role Patient → submit | redirect `/patient/dashboard` | 201, profile `P-YYYY-NNNN` | USER, PATIENT, UNIQUE#EMAIL, STATS | 201, profile created | PASS | `authController.register` |
| APPT-01..03 | Patient / F3 | Book + persist | Dr. Vance, date +5 days, `10:00 AM` | §10 steps 1–11 | confirmation, then listed in My Appointments | 201 pending; list contains it; GET by id 200 | APPT, SLOT, COUNTERs, STATS, NOTIF, AUDIT | as expected | PASS | `appointmentController.createAppointment` |
| APPT-04 | Patient 2 / F3 | Double booking blocked | same doctor/date/slot | book same slot as Maria | error "already booked" | 409 | nothing written (transaction cancelled) | 409 | PASS | `acquireSlot` |
| APPT-19..21 | Receptionist / F3 | Confirm + check-in, patient notified | appointment from APPT-01 | Reception Desk → *Check In* | status badge Checked In | 200 ×2 | APPT.status, NOTIF for patient | as expected | PASS | `updateAppointmentStatus` |
| APPT-23, 27, 28 | Doctor / F3 | See own, start, complete | as above | Doctor Dashboard → dropdown | status updates | 200 | APPT.status, SLOT released on completed | as expected | PASS | — |
| EMR-01, 02 | Doctor / F4 | Record + prescription | patient Robert | Consultations → fill → *Save* | "saved" banner | 201 ×2 | EMR, RX (active) | 201 ×2 | PASS | `emrController` |
| EMR-06 | Patient / F4 | Own records only | — | Medical History | list of own records | all `patient` = own | — | as expected | PASS | `listByScope` |
| PAT-01 | Receptionist / F2 | Walk-in registration | synthetic patient | *Register Patient* modal | new row | 201 `P-…` | USER, PATIENT, guard, STATS | 201 | PASS | `createPatient` |
| PAT-05 | Patient / F2 | Update own profile | — | API `PUT /patients/<own id>` | — | 200 | PATIENT phone | 200 | PASS | — |
| LAB-01..04 | Doctor, Lab, Patient / F5 | Order → results → patient sees | lab test from catalog | API order; Lab dashboard status buttons; patient Lab Reports | statuses advance; report visible | 201; 200 ×3; listed | LAB.status, results, performedBy | as expected | PASS | `labController` |
| PHA-01, 03, 04 | Pharmacist / F6 | See and dispense once | RX from EMR-02 | Pharmacy dashboard → *Dispense* twice | dispensed; second time error | 200; 400 | RX.status=dispensed | as expected | PASS | `dispensePrescription` |
| PHA-07, 08 | Pharmacist / F6 | Stock rules + ledger | Atorvastatin | *Adjust* stock_out 999999; stock_in 10 | error; quantity +10 | 400; 200 | MED.quantity, INVTX | as expected | PASS | `adjustStock` |
| BILL-01, 03, 06, 07 | Receptionist, Patient / F8 | Create bill, patient sees, pays partially | 100.00 consultation | API create; patient Billing → *Record Payment* 40 | partially paid | 201; listed; 400 for 0; 200 | BILL, STATS#BILLING | as expected | PASS | `billingController` |
| BED-01, 02, 04 | Nurse / F7 | Admit, block double, discharge | first available bed | Bed & Ward → *Assign* → *Discharge* | occupied → available | 200; 400; 200 | BED.status/currentPatient | as expected | PASS | `bedController` |
| ADM-01, 02, 04, 06 | Admin / S1 | Overview, audit, department, doctor | synthetic names | Admin dashboard; Audit page; API creates | data shown | 200; 200; 201; 201 | DEPT, DOCTOR+USER, AUDIT | as expected | PASS | — |
| AI-01 | anonymous / S3 | Symptom checker | "chest pain…" | AI page → *Analyze* | department + doctors | 200 | none | 200 | PASS | `aiController` |

---

## 22. Negative and unauthorized access tests

### 22.1 How to run a cross-user test yourself (safe, isolated backend)

```bash
API=http://localhost:5055/api          # the isolated backend from §2.2 — never production
login() { curl -s -X POST $API/auth/login -H 'content-type: application/json' \
          -d "{\"email\":\"$1\",\"password\":\"password123\"}" | node -pe 'JSON.parse(require("fs").readFileSync(0)).token'; }
ROBERT=$(login patient@smarthospital.org); MARIA=$(login maria@smarthospital.org)

# 1) find one of Robert's record ids (as Robert)
REC=$(curl -s $API/emr/records -H "authorization: Bearer $ROBERT" | node -pe 'JSON.parse(require("fs").readFileSync(0)).records[0]._id')
# 2) try to read it as Maria  -> secure result is 403 or 404
curl -s -o /dev/null -w '%{http_code}\n' $API/emr/records/$REC -H "authorization: Bearer $MARIA"
# 3) confirm nothing changed after a rejected write: re-read the item as admin and compare
```

### 22.2 Executed negative tests

**Correctly blocked (PASS).** These requests were refused and left the data unchanged.

| Group | Test IDs |
|---|---|
| Authentication | AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-12, AUTH-13 |
| Appointments & clinical | APPT-04, APPT-17, APPT-22, EMR-04, EMR-05, PAT-02, PAT-06, PAT-07 |
| Lab | LAB-07, LAB-09, LAB-10 |
| Pharmacy | PHA-02, PHA-04, PHA-06, PHA-07, PHA-09, PHA-10 |
| Billing | BILL-02, BILL-06, BILL-11 |
| Beds | BED-02, BED-03, BED-05 |
| Admin, notifications, AI | ADM-03, ADM-05, ADM-08, ADM-09, AI-02 |

**Not blocked (FAIL).** These requests succeeded and should have been refused. Where a write went through, the harness re-read the item afterwards and confirmed it **had** changed. It then restored the original value.

- **Cross-patient reads by id:** APPT-10, EMR-07, EMR-08, EMR-09, LAB-06, BILL-04, PAT-03.
- **Cross-user writes:** PAT-04 (address changed), APPT-13 (status pending to cancelled), BILL-05 (paidAmount 0 to 1), ADM-07 (fee 140 to 1).
- **Over-broad staff access:** APPT-15, APPT-16, EMR-10, EMR-11, BILL-10-nurse, BILL-10-lab, BILL-10-pharmacy, BILL-10-doctor, AI-03.
- **Data integrity:** APPT-06 (past date), APPT-07 (patient id that doesn't exist), APPT-29 (completed to pending), LAB-08 (completed to requested), BILL-08 (overpayment), BILL-09 (paying a paid bill).
- **Personal data leaks:** PAT-08 (search), PAT-09 (bed occupants).

### 22.3 Frontend checks (reviewed in code, not executed in a browser)

| ID | Check | Expected | Finding from code | Status |
|---|---|---|---|---|
| FE-01 | Sidebar per role | only own menu | role-specific menus in `DashboardLayout.tsx` | NOT TESTED (code matches) |
| FE-02 | Direct URL `/admin/billing` as patient | redirect or 403 page | `ProtectedRoute` has no `allowedRoles`, so the page renders. The patient's own bills load, and the Record Payment button is shown. | NOT TESTED |
| FE-03 | Direct URL `/admin/audit-logs` as patient | blocked | page renders and its API call returns 403, so the page shows empty data | NOT TESTED |
| FE-04 | Logged-out user opens `/doctor/dashboard` | redirect `/login` | `ProtectedRoute` redirects when `user` is null | NOT TESTED |
| FE-05 | Nurse landing page | nurse workspace | renders `PatientDashboard` | NOT TESTED (defect by code) |
| FE-06 | Register page roles | patient only | dropdown offers Doctor, Receptionist, Lab, Pharmacist, **Hospital Admin** | NOT TESTED (defect by code) |
| FE-07 | Forgot password link | reset page | `/forgot-password` route missing, so it redirects to `/` | NOT TESTED (defect by code) |
| FE-08 | Logout clears session | token removed | `AuthContext.logout` clears `localStorage`; the server token stays valid until it expires | NOT TESTED |
| FE-09 | Booking confirmation integrity | only real ids | fallback builds a random `APT-…` id | NOT TESTED (defect by code) |
| FE-10 | Doctor's consultation author | logged-in doctor | defaults to first doctor in list | NOT TESTED (defect by code) |
| FE-11 | Role switch after re-login | menus change | `login()` replaces stored user and token | NOT TESTED |
| FE-12 | Doctor status dropdown failure | revert on error | optimistic update kept even if the request fails | NOT TESTED (defect by code) |

---

## 23. Missing capability tests

| ID | Capability | Result | Classification |
|---|---|---|---|
| APPT-02 | Patient sees a newly booked appointment in My Appointments | PASS. Fixed on 2026-10-17: the page used to show the booking form. | — |
| APPT-23 | Doctor sees assigned appointments | PASS | — |
| LAB-02 | Lab sees an authorized order | PASS | — |
| PHA-01 | Pharmacist sees a valid prescription | PASS | — |
| APPT-08 | Receptionist or admin books for a patient from the booking page | **FAIL**: 400 "patient: Required" | Frontend problem: no patient picker |
| NUR-01 | Nurse records vitals or observations | **FAIL**: 403, and no endpoint exists | Missing feature |
| AUTH-14 | Admin manages users and roles | **FAIL**: 404 | Missing feature |
| PHA-05 | Dispensing reduces stock | **FAIL** | Missing feature or workflow bug |
| — | Doctor orders a lab test from the UI | API only | Missing frontend feature |
| — | Staff create a bill from the UI | API only | Missing frontend feature |
| — | Reschedule an appointment | no endpoint | Missing feature |
| — | Patient cancels own appointment | no UI. The API allows it but without ownership checks, so a cancel button should not be added until ownership is enforced. | Missing feature + authorization problem |
| — | Password reset | not implemented | Missing feature |
| — | Admin "Patients / Doctors / Departments Directory" | menu items render the analytics page | Routing problem / missing pages |
| — | Super Admin global administration | nothing beyond Hospital Admin | Missing feature |
| — | Doctor availability enforced in booking | slots are a fixed list, `availableDays` ignored | Missing business rule |
| — | `billing_staff` role | declared, but has no permissions | Dead role (intentional or unfinished) |

---

## 24. Role escalation and cross-user access tests

| ID | Attempt | Expected | Actual | Status |
|---|---|---|---|---|
| AUTH-07 | Anonymous signs up with `role: super_admin` | refused | 201, super_admin token | **FAIL (Critical)** |
| AUTH-08 | Anonymous signs up with `role: hospital_admin` (also offered in the UI dropdown) | refused | 201 | **FAIL (Critical)** |
| AUTH-09 | The self-made super admin reads audit logs | impossible | 200 | **FAIL** |
| AUTH-10/11 | Anonymous signs up as `doctor` (no profile) and lists EMR records and appointments | 0 / 403 | sees **every** record and appointment | **FAIL (Critical)** |
| AUTH-12 | Nurse sends `role: super_admin` in a profile update | ignored | ignored | PASS |
| EMR-03 | Doctor writes a diagnosis under another doctor's name | refused | 201 | **FAIL (High)** |
| ADM-07 | Doctor edits another doctor's fee | refused | 200, fee changed | **FAIL (High)** |
| APPT-05 | Patient books on behalf of another patient | refused | 201 | **FAIL** |
| PAT-04 | Patient edits another patient's address | refused | 200, changed | **FAIL (Critical)** |
| BILL-05 | Patient pays another patient's bill | refused | 200, changed | **FAIL (High)** |
| APPT-13 | Patient cancels another patient's appointment | refused | 200, changed | **FAIL (High)** |
| — | Hospital Admin escalates to Super Admin | n/a | there is no difference to escalate to | BLOCKED (feature absent) |
| — | Deactivated account keeps using its token | refused | not testable: there is no deactivate API. By code, `authenticateJWT` does not check `isActive`. | BLOCKED |
| — | Cross-tenant access | n/a | single tenant | Not applicable |

---

## 25. End-to-end integration test scenarios

**E2E-1 "Outpatient visit".** This was executed as one continuous run through the API, with test IDs in order:

1. Patient books the appointment (APPT-01).
2. Receptionist confirms and checks in (APPT-19).
3. Doctor starts the consultation (APPT-27).
4. Doctor writes the record (EMR-01) and the prescription (EMR-02).
5. Doctor orders a lab test (LAB-01). Lab collects, processes and completes it (LAB-03), and the patient sees the report (LAB-04).
6. Pharmacist dispenses (PHA-03).
7. Receptionist bills (BILL-01) and the patient pays partially (BILL-07).
8. Doctor completes the appointment (APPT-28).
9. Admin sees the audit trail (ADM-02).

**Result:** the functional path works end to end. All of those steps passed.

**E2E-2 "Inpatient stay".** Nurse admits Robert to a bed (BED-01), a double assignment is refused (BED-02), and the nurse discharges (BED-04). All PASS.
A room charge is **not** generated automatically. There is no link from beds to billing.

**E2E-3 "Malicious patient".** Maria, using only her own login:

1. Reads Robert's appointment, record, prescription, lab report, bill and timeline (APPT-10, EMR-07/08/09, LAB-06, BILL-04).
2. Changes his address (PAT-04).
3. Cancels his appointment (APPT-13).
4. Records a payment on his bill (BILL-05).
5. Searches for patient contact details (PAT-08).

**Result:** every step succeeded. **FAIL.**

**E2E-4 "Anonymous attacker".** An anonymous visitor:

1. Registers as `doctor` and reads every EMR record and appointment (AUTH-10/11).
2. Registers as `super_admin` and reads the audit logs (AUTH-07/09).

**Result:** both succeeded. **FAIL.**

---

## 26. Test results and evidence

### 26.1 Where and how the tests ran

**Environment.**

| Item | Value |
|---|---|
| Database | DynamoDB Local 2.x, in memory, on `localhost:8000` |
| Tables | `HospitalData-audit` (first run) and `HospitalData-audit2` (the final run reported here) |
| Data | Seeded with `npm run seed`, plus synthetic `@example.test` accounts created during the run |
| Backend | `npm run dev` on port 5055 with test-only `JWT_SECRET` |
| AWS writes during testing | **None** |

**Method.** A script made real HTTP requests as each seeded role. For every write that should have been refused, it
re-read the record as an admin to see whether the data changed. Where a write wrongly succeeded, it restored the original value afterwards.

**Other runs on 2026-10-17:**

- The backend's own `npm test` suite passed: 87 out of 87.
- A read-only smoke check against the real `HospitalData` table passed. All 7 seeded roles logged in, and every read endpoint returned 200 or the intended 403.

### 26.2 Counts

| Category | Count |
|---|---|
| Executed checks (this audit) | **126** |
| PASS | **83** |
| FAIL | **43** |
| BLOCKED (cannot be executed: feature absent) | **3** (deactivated-token reuse, Hospital Admin → Super Admin escalation, password reset) |
| NOT TESTED (frontend browser checks, reviewed in code) | **12** (FE-01…FE-12) |
| Automated backend tests (`npm test`) | 87 passed, 0 failed |

### 26.3 Full executed results

| ID | Role | Feature | Purpose | Endpoint | Expected | Actual | Status |
|---|---|---|---|---|---|---|---|
| AUTH-01-admin | Hospital Admin | Authentication | Valid login with seeded account | `POST /api/auth/login` | 200 + token | 200 role=hospital_admin | **PASS** |
| AUTH-01-doctor | Doctor | Authentication | Valid login with seeded account | `POST /api/auth/login` | 200 + token | 200 role=doctor | **PASS** |
| AUTH-01-doctor2 | Doctor (other) | Authentication | Valid login with seeded account | `POST /api/auth/login` | 200 + token | 200 role=doctor | **PASS** |
| AUTH-01-patient | Patient | Authentication | Valid login with seeded account | `POST /api/auth/login` | 200 + token | 200 role=patient | **PASS** |
| AUTH-01-patient2 | Patient (other) | Authentication | Valid login with seeded account | `POST /api/auth/login` | 200 + token | 200 role=patient | **PASS** |
| AUTH-01-reception | Receptionist | Authentication | Valid login with seeded account | `POST /api/auth/login` | 200 + token | 200 role=receptionist | **PASS** |
| AUTH-01-lab | Laboratory Staff | Authentication | Valid login with seeded account | `POST /api/auth/login` | 200 + token | 200 role=lab_staff | **PASS** |
| AUTH-01-pharmacy | Pharmacist | Authentication | Valid login with seeded account | `POST /api/auth/login` | 200 + token | 200 role=pharmacist | **PASS** |
| AUTH-01-nurse | Nurse | Authentication | Valid login with seeded account | `POST /api/auth/login` | 200 + token | 200 role=nurse | **PASS** |
| AUTH-02 | Patient | Authentication | Wrong password rejected | `POST /api/auth/login` | 401 | 401 Invalid credentials | **PASS** |
| AUTH-03 | Anonymous | Authentication | Unknown email rejected with same generic message | `POST /api/auth/login` | 401 "Invalid credentials" | 401 Invalid credentials | **PASS** |
| AUTH-04 | Anonymous | Authentication | Protected endpoint without token | `GET /api/auth/me` | 401 | 401 | **PASS** |
| AUTH-05 | Anonymous | Authentication | Tampered JWT signature | `GET /api/auth/me` | 401 | 401 | **PASS** |
| AUTH-06 | Patient | Authentication | Self-registration as patient creates user + patient profile | `POST /api/auth/register` | 201, role patient, profile exists | 201 role=patient profile=P-2026-0004 | **PASS** |
| AUTH-07 | Anonymous | User & role management | Public sign-up must not grant super_admin | `POST /api/auth/register` | 400/403 (role not self-assignable) | 201 role=super_admin | **FAIL** |
| AUTH-08 | Anonymous | User & role management | Public sign-up must not grant hospital_admin | `POST /api/auth/register` | 400/403 | 201 role=hospital_admin | **FAIL** |
| AUTH-09 | Super Admin | Administration | Self-registered super_admin can read audit logs | `GET /api/audit-logs` | Should be impossible (account should not exist) | 200 | **FAIL** |
| AUTH-10 | Doctor (self-registered) | Clinical records | Doctor without a doctor profile must not see every EMR record | `GET /api/emr/records` | 0 records or 403 | 200, 1 records returned | **FAIL** |
| AUTH-11 | Doctor (self-registered) | Appointments | Doctor without profile must not see every appointment | `GET /api/appointments` | 0 or 403 | 200, 3 appointments | **FAIL** |
| AUTH-12 | Nurse | User & role management | Mass assignment: role in profile update body is ignored | `PUT /api/auth/profile` | role stays nurse | 200, role now nurse | **PASS** |
| AUTH-13 | Nurse | Authentication | Change password with wrong current password | `POST /api/auth/change-password` | 400 | 400 Incorrect current password | **PASS** |
| AUTH-14 | Hospital Admin | User & role management | Admin user-management endpoint exists (list/deactivate/change role) | `GET /api/users` | 200 | 404 Route not found: GET /api/users | **FAIL** |
| APPT-01 | Patient | Appointments | Patient books appointment (UI payload, no patient field) | `POST /api/appointments` | 201, status pending, patient = own profile | 201 APT-2026-00004 status=pending patientMatches=true | **PASS** |
| APPT-02 | Patient | Appointments | New appointment appears in My Appointments list | `GET /api/appointments` | contains new appointment; all items own | 200 found=true allOwn=true | **PASS** |
| APPT-03 | Patient | Appointments | Appointment persists (re-read by id) | `GET /api/appointments/:id` | 200 same appointmentId | 200 APT-2026-00004 | **PASS** |
| APPT-04 | Patient (other) | Appointments | Double booking of same doctor/day/slot is refused | `POST /api/appointments` | 409 | 409 This time slot is already booked. Please choose a different time. | **PASS** |
| APPT-05 | Patient (other) | Appointments | Patient cannot create an appointment for another patient | `POST /api/appointments` | 403 or patient forced to own profile | 201 patientStored=OTHER PATIENT | **FAIL** |
| APPT-06 | Patient | Appointments | Booking in the past is refused | `POST /api/appointments` | 400 | 201 | **FAIL** |
| APPT-07 | Receptionist | Appointments | Appointment for non-existent patient id is refused | `POST /api/appointments` | 400 | 201 | **FAIL** |
| APPT-08 | Receptionist | Appointments | Receptionist can book through the shared booking page (page sends no patient field) | `POST /api/appointments` | 201 with a chosen patient | 400 patient: Required | **FAIL** |
| APPT-09 | Receptionist | Appointments | Receptionist books for a patient via API with patient id | `POST /api/appointments` | 201 | 201 | **PASS** |
| APPT-10 | Patient (other) | Appointments | Patient cannot read another patient's appointment by id | `GET /api/appointments/:id` | 403/404 | 200 (returned patient dob/allergies/history) | **FAIL** |
| APPT-11 | Patient (other) | Appointments | Other patient's list excludes Robert's appointment | `GET /api/appointments` | not listed | listed=false | **PASS** |
| APPT-12 | Patient (other) | Appointments | Changing ?patient= query does not reveal other patient | `GET /api/appointments?patient=<other>` | not listed | listed=false | **PASS** |
| APPT-13 | Patient (other) | Appointments | Patient cannot cancel another patient's appointment | `PATCH /api/appointments/:id/status` | 403, status unchanged | 200, status pending -> cancelled | **FAIL** |
| APPT-14 | Patient | Appointments | Patient cannot mark own appointment completed | `PATCH /api/appointments/:id/status` | 403 | 200 | **FAIL** |
| APPT-15 | Laboratory Staff | Appointments | Lab staff cannot change appointment status | `PATCH /api/appointments/:id/status` | 403 | 200 | **FAIL** |
| APPT-16 | Pharmacist | Appointments | Pharmacist should not list the hospital-wide appointment book | `GET /api/appointments` | 403 or 0 | 200, 8 appointments | **FAIL** |
| APPT-17 | Patient | Appointments | Patient cannot delete appointments | `DELETE /api/appointments/:id` | 403 | 403 | **PASS** |
| APPT-18 | Receptionist | Appointments | Receptionist finds the new appointment | `GET /api/appointments` | listed | 200 listed=true | **PASS** |
| APPT-19 | Receptionist | Appointments | Receptionist confirms then checks in | `PATCH /api/appointments/:id/status` | 200, 200 -> checked_in | 200, 200 -> checked_in | **PASS** |
| APPT-20 | Patient | Appointments | Patient sees receptionist update | `GET /api/appointments/:id` | checked_in | checked_in | **PASS** |
| APPT-21 | Patient | Notifications | Patient received status-change notification | `GET /api/notifications` | notification mentioning appointment | 8 matching | **PASS** |
| APPT-22 | Receptionist | Clinical records | Receptionist cannot issue a prescription | `POST /api/emr/prescriptions` | 403 | 403 | **PASS** |
| APPT-23 | Doctor | Appointments | Assigned doctor sees the appointment; list contains only own appointments | `GET /api/appointments` | listed, all own | listed=true allOwn=true | **PASS** |
| APPT-24 | Doctor (other) | Appointments | Other doctor's list excludes it | `GET /api/appointments` | not listed | listed=false | **PASS** |
| APPT-25 | Doctor (other) | Appointments | Unassigned doctor cannot open the appointment by id | `GET /api/appointments/:id` | 403/404 | 200 | **FAIL** |
| APPT-26 | Doctor (other) | Appointments | Unassigned doctor cannot change status | `PATCH /api/appointments/:id/status` | 403 | 200 | **FAIL** |
| APPT-27 | Doctor | Appointments | Assigned doctor starts consultation | `PATCH /api/appointments/:id/status` | 200 in_consultation | 200 in_consultation | **PASS** |
| EMR-01 | Doctor | Clinical records | Doctor creates medical record linked to appointment | `POST /api/emr/records` | 201 | 201 EMR-2026-00002 | **PASS** |
| EMR-02 | Doctor | Prescriptions | Doctor issues prescription | `POST /api/emr/prescriptions` | 201 status active | 201 RX-2026-00002 active | **PASS** |
| EMR-03 | Doctor (other) | Clinical records | Doctor cannot author a record in another doctor's name | `POST /api/emr/records` | 403 or doctor forced to self | 201 storedDoctor=OTHER DOCTOR | **FAIL** |
| EMR-04 | Nurse | Clinical records | Nurse cannot create diagnosis records | `POST /api/emr/records` | 403 | 403 | **PASS** |
| EMR-05 | Pharmacist | Prescriptions | Pharmacist cannot create a prescription | `POST /api/emr/prescriptions` | 403 | 403 | **PASS** |
| EMR-06 | Patient | Clinical records | Patient sees own records only | `GET /api/emr/records` | includes new record, all own | found=true allOwn=true | **PASS** |
| EMR-07 | Patient (other) | Clinical records | Patient cannot open another patient's medical record by id | `GET /api/emr/records/:id` | 403/404 | 200 | **FAIL** |
| EMR-08 | Patient (other) | Prescriptions | Patient cannot open another patient's prescription by id | `GET /api/emr/prescriptions/:id` | 403/404 | 200 | **FAIL** |
| EMR-09 | Patient (other) | Patient records | Patient cannot read another patient's full timeline | `GET /api/patients/:id/timeline` | 403/404 | 200 | **FAIL** |
| EMR-10 | Laboratory Staff | Clinical records | Lab staff should not list all diagnoses/clinical notes | `GET /api/emr/records` | 403 or 0 | 200, 3 records | **FAIL** |
| EMR-11 | Receptionist | Clinical records | Receptionist should not list clinical notes | `GET /api/emr/records` | 403 or 0 | 200, 3 records | **FAIL** |
| EMR-12 | Doctor (other) | Clinical records | Unrelated doctor cannot open record by id | `GET /api/emr/records/:id` | 403/404 | 200 | **FAIL** |
| PAT-01 | Receptionist | Patient records | Receptionist registers a walk-in patient | `POST /api/patients` | 201 | 201 P-2026-0005 | **PASS** |
| PAT-02 | Patient | Patient records | Patient cannot list the patient directory | `GET /api/patients` | 403 | 403 | **PASS** |
| PAT-03 | Patient (other) | Patient records | Patient cannot read another patient's profile | `GET /api/patients/:id` | 403/404 | 200 | **FAIL** |
| PAT-04 | Patient (other) | Patient records | Patient cannot edit another patient's profile | `PUT /api/patients/:id` | 403, address unchanged | 200, changed=true | **FAIL** |
| PAT-05 | Patient | Patient records | Patient can update own profile | `PUT /api/patients/:id` | 200 | 200 | **PASS** |
| PAT-06 | Doctor | Patient records | Doctor cannot delete patients | `DELETE /api/patients/:id` | 403 | 403 | **PASS** |
| PAT-07 | Pharmacist | Patient records | Pharmacist cannot list patient directory | `GET /api/patients` | 403 | 403 | **PASS** |
| PAT-08 | Patient | Patient records | Global search must not expose other patients to a patient | `GET /api/analytics/search?q=Maria` | 403 or no other patients | 200, 1 patients returned (fields: _id,name,patientId,phone,email) | **FAIL** |
| PAT-09 | Patient | Beds | Patient must not see who occupies hospital beds | `GET /api/beds/beds` | 403 or no occupant details | 200, 2 beds with occupant name/phone | **FAIL** |
| LAB-01 | Doctor | Laboratory | Doctor orders a lab test (API only; no UI button) | `POST /api/lab/reports` | 201 status requested | 201 LAB-000003 requested | **PASS** |
| LAB-02 | Laboratory Staff | Laboratory | Lab staff sees the order | `GET /api/lab/reports` | listed | 200 listed=true | **PASS** |
| LAB-03 | Laboratory Staff | Laboratory | Lab moves order through statuses and enters results | `PUT /api/lab/reports/:id` | 200 x3, completed | 200,200,200 -> completed | **PASS** |
| LAB-04 | Patient | Laboratory | Patient sees own completed report | `GET /api/lab/reports` | listed | listed=true | **PASS** |
| LAB-05 | Patient (other) | Laboratory | Other patient's list excludes report | `GET /api/lab/reports` | not listed | listed=false | **PASS** |
| LAB-06 | Patient (other) | Laboratory | Patient cannot open another patient's report by id | `GET /api/lab/reports/:id` | 403/404 | 200 | **FAIL** |
| LAB-07 | Doctor | Laboratory | Doctor cannot edit lab results | `PUT /api/lab/reports/:id` | 403 | 403 | **PASS** |
| LAB-08 | Laboratory Staff | Laboratory | Completed report cannot be reopened / results wiped | `PUT /api/lab/reports/:id` | 400/409 | 200 -> requested | **FAIL** |
| LAB-09 | Receptionist | Laboratory | Receptionist cannot order lab tests | `POST /api/lab/reports` | 403 | 403 | **PASS** |
| LAB-10 | Patient | Laboratory | Patient cannot edit lab test catalog | `POST /api/lab/tests` | 403 | 403 | **PASS** |
| PHA-01 | Pharmacist | Pharmacy | Pharmacist sees doctor prescription with correct patient | `GET /api/emr/prescriptions` | listed, patient Robert | listed=true patient=Robert Chen | **PASS** |
| PHA-02 | Nurse | Pharmacy | Nurse cannot dispense | `POST /api/pharmacy/dispense` | 403 | 403 | **PASS** |
| PHA-03 | Pharmacist | Pharmacy | Pharmacist dispenses prescription | `POST /api/pharmacy/dispense` | 200 status dispensed | 200 dispensed | **PASS** |
| PHA-04 | Pharmacist | Pharmacy | Dispensing twice is refused | `POST /api/pharmacy/dispense` | 400 | 400 Prescription already dispensed | **PASS** |
| PHA-05 | Pharmacist | Pharmacy | Dispensing deducts stock of the dispensed medicine | `POST /api/pharmacy/dispense` | quantity decreases | Atorvastatin 20mg: 18 -> 18 | **FAIL** |
| PHA-06 | Doctor | Pharmacy | Doctor cannot adjust stock | `POST /api/pharmacy/medicines/:id/adjust-stock` | 403 | 403 | **PASS** |
| PHA-07 | Pharmacist | Pharmacy | Stock cannot go negative | `POST /api/pharmacy/medicines/:id/adjust-stock` | 400 | 400 Insufficient stock available | **PASS** |
| PHA-08 | Pharmacist | Pharmacy | Stock-in recorded in inventory ledger | `POST adjust-stock + GET /api/pharmacy/transactions` | 200 and ledger entry | 200, ledger entries=5 | **PASS** |
| PHA-09 | Pharmacist | Clinical records | Pharmacist cannot change a diagnosis | `PUT /api/emr/records/:id` | 403/404 (no update route) | 404 | **PASS** |
| PHA-10 | Nurse | Pharmacy | Nurse cannot read inventory ledger | `GET /api/pharmacy/transactions` | 403 | 403 | **PASS** |
| BILL-01 | Receptionist | Billing | Receptionist creates a bill (API only; no UI form) | `POST /api/billing` | 201 pending | 201 INV-000003 pending total=100 | **PASS** |
| BILL-02 | Doctor | Billing | Doctor cannot create bills | `POST /api/billing` | 403 | 403 | **PASS** |
| BILL-03 | Patient | Billing | Patient sees own bill | `GET /api/billing` | listed | listed=true | **PASS** |
| BILL-04 | Patient (other) | Billing | Patient cannot open another patient's bill | `GET /api/billing/:id` | 403/404 | 200 | **FAIL** |
| BILL-05 | Patient (other) | Billing | Patient cannot record a payment on another patient's bill | `POST /api/billing/:id/pay` | 403, paidAmount unchanged | 200, paid 0 -> 1 | **FAIL** |
| BILL-06 | Patient | Billing | Zero payment rejected | `POST /api/billing/:id/pay` | 400 | 400 | **PASS** |
| BILL-07 | Patient | Billing | Partial payment -> partially_paid | `POST /api/billing/:id/pay` | 200 partially_paid | 200 partially_paid balance=59 | **PASS** |
| BILL-08 | Patient | Billing | Overpayment beyond balance is refused | `POST /api/billing/:id/pay` | 400 | 200 paidAmount=100041 total=100 | **FAIL** |
| BILL-09 | Patient | Billing | Payment on an already paid bill is refused | `POST /api/billing/:id/pay` | 400 | 200 | **FAIL** |
| BILL-10-nurse | Nurse | Billing | Non-billing staff should not list every patient bill | `GET /api/billing` | 403 or 0 | 200, 3 bills | **FAIL** |
| BILL-10-lab | Laboratory Staff | Billing | Non-billing staff should not list every patient bill | `GET /api/billing` | 403 or 0 | 200, 3 bills | **FAIL** |
| BILL-10-pharmacy | Pharmacist | Billing | Non-billing staff should not list every patient bill | `GET /api/billing` | 403 or 0 | 200, 3 bills | **FAIL** |
| BILL-10-doctor | Doctor | Billing | Non-billing staff should not list every patient bill | `GET /api/billing` | 403 or 0 | 200, 3 bills | **FAIL** |
| BILL-11 | Receptionist | Billing | Receptionist cannot delete bills | `DELETE /api/billing/:id` | 403 | 403 | **PASS** |
| BILL-12 | Receptionist | Billing | Receptionist can view billing stats | `GET /api/billing/stats` | 200 | 200 | **PASS** |
| BED-01 | Nurse | Beds & wards | Nurse admits patient to available bed | `POST /api/beds/beds/:id/assign` | 200 occupied | 200 occupied | **PASS** |
| BED-02 | Nurse | Beds & wards | Occupied bed cannot be double-assigned | `POST /api/beds/beds/:id/assign` | 400 | 400 | **PASS** |
| BED-03 | Patient | Beds & wards | Patient cannot discharge beds | `POST /api/beds/beds/:id/discharge` | 403 | 403 | **PASS** |
| BED-04 | Nurse | Beds & wards | Nurse discharges patient | `POST /api/beds/beds/:id/discharge` | 200 available | 200 available | **PASS** |
| BED-05 | Receptionist | Beds & wards | Receptionist cannot create rooms | `POST /api/beds/rooms` | 403 | 403 | **PASS** |
| NUR-01 | Nurse | Nursing care | Nurse can record vital signs / nursing observations | `POST /api/emr/records (only vitals store)` | 201 via a nurse-specific endpoint | 403 | **FAIL** |
| ADM-01 | Hospital Admin | Administration | Admin analytics overview | `GET /api/analytics/overview` | 200 | 200 | **PASS** |
| ADM-02 | Hospital Admin | Administration | Audit log shows workflow actions (appointment status change) | `GET /api/audit-logs` | contains APPOINTMENT_STATUS_CHANGED | 200, 52 logs, statusChange=true | **PASS** |
| ADM-03 | Doctor | Administration | Doctor cannot read audit logs | `GET /api/audit-logs` | 403 | 403 | **PASS** |
| ADM-04 | Hospital Admin | Administration | Admin creates department | `POST /api/departments` | 201 | 201 | **PASS** |
| ADM-05 | Receptionist | Administration | Receptionist cannot create departments | `POST /api/departments` | 403 | 403 | **PASS** |
| ADM-06 | Hospital Admin | Administration | Admin onboards a doctor (creates login + profile) | `POST /api/doctors` | 201 | 201 | **PASS** |
| ADM-07 | Doctor | Administration | Doctor cannot edit another doctor's profile/fee | `PUT /api/doctors/:id` | 403, fee unchanged | 200, fee 140 -> 1 | **FAIL** |
| ADM-08 | Patient | Notifications | Patient cannot send notifications | `POST /api/notifications` | 403 | 403 | **PASS** |
| ADM-09 | Patient (other) | Notifications | Cannot mark another user's notification read | `PATCH /api/notifications/:id/read` | 404 | 404 | **PASS** |
| AI-01 | Anonymous | AI assistance | Public symptom checker works without login | `POST /api/ai/symptoms` | 200 | 200 | **PASS** |
| AI-02 | Anonymous | AI assistance | Forecasts require login | `GET /api/ai/inventory-forecast` | 401 | 401 | **PASS** |
| AI-03 | Patient | AI assistance | Patient should not see inventory forecast | `GET /api/ai/inventory-forecast` | 403 | 200 | **FAIL** |
| APPT-28 | Doctor | Appointments | Doctor completes consultation | `PATCH /api/appointments/:id/status` | 200 completed | 200 completed | **PASS** |
| APPT-29 | Receptionist | Appointments | Invalid transition completed -> pending is refused | `PATCH /api/appointments/:id/status` | 400 | 200 -> pending | **FAIL** |
| APPT-30 | Patient | Appointments | Patient view reflects the latest server status (after APPT-29) | `GET /api/appointments` | same as server | pending | **PASS** |

---

## 27. Bugs and security findings

Severity: **Critical** means anyone can reach patient data or take admin control. **High** means a cross-user write, or a financial or clinical integrity problem.
**Medium** means least-privilege or validation gaps. **Low** means hardening.

| # | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| S1 | **Critical** | Public sign-up accepts any role, including `super_admin` and `hospital_admin`. The sign-up page even offers Hospital Admin. | AUTH-07, AUTH-08, AUTH-09; `validators/authValidator.ts`; `pages/Register.tsx` | Public sign-up should create **patients only**. Staff accounts should be created by an admin endpoint. Remove the role dropdown. |
| S2 | **Critical** | A user whose role is doctor or patient but who has no profile skips list scoping and sees **all** records and appointments. Combined with S1, an anonymous visitor can read every diagnosis. | AUTH-10, AUTH-11; `emrController.listByScope` ("if the profile is missing, the original did not restrict either") | If the profile is missing, return 403 or an empty list. Never fall back to "all". |
| S3 | **Critical** | Fetch-by-id endpoints never check ownership. Affected: appointments, EMR, prescriptions, lab reports, bills, patient profile and timeline. | APPT-10, APPT-25, EMR-07, EMR-08, EMR-09, EMR-12, LAB-06, BILL-04, PAT-03 | Add one shared `canAccessPatientResource(user, item)` check: own patient; treating doctor; clinical roles for clinical data; billing roles for bills; admin. |
| S4 | **Critical** | A patient can edit any patient's profile. | PAT-04; `patientController.updatePatient` | A patient may update only their own profile. Doctors should not edit demographics. |
| S5 | **High** | Anyone logged in can change any appointment's status, with no transition rules. | APPT-13, APPT-14, APPT-15, APPT-26, APPT-29 | Add a state machine with role-owned transitions: receptionist confirms, checks in or cancels; the assigned doctor moves to in_consultation and completed; the patient cancels their own pending or confirmed appointment. |
| S6 | **High** | A patient can record payments on any bill, overpay, or "pay" a paid bill. Payments are self-declared, with no gateway. | BILL-05, BILL-08, BILL-09 | Remove the patient role from `/pay`, or allow own bills only through a real payment provider. Reject amounts above the balance and payments on paid bills. |
| S7 | **High** | Clinical authorship can be spoofed. The `doctor` field comes from the request body, and the UI defaults it to the first doctor. | EMR-03; `EMRConsultation.tsx` | For a doctor caller, force `doctor` to their own profile. |
| S8 | **High** | Any doctor can edit any doctor's profile and fee. | ADM-07; `doctorRoutes.ts` | Allow only the doctor's own profile, with no fee or department changes, or admin only. |
| S9 | **High** | Patients can see other patients' personal data through global search and bed lists. | PAT-08, PAT-09 | Restrict `/analytics/search` to staff. Strip occupant details from bed lists for non-staff. |
| S10 | **High** | Finalized lab results can be reopened and wiped. There is no record of the previous values. | LAB-08 | Make completed reports immutable. Corrections should create an amendment and keep the history. |
| S11 | Medium | Over-broad staff reads. Pharmacist, lab and receptionist see all clinical notes. All staff see all bills. The pharmacist sees the whole appointment book. Patients see forecasts. | EMR-10, EMR-11, BILL-10-*, APPT-16, AI-03 | Apply role lists to the GET routes, following the matrix in §7. |
| S12 | Medium | Booking validation gaps. Past dates and patient ids that don't exist are accepted. A patient can book for others. Doctor availability isn't checked. | APPT-05, APPT-06, APPT-07 | Validate patient existence, date ≥ today, and doctor availability. Force own patient id for patients. |
| S13 | Medium | No login rate limiting. `express-rate-limit` is installed but unused. | `app.ts` | Add a limiter on `/api/auth/login` and `/register`. |
| S14 | Medium | Tokens last 7 days, are stored in `localStorage`, can't be revoked, and `isActive` isn't checked per request. The role is read from the token. | `middleware/auth.ts`, `AuthContext.tsx` | Shorter expiry, re-check user status and role on each request, or keep a token version on the user. |
| S15 | Medium | Frontend routes have no role guards. Any page opens by URL. | `App.tsx` (`<ProtectedRoute />` without `allowedRoles`) | Pass `allowedRoles` per route group. This is a UX fix only; the server must still enforce. |
| S16 | Low | The booking page can show a fabricated confirmation id. | `AppointmentBooking.tsx` fallback | Show an error instead. |
| S17 | Low | Rejected (403) requests are not written to the audit log. | `auditLogger` only called on success | Log authorization failures. |
| S18 | **High** | Every patient and doctor account created by staff (`POST /api/patients`, `POST /api/doctors`) gets the same hard-coded password `password123`. Nobody is forced to change it, so anyone who knows a patient's or doctor's e-mail can log in as them. | `patientController.ts` and `doctorController.ts` call `bcrypt.hash('password123', …)` (reviewed, not executed) | Generate a random one-time password or an invite link, and force a change at first login. |

**Functional bugs**, not security issues:

| # | Bug | Evidence |
|---|---|---|
| B1 | Dispensing doesn't deduct stock or write a ledger entry | PHA-05 |
| B2 | Staff booking page can't choose a patient | APPT-08 |
| B3 | Nurse lands on the patient dashboard | `App.tsx` |
| B4 | "Forgot Password?" leads to the home page | `Login.tsx` |
| B5 | Admin directory menu items show analytics | `App.tsx` |
| B6 | Doctor status dropdown keeps its optimistic value when the request fails | `DoctorDashboard.tsx` |
| B7 | A doctor created through public sign-up has no doctor profile, so their dashboard can't work | AUTH-10 |

---

## 28. Missing features and recommended fixes

### 28.1 Not implemented

- user and role management, with a real Super Admin scope
- password reset
- a nursing module (vitals, observations, care tasks)
- a lab-order button for doctors
- a bill-creation form
- appointment rescheduling
- patient self-cancellation (blocked by S5)
- a patient profile page (`/patient/profile` shows the dashboard)
- admin directory pages for patients, doctors and departments
- enforcement of doctor availability
- automatic billing from consultations, labs, medicines and bed days
- a real payment provider
- the `billing_staff` role

### 28.2 Recommended fix order

1. **Close sign-up escalation (S1).** Public sign-up should create patients only. Add an admin-only `POST /api/users` for staff, plus list, role-change and deactivate endpoints. That gives Super Admin a real purpose, for example as the only role that can create admins.
2. **Stop the missing-profile fallback (S2).**
3. **Add a shared ownership check (S3, S4) and remove the shared default password (S18).** Apply the ownership check to every `/:id` read and write.
4. **Add the appointment state machine and role-owned transitions (S5).** Then add the patient's own-cancel button.
5. **Lock down billing payments (S6).**
6. **Force authorship (S7) and doctor self-edit (S8).**
7. **Restrict search and bed occupant details (S9), and make completed lab results immutable (S10).**
8. **Narrow staff reads to the §7 matrix (S11).** Add booking validation (S12).
9. **Session hardening.** Rate limiting (S13), token checks (S14), frontend route guards (S15).
10. **Functional gaps.** Stock deduction on dispense (B1), staff patient picker (B2), nurse dashboard and nursing module, password reset.

---

## 29. Final role permission audit summary

| Metric | Value |
|---|---|
| Roles discovered | 8 usable (`super_admin`, `hospital_admin`, `doctor`, `nurse`, `receptionist`, `lab_staff`, `pharmacist`, `patient`) + 2 aliases (`admin`, `lab_technician`) + 1 dead (`billing_staff`) |
| Features discovered | 8 core modules (F1–F8) + 3 supporting (administration, notifications, AI). No nursing module. |
| API endpoints reviewed | 82 |
| Role × feature combinations reviewed | 64 (8 × 8), all in §7 |
| Executed checks | 126: 83 PASS, 43 FAIL |
| BLOCKED / NOT TESTED | 3 / 12 |
| Critical findings | 4 (S1–S4) |
| High findings | 7 (S5–S10, S18) |
| Unauthorized capabilities found | 39 failing checks (§22.2 and §24); the other 4 failures are missing capabilities |
| Missing legitimate capabilities | 4 executed (APPT-08, NUR-01, AUTH-14, PHA-05) + 13 by review (§23) |

**What the audit verified, and how firmly:**

| Verdict | What it covers |
|---|---|
| **Verified working** | Login and sign-in errors; JWT signature check; list scoping for real patient and doctor profiles; role-gated create and delete in most modules; double-booking protection; dispense-once; non-negative stock; bed double-assignment guard; notification ownership; audit trail of successful actions; the full functional outpatient workflow. |
| **Verified broken** | Every Critical and High item in §27, and B1–B2. |
| **Reviewed, not executed** | Frontend route guards and UI behaviours FE-01…FE-12; delete endpoints for admin; room and bed creation; audit-log stats. |
| **Not yet reviewed** | Vercel deployment and its IAM role; the `aiService` heuristics in depth; performance and limits under load. |

**This application is not secure for real patient data in its current state.** The documentation being complete does not change that.

---

## 30. Retesting checklist after fixes

Run these in the isolated environment from §2.2, on a freshly seeded table. Each line is one test ID from §26, and every one of them should **PASS** after the fixes.

- [ ] AUTH-07, AUTH-08: public sign-up with `super_admin` or `hospital_admin` is refused. The sign-up page shows no role dropdown.
- [ ] AUTH-09: there is no way to get a super_admin token without an existing super admin.
- [ ] AUTH-10, AUTH-11: a profile-less doctor or patient gets 403 or empty lists.
- [ ] AUTH-14: the admin can list users, change a role and deactivate an account. Each change is audited. A non-admin gets 403.
- [ ] A deactivated user's existing token is refused on the next request.
- [ ] APPT-05, APPT-06, APPT-07: booking for others, booking in the past and booking for an unknown patient are refused.
- [ ] APPT-08: the receptionist can pick a patient on the booking page.
- [ ] APPT-10, APPT-25: other patients and unassigned doctors get 403 or 404 by id.
- [ ] APPT-13, APPT-14, APPT-15, APPT-26, APPT-29: only allowed roles can make allowed transitions.
- [ ] APPT-16: the pharmacist gets 403 on the appointment list.
- [ ] EMR-03: the doctor field is forced to the caller.
- [ ] EMR-07, EMR-08, EMR-09, EMR-12: by-id reads are restricted.
- [ ] EMR-10, EMR-11: lab staff and receptionists can't list clinical notes.
- [ ] PAT-03, PAT-04: other patients' profiles can't be read or edited.
- [ ] PAT-08, PAT-09: search and bed occupant details are restricted to staff.
- [ ] LAB-06, LAB-08: by-id reads are restricted, and completed reports are immutable.
- [ ] PHA-05: dispensing reduces stock and writes an `INVTX` entry.
- [ ] BILL-04, BILL-05, BILL-08, BILL-09, BILL-10-*: financial reads and writes are restricted, with no overpaying and no paying a paid bill.
- [ ] NUR-01: the nurse can record vitals through a nursing endpoint, and cannot write a diagnosis.
- [ ] ADM-07: a doctor can't edit other doctors.
- [ ] AI-03: forecasts are staff-only.
- [ ] FE-02, FE-03, FE-05, FE-06, FE-07, FE-09, FE-10, FE-12: re-check in a browser.
- [ ] Re-run all the PASS tests in §26 to confirm nothing regressed. Then run `npm test`, which should show 87+ passing.
- [ ] Confirm that rejected requests leave the database unchanged: re-read each item as admin after every negative test.
