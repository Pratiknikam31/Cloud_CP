# Smart Hospital Management System — Complete Feature & Configuration Guide

---

## 🔌 External Services & Connections Required

| Service | Required? | Purpose | Where to Configure |
|---|:---:|---|---|
| **Amazon DynamoDB** | ✅ **YES** | Primary database for all data (users, patients, doctors, appointments, medicines, etc.), one table `HospitalData` | `backend/.env` → `AWS_REGION`, `DYNAMODB_TABLE_NAME` + AWS credentials (see [SETUP.md](SETUP.md)) |
| **Gemini API** | ❌ **NO** | Not used anywhere in the current codebase. AI features use a local keyword-matching algorithm instead. | — |
| **Cloudinary** | ❌ **NO** | No code uploads or fetches images via Cloudinary; its variables were removed from `.env.example`. | — |

### Amazon DynamoDB Setup (The Only Required Connection)

Follow [SETUP.md](SETUP.md): create the `HospitalData` table (section B), a least-privilege IAM policy and credentials (section C), then fill in `backend/.env` (section D) and run `npm run dev`. Verify with `http://localhost:5000/api/health?db=1`.

---

## 🔑 Role-Based Access Control (8 Roles)

| Role | Slug | Login Email (Demo) | Key Permissions |
|---|---|---|---|
| Super Admin | `super_admin` | — | Full system control |
| Hospital Admin | `hospital_admin` | `admin@smarthospital.org` | Analytics, manage all modules, audit logs |
| Doctor | `doctor` | `doctor@smarthospital.org` | Consultations, EMR, prescriptions, lab requests |
| Nurse | `nurse` | — | Vitals, bed management, queue assist |
| Receptionist | `receptionist` | `reception@smarthospital.org` | Queue control, check-ins, patient registration, bed allocation |
| Lab Staff | `lab_staff` | `lab@smarthospital.org` | Test requests, result entry, report management |
| Pharmacist | `pharmacist` | `pharmacy@smarthospital.org` | Inventory, dispensing, stock alerts |
| Patient | `patient` | `patient@smarthospital.org` | Book appointments, view records, AI symptom checker, billing |

> **Demo password for all accounts:** `password123`
> Run `npm run seed` in the backend folder to create these accounts.

---

## 📋 Feature-by-Feature Breakdown

### 1. Authentication & Registration

| Item | Details |
|---|---|
| **Page** | `/login`, `/register` |
| **Roles** | All |
| **API Endpoint** | `POST /api/auth/register`, `POST /api/auth/login` |
| **Input (Register)** | `name` (string, min 2 chars), `email` (valid email), `password` (min 6 chars), `phone` (string, optional), `role` (enum, defaults to `patient`) |
| **Input (Login)** | `email`, `password` |
| **Output** | `{ success: true, token: "jwt...", user: { id, name, email, role } }` |
| **External API** | ❌ None — uses `bcryptjs` for hashing, `jsonwebtoken` for JWT |
| **Special Behavior** | When a user registers as `patient`, a Patient profile is auto-created with a unique ID like `P-2026-0001` |

---

### 2. Admin Analytics Dashboard

| Item | Details |
|---|---|
| **Page** | `/admin/dashboard` |
| **Roles** | `super_admin`, `hospital_admin` |
| **Input** | None (auto-loads on page visit) |
| **Output** | 8 KPI cards (Total Patients, Active Doctors, Today's Appointments, Bed Occupancy %, Pending Lab Tests, Low Stock Alerts, Today's Revenue, Avg Wait Time) + Recharts bar/line graphs |
| **External API** | ❌ None — currently uses demo/mock data rendered client-side |

---

### 3. Doctor Dashboard

| Item | Details |
|---|---|
| **Page** | `/doctor/dashboard` |
| **Roles** | `doctor` |
| **Input** | None |
| **Output** | Today's appointment schedule table, live queue token status, pending lab reports counter, upcoming consultations list |
| **External API** | ❌ None |

---

### 4. Patient Dashboard

| Item | Details |
|---|---|
| **Page** | `/patient/dashboard` |
| **Roles** | `patient` |
| **Input** | None |
| **Output** | Upcoming appointments, active prescriptions, pending bills summary, recent medical records |
| **External API** | ❌ None |

---

### 5. AI Smart Symptom Department Recommendation

| Item | Details |
|---|---|
| **Page** | `/patient/ai-recommendation` |
| **Roles** | `patient` |
| **Input** | Free-text symptom description (e.g. "sharp chest pain with shortness of breath") OR click a quick symptom chip |
| **Output** | `{ primaryDepartment: "Cardiology", confidenceScore: 96, urgencyLevel: "urgent", explanation: "...", suggestedDoctors: [...] }` |
| **External API** | ❌ **None** — uses a local keyword-matching algorithm (no Gemini, no OpenAI). The engine checks for keywords like "chest", "heart", "joint", "head" etc. and maps them to departments with hardcoded confidence scores. |
| **How it works** | Frontend sends `POST /api/ai/recommend-department` with `{ symptoms: "..." }`. If the backend endpoint is unavailable, the frontend has a built-in fallback that runs the same keyword logic client-side. |

---

### 6. Appointment Booking with Token Generation

| Item | Details |
|---|---|
| **Page** | `/patient/book-appointment` |
| **Roles** | `patient`, `receptionist` |
| **Input** | Step 1: Select department + doctor. Step 2: Pick date + time slot + consultation mode (in-person / teleconsultation). Step 3: Optional symptom description → Confirm |
| **Output** | Booking confirmation card with: `appointmentId` (e.g. `APT-2026-8819`), `tokenNumber` (e.g. `104`), doctor name, department, date, time, fee |
| **External API** | ❌ None — token number is generated server-side (or client-side fallback) |

