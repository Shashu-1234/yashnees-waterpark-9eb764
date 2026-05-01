const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'yashneesh.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Create Tables ────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_types (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL,         -- adult | child | premium | couple
    price       INTEGER NOT NULL,
    original_price INTEGER,
    description TEXT,
    features    TEXT    NOT NULL,         -- JSON array
    color       TEXT    DEFAULT '#00d4ff',
    badge       TEXT,                     -- e.g. "Most Popular"
    is_active   INTEGER DEFAULT 1,
    sort_order  INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_ref        TEXT    UNIQUE NOT NULL,
    customer_name      TEXT    NOT NULL,
    customer_email     TEXT    NOT NULL,
    customer_phone     TEXT    NOT NULL,
    visit_date         TEXT    NOT NULL,
    ticket_type_id     INTEGER NOT NULL REFERENCES ticket_types(id),
    quantity           INTEGER NOT NULL DEFAULT 1,
    unit_price         INTEGER NOT NULL,
    total_amount       INTEGER NOT NULL,
    payment_status     TEXT    DEFAULT 'pending',   -- pending | paid | failed | refunded
    razorpay_order_id  TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature  TEXT,
    special_request    TEXT,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    full_name     TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS offers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    discount_pct INTEGER DEFAULT 0,
    valid_until TEXT,
    is_active   INTEGER DEFAULT 1,
    badge_color TEXT DEFAULT '#ff6b4a'
  );

  CREATE TABLE IF NOT EXISTS gallery_items (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    title    TEXT,
    category TEXT,
    emoji    TEXT,
    sort_order INTEGER DEFAULT 0
  );
`);

// ─── Seed Ticket Types ────────────────────────────────────────────────────────
const existingTickets = db.prepare('SELECT COUNT(*) as cnt FROM ticket_types').get();
if (existingTickets.cnt === 0) {
  const insertTicket = db.prepare(`
    INSERT INTO ticket_types (name, category, price, original_price, description, features, color, badge, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTicket.run('Child Pass', 'child', 150, 200,
    'Perfect for little ones (below 10 years)',
    JSON.stringify(['Kids Splash Zone','Mini Water Slides','Banana Ride','Rain Dance','Tub Ride']),
    '#22c55e', null, 1);

  insertTicket.run('Adult Pass', 'adult', 250, 350,
    'Full access to all 20+ rides (10+ years)',
    JSON.stringify(['All 20+ Rides','Wave Pool','Giant Slides','Rain Dance','Wall Climbing','Tube Rides','Lazy River']),
    '#00d4ff', 'Most Popular', 2);

  insertTicket.run('Premium Pass', 'premium', 390, 500,
    'Priority access + exclusive perks',
    JSON.stringify(['Everything in Adult Pass','Priority Queue','Locker Room','Changing Room','10% Birthday Discount','Free Parking']),
    '#ffd166', 'Best Value', 3);

  insertTicket.run('Couple Pass', 'couple', 450, 600,
    'Special package for 2 adults',
    JSON.stringify(['2x Adult Access','Wave Pool','All Major Rides','Couple Locker','Priority Entry','Rain Dance']),
    '#f472b6', 'Romantic', 4);
}

// ─── Seed Admin ───────────────────────────────────────────────────────────────
const existingAdmin = db.prepare('SELECT COUNT(*) as cnt FROM admins').get();
if (existingAdmin.cnt === 0) {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO admins (username, password_hash, full_name) VALUES (?, ?, ?)').run(username, hash, 'Park Administrator');
  console.log(`✅ Admin created: ${username} / ${password}`);
}

// ─── Seed Offers ─────────────────────────────────────────────────────────────
const existingOffers = db.prepare('SELECT COUNT(*) as cnt FROM offers').get();
if (existingOffers.cnt === 0) {
  const insertOffer = db.prepare('INSERT INTO offers (title, description, discount_pct, valid_until, badge_color) VALUES (?,?,?,?,?)');
  insertOffer.run('Tuesday–Thursday Special', 'Visit on weekdays and save big! Best time to enjoy all rides without crowds.', 20, '2025-12-31', '#00d4ff');
  insertOffer.run('College Student Offer', 'Show your college ID and get 50% off on adult tickets. Valid for all students.', 50, '2025-12-31', '#22c55e');
  insertOffer.run('Birthday Bash', "Celebrating your birthday? Get 30% off + complimentary locker on your special day.", 30, '2025-12-31', '#f472b6');
  insertOffer.run('Group Booking (5+)', 'Book 5 or more tickets together and save 10% on the total bill.', 10, '2025-12-31', '#ffd166');
}

// ─── Helper Functions ─────────────────────────────────────────────────────────
const dbHelpers = {
  getTicketTypes: () => db.prepare('SELECT * FROM ticket_types WHERE is_active=1 ORDER BY sort_order').all(),
  getTicketById: (id) => db.prepare('SELECT * FROM ticket_types WHERE id=?').get(id),
  createBooking: db.prepare(`
    INSERT INTO bookings (booking_ref,customer_name,customer_email,customer_phone,visit_date,ticket_type_id,quantity,unit_price,total_amount,special_request)
    VALUES (@booking_ref,@customer_name,@customer_email,@customer_phone,@visit_date,@ticket_type_id,@quantity,@unit_price,@total_amount,@special_request)
  `),
  getBookingByRef: (ref) => db.prepare('SELECT b.*, t.name as ticket_name, t.category FROM bookings b JOIN ticket_types t ON b.ticket_type_id=t.id WHERE b.booking_ref=?').get(ref),
  getBookingByOrderId: (orderId) => db.prepare('SELECT * FROM bookings WHERE razorpay_order_id=?').get(orderId),
  updatePaymentStatus: db.prepare(`UPDATE bookings SET payment_status=@status, razorpay_payment_id=@paymentId, razorpay_signature=@signature, updated_at=CURRENT_TIMESTAMP WHERE razorpay_order_id=@orderId`),
  setOrderId: db.prepare('UPDATE bookings SET razorpay_order_id=? WHERE booking_ref=?'),
  getAllBookings: (limit=100, offset=0) => db.prepare(`
    SELECT b.*, t.name as ticket_name FROM bookings b
    JOIN ticket_types t ON b.ticket_type_id=t.id
    ORDER BY b.created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset),
  getBookingStats: () => db.prepare(`
    SELECT
      COUNT(*) as total_bookings,
      SUM(CASE WHEN payment_status='paid' THEN 1 ELSE 0 END) as paid_bookings,
      SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END) as total_revenue,
      SUM(CASE WHEN payment_status='pending' THEN 1 ELSE 0 END) as pending_bookings,
      SUM(CASE WHEN DATE(created_at)=DATE('now') THEN 1 ELSE 0 END) as today_bookings,
      SUM(CASE WHEN DATE(created_at)=DATE('now') AND payment_status='paid' THEN total_amount ELSE 0 END) as today_revenue
    FROM bookings
  `).get(),
  getRecentBookings: (n=10) => db.prepare(`
    SELECT b.*, t.name as ticket_name FROM bookings b
    JOIN ticket_types t ON b.ticket_type_id=t.id
    ORDER BY b.created_at DESC LIMIT ?
  `).all(n),
  getOffers: () => db.prepare('SELECT * FROM offers WHERE is_active=1').all(),
  getAdminByUsername: (u) => db.prepare('SELECT * FROM admins WHERE username=?').get(u),
};

module.exports = { db, ...dbHelpers };
