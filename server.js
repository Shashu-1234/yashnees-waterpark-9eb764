require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const path = require('path');

const db = require('./database');
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'yashneesh-secret-key-change-in-prod';

// ── Razorpay ──────────────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID     || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Too many requests, please try again later.' } });
app.use('/api/', apiLimiter);

// ── Auth Middleware ───────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Email Helper ──────────────────────────────────────────────────────────────
async function sendConfirmationEmail(booking) {
  if (!process.env.EMAIL_USER) return;
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Yashneesh Fun World <noreply@yashneeshfunworld.com>',
      to: booking.customer_email,
      subject: `🎟️ Booking Confirmed – ${booking.booking_ref} | Yashneesh Fun World`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#050f1e;color:#fff;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#00d4ff,#00ffcc);padding:30px;text-align:center;">
            <h1 style="margin:0;color:#050f1e;font-size:28px;">🎉 Booking Confirmed!</h1>
          </div>
          <div style="padding:30px;">
            <p>Hi <strong>${booking.customer_name}</strong>,</p>
            <p>Your booking at <strong>Yashneesh Fun World</strong> is confirmed!</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
              <tr><td style="padding:10px;border-bottom:1px solid #1e3a5f;color:#aaa;">Booking Ref</td><td style="padding:10px;border-bottom:1px solid #1e3a5f;"><strong>${booking.booking_ref}</strong></td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #1e3a5f;color:#aaa;">Visit Date</td><td style="padding:10px;border-bottom:1px solid #1e3a5f;">${booking.visit_date}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #1e3a5f;color:#aaa;">Ticket</td><td style="padding:10px;border-bottom:1px solid #1e3a5f;">${booking.ticket_name} × ${booking.quantity}</td></tr>
              <tr><td style="padding:10px;color:#aaa;">Amount Paid</td><td style="padding:10px;color:#00ffcc;font-weight:bold;">₹${booking.total_amount}</td></tr>
            </table>
            <p style="color:#aaa;font-size:13px;">📍 Navage Road, Kuttalawadi, Belagavi – 590018 | 📞 +91 88841 42211</p>
            <p style="color:#aaa;font-size:13px;">⏰ Park timings: 10:30 AM – 4:00 PM (All days)</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Email error:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/tickets – list all ticket types
app.get('/api/tickets', (req, res) => {
  try {
    const tickets = db.getTicketTypes();
    const parsed = tickets.map(t => ({ ...t, features: JSON.parse(t.features) }));
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/offers – list active offers
app.get('/api/offers', (req, res) => {
  try {
    res.json({ success: true, data: db.getOffers() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings/create – create booking and Razorpay order
app.post('/api/bookings/create', async (req, res) => {
  try {
    const { customer_name, customer_email, customer_phone, visit_date, ticket_type_id, quantity, special_request } = req.body;

    // Validation
    if (!customer_name || !customer_email || !customer_phone || !visit_date || !ticket_type_id || !quantity)
      return res.status(400).json({ error: 'All fields are required.' });
    if (!/^\d{10}$/.test(customer_phone))
      return res.status(400).json({ error: 'Phone must be 10 digits.' });
    if (quantity < 1 || quantity > 20)
      return res.status(400).json({ error: 'Quantity must be between 1–20.' });

    const vDate = new Date(visit_date);
    if (isNaN(vDate) || vDate < new Date(new Date().toDateString()))
      return res.status(400).json({ error: 'Visit date must be today or a future date.' });

    const ticket = db.getTicketById(ticket_type_id);
    if (!ticket) return res.status(404).json({ error: 'Ticket type not found.' });

    const total_amount = ticket.price * parseInt(quantity);
    const booking_ref = 'YFW-' + Date.now().toString(36).toUpperCase() + '-' + uuidv4().slice(0,4).toUpperCase();

    // Create DB record
    db.createBooking.run({ booking_ref, customer_name, customer_email, customer_phone, visit_date, ticket_type_id, quantity: parseInt(quantity), unit_price: ticket.price, total_amount, special_request: special_request || '' });

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: total_amount * 100, // paise
      currency: 'INR',
      receipt: booking_ref,
      notes: { booking_ref, customer_name, customer_email },
    });

    // Link order ID to booking
    db.setOrderId.run(razorpayOrder.id, booking_ref);

    res.json({
      success: true,
      booking_ref,
      razorpay_order_id: razorpayOrder.id,
      razorpay_key_id: process.env.RAZORPAY_KEY_ID,
      total_amount,
      customer_name,
      customer_email,
      customer_phone,
    });
  } catch (err) {
    console.error('Booking create error:', err);
    res.status(500).json({ error: 'Failed to create booking: ' + err.message });
  }
});

// POST /api/payments/verify – verify Razorpay payment
app.post('/api/payments/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature)
      return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });

    // Update DB
    db.updatePaymentStatus.run({ status: 'paid', paymentId: razorpay_payment_id, signature: razorpay_signature, orderId: razorpay_order_id });

    const booking = db.getBookingByOrderId(razorpay_order_id);
    if (booking) {
      const full = db.getBookingByRef(booking.booking_ref);
      await sendConfirmationEmail(full);
    }

    res.json({ success: true, message: 'Payment verified successfully.', booking_ref: booking?.booking_ref });
  } catch (err) {
    console.error('Payment verify error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/:ref – get booking details (for confirmation page)
app.get('/api/bookings/:ref', (req, res) => {
  const booking = db.getBookingByRef(req.params.ref);
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  res.json({ success: true, data: booking });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required.' });

  const admin = db.getAdminByUsername(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash))
    return res.status(401).json({ error: 'Invalid credentials.' });

  const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ success: true, token, admin: { username: admin.username, full_name: admin.full_name } });
});

// GET /api/admin/stats
app.get('/api/admin/stats', authMiddleware, (req, res) => {
  res.json({ success: true, data: db.getBookingStats() });
});

// GET /api/admin/bookings
app.get('/api/admin/bookings', authMiddleware, (req, res) => {
  const limit  = parseInt(req.query.limit  || '50');
  const offset = parseInt(req.query.offset || '0');
  res.json({ success: true, data: db.getAllBookings(limit, offset) });
});

// GET /api/admin/recent
app.get('/api/admin/recent', authMiddleware, (req, res) => {
  res.json({ success: true, data: db.getRecentBookings(10) });
});

// PATCH /api/admin/bookings/:id/status
app.patch('/api/admin/bookings/:id/status', authMiddleware, (req, res) => {
  const { status } = req.body;
  const allowed = ['paid','pending','failed','refunded'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  db.db.prepare('UPDATE bookings SET payment_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, req.params.id);
  res.json({ success: true, message: 'Status updated.' });
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin/login.html')));
app.get('/admin/*', (req, res) => res.sendFile(path.join(__dirname, 'public/admin/login.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌊 Yashneesh Fun World Server running!`);
  console.log(`   Local:  http://localhost:${PORT}`);
  console.log(`   Admin:  http://localhost:${PORT}/admin`);
  console.log(`   API:    http://localhost:${PORT}/api`);
  console.log(`\n   Razorpay Key: ${process.env.RAZORPAY_KEY_ID || '⚠️  Not configured'}\n`);
});

module.exports = app;