---

### 7. EMR Consultation Workspace

| Item | Details |
|---|---|
| **Page** | `/doctor/consultations` |
| **Roles** | `doctor` |
| **Input** | Patient ID, vitals (BP, Pulse, Temp, SpO2, Weight), primary diagnosis text, clinical notes, and multi-item prescription (medicine name, dosage, frequency, duration, instructions) |
| **Output** | Saved EMR entry synced to patient's medical history. Confirmation banner: "EMR Entry & Prescription Saved!" |
| **External API** | ❌ None |
| **Special Feature** | Printable consultation pass via browser `window.print()` |

---

### 8. Pharmacy Inventory & AI Stock Depletion Forecasting

| Item | Details |
|---|---|
| **Page** | `/pharmacy/inventory` |
| **Roles** | `pharmacist`, `hospital_admin` |
| **Input** | Search medicine name/category. "Stock-In New Batch" button for adding inventory. |
| **Output** | Table: Medicine Name, Category, Current Stock, Daily Usage, **AI Estimated Days Left**, Unit Price, Status (Critical/Low/Optimal) |
| **External API** | ❌ **None** — the "AI" depletion prediction is a simple formula: `Days Left = Current Stock ÷ Daily Average Usage`. If ≤3 days, status = "Critical Reorder". |

---

### 9. Interactive Bed & Room Grid Manager

| Item | Details |
|---|---|
| **Page** | `/admin/beds`, `/reception/beds` |
| **Roles** | `hospital_admin`, `receptionist`, `nurse` |
| **Input** | Select floor from dropdown |
| **Output** | Visual grid showing rooms → beds. Each bed is color-coded: 🟢 Available, 🔵 Occupied (with patient name), 🟡 Reserved, 🔴 Maintenance |
| **External API** | ❌ None |

---

### 10. Itemized Billing & Invoice

| Item | Details |
|---|---|
| **Page** | `/admin/billing`, `/patient/bills` |
| **Roles** | `hospital_admin`, `patient` |
| **Input** | None (invoice is pre-populated from patient's charges) |
| **Output** | Professional invoice document with: Invoice #, patient/doctor info, itemized charges table (Consultation, Lab, Pharmacy, Room), subtotal, tax, insurance discount, grand total, payment status badge |
| **External API** | ❌ None |
| **Special Feature** | Printable PDF invoice via `window.print()` |

---

### 11. HIPAA Security Audit Log Viewer

| Item | Details |
|---|---|
| **Page** | `/admin/audit-logs` |
| **Roles** | `super_admin`, `hospital_admin` |
| **Input** | Search by event or user ID |
| **Output** | Table: Timestamp, User Identity, Action Event (e.g. `VIEW_EMR_RECORD`, `UNAUTHORIZED_LOGIN_ATTEMPT`), Target Resource, IP Address, Result (SUCCESS/BLOCKED) |
| **External API** | ❌ None — audit logs are written to the DynamoDB table (items `AUDIT#<id>`) by the `logAudit()` utility on every sensitive action |

---

### 12. Receptionist Queue & Check-in Dashboard

| Item | Details |
|---|---|
| **Page** | `/reception/dashboard`, `/reception/queue` |
| **Roles** | `receptionist` |
| **Input** | "Call Next Patient" button, patient search |
| **Output** | Live queue status, today's check-in count, current token being served, bed availability summary |
| **External API** | ❌ None |

---

### 13. Laboratory Dashboard

| Item | Details |
|---|---|
| **Page** | `/lab/dashboard`, `/lab/tests`, `/lab/reports` |
| **Roles** | `lab_staff` |
| **Input** | None (auto-loads pending test requests) |
| **Output** | Pending test requests list, completed reports count, test status pipeline (Requested → Sample Collected → Processing → Completed) |
| **External API** | ❌ None |

---

### 14. Public Landing Page

| Item | Details |
|---|---|
| **Page** | `/` (root) |
| **Roles** | Public (no login required) |
| **Input** | None |
| **Output** | Marketing SaaS landing page with: Hero section, feature cards, department specializations, AI features showcase, security section, live stats counters, testimonials, CTA buttons, footer |
| **External API** | ❌ None |

---

## 🔧 Backend API Endpoints Summary

| Method | Endpoint | Auth Required | Description |
|---|---|:---:|---|
| `POST` | `/api/auth/register` | ❌ | Create new user account |
| `POST` | `/api/auth/login` | ❌ | Login and receive JWT token |
| `GET` | `/api/auth/me` | ✅ | Get current logged-in user profile |
| `PUT` | `/api/auth/profile` | ✅ | Update user name/phone/avatar |
| `POST` | `/api/auth/change-password` | ✅ | Change password |
| `GET` | `/api/health` | ❌ | Server health check |

---

## 📦 Tech Stack Summary

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide React Icons, Recharts, Axios, React Router v6 |
| **Backend** | Node.js, Express.js, TypeScript, AWS SDK for JavaScript v3 (DynamoDB), JWT, bcryptjs, Zod validation, Helmet, Morgan |
| **Database** | Amazon DynamoDB (single table, on-demand) |
| **External APIs** | **None** — all AI features use local algorithms, no third-party API keys needed |

---

## 🏃 Quick Start Commands

```bash
# Backend
cd backend
npm install
npm run seed          # Seed database with demo data
npm run dev           # Start API server on http://localhost:5000

# Frontend (new terminal)
cd frontend
npm install
npm run dev           # Start UI on http://localhost:5173
```
