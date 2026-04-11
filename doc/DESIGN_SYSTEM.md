# Design System (Brief)

## Goal
Provide a consistent UI foundation using reusable components, shared color tokens, typography, and iconography.

## Core Tokens
Defined in [app/globals.css](app/globals.css):
- Semantic colors: `--color-text`, `--color-card`, `--color-surface`, `--color-border`, `--color-text-secondary`, `--color-accent`
- Coalition colors: `--color-coalition-tiamant`, `--color-coalition-zefiria`, `--color-coalition-marventis`, `--color-coalition-ignisaria`
- Theme modes: `html.light` and `html.dark`

## Typography
- Primary font: Inter (configured in [app/layout.tsx](app/layout.tsx))
- Consistent hierarchy with utility classes for titles, labels, helper text, and metrics.

## Icons
- Library: lucide-react
- Used across navigation, profile actions, chat, and filters.

## Reusable Components (12)
Located in [components](components):
1. [AuthLayout.tsx](components/AuthLayout.tsx)
2. [Header.tsx](components/Header.tsx)
3. [Footer.tsx](components/Footer.tsx)
4. [NavLink.tsx](components/NavLink.tsx)
5. [NavProfile.tsx](components/NavProfile.tsx)
6. [ThemeProvider.tsx](components/ThemeProvider.tsx)
7. [CardContainer.tsx](components/CardContainer.tsx)
8. [CustomButton.tsx](components/CustomButton.tsx)
9. [IconActionButton.tsx](components/IconActionButton.tsx)
10. [StatCard.tsx](components/StatCard.tsx)
11. [CoalitionPointsChart.tsx](components/CoalitionPointsChart.tsx)
12. [Chat.tsx](components/Chat.tsx)

## Usage Rules
- Prefer semantic tokens over hardcoded colors.
- Prefer shared components over inline duplicated UI blocks.
- Keep new buttons on top of CustomButton variants when possible.
- Keep metric cards on top of StatCard for consistency.
