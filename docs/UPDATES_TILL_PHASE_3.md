# SiteTrack Mobile App — Full Product & UX Walkthrough (End of Phase 3)

This document is a complete, highly-detailed functional walkthrough of the SiteTrack mobile application up to the end of Phase 3. It explains exactly **how the app works, what every screen looks like, and what features have been built.** 

If you are taking over this project to build new features, read this to understand exactly what the user experiences when they open the app.

---

## 🎨 Global Design System & Vibe
* **The Vibe:** Premium, modern, consumer-grade Field Service App. It feels like an expensive SaaS product, not a clunky legacy tool.
* **Colors:** Dark Navy (`#1B2D4F`) for all top-level branding and headers, vibrant Orange (`#F97316`) for primary actions, success Green (`#22C55E`), and Off-White (`#F8FAFC`) for the app's background.
* **"Hero Headers":** Almost every screen features a **Navy Curved Header** that sweeps down from the top, with white content cards floating slightly over the curve to create depth and shadows.
* **Modals over Alerts:** The app strictly avoids ugly default iOS/Android popup boxes (like `Alert.alert`). Everything uses smooth, sliding Bottom Sheets or custom Modal cards.

---

## 📱 The Core User Journey & Screens

### 1. The Splash & Login Flow
* **Splash Screen (`app/(auth)/index.tsx`):** When the app launches, the user sees a full-screen Navy background. In the center is a glowing Orange Circle with "ST" inside, and "SiteTrack - Field Service, Simplified" below it in bold white text. An orange spinning loader checks if the user is logged in. It fades out smoothly after 600ms.
* **Login Screen (`app/(auth)/login.tsx`):** If not logged in, they hit the Login screen. The top 40% of the screen is the Navy curve. A floating white "Welcome Back" card sits over it, containing an Email field, a Password field (with a show/hide eye), and a massive Orange "Sign In" button. There is also a Ghost-styled Fingerprint/Biometric button below it.
* **Forgot Password (`app/(auth)/forgot-password.tsx`):** A clean email-input screen. If they submit, a massive green success circle with a checkmark animates in, telling them to check their inbox.

### 2. The Main Tab Navigation (The "Footer")
Once logged in, the user sees a highly polished, clean white tab bar at the absolute bottom of the screen with **3 main tabs**:
1. **Home** (Dashboard)
2. **Schedule** (My Jobs)
3. **Profile** (Account settings)

*Note: There are NO other tabs in the footer. Do not add hidden tabs or redundant folders to this footer.*

---

### 3. Home Dashboard (Tab 1: `app/(app)/index.tsx`)
This is the command center for the technician's day.

* **Top Header:** Navy curved header. It greets the user ("Good Morning, John 👋") and shows today's date. In the top right corner is a **Bell Icon** (for Alerts) and a small cloud syncing indicator.
* **The 2x2 Stat Grid:** Floating over the header curve are 4 cards showing actual daily stats:
  - Total Jobs (Blue icon)
  - Completed (Green icon)
  - In Progress (Orange icon)
  - Pending (Grey icon)
* **Quick Actions:** Two rows of chunky, tappable buttons:
  - 🚀 Start Next Job -> Jumps to the Schedule tab.
  - 📷 Scan Asset QR -> (Coming Soon placeholder toast).
  - 📆 This Week -> (Shows a toast of total weekly completion).
  - ⚠️ Open Defects -> (Shows a toast of current un-actioned defects).
* **"Next Up" Hero Card:** If the tech has a job scheduled today, a massive Orange card appears showing the exact address, time, and two buttons: "Navigate" (opens Google Maps) and "Open Job".
* **Today's Jobs List:** A scrolling vertical list of job cards for today. If there are no jobs, a fun custom `<EmptyState>` component appears saying "🎉 No jobs today! Enjoy your day".

---

### 4. My Jobs / Schedule (Tab 2: `app/(app)/jobs/index.tsx`)
The technician's full schedule.

* **Top Header:** Navy header titled "My Jobs".
* **Filter Pills:** Just below the header is a row of horizontal grey pills used for filtering the schedule: **Today (X)** | **This Week (Y)** | **All Jobs (Z)**. The pills dynamically inject the exact count of jobs inside the labels!
* **Job Cards:** Each job is represented by a crisp white card featuring:
  - The property name and full address.
  - A colored priority stripe on the left edge (Red for Urgent, Orange for High, Blue for Normal).
  - Time, Date, and Job Type (e.g., Routine Service).

---

### 5. The Job Detail Screen (`app/(app)/jobs/[id]/index.tsx`)
The most complex and important screen in the app. When a technician taps a Job Card, they are taken here. The Bottom Tab Bar hides itself so this screen gets maximum space.

* **Top Header:** Shows the property name and address. There is a "Navy on White background" Maps Navigation button.
* **Detailed Info Tags:** Horizontal scrolling chips showing the date, time, job type, and a colored Priority chip (e.g., "⚡ High Priority").
* **The Time Tracking Card (CRITICAL):**
  - If the job is Scheduled: A big orange "Clock In & Start Job" button.
  - If the job is In Progress: The card turns grey/green. It shows the exact Start Time. The technician gets two half-width buttons side-by-side: a grey "Pause/Break" button and a green "Complete Job" button.
  - If the job is Completed: A static green success banner saying "Completed at [Time]".
* **The 4 Vertical Action Menus:** Below the timer, there are 4 huge menu rows for the technician to do their actual work. They currently route to Phase 4-6 placeholders:
  - 🔍 **Inspect Assets** 
  - ⚠️ **Log Defect** 
  - 📷 **Take Photos** 
  - ✍️ **Capture Signature** 
* **The Notes System:** A tab at the bottom for finding details ("Check in at security desk"). It features a clean "Edit" toggle so the technician can write back to the office natively without jumping screens.
* **The Floating Report Button:** Pinned to the absolute bottom of the screen, floating above everything else, is a white button: "📄 Generate / View Report". 

---

### 6. Alerts & Notifications (`app/(app)/notifications/index.tsx`)
Accessed exclusively by tapping the Bell icon on the Home dashboard (it is NOT a bottom tab).
* Uses the standard Navy header with a "Back" button so the user can easily return to the dashboard.
* Shows a list of system alerts (Sync completions, urgent new job assignments). Unread alerts have a bold orange stripe on the left and an orange dot.

---

### 7. The Profile Screen (Tab 3: `app/(app)/profile.tsx`)
* **Header:** Deep navy design pushing the user's Avatar (72x72) down over the curve.
* **Content:** Shows their email, phone number, and app version details.
* **Sign Out:** When tapped, a smooth Custom Bottom Sheet slides up from the bottom of the screen asking "Are you sure you want to sign out?" with a destructive red button. (No ugly system alerts here!).

---

## 🚧 Placeholders & What Needs to be Built Next (Phase 4+)

Everything listed above is **100% built and functioning exactly as described**. 

If the user clicks on Inspect Assets, Log Defects, Take Photos, or Generate Report inside the Job Detail screen, they are taken to a beautiful white screen that says: **"Coming in Phase X"**. 

**The AI taking over this project for Phase 4 must:**
1. Open `app/(app)/jobs/[id]/inspect.tsx` and replace the placeholder text with a list of Assets for the technician to mark "Pass" or "Fail".
2. Open `app/(app)/jobs/[id]/defects.tsx` and replace the placeholder text with a form to log broken assets (Minor/Critical).
3. Connect those actions back to the local `expo-sqlite` database so the background syncer can send them to Supabase!
