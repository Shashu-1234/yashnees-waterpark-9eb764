const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  });
}

const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
if (hamburger && navLinks && navbar) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });

  document.addEventListener('click', (event) => {
    if (!navbar.contains(event.target)) {
      navLinks.classList.remove('open');
    }
  });
}

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, index) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), index * 70);
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

function animateCounter(element, target, duration = 1600) {
  let start = 0;

  const step = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.floor(eased * target).toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.textContent = target.toLocaleString() + (element.dataset.suffix || '');
    }
  };

  requestAnimationFrame(step);
}

const statObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const target = parseInt(entry.target.dataset.target || '0', 10);
      animateCounter(entry.target, target);
      statObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.4 });

document.querySelectorAll('[data-target]').forEach((element) => statObserver.observe(element));

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  const prefix = type === 'success' ? 'Success:' : 'Error:';
  toast.innerHTML = `<div class="toast-inner toast-${type}">${prefix} ${message}</div>`;
  toast.style.display = 'block';

  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}

window.showToast = showToast;

const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a').forEach((link) => {
  const href = link.getAttribute('href');
  if (href === currentPage || (currentPage === '' && href === 'index.html')) {
    link.classList.add('active');
  }
});

const stickyCta = document.getElementById('sticky-cta');
if (stickyCta) {
  window.addEventListener('scroll', () => {
    const show = window.scrollY > 320;
    stickyCta.style.opacity = show ? '1' : '0';
    stickyCta.style.pointerEvents = show ? 'auto' : 'none';
  });

  stickyCta.style.opacity = '0';
  stickyCta.style.pointerEvents = 'none';
  stickyCta.style.transition = 'opacity 0.3s ease';
}

const parallaxItems = document.querySelectorAll('[data-parallax]');
if (parallaxItems.length) {
  let parallaxTicking = false;

  const runParallax = () => {
    const scrollY = window.scrollY;
    parallaxItems.forEach((item) => {
      const speed = parseFloat(item.dataset.parallax || '0');
      item.style.transform = `translate3d(0, ${scrollY * speed}px, 0)`;
    });
    parallaxTicking = false;
  };

  window.addEventListener('scroll', () => {
    if (!parallaxTicking) {
      window.requestAnimationFrame(runParallax);
      parallaxTicking = true;
    }
  });

  runParallax();
}
