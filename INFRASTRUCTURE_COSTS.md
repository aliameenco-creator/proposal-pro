# Internal Infrastructure & Cost Breakdown

This document outlines the backend technologies, API keys, and estimated costs associated with running **Proposal Pro**. 

*(Note: This is for your internal use as the app owner, so you know exactly what you are spending. You likely do not need to send this specific file to your clients).*

---

## 1. AI Generation (Google Gemini API)

Proposal Pro uses Google's state-of-the-art AI to generate the proposal content.

* **Model Used:** `gemini-3.1-pro-preview` (Google's highly capable reasoning model).
* **API Keys Used:** **1** (Google Gemini API Key).
* **Pricing Structure:**
  * **Free Tier:** Google AI Studio offers a free tier (typically up to 50 requests per day for Pro models, subject to rate limits).
  * **Pay-As-You-Go (if you exceed the free tier):**
    * **Input Costs:** ~$1.25 per 1 million tokens (roughly 750,000 words of context/prompts).
    * **Output Costs:** ~$5.00 per 1 million tokens (roughly 750,000 words generated).
* **Estimated Cost per Proposal:** 
  * A typical proposal generation uses about 500-1,000 input tokens and generates 500-800 output tokens.
  * **Cost:** Less than **$0.005 (half a cent)** per generated proposal. You can generate hundreds of proposals for just a few dollars.

---

## 2. Database & Authentication (Google Firebase)

All of your proposals, client data, brand settings, and digital signatures are stored securely in Firebase.

* **Services Used:** 
  * **Firestore:** NoSQL Database (stores the proposal text, status, and signature data).
  * **Firebase Auth:** Handles your secure login (Google Sign-In).
* **API Keys Used:** **1** (Firebase Client Config Key - note: this is a public identifier for your app, billing is handled at the Google Cloud project level).
* **Pricing Structure (Spark Plan - Free Tier):**
  * **Reads:** 50,000 document reads per day for free.
  * **Writes:** 20,000 document writes per day for free.
  * **Deletes:** 20,000 document deletes per day for free.
  * **Authentication:** 50,000 Monthly Active Users for free.
* **Estimated Cost:** 
  * **$0.00 / month**. Unless you are managing thousands of clients viewing proposals every single day, you will likely never exceed the Firebase Free Tier. If you do, it costs pennies per 100,000 additional reads.

---

## 3. Hosting & Frontend

* **Current Environment:** The app is currently running in the AI Studio preview environment.
* **Production Deployment:** When you deploy this to a service like Firebase Hosting, Vercel, or Google Cloud Run:
  * **Cost:** Most modern hosting platforms offer a generous free tier for frontend applications that will easily cover standard usage.

---

## Summary of Your Spending

| Service | Keys Used | Estimated Monthly Cost (Low/Medium Volume) |
| :--- | :--- | :--- |
| **Gemini AI** | 1 | **$0.00** (Free tier) to **$2.00** (if generating hundreds of proposals) |
| **Firebase DB** | 1 | **$0.00** (Covered by generous daily free limits) |
| **Hosting** | 0 | **$0.00** (Standard free tiers) |
| **Total** | **2** | **~$0.00 to $2.00 / month** |

**Conclusion:** Proposal Pro is extremely lightweight and cost-efficient. You are utilizing exactly **2 API configurations** (Gemini for AI, Firebase for data), and your running costs will be virtually zero until you scale to a massive enterprise level.
