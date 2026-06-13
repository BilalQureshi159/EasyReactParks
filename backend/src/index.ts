import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { connectDB } from './db/connect.js';
import { errorHandler } from './middleware/error.js';
import { BRANDING } from './config/branding.js';
import authRoutes from './routes/auth.js';
import ticketRoutes from './routes/tickets.js';
import posRoutes from './routes/pos.js';
import scannerRoutes from './routes/scanner.js';
import bookingRoutes from './routes/bookings.js';
import membershipRoutes from './routes/memberships.js';
import couponRoutes from './routes/coupons.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import reportExtendedRoutes from './routes/reportsExtended.js';
import auditRoutes from './routes/audit.js';
import publicRoutes from './routes/public.js';
import operationsRoutes from './routes/operations.js';
import settingsRoutes from './routes/settings.js';
import adminRoutes from './routes/admin.js';
import staffRoutes from './routes/staff.js';
import rolesRoutes from './routes/roles.js';
import supportRoutes from './routes/support.js';
import adminSupportRoutes from './routes/adminSupport.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: BRANDING.apiServiceId, stack: 'Express+MySQL', version: '3.0.0' });
});

app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/scanner', scannerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reports', reportExtendedRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/admin/support', adminSupportRoutes);
app.use('/api/audit', auditRoutes);

app.use(errorHandler);

connectDB().then(() => {
  app.listen(config.port, () => {
    console.log(`${BRANDING.appName} API running on http://localhost:${config.port}`);
  });
}).catch(() => process.exit(1));
