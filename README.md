# CloudCare — Cloud-Based Smart Hospital Management System (SaaS)

[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen.svg)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-cyan.svg)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An enterprise-grade, cloud-native **Smart Hospital SaaS Platform** built with React, Vite, TypeScript, Express, and MongoDB.

Engineered with 8-level Role-Based Access Control (RBAC), AI symptom-to-specialist clinical routing, digital outpatient queue management, smart pharmacy inventory depletion forecasting, visual room/bed grid allocations, itemized billing invoices, and HIPAA security audit logging.

---

## 🌟 Key Architecture & Capabilities

* 🔐 **Multi-Role Role-Based Access Control (RBAC)**: Tailored workspaces for Super Admin, Hospital Admin, Doctor, Nurse, Receptionist, Lab Staff, Pharmacist, and Patient.
* 🤖 **AI Symptom Triage & Specialist Matching**: Natural language symptom clustering matching patients to clinical specialty wings and available attending doctors with confidence scores.
* ⏱️ **Live Digital Queue Manager**: Real-time token dispatch (e.g., Token #101), call-next patient action, and consultation status workflow tracking.
* 💊 **Smart Pharmacy Depletion Forecasting**: Algorithmic stock depletion calculation predicting remaining operational days and triggering procurement alerts.
* 🛏️ **Interactive Bed & Ward Grid**: Visual floor map tracking Available, Occupied, Reserved, and Maintenance beds with 1-click patient allocation and discharge.
* 📋 **Electronic Medical Records (EMR)**: Physical vitals recording (BP, Pulse, Temp, SpO2, Weight, Height), differential diagnosis, and digital prescription issuance.
* 🔬 **Laboratory Information System (LIS)**: Test catalog management, specimen tracking, and diagnostic report publishing with abnormal parameter flagging.
* 💳 **Itemized Billing & Payments**: Multi-line itemized invoice generation (consultation, pharmacy, room, laboratory), online payment recording, and PDF invoice printing.
* 🛡️ **HIPAA Security & Audit Trail**: Cryptographic audit logging for all patient record queries, modifications, bed assignments, and drug dispensing.
* 🔍 **Global Real-Time Search**: Debounced instant search across Patients, Doctors, Appointments, and Medicines directly from the dashboard header.

---

## 🗝️ Demo User Credentials

All demo user accounts are pre-seeded with the password: **`password123`**

| Role | Email Address | Primary Workspace |
|---|---|---|
| **Hospital Admin** | `admin@smarthospital.org` | `/admin/dashboard` |
| **Chief Doctor** | `doctor@smarthospital.org` | `/doctor/dashboard` |
| **Consulting Neurologist** | `brody@smarthospital.org` | `/doctor/dashboard` |
| **Patient Portal** | `patient@smarthospital.org` | `/patient/dashboard` |
| **Patient 2** | `maria@smarthospital.org` | `/patient/dashboard` |
| **Receptionist** | `reception@smarthospital.org` | `/reception/dashboard` |
| **Nurse Station** | `nurse@smarthospital.org` | `/admin/beds` |
| **Lab Technician** | `lab@smarthospital.org` | `/lab/dashboard` |
| **Pharmacist** | `pharmacy@smarthospital.org` | `/pharmacy/dashboard` |

---

## 🚀 Getting Started

### Option A: Local Node.js Setup

#### 1. Prerequisites
* Node.js v18+ or v20+
* MongoDB running locally (`mongodb://localhost:27017/smarthospital`) or a MongoDB Atlas cluster URI.

#### 2. Backend Installation & Database Seeding
```bash
cd backend
npm install

# Seed the database with comprehensive demo datasets (users, doctors, patients, beds, medicines, lab tests, bills)
npm run seed

# Start development API server
npm run dev
# API running on http://localhost:5000
```

#### 3. Frontend Installation & Launch
```bash
cd frontend
npm install

# Start Vite development server
npm run dev
# Web application running on http://localhost:5173
```

---

### Option B: Docker Compose Deployment

Run the entire multi-container stack (MongoDB 7.0 + Backend API + Frontend Nginx) with a single command:

```bash
docker compose up --build -d
```

* **Frontend Web App**: http://localhost:5173
* **Backend REST API**: http://localhost:5000/api/health
* **MongoDB**: localhost:27017

To populate the database inside the container:
```bash
docker compose exec backend npm run seed
```

---

## 📡 REST API Catalog Reference

All protected endpoints require HTTP header: `Authorization: Bearer <JWT_TOKEN>`.

### Authentication & Profile (`/api/auth`)
* `POST /api/auth/register` — Register new user account
* `POST /api/auth/login` — Authenticate and receive JWT
* `GET  /api/auth/me` — Fetch current authenticated user profile
* `PUT  /api/auth/profile` — Update account profile details
* `POST /api/auth/change-password` — Change password

### Patients (`/api/patients`)
* `GET    /api/patients` — List patients with search, blood group & gender filters, pagination
* `GET    /api/patients/:id` — Get detailed patient record
* `GET    /api/patients/:id/timeline` — Patient chronological clinical timeline
* `POST   /api/patients` — Register new patient (creates linked user)
* `PUT    /api/patients/:id` — Update patient record
* `DELETE /api/patients/:id` — Remove patient record (Admin only)

### Doctors (`/api/doctors`)
* `GET    /api/doctors` — Public directory of doctors with department & specialization filters
* `GET    /api/doctors/:id` — Doctor profile and consultation fees
* `GET    /api/doctors/:id/slots` — Available days and time slots
* `POST   /api/doctors` — Add new doctor (Admin only)
* `PUT    /api/doctors/:id` — Update doctor profile
* `DELETE /api/doctors/:id` — Remove doctor profile

### Departments (`/api/departments`)
* `GET    /api/departments` — List clinical departments
* `GET    /api/departments/:id` — Department details
* `POST   /api/departments` — Create new department
* `PUT    /api/departments/:id` — Update department details
* `DELETE /api/departments/:id` — Remove department

### Appointments & Queue (`/api/appointments`)
* `GET    /api/appointments` — List appointments with status & date filters
* `GET    /api/appointments/stats` — Summary counts (today, completed, waiting)
* `GET    /api/appointments/:id` — Appointment record details
* `POST   /api/appointments` — Book appointment with automated conflict detection & token assignment
* `PATCH  /api/appointments/:id/status` — Advance status (`checked_in`, `in_consultation`, `completed`, `cancelled`)
* `DELETE /api/appointments/:id` — Delete appointment

### Electronic Medical Records & Rx (`/api/emr`)
* `GET    /api/emr/records` — Query patient medical records
* `GET    /api/emr/records/:id` — Fetch clinical record details with vitals
* `POST   /api/emr/records` — Create clinical record encounter (Doctor/Admin)
* `GET    /api/emr/prescriptions` — Query electronic prescriptions
* `GET    /api/emr/prescriptions/:id` — Fetch prescription details
* `POST   /api/emr/prescriptions` — Issue prescription with itemized medications

### Pharmacy & Stock Management (`/api/pharmacy`)
* `GET    /api/pharmacy/medicines` — Medicines catalog with category & status filters
* `GET    /api/pharmacy/medicines/predictions` — AI stock depletion and reorder forecast
* `GET    /api/pharmacy/medicines/:id` — Medicine details
* `POST   /api/pharmacy/medicines` — Add new medication item
* `PUT    /api/pharmacy/medicines/:id` — Update medication item
* `POST   /api/pharmacy/medicines/:id/adjust-stock` — Adjust stock with audit reason
* `GET    /api/pharmacy/transactions` — Inventory stock movement transactions
* `POST   /api/pharmacy/dispense` — Dispense prescription & decrement inventory

### Laboratory Information (`/api/lab`)
* `GET    /api/lab/tests` — Diagnostic test catalog
* `POST   /api/lab/tests` — Add diagnostic test to formulary
* `GET    /api/lab/reports` — Patient lab requisitions & reports
* `GET    /api/lab/reports/:id` — Lab report details with parameter readings
* `POST   /api/lab/reports` — Requisition new laboratory investigation
* `PUT    /api/lab/reports/:id` — Input test readings and publish completed report

### Bed & Ward Management (`/api/beds`)
* `GET    /api/beds/rooms` — Hospital rooms categorized by building, floor, and wing
* `POST   /api/beds/rooms` — Create room
* `GET    /api/beds/beds` — Live bed matrix with occupancy statistics
* `POST   /api/beds/beds` — Create bed
* `POST   /api/beds/beds/:id/assign` — Admit patient to bed
* `POST   /api/beds/beds/:id/discharge` — Discharge patient from bed

### Billing & Invoicing (`/api/billing`)
* `GET    /api/billing` — Query patient invoices with payment status
* `GET    /api/billing/stats` — Revenue collected, pending receivables, and totals
* `GET    /api/billing/:id` — Invoice details with itemized charges
* `POST   /api/billing` — Generate invoice
* `POST   /api/billing/:id/pay` — Record payment on invoice

### AI Clinical Services (`/api/ai`)
* `POST   /api/ai/symptoms` — Natural language symptom assessment & doctor matching
* `GET    /api/ai/inventory-forecast` — Pharmacy stock depletion risk analysis
* `GET    /api/ai/bed-forecast` — Hospital ward occupancy saturation forecast

### Analytics & Global Search (`/api/analytics`)
* `GET    /api/analytics/overview` — Executive KPI summary, monthly trends & department loads
* `GET    /api/analytics/search?q=...` — Unified global search across Patients, Doctors, Appointments, and Medicines

### Notifications & Auditing
* `GET    /api/notifications` — In-app alerts for authenticated user
* `PATCH  /api/notifications/read-all` — Mark all notifications as read
* `GET    /api/audit-logs` — HIPAA compliance audit trail (Admin only)
* `GET    /api/audit-logs/stats` — Activity breakdown by action and entity

---

## 🗄️ Database Models (16 Mongoose Schemas)

| Model | Purpose |
|---|---|
| `User` | Authentication credentials, roles (8+ roles), contact details |
| `Patient` | Demographics, blood group, allergies, medical history, emergency contact |
| `Doctor` | Specialty, department link, room number, fees, consultation slots |
| `Department` | Clinical specialty units (Cardiology, Neurology, Pediatrics, etc.) |
| `Appointment` | Patient-doctor booking, queue token, time slot, appointment status |
| `MedicalRecord` | Clinical vitals (BP, SpO2, Pulse, Temp, Weight), diagnosis, follow-up |
| `Prescription` | Multi-medication dosage lines, instructions, dispensing status |
| `Medicine` | Drug formulary, batch numbers, stock count, expiry date, status |
| `InventoryTransaction` | Immutable stock movement ledger (stock in, stock out, expired, adjustment) |
| `LabTest` | Test catalog (CBC, Lipid Panel, HbA1c), reference ranges, pricing |
| `LabReport` | Patient lab order, parameter values, flags (Normal / Abnormal) |
| `Room` | Ward categorization (ICU, General, Private), daily rates |
| `Bed` | Bed identifier, current patient link, occupancy status |
| `Bill` | Multi-category itemized invoice, tax, discount, balance, payment status |
| `Notification` | In-app user notifications with read status |
| `AuditLog` | Security action logs recording user, entity, description, IP address |

---

## 📄 License & Attribution
Developed for Enterprise SaaS Demonstration, Academic Evaluation, and Production Healthcare Cloud Deployments.  
&copy; 2026 CloudCare SmartHospital Systems Inc. All rights reserved.
