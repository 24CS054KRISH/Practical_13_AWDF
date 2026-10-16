# Advanced Web Development Frameworks (ITUE301) - Practical 13
## Practical 13: AI API Integration into a Web Application
**Student ID:** 24CS034  
**Course:** B. Tech (CSE/IT/AIML) — Semester 5  
**Institution:** Chandubhai S. Patel Institute of Technology (CSPIT) / DEPSTAR, CHARUSAT  

---

## 🎯 Practical Objective & CO/PO Mapping
- **Objective:** To integrate an external AI service into the existing Task Management web application securely and understand responsible AI engineering.
- **CO/PO Mapping:** CO6 / PO3, PO5, PO12

---

## 🏗️ Architecture & Flow Diagram
```text
React Frontend (Vite @ localhost:5173)
       │
       │ User clicks 'Generate description'
       ▼
Express Backend (/api/ai/generate-description @ localhost:5000)
       │
       │ API key stored server-side only in .env (never exposed to client)
       ▼
OpenAI API (gpt-4o-mini) / Google Gemini API (gemini-1.5-flash)
       │
       │ Response parsed / caught on error
       ▼
Response sent back to React UI
   ├── On Success: Editable draft filled into description field + Visible AI Disclaimer
   └── On Failure (Graceful Degradation): Fallback message displayed, app continues working uninterrupted
```

---

## ⚡ Core Features Implemented

1. **Secure Backend AI Proxying:**
   - OpenAI SDK / Gemini API called strictly from Node.js Express backend (`/api/ai/generate-description`).
   - Private API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`) reside exclusively in server-side `.env`, never exposed to browser DevTools or committed to GitHub.

2. **Graceful Degradation Design:**
   - Wrapped AI API integration in comprehensive `try/catch` handlers.
   - On network drop, quota exhaustion, or invalid API key (401 Unauthorized), the endpoint returns `{ description: '', fallback: true, message: '...' }` with HTTP 200, allowing the user to type manually without breaking task creation.

3. **Editable Suggestion & User Agency:**
   - AI suggestions pre-fill the description `textarea` as an editable draft.
   - The user maintains complete control to modify, expand, or discard the suggestion prior to persisting the task.

4. **Clear AI Disclaimer (Responsible AI):**
   - Subtle informational banner highlighting:
     > *"AI-generated content. Please review and modify before saving."*

5. **Frontend Loading State:**
   - Animated SVG spinner and `"Generating..."` label with button disabling to prevent accidental duplicate clicks during network latency.

6. **Rate Limiting Enforcement:**
   - In-memory rate limiting mechanism restricting requests to **maximum 1 request per task per minute** (60s cooldown).
   - Returns HTTP 429 (`Too Many Requests`) with countdown retry timer.

---

## 🚀 Getting Started

### 1. Backend Setup
```bash
cd TaskManagerAPI
npm install
```
Configure your `.env` file (copy from `.env.example`):
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.heiczbp.mongodb.net/taskdb
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5000
DEMO_MODE=true
```
Run the server:
```bash
node app.js
```
The server starts at `http://localhost:5000`.

### 2. Frontend Setup
```bash
cd ../task-manager-frontend
npm install
npm run dev
```
The frontend starts at `http://localhost:5173`.

### 3. Automated Test Suite
Run the test runner to verify status endpoints, rate limiting, and graceful degradation:
```bash
cd TaskManagerAPI
npm run test:ai
```

---

## 💡 Key Questions & Analysis (Viva & Evaluation)

### Q1: Why must the AI API key be called from the backend rather than directly from the React frontend?
> **Answer:**  
> Frontend code (HTML, JavaScript, and network bundles) runs entirely in the client's browser environment. Any API key embedded in client JavaScript or `.env` prefixed with `VITE_` is visible in plain text via the browser's DevTools Network tab, Sources panel, or by inspecting bundles. Malicious actors can extract the key to drain billing quotas or abuse the account. By proxying requests through a Node.js/Express backend, the API key remains strictly in server-side environment variables (`process.env`), completely concealed from the client.

### Q2: What does 'graceful degradation' mean in this context, and why does it matter for a feature that depends on a third-party service outside your control?
> **Answer:**  
> Graceful degradation is a software design pattern where a system maintains core operational capabilities even when optional or external dependencies fail. In this application, AI description generation is an assistive enhancement, not a blocker. If the external AI service experiences downtime, rate limiting, or network timeout, the application catches the error and falls back to manual text entry rather than crashing or preventing task creation. This guarantees high application availability and resilience.

### Q3: What are the privacy and governance implications of sending task data to an external AI API, and what kind of data should never be sent this way?
> **Answer:**  
> Sending user prompts or task information to third-party AI APIs transmits data over external networks and may subject it to retention policies, model training pipelines, or compliance scrutiny (e.g., GDPR, HIPAA, SOC 2).  
> **Data that should NEVER be sent to external AI APIs:**
> - Personally Identifiable Information (PII): Social Security Numbers, phone numbers, home addresses, passwords.
> - Financial or Health Records: Credit card numbers, medical diagnoses, insurance IDs.
> - Proprietary/Confidential Business Secrets: Proprietary algorithms, unreleased financial reports, proprietary credentials, and cryptographic private keys.
