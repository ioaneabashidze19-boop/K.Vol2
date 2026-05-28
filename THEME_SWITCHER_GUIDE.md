# KavShare Theme Switching & Dark Mode Guide

KavShare supports a fully responsive theme switching engine allowing users to toggle between a clean light mode layout and our premium dark slate theme.

---

## 1. Architecture Overview

- **Theme Strategy**: Class-based theme toggle. Theme properties are bound to the `html` element via the `.dark` class selector.
- **Persistence**: Active selections are automatically saved in the user's browser `localStorage` using the key `kavshare-theme`.
- **System Synchronization**: If no preference is saved in local storage, the platform defaults to the operating system's media preference (`prefers-color-scheme`).
- **Hydration Safety**: Built-in mount state guards prevent React server-side rendering (SSR) hydration mismatches.

---

## 2. API Integration

### The `useTheme` Hook
Import and execute `useTheme` from [`src/components/patterns/ThemeProvider.tsx`](file:///c:/Users/admin/Desktop/K.Vol2/kavshare/src/components/patterns/ThemeProvider.tsx) to read or update states:

```tsx
import { useTheme } from "@/components/patterns/ThemeProvider";

export function CustomButton() {
  const { theme, toggleTheme, setTheme } = useTheme();

  return (
    <button onClick={toggleTheme}>
      Current Mode: {theme}
    </button>
  );
}
```

### Visual Switcher Component
A pre-styled button control is exported as `<ThemeToggle />` from [`src/components/patterns/ThemeToggle.tsx`](file:///c:/Users/admin/Desktop/K.Vol2/kavshare/src/components/patterns/ThemeToggle.tsx). Drop this component into header layouts or settings panels to enable switching.

---

## 3. Implementation Verification & Testing

### Verification Steps in Browser Developer Tools:

1. **Verify Default State (First Load)**:
   - Clear your browser localStorage (`localStorage.clear()`).
   - Reload the page. Verify the `<html>` tag class matches your system preferences.
2. **Verify Theme Toggle Action**:
   - Click the theme toggle button in the header.
   - Inspect the DOM elements. Verify the `<html>` tag has the class `dark` added (in dark mode) or removed (in light mode).
3. **Verify LocalStorage Persistence**:
   - Set the theme to **Light**.
   - Inspect the Local Storage records. Verify `kavshare-theme` contains the value `"light"`.
   - Reload the page. Verify the page renders in Light mode immediately without flashing or layout shifting.
4. **Hydration Check**:
   - Open the browser developer console. Verify there are no warning messages saying *"Text content did not match..."* or *"Hydration failed..."*.
5. **Component Styling Verification**:
   - Switch themes and inspect inputs, buttons, and cards. Verify borders, text, and focus outlines transition smoothly (using the CSS `transition` rules configured on `body`).
