import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute, getHomeRoute } from '@/components/auth/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { SupportPage } from '@/pages/SupportPage';
import { AdminSupportPage } from '@/pages/admin/AdminSupportPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { POSPage } from '@/pages/POSPage';
import { ScannerPage } from '@/pages/ScannerPage';
import { TicketsPage } from '@/pages/TicketsPage';
import { BookingsPage } from '@/pages/BookingsPage';
import { MembershipsPage } from '@/pages/MembershipsPage';
import { CouponsPage } from '@/pages/CouponsPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { OrderDetailPage } from '@/pages/OrderDetailPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { BookingPublicPage } from '@/pages/BookingPublicPage';
import { AdminParksPage } from '@/pages/admin/AdminParksPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminParkDetailPage } from '@/pages/admin/AdminParkDetailPage';
import { StaffPage } from '@/pages/StaffPage';
import { RolesPage } from '@/pages/RolesPage';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ReportsOverviewPage } from '@/pages/reports/ReportsOverviewPage';
import { ReportsRevenuePage } from '@/pages/reports/ReportsRevenuePage';
import { ReportsSalesPage } from '@/pages/reports/ReportsSalesPage';
import { ReportsAttendancePage } from '@/pages/reports/ReportsAttendancePage';
import { ReportsTicketsPage } from '@/pages/reports/ReportsTicketsPage';
import { ReportsBookingsPage } from '@/pages/reports/ReportsBookingsPage';
import { ReportsMembershipsPage } from '@/pages/reports/ReportsMembershipsPage';
import { ReportsCouponsPage } from '@/pages/reports/ReportsCouponsPage';
import { ReportsStaffPage } from '@/pages/reports/ReportsStaffPage';
import { ReportsAuditPage } from '@/pages/reports/ReportsAuditPage';
import { Toaster } from 'sonner';

function AppRoutes() {
  const { isAuthenticated, isLoading, user, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to={getHomeRoute(user?.role || '')} replace /> : <LoginPage />
      } />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/book" element={<BookingPublicPage />} />
      <Route path="/book/:slug" element={<BookingPublicPage />} />
      <Route element={<ProtectedRoute mode="super_admin"><AdminLayout /></ProtectedRoute>}>
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/parks" element={<AdminParksPage />} />
        <Route path="/admin/parks/:id" element={<AdminParkDetailPage />} />
        <Route path="/admin/support" element={<AdminSupportPage />} />
      </Route>
      <Route element={<ProtectedRoute mode="park"><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pos" element={<POSPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/scanner" element={<ScannerPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/memberships" element={<MembershipsPage />} />
        <Route path="/coupons" element={<CouponsPage />} />
        <Route path="/reports" element={<Navigate to="/reports/overview" replace />} />
        <Route path="/reports/overview" element={<ReportsOverviewPage />} />
        <Route path="/reports/revenue" element={<ReportsRevenuePage />} />
        <Route path="/reports/sales" element={<ReportsSalesPage />} />
        <Route path="/reports/attendance" element={<ReportsAttendancePage />} />
        <Route path="/reports/tickets" element={<ReportsTicketsPage />} />
        <Route path="/reports/bookings" element={<ReportsBookingsPage />} />
        <Route path="/reports/memberships" element={<ReportsMembershipsPage />} />
        <Route path="/reports/coupons" element={<ReportsCouponsPage />} />
        <Route path="/reports/staff" element={<ReportsStaffPage />} />
        <Route path="/reports/audit" element={<ReportsAuditPage />} />
        <Route path="/audit" element={<Navigate to="/reports/audit" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/roles" element={<RolesPage />} />
      </Route>
      <Route path="*" element={
        <Navigate to={isAuthenticated ? getHomeRoute(user?.role || '') : '/login'} replace />
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'rounded-xl shadow-elevated border border-slate-200/80',
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
