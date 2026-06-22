# Proposal Pro - Project Blueprint

This document acts as a comprehensive "blueprint" for the Proposal Pro application. Instruct an AI Agent with this file, and it will be able to reconstruct the exact same application from scratch.

## 1. Project Overview

**Name:** Proposal Pro
**Description:** A smart, AI-powered proposal generation and management platform. It allows users to quickly draft customized business proposals via AI, style them according to multiple saved brand identities, share them via secure web links, and collect digital signatures from clients.
**Provider Name:** remotelyavailable (remotelyavailable.com)

## 2. Tech Stack & Dependencies

The application is a Single Page Application (SPA) built using React.

*   **Framework:** React 19 (via Vite)
*   **Routing:** `react-router-dom` v7+
*   **Styling:** Tailwind CSS (v4)
*   **Icons:** `lucide-react`
*   **Animations:** `motion`
*   **Editor:** TipTap (React) with StarterKit and Image extensions
*   **Signatures:** `react-signature-canvas` for drawing signatures
*   **PDF Generation:** `html2pdf.js` for client-side PDF export
*   **Backend & DB:** Firebase v12 (Firestore for database, Firebase Auth for Google Sign-In)
*   **AI Integration:** `@google/genai` (utilizing `gemini-3.1-pro-preview`)

## 3. Database Schema (Firestore)

The application uses Firebase Firestore with the following Collections and relationships:

### `users`
Stores user profile information.
*   `id`: string (Matches Firebase Auth UID)
*   `email`: string
*   `createdAt`: timestamp

### `brandProfiles`
Stores branding configuration for proposal generation, allowing users to switch between brands.
*   `id`: string
*   `ownerId`: string (User UID)
*   `name`: string (e.g., "Main Agency")
*   `brandKit`: Object
    *   `primary`: string (Hex Color)
    *   `secondary`: string (Hex Color)
    *   `accent`: string (Hex Color)
    *   `background`: string (Hex Color)
    *   `fontFamily`: string (e.g., "Questrial")
    *   `logoUrl`: string

### `proposals`
Stores the actual proposals generated or drafted by the user.
*   `id`: string
*   `ownerId`: string (User UID)
*   `title`: string
*   `clientName`: string
*   `content`: string (HTML stored from TipTap editor)
*   `status`: string (`draft`, `sent`, `approved`)
*   `brandProfileId`: string (Reference to brand profile)
*   `brandKit`: Object (Snapshot of the brand kit at the time of creation so it doesn't break if the global brand profile changes)
*   `lineItems`: Array (Optional: used for pricing tables)
    *   `name`: string
    *   `price`: number
*   `signature`: string (Base64 Data URL of the signed canvas, if approved)
*   `createdAt`: timestamp
*   `updatedAt`: timestamp

### `notifications`
Stores activity logs (e.g., when a client signs).
*   `id`: string
*   `ownerId`: string (User UID)
*   `proposalId`: string
*   `proposalTitle`: string
*   `clientName`: string
*   `message`: string
*   `read`: boolean
*   `createdAt`: timestamp

## 4. Environment Variables Required

*   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, etc. (Standard Firebase config keys exposed to the frontend)
*   `VITE_GEMINI_API_KEY` (For running the Gemini model from the frontend during proposal generation)

## 5. Application Structure & Routes

### `src/App.tsx`
Handles the routing definitions. Wraps the app in an `AuthProvider`.
*   `/` -> `<Layout>` Wrapper
*   `/` (Inside Layout) -> `<Dashboard>` (Protected)
*   `/editor/:id?` (Inside Layout) -> `<Editor>` (Protected)
*   `/settings` (Inside Layout) -> `<Settings>` (Protected)
*   `/p/:id` -> `<ClientView>` (Publicly Accessible)

### Key Components

#### `Layout.tsx`
*   Checks if the user is authenticated via Firebase. If not, displays a smooth, centered "Google Sign-In" screen.
*   If authenticated, displays the main application sidebar/header navigation with links to Dashboard, Create Proposal, and Brand Settings.
*   Shows a notification bell icon reading from the `notifications` collection.
*   Includes a standard footer attributing "Proposal Pro" to "remotelyavailable" linking to "remotelyavailable.com".

#### `Dashboard.tsx`
*   Fetches and lists all proposals belonging to the logged-in user.
*   Shows key metrics (Total Drafts, Sent, Approved).
*   Allows duplicating, deleting, and copying the public link for proposals.

#### `Editor.tsx`
*   The core proposal creation engine.
*   **AI Integration:** Contains a sidebar allowing the user to select one of their saved `brandProfiles`, input a prompt (e.g., "Write a web design proposal for Acme Corp"), and call the Gemini API (`gemini-3.1-pro-preview`) to generate HTML structured proposal copy.
*   Uses a TipTap rich text editor to allow manual editing of the generated content.
*   Saves the proposal to the `proposals` collection.

#### `Settings.tsx`
*   Allows the user to create, edit, and delete multiple `brandProfiles`.
*   Users can set custom colors and specific Google Font family names (e.g., "Inter" or "Questrial").

#### `ClientView.tsx`
*   The exact URL sent to clients (`/p/UNIQUE_ID`).
*   Does **not** require authentication.
*   Dynamically loads the specific Google Font saved in the proposal's `brandKit`. Applies primary/background colors to the page UI elements natively, ensuring the client views it completely branded to your specific agency.
*   Updates the browser `<title>` dynamically to (`[Client Name] - Proposal Pro`).
*   Includes a `react-signature-canvas` box at the bottom.
*   When the client signs and clicks "Approve", it saves the signature as a base64 Data URL to the Firestore document, changes status to `approved`, and fires a new record to the `notifications` collection so the agency owner is alerted.
*   Includes a "Download PDF" button powered by `html2pdf.js`, generating a PDF snapshot directly from the browser window.

## 6. System Design Philosophy

*   **Speed:** Utilize AI to overcome the blank-page syndrome.
*   **No-Friction Client Approval:** Clients do not create accounts. They view a link, sign it digitally on the canvas, and done.
*   **Customizability:** By storing `brandKit` configurations physically on the individual proposal documents upon creation, historical proposals remain perfectly styled even if the globally saved brand colors are updated later.
