# Zendy Delivery AI - Project Structure

## Overview
Full-stack SaaS platform for restaurants to automate WhatsApp ordering through AI agent (PT-PT).

## Project Architecture

### Pages & Routes
```
/login           → Login page for restaurant owners
/                → Dashboard (order management)
/menu            → Menu Management (categories, products, add-ons)
/orders          → Orders list
/orders/:id      → Order detail view
/settings        → Restaurant settings
```

### Folder Structure
```
src/
├── pages/               # All page components
│   ├── Dashboard.tsx
│   ├── MenuManagement.tsx
│   ├── Orders.tsx
│   ├── OrderDetail.tsx
│   ├── Settings.tsx
│   ├── Login.tsx
│   └── NotFound.tsx
│
├── layouts/            # Layout wrappers
│   └── DashboardLayout.tsx
│
├── providers/          # Context providers
│   └── ThemeProvider.tsx
│
├── components/         # Reusable UI components (to be built)
│   └── ui/            # Shadcn components
│
├── lib/               # Utilities
│   └── utils.ts
│
└── integrations/      # External integrations
    └── supabase/      # Supabase client
```

## Design System

### Color Tokens (Light Mode)
- **Primary**: Orange (24.6 95% 53.1%) - Main brand color
- **Secondary**: Light gray (60 4.8% 95.9%)
- **Accent**: Light orange (25 95% 97%)
- **Destructive**: Red (0 84.2% 60.2%)

### Brand Colors
- **Orange**: Main brand color
- **Green**: Success states (142.1 76.2% 36.3%)
- **Red**: Error states (0 84.2% 60.2%)

### Gradients
- `gradient-primary`: Orange → Red
- `gradient-secondary`: Green → Orange
- `gradient-hero`: Orange → Red (full hero)

### Shadows
- `shadow-soft`: Subtle elevation
- `shadow-glow`: Orange glow effect
- `shadow-card`: Card elevation

### Design Specifications
- **Radius**: 8px (consistent across all components)
- **Animations**: 300ms transition-smooth
- **Breakpoints**: sm(640) md(768) lg(1024) xl(1280) 2xl(1400)

## Theme System

### Dark Mode Support
ThemeProvider implemented with localStorage persistence:
- Light mode (default)
- Dark mode
- System preference

Toggle via `useTheme()` hook from `@/providers/ThemeProvider`

## Next Steps

### Database Setup Required
Tables to create:
- `restaurants` - Restaurant info
- `categories` - Menu categories
- `products` - Menu items
- `addons` - Product add-ons
- `carts` - Active carts
- `cart_items` - Cart contents
- `orders` - Completed orders
- `messages` - WhatsApp conversation history

### Components to Build
Following Shadcn design system:
- Navigation/Sidebar
- Order cards
- Product cards
- Status badges
- Data tables
- Forms (menu management, settings)
- Modals/Dialogs

### Features to Implement
1. Authentication (restaurant login)
2. Menu management CRUD
3. Order management dashboard
4. WhatsApp integration (Evolution API)
5. AI agent integration (PT-PT)
6. Real-time order updates

## Technical Stack
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + Shadcn UI
- **Backend**: Supabase (already connected)
- **State**: React Query
- **Routing**: React Router v6
- **Theme**: Custom ThemeProvider (light/dark)

## Design System Rules
✅ All colors use HSL format
✅ All colors defined in CSS variables
✅ Components use semantic tokens (no hardcoded colors)
✅ Consistent 8px border radius
✅ Gradients and shadows follow brand guidelines
✅ Light + Dark mode fully supported
