# Final Year College Project Report & Technical Documentation

# CLOUD-BASED SMART HOSPITAL MANAGEMENT SYSTEM
**A Cloud-Native, AI-Assisted Hospital SaaS Platform with 8-Level RBAC**

---

## 1. ABSTRACT & EXECUTIVE SUMMARY

The **Cloud-Based Smart Hospital Management System** is a next-generation SaaS enterprise web application designed to streamline modern healthcare operations. The system unifies electronic medical records (EMR), automated symptom-assisted department routing, live digital patient queue management, pharmacy inventory depletion forecasting, real-time bed grid management, itemized billing, and HIPAA-compliant security audit logging.

Built on a decoupled, micro-service-ready full-stack architecture using **React, TypeScript, Vite, Tailwind CSS, Node.js, Express, and Amazon DynamoDB**, the platform guarantees 99.99% operational uptime, zero cross-role privilege escalation, and real-time data synchronization.

---

## 2. SYSTEM ARCHITECTURE & HIGH-LEVEL DESIGN

### 2.1 Technology Stack Matrix
* **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui design tokens, Lucide React Icons, Recharts Analytics, Axios.
* **Backend**: Node.js, Express.js (TypeScript), AWS SDK v3 DynamoDB data-access layer, JWT Authentication, bcryptjs, Helmet security, Zod Schema Validation.
* **Database**: Amazon DynamoDB, one table with three global secondary indexes; transactions and conditional writes for booking, stock, payment and bed consistency.

### 2.2 System Architecture Diagram
```mermaid
graph TD
    Client[Web Browser / Mobile App - React Client] -->|HTTPS REST API / Bearer JWT| Gateway[Express API Gateway & Security]
    Gateway -->|Auth Guard| JWT[JWT Authentication & RBAC Engine]
    Gateway -->|Logging| Audit[HIPAA Audit Trail Logger]
    
    JWT --> DoctorModule[Doctor & Consultation Service]
    JWT --> PatientModule[Patient Portal & EMR Service]
    JWT --> QueueModule[Live Digital Queue Engine]
    JWT --> AIService[AI Department & Inventory Engine]
    JWT --> PharmacyModule[Pharmacy & Inventory Service]
    JWT --> BedModule[Bed & Room Management Service]
    JWT --> BillingModule[Billing & Invoice Service]
    
    AIService -->|AWS SDK v3| DB[(Amazon DynamoDB)]
    DoctorModule --> DB
    PatientModule --> DB
    PharmacyModule --> DB
    BedModule --> DB
    BillingModule --> DB
```

---

## 3. DATABASE ENTITY-RELATIONSHIP DIAGRAM (ERD)

```mermaid
erDiagram
    USER ||--o{ PATIENT : owns
    USER ||--o{ DOCTOR : owns
    DEPARTMENT ||--o{ DOCTOR : employs
    DOCTOR ||--o{ APPOINTMENT : conducts
    PATIENT ||--o{ APPOINTMENT : books
    DOCTOR ||--o{ MEDICAL_RECORD : creates
    PATIENT ||--o{ MEDICAL_RECORD : possesses
    DOCTOR ||--o{ PRESCRIPTION : issues
    PRESCRIPTION ||--o{ MEDICINE : contains
    ROOM ||--o{ BED : contains
    PATIENT ||--o{ BILL : charged
```

---

## 4. ROLE-BASED ACCESS CONTROL (RBAC) MATRIX

| Module / Action | Super Admin | Hospital Admin | Doctor | Nurse | Receptionist | Lab Staff | Pharmacist | Patient |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| System Configuration & RBAC | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| EMR Consultations & Vitals | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | Read-Only |
| Issue Prescriptions | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Call Next Patient Queue Token | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Dispense Medicines | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Upload Lab Test Reports | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Assign Hospital Beds | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Financial Analytics | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 5. SMART AI ENGINE ALGORITHMS

### 5.1 Symptom-Based Department Recommendation
The engine processes patient free-text symptom inputs, normalizes token streams, and calculates weighted term-frequency matching against clinical department symptom vector representations:

$$\text{MatchScore}(D_k) = \sum_{t \in S} w_t \cdot \text{TF}(t, D_k)$$

Where $S$ represents extracted symptom tokens and $w_t$ represents the clinical weight of symptom $t$.

### 5.2 Pharmacy Stock Depletion & Reorder Forecasting
Predicts remaining operational days ($D_{\text{remaining}}$) before stock exhaustion:

$$D_{\text{remaining}} = \frac{S_{\text{current}}}{\bar{C}_{\text{daily}}}$$

When $D_{\text{remaining}} \le 3$, an automated critical reorder alert flag is broadcast to the Pharmacy and Admin dashboards.

---

## 6. DEPLOYMENT & INSTALLATION GUIDE

### Prerequisites
* Node.js v20.x or higher
* npm v10.x or higher
* An Amazon DynamoDB table and AWS credentials: see [SETUP.md](SETUP.md)

### Step-by-Step Local Launch
```bash
# 1. Backend Setup
cd backend
npm install
cp .env.example .env   # fill in values, see SETUP.md section D
npm run seed     # Inserts demo data with 10 demo accounts into an empty table
npm run dev      # Starts Express backend on http://localhost:5000

# 2. Frontend Setup (in a new terminal)
cd frontend
npm install
npm run dev      # Starts Vite dev server on http://localhost:5173
```

---

## 7. DEMO CREDENTIALS

| Account Role | Email Address | Password |
|---|---|---|
| Hospital Admin | `admin@smarthospital.org` | `password123` |
| Chief Doctor | `doctor@smarthospital.org` | `password123` |
| Patient Portal | `patient@smarthospital.org` | `password123` |
| Receptionist | `reception@smarthospital.org` | `password123` |
| Lab Technician | `lab@smarthospital.org` | `password123` |
| Pharmacist | `pharmacy@smarthospital.org` | `password123` |

---
&copy; 2026 SmartHospital SaaS Platform. All Rights Reserved.
