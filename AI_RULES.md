# AI Rules & Guidelines

## Tech Stack

*   **React (TypeScript)**: The core library for building the user interface, ensuring type safety and component-driven architecture.
*   **React Router**: Used for handling client-side routing and navigation between pages (e.g., Login, Admin Dashboard, Rider Dashboard).
*   **Tailwind CSS**: The utility-first CSS framework used for all styling, ensuring responsive, modern, and clean designs.
*   **shadcn/ui (Radix UI)**: Prebuilt, accessible, and highly customizable UI components used for building forms, dialogs, tables, and other interactive elements.
*   **Lucide React**: The primary icon library used for all visual indicators, buttons, and navigation icons.
*   **Local Storage / Mock Database**: Used for simulating persistent state, authentication sessions, and data management (riders, establishments, schedules, deliveries, notifications) in a client-only environment.

---

## Library Usage Rules

### 1. UI Components & Styling
*   **Rule**: Always use **shadcn/ui** components (e.g., Button, Dialog, Input, Select, Table, Card, Tabs) for building user interfaces.
*   **Rule**: Do not write custom CSS. Use **Tailwind CSS** utility classes exclusively for layouts, spacing, colors, and responsive design.
*   **Rule**: Ensure all designs are fully responsive, supporting both mobile devices (crucial for Riders) and desktop screens (crucial for Administrators).

### 2. Icons
*   **Rule**: Use **Lucide React** for all icons. Do not import icons from other libraries (like FontAwesome or Material Icons) to maintain visual consistency.

### 3. State Management & Data Persistence
*   **Rule**: Use React state (`useState`, `useContext`) for local and global application state.
*   **Rule**: Persist application data (users, establishments, schedules, deliveries, notifications) in `localStorage` to simulate a backend database and maintain state across page refreshes.

### 4. Routing & Access Control
*   **Rule**: Use **React Router** for routing. Keep all route definitions in `src/App.tsx`.
*   **Rule**: Implement strict role-based access control (RBAC) to ensure Riders cannot access Admin pages and vice versa, redirecting unauthorized users to their respective home screens.

### 5. Code Structure & Quality
*   **Rule**: Keep components small, focused, and under 100 lines of code where possible. Create new files in `src/components/` or `src/pages/` for new components.
*   **Rule**: Do not use placeholders, partial implementations, or `TODO` comments. All code must be fully functional and complete.