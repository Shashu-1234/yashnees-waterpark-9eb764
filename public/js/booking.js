const state = {
  currentStep: 1,
  tickets: [],
  selectedTicketId: null,
  qty: 1,
  visitDate: '',
  customer: {},
  bookingRef: null,
  razorpayOrderId: null,
  totalAmount: 0,
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getSelectedTicket() {
  return state.tickets.find((ticket) => ticket.id === state.selectedTicketId);
}

function showError(id, message) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.style.display = message ? 'block' : 'none';
}

function setLoading(buttonId, loading) {
  const button = document.getElementById(buttonId);
  if (!button) return;

  if (loading) {
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Processing...';
  } else {
    button.disabled = false;
    button.innerHTML = 'Pay securely with Razorpay';
  }
}

function formatDate(value) {
  const [year, month, day] = value.split('-');
  return `${day} ${monthNames[Number(month) - 1]} ${year}`;
}

function goToStep(step) {
  state.currentStep = step;

  document.querySelectorAll('.panel').forEach((panel, index) => {
    panel.classList.toggle('active', index + 1 === step);
  });

  for (let index = 1; index <= 3; index += 1) {
    const circle = document.getElementById(`sc${index}`);
    const label = document.getElementById(`sl${index}`);
    const line = document.getElementById(`line${index}`);

    if (!circle || !label) continue;

    circle.className = 'step-circle';
    label.className = 'step-label';

    if (index < step) {
      circle.classList.add('done');
      circle.textContent = 'OK';
    } else if (index === step) {
      circle.classList.add('active');
      circle.textContent = String(index);
      label.classList.add('active');
    } else {
      circle.textContent = String(index);
    }

    if (line) {
      line.classList.toggle('done', index < step);
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadTickets() {
  try {
    const response = await fetch('/api/tickets');
    if (!response.ok) throw new Error('API unavailable');
    const payload = await response.json();
    state.tickets = payload.data || [];
  } catch (error) {
    state.tickets = window.FALLBACK_TICKETS || [];
    if (typeof showToast === 'function') {
      showToast('Live ticket API is unavailable. Showing fallback tickets for preview.', 'error');
    }
  }

  renderTicketOptions();
}

function renderTicketOptions() {
  const params = new URLSearchParams(window.location.search);
  const preselected = parseInt(params.get('ticket') || '', 10);
  const labels = { child: 'Junior', adult: 'Classic', premium: 'Premium', couple: 'Couple' };
  const container = document.getElementById('ticketOptions');

  container.innerHTML = state.tickets.map((ticket) => `
    <label class="ticket-option" id="opt-${ticket.id}" for="t${ticket.id}">
      <input type="radio" name="ticket" id="t${ticket.id}" value="${ticket.id}" onchange="selectTicket(${ticket.id})" ${preselected === ticket.id ? 'checked' : ''}>
      <div class="ticket-opt-info">
        <div class="ticket-opt-name">${ticket.name}</div>
        <div class="ticket-opt-desc">${labels[ticket.category] || 'Park'} pass | ${ticket.description}</div>
      </div>
      <div class="ticket-opt-price">INR ${ticket.price}</div>
    </label>
  `).join('');

  const preferredTicket = state.tickets.find((ticket) => ticket.id === preselected)
    || state.tickets.find((ticket) => ticket.badge === 'Most Popular')
    || state.tickets[0];

  if (preferredTicket) {
    selectTicket(preferredTicket.id);
  }
}

function selectTicket(id) {
  state.selectedTicketId = id;
  document.querySelectorAll('.ticket-option').forEach((option) => option.classList.remove('selected'));
  const option = document.getElementById(`opt-${id}`);
  const radio = document.getElementById(`t${id}`);
  if (option) option.classList.add('selected');
  if (radio) radio.checked = true;
}

function changeQty(delta) {
  state.qty = Math.max(1, Math.min(20, state.qty + delta));
  document.getElementById('qtyDisplay').textContent = String(state.qty);
}

function setMinDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const formatted = `${year}-${month}-${day}`;
  document.getElementById('visitDate').min = formatted;
  document.getElementById('visitDate').value = formatted;
}

function goToStep2() {
  showError('p1error', '');

  if (!state.selectedTicketId) {
    showError('p1error', 'Please select a ticket type.');
    return;
  }

  const visitDate = document.getElementById('visitDate').value;
  if (!visitDate) {
    showError('p1error', 'Please choose a visit date.');
    return;
  }

  state.visitDate = visitDate;
  goToStep(2);
}

function goToStep3() {
  showError('p2error', '');

  const name = document.getElementById('custName').value.trim();
  const email = document.getElementById('custEmail').value.trim();
  const phone = document.getElementById('custPhone').value.trim();

  if (!name) {
    showError('p2error', 'Please enter your full name.');
    return;
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('p2error', 'Please enter a valid email address.');
    return;
  }

  if (!/^\d{10}$/.test(phone)) {
    showError('p2error', 'Please enter a valid 10-digit mobile number.');
    return;
  }

  state.customer = {
    name,
    email,
    phone,
    special: document.getElementById('custSpecial').value.trim(),
  };

  renderSummary();
  goToStep(3);
}

function renderSummary() {
  const ticket = getSelectedTicket();
  const total = ticket.price * state.qty;
  state.totalAmount = total;

  document.getElementById('summaryCard').innerHTML = `
    <div class="summary-row"><span>Visitor name</span><span class="summary-val">${state.customer.name}</span></div>
    <div class="summary-row"><span>Email</span><span class="summary-val">${state.customer.email}</span></div>
    <div class="summary-row"><span>Mobile</span><span class="summary-val">${state.customer.phone}</span></div>
    <div class="summary-row"><span>Visit date</span><span class="summary-val">${formatDate(state.visitDate)}</span></div>
    <div class="summary-row"><span>Ticket type</span><span class="summary-val">${ticket.name}</span></div>
    <div class="summary-row"><span>Quantity</span><span class="summary-val">${state.qty}</span></div>
    <div class="summary-row"><span>Unit price</span><span class="summary-val">INR ${ticket.price}</span></div>
    <div class="summary-row"><span>Total amount</span><span class="summary-val total-val">INR ${total}</span></div>
  `;
}

async function initiatePayment() {
  setLoading('payBtn', true);

  try {
    const response = await fetch('/api/bookings/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: state.customer.name,
        customer_email: state.customer.email,
        customer_phone: state.customer.phone,
        visit_date: state.visitDate,
        ticket_type_id: state.selectedTicketId,
        quantity: state.qty,
        special_request: state.customer.special,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not create the booking.');

    const ticket = getSelectedTicket();
    state.bookingRef = data.booking_ref;
    state.razorpayOrderId = data.razorpay_order_id;

    const options = {
      key: data.razorpay_key_id,
      amount: data.total_amount * 100,
      currency: 'INR',
      name: 'Yashneesh Fun World',
      description: `${ticket.name} x ${state.qty} · ${formatDate(state.visitDate)}`,
      order_id: data.razorpay_order_id,
      prefill: {
        name: data.customer_name,
        email: data.customer_email,
        contact: data.customer_phone,
      },
      theme: { color: '#36d7ff' },
      modal: {
        ondismiss: () => {
          setLoading('payBtn', false);
          showToast('Payment was cancelled. You can try again anytime.', 'error');
        },
      },
      handler: async (paymentResponse) => {
        await verifyPayment(paymentResponse);
      },
    };

    const razorpay = new Razorpay(options);
    razorpay.open();
  } catch (error) {
    setLoading('payBtn', false);
    showToast(error.message, 'error');
  }
}

async function verifyPayment(response) {
  try {
    const verification = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      }),
    });

    const data = await verification.json();
    if (!verification.ok) throw new Error(data.error || 'Payment verification failed.');

    window.location.href = `booking-success.html?ref=${data.booking_ref}`;
  } catch (error) {
    setLoading('payBtn', false);
    showToast(`Payment verification failed. Please contact support with reference ${state.bookingRef}.`, 'error');
  }
}

setMinDate();
loadTickets();
