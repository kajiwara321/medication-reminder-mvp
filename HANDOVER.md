# Handover Document: Medication Reminder MVP

## Project Overview

Develop an MVP web application using Next.js (TypeScript) deployed on Vercel. The app uses a Mac/iPhone camera to monitor a pill calendar, detect if pills have been taken (based on image difference from a baseline), and notify the user if medication might have been missed. **The primary goal is to create a functional demo for investors, prioritizing core detection and notification features over polished UI/UX for now.**

## Current Status: **(Updated)**

**Currently working on the `feature/single-region-experiment` branch.** Automatic Grid Splitting feature implemented (`f0582d4`, `e9ac171`, `59bebbb`). Core functionality (baseline setting, change detection, notification) appears functional. **Resolved ESLint issues (`0250388`, `758eeaa`) causing Vercel build failures and successfully deployed to Vercel.** Added a local setup guide (`2e1387e`).

## Technology Stack

*   Framework: Next.js (App Router)
*   Language: TypeScript
*   Styling: Tailwind CSS
*   Deployment Target: Vercel
*   UI: React Components
*   Camera Access: `navigator.mediaDevices.getUserMedia()`
*   Image Processing: Canvas API (Client-side)
*   State/Settings Storage: LocalStorage (Partially implemented, needs update for grid)
*   Testing: Jest / React Testing Library (Setup complete)

## Development Rules & Process

*   **Iterative Development:** Follow the phased plan below.
*   **Version Control:** Commit changes to Git frequently with meaningful messages after each logical step or feature implementation. Use `git log --oneline` to view history.
*   **Handover Document:** Keep this document (`HANDOVER.md`) updated with the current status, next steps, and any significant changes or decisions after each major step. Include relevant Git commit hashes.
*   **Modularity:** Implement features in well-defined, reusable components and utility functions (modules).
*   **Unit Testing:** Write unit tests for key functions (especially utilities like `imageUtils`, `storage`, and potentially hooks) using Jest and React Testing Library. Run tests regularly (`npm test`). *(Setup required, tests not yet written)*

## Revised Development Plan (Demo Priority) - **(On Hold)**
**(Note: The following plan applies to the `feature/multi-region-poc` branch. Development is currently paused on this plan.)**

**Goal:** Demonstrate detection of medication status (taken/not taken) for specific, labeled pockets based on a simple schedule.

**Step 1: Multi-Pocket Management Foundation (Completed & Tested on `feature/multi-region-poc`)**
*   **Commit:** `909f74e`

**Step 2: Pocket Labeling & Simple Schedule (Completed & Tested on `feature/multi-region-poc`)**
*   **Commit:** `5e9aa94`

**Step 3: Simplified Detection Logic & Notification (Next on `feature/multi-region-poc`)**

**(Post-Demo) Step 4: UI/UX Refinement & Full Scheduling (On `feature/multi-region-poc`)**

## Previous Implementation (Initial MVP - **Current Base**)
*   **Commit:** `9cf5d18` (feat: Initial commit for medication reminder MVP) - **Base for `feature/single-region-experiment` branch.**
*   Single region selection and baseline setting.
*   Basic difference detection and notification for the single region.

## Development Notes **(Updated)**

*   **Branching:**
    *   The multi-region features developed up to commit `5e9aa94` are saved in the `feature/multi-region-poc` branch.
    *   Current development for a new experiment is happening on the `feature/single-region-experiment` branch, starting from the initial MVP commit `9cf5d18`.
*   **New Experiment: Automatic Grid Splitting**
    *   **Commit:** `f0582d4` (feat: Implement basic grid splitting UI and logic)
    *   **Commit:** `e9ac171` (fix: Resolve hydration and image dimension errors)
    *   **Commit:** `59bebbb` (refactor: Adjust layout and RegionSelector styling)
    *   **Goal:** Allow user to select the entire calendar area, then automatically split it into a 7x4 grid for individual pocket monitoring.
    *   **Approach Implemented:** (Details omitted for brevity, see previous version if needed)
    *   **Current State:** Core functionality implemented and appears functional.
*   **Vercel Deployment & ESLint Fixes:**
    *   **Commit:** `0250388` (fix: Resolve ESLint issues for Vercel build & restore detection logic)
    *   **Commit:** `758eeaa` (fix: Resolve remaining ESLint issues for Vercel build)
    *   Identified and fixed several ESLint errors/warnings that were preventing successful Vercel builds. Adjusted `useEffect` dependencies and suppressed a specific `react-hooks/exhaustive-deps` warning with justification to ensure correct detection logic.
*   **Documentation:**
    *   **Commit:** `2e1387e` (docs: Add local setup guide)
    *   Added `LOCAL_SETUP_GUIDE.md` detailing steps for setting up and running the project locally.
*   **Known Issues:**
    *   State persistence (`useSettings` hook) needs to be updated for the grid structure.
    *   Remaining ESLint warnings in `npm run build` output (related to `useCallback` dependencies in `RegionSelector.tsx` and `useEffect` dependencies in `page.tsx`) - These do not currently block the build but could be addressed for better code quality/performance.

## Next Steps **(Updated)**

With deployment successful, the next focus returns to verifying and refining the core grid functionality:

*   **Verify and Refine Grid Functionality:**
    *   Task 1: Conduct more thorough testing of baseline setting and change detection under various conditions (different lighting, partial changes, etc.).
    *   Task 2: Fine-tune the `DIFF_THRESHOLD` (currently 10%) if needed based on testing.
    *   Task 3: Consider adding visual feedback directly on the grid cells in the camera view (e.g., changing border color on detection).
*   **Address Remaining ESLint Warnings (Optional but Recommended):** Fix the warnings identified during the `npm run build` process.
*   **Refactor State Management (Future):** Integrate `masterRegion` and `baselineImages` state with `useSettings` hook for persistence in LocalStorage.

## Key Decisions Made **(Updated)**

*   Language: TypeScript
*   Region Selection: **(Current Branch)** Single Master Region -> Automatic 7x4 Grid. **(Previous Branch)** Multi-Region Drag & Drop.
*   Grid Splitting Method: **Equal Splitting** (Method A) implemented.
*   Baseline Setting: **Set All Baselines** button implemented.
*   Notification (MVP): Text-based display (temporary).
*   Image Comparison: Client-side via Canvas API.
*   Difference Threshold: 10% (May need adjustment later).
*   Testing Framework: Jest / React Testing Library.
*   ESLint `react-hooks/exhaustive-deps` for comparison `useEffect` intentionally suppressed to maintain functionality.

## Deployment

*   **Vercel URL (`feature/single-region-experiment` branch):** [https://medication-reminder-7pp3ndlh7-kajiken321s-projects-a2ac8508.vercel.app/](https://medication-reminder-7pp3ndlh7-kajiken321s-projects-a2ac8508.vercel.app/)

## Documentation

*   **Local Setup Guide:** See `LOCAL_SETUP_GUIDE.md` in the project root for instructions on setting up and running the project locally.

## Potential Challenges / Areas for Refinement

*   Accuracy of equal grid splitting vs. real calendar pockets (May require Method B later).
*   Lighting Sensitivity, Performance, Stability (as before).
*   Managing state for 28 cells efficiently (Consider refactoring with `useReducer` or Zustand if complexity grows).
*   Designing intuitive UI for displaying status of 28 cells (Further improvements possible).
*   Need to add actual unit tests for implemented modules.