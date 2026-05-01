# 🌊 Yashneesh Fun World – Full-Stack Website

Belagavi's #1 Water Park – Complete ticket booking website with Razorpay payment integration and admin dashboard.

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Node.js v18+ → https://nodejs.org
- A Razorpay account → https://dashboard.razorpay.com

### Step 1 – Install Dependencies
```bash
cd yashneesh-funworld
npm install
```

### Step 2 – Configure Environment
```bash
cp .env.example .env
```
Edit `.env` and fill in:
```
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX
JWT_SECRET=any-long-random-string-here
```

### Step 3 – Start the Server
```bash
node server.js
```

### Step 4 – Open in Browser
- 🌐 **Website:** http://localhost:3000
- 🔐 **Admin Panel:** http://localhost:3000/admin
  - Username: `admin`
  - Password: `Admin@1234`

---

## 📁 Project Structure

```
yashneesh-funworld/
├── server.js              ← Express backend + all API routes
├── database.js            ← SQLite setup, seeded data & DB helpers
├── package.json
├── .env.example           ← Copy to .env and fill in values
├── yashneesh.db           ← Auto-created on first run (SQLite)
│
└── public/
    ├── index.html         ← Homepage
    ├── rides.html         ← Rides & Attractions
    ├── tickets.html       ← Ticket Pricing
    ├── gallery.html       ← Photo Gallery
    ├── contact.html       ← Contact Us
    ├── booking.html       ← Multi-step Booking Form
    ├── booking-success.html ← E-Ticket Confirmation
    │
    ├── css/style.css      ← Full design system
    ├── js/
    │   ├── main.js        ← Shared JS (nav, scroll, animations)
    │   └── booking.js     ← Razorpay payment flow
    │
    └── admin/
        ├── login.html     ← Admin login
        └── dashboard.html ← Full admin dashboard
```

---

## 💳 Razorpay Setup

1. Create account at https://dashboard.razorpay.com
2. Go to **Settings → API Keys → Generate Test Key**
3. Copy `Key ID` and `Key Secret` into `.env`
4. For live payments: generate **Live Keys** and update `.env`

### Test Cards (Test Mode)
| Card Number | Expiry | CVV |
|---|---|---|
| 4111 1111 1111 1111 | Any future date | Any 3 digits |
| 5267 3181 8797 5449 | Any future date | Any 3 digits |

Test UPI: `success@razorpay`

---

## 🔌 API Endpoints

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | List all ticket types |
| GET | `/api/offers` | List active offers |
| POST | `/api/bookings/create` | Create booking + Razorpay order |
| POST | `/api/payments/verify` | Verify Razorpay payment |
| GET | `/api/bookings/:ref` | Get booking by reference |

### Admin (JWT required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login (returns JWT) |
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/bookings` | All bookings (paginated) |
| GET | `/api/admin/recent` | 10 most recent bookings |
| PATCH | `/api/admin/bookings/:id/status` | Update payment status |

---

## 📧 Email Setup (Optional)

Add these to `.env` for booking confirmation emails:
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-16-char-app-password
```

For Gmail App Password: Google Account → Security → 2-Step Verification → App Passwords

---

## 🌐 Deployment

### Option A: VPS / Cloud Server (Recommended)
```bash
# Install PM2 for process management
npm install -g pm2
pm2 start server.js --name yashneesh
pm2 save && pm2 startup

# Use Nginx as reverse proxy
# Point domain: yashneeshfunworld.com → localhost:3000
```

### Option B: Railway / Render (Free tier)
1. Push code to GitHub
2. Connect repo to Railway or Render
3. Add environment variables in dashboard
4. Deploy!

### Option C: Local Network (for demo to client)
```bash
# Find your local IP
ipconfig   # Windows
ifconfig   # Mac/Linux

# Share: http://192.168.1.x:3000
```

---

## 🎨 Customization

### Change Ticket Prices
In `database.js` → `Seed Ticket Types` section, update the price values.
Or use the Admin Panel → Ticket Management tab.

### Change Park Info
Update contact details in `public/index.html` and `public/contact.html`.

### Change Colors
Edit CSS variables at top of `public/css/style.css`:
```css
:root {
  --cyan: #00d4ff;    /* Primary color */
  --aqua: #00ffcc;    /* Secondary */
  --coral: #ff6b4a;   /* Accent */
}
```

---

## 🔐 Security Notes

1. **Change default admin password** immediately after setup
2. **Use a strong JWT_SECRET** (32+ random characters)
3. **Switch to Razorpay Live Keys** before going live
4. **Use HTTPS** in production (SSL certificate via Let's Encrypt)
5. Never commit `.env` to version control

---

## 📞 Park Details (Pre-configured)

- **Name:** Yashneesh Fun World
- **Address:** Navage Road, Kuttalawadi, Belagavi – 590018
- **Phone:** +91 88841 42211
- **Timings:** 10:30 AM – 4:00 PM (All 7 days)
- **Google Rating:** 4.1★

---

Built with ❤️ for Yashneesh Fun World, Belagavi
