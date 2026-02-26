# CLAUDE.md — AI Assistant Guidelines for yuramanager

## Project Overview

**yuramanager** (YuraCRM) is a CRM web application for **YURATRANSPORTATION** — a passenger transportation company operating UA-EU and EU-UA routes. It manages passenger leads, vehicle assignments, route optimization, and driver status tracking.

## Architecture

Single-page application — one monolithic HTML file (`index_pass_19v.html`) containing all CSS, HTML, and JavaScript inline. No build tools, no bundler, no framework. Pure vanilla JS.

### Backend

- **Google Apps Script** — two endpoints (Apps Script Web Apps) handle data:
  - `API_URL` — main passenger CRUD (getAll, addPassenger, updatePassenger, archivePassengers, restorePassengers, optimize)
  - `ROUTE_API_URL` — route management (getRoutePassengers, copyToRoute, getAvailableRoutes, createRouteSheet, etc.)
- **Smart Sender API** — tagging contacts via `proxy_pass_19v.php` PHP proxy
- **Google Sheets** — primary data store (passengers + route sheets per vehicle)

### Data Flow

1. Passengers loaded from Google Sheets via Apps Script API
2. Stored locally in `passengers[]` array + `localStorage` (`yuraCrmV16`)
3. Changes synced back to server via API calls
4. Silent auto-sync every 60 seconds

## Project Structure

```
yuramanager/
├── CLAUDE.md              # AI assistant guidelines (this file)
├── index_pass_19v.html    # Main SPA — all CSS/HTML/JS (~5000 lines)
└── proxy_pass_19v.php     # Smart Sender API proxy for tagging
```

## Key Concepts

### Passenger Statuses
- `new` — fresh lead
- `work` — in progress
- `optimize` — included in route optimization
- `route` — assigned to a route
- `archived` / `refused` / `transferred` / `deleted` — closed statuses

### Filters System
The `filters` object controls all list filtering:
- `direction` — 'all', 'ua-eu', 'eu-ua'
- `showNewOnly` — show only leads from last 24h
- `specialStatus` — show specific closed status (archived, refused, etc.)
- `date`, `vehicle`, `search`, `routeVehicle`, etc.

### Unique Keys
Passengers are identified by `_sheet + _rowNum` (server data) or `local_<index>` (local only). This `uid` system is used for selection, editing, and bulk operations.

### Two Rendering Modes
- **Normal mode** — renders from `passengers[]` via `getFilteredData()` + `render()`
- **Route mode** — renders from `routePassengers[]` via `renderRoutePassengers()` (loaded from route API)

## Development Guidelines

- This is a monolithic HTML file — all changes go in `index_pass_19v.html`
- CSS is in `<style>` at the top, HTML in `<body>`, JS in `<script>` at the bottom
- Responsive design: PC sidebar (>900px) vs burger menu (<900px)
- No build step — edit and deploy directly
- Test on both mobile and desktop viewports

### Naming Conventions
- Functions: camelCase (`showNewLeads`, `bulkAssignVehicle`)
- CSS classes: kebab-case (`lead-card`, `card-direction`, `bulk-sidebar-btn`)
- IDs: camelCase (`pcNewLeads`, `mobileCountAll`, `bulkVehicleModal`)

### Important Patterns
- `findPassengerByUid(uid)` — find passenger by unique key
- `showLoader()` / `hideLoader()` — global loading overlay
- `showToast(msg)` — notification messages
- `saveSettings()` — persist to localStorage
- `updatePassengerOnServer(p)` — sync single passenger to API

## Git Workflow

- **Default branch**: `main`
- Write clear commit messages in imperative mood
- Keep commits atomic

## Key Decisions & Context

- Single HTML file architecture chosen for simplicity of deployment
- Google Sheets as database — no separate DB server needed
- Smart Sender integration for customer notification tagging
- Route optimization uses Google Directions API (server-side)
- localStorage used for offline capability and faster loads
