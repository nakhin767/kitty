// NeuroTwin — Upgrade and Payment Logic
'use strict';

// Track selected plan and payment method
let selectedPlan = 'lifetime'; // default
let selectedMethod = 'card';   // default

// Initialize state plan tracker if not exists in main app.js
if (typeof state !== 'undefined') {
  state.isPremium = false;
  state.planType = null;
}

// Open benefits modal (สิทธิประโยชน์ของคุณ)
function openBenefitsModal() {
  const modal = document.getElementById('benefits-modal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

// Close benefits modal
function closeBenefitsModal() {
  const modal = document.getElementById('benefits-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function closeBenefitsModalOutside(e) {
  if (e.target.id === 'benefits-modal') {
    closeBenefitsModal();
  }
}

// Open checkout payment modal
function openPaymentModal(plan) {
  if (plan === 'pro') plan = 'trial';
  if (plan === 'enterprise') plan = 'lifetime';
  selectedPlan = plan;
  
  // Set summary info based on selected plan
  const planNameEl = document.getElementById('order-plan-name');
  const planPriceEl = document.getElementById('order-plan-price');
  const totalAmountEl = document.getElementById('checkout-total-amount');
  const confirmTextEl = document.getElementById('pay-confirm-text');
  const finePrintEl = document.getElementById('pay-under-btn-fine-print');
  const qrAmountEl = document.getElementById('promptpay-qr-amount');
  
  let planLabel = 'แพ็กเกจถาวร (Lifetime)';
  let planPrice = '฿3,999';
  let finePrint = 'ชำระครั้งเดียว ใช้งานได้ตลอดชีพ';
  
  if (plan === 'trial') {
    planLabel = 'ทดลองใช้ฟรี 3 วัน (Subscription)';
    planPrice = '฿199';
    finePrint = '฿199 หลังจาก 3 วัน หากไม่ยกเลิก';
  }
  
  if (planNameEl) planNameEl.textContent = planLabel;
  if (planPriceEl) planPriceEl.textContent = planPrice;
  if (totalAmountEl) totalAmountEl.textContent = planPrice;
  if (confirmTextEl) {
    confirmTextEl.textContent = plan === 'trial' ? 'เริ่มทดลองใช้ฟรี (฿199)' : `ชำระเงิน ${planPrice}`;
  }
  if (finePrintEl) finePrintEl.textContent = finePrint;
  if (qrAmountEl) qrAmountEl.textContent = planPrice;

  // Make sure checkout step is active, others are hidden
  document.getElementById('modal-payment').classList.add('active');
  document.getElementById('modal-processing').classList.remove('active');
  document.getElementById('modal-success').classList.remove('active');
  
  // Reset payment form fields
  resetPaymentForms();
  
  // Show modal
  const modal = document.getElementById('payment-modal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

// Reset forms
function resetPaymentForms() {
  document.getElementById('card-number').value = '';
  document.getElementById('card-name').value = '';
  document.getElementById('card-exp').value = '';
  document.getElementById('card-cvv').value = '';
  document.getElementById('card-num-disp').textContent = '•••• •••• •••• ••••';
  document.getElementById('card-name-disp').textContent = 'ชื่อผู้ถือบัตร';
  document.getElementById('card-exp-disp').textContent = 'MM/YY';
  
  const trmPhone = document.getElementById('truemoney-phone');
  if (trmPhone) trmPhone.value = '';

  selectPayMethod('card'); // default back to card
}

// Close checkout modal
function closePaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function closeModalOutside(e) {
  if (e.target.id === 'payment-modal') {
    closePaymentModal();
  }
}

// Select payment channel method
function selectPayMethod(method) {
  selectedMethod = method;
  
  // Toggle active styling on channel cards
  document.querySelectorAll('.pay-channel-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  const label = document.getElementById(`pc-${method}-label`);
  if (label) {
    label.classList.add('selected');
    const radio = label.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  }
  
  // Toggle form containers
  document.getElementById('card-form-wrapper').classList.add('hidden');
  document.getElementById('promptpay-wrapper').classList.add('hidden');
  document.getElementById('truemoney-wrapper').classList.add('hidden');
  
  if (method === 'card') {
    document.getElementById('card-form-wrapper').classList.remove('hidden');
  } else if (method === 'promptpay') {
    document.getElementById('promptpay-wrapper').classList.remove('hidden');
  } else if (method === 'truemoney') {
    document.getElementById('truemoney-wrapper').classList.remove('hidden');
  }
}

// Formats
function formatCardNumber(input) {
  let val = input.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  let formatted = '';
  for (let i = 0; i < val.length; i++) {
    if (i > 0 && i % 4 === 0) formatted += ' ';
    formatted += val[i];
  }
  input.value = formatted;
  
  // Update card display
  const display = document.getElementById('card-num-disp');
  if (display) {
    display.textContent = formatted || '•••• •••• •••• ••••';
  }
}

// Expiry Format MM/YY
function formatExpiry(input) {
  let val = input.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  if (val.length >= 2) {
    input.value = val.slice(0, 2) + '/' + val.slice(2, 4);
  } else {
    input.value = val;
  }
  
  // Update exp display
  const display = document.getElementById('card-exp-disp');
  if (display) {
    display.textContent = input.value || 'MM/YY';
  }
}

// Phone Number Format 0XX-XXX-XXXX
function formatPhoneNumber(input) {
  let val = input.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  let formatted = '';
  for (let i = 0; i < val.length; i++) {
    if (i === 3 || i === 6) formatted += '-';
    formatted += val[i];
  }
  input.value = formatted;
}

// Process Payment logic
async function processPayment() {
  // Validate forms based on selection
  if (selectedMethod === 'card') {
    const cardNum = document.getElementById('card-number').value.trim();
    const cardName = document.getElementById('card-name').value.trim();
    const cardExp = document.getElementById('card-exp').value.trim();
    const cardCvv = document.getElementById('card-cvv').value.trim();
    
    if (cardNum.length < 16) {
      showToast('⚠️ กรุณากรอกหมายเลขบัตรเครดิตที่ถูกต้อง', 'error');
      return;
    }
    if (!cardName) {
      showToast('⚠️ กรุณากรอกชื่อผู้ถือบัตร', 'error');
      return;
    }
    if (cardExp.length < 5) {
      showToast('⚠️ กรุณากรอกวันหมดอายุที่ถูกต้อง (MM/YY)', 'error');
      return;
    }
    if (cardCvv.length < 3) {
      showToast('⚠️ กรุณากรอกรหัส CVV ที่ถูกต้อง', 'error');
      return;
    }
  } else if (selectedMethod === 'truemoney') {
    const phone = document.getElementById('truemoney-phone').value.trim();
    if (phone.length < 11) {
      showToast('⚠️ กรุณากรอกเบอร์โทรศัพท์ TrueMoney Wallet ที่ถูกต้อง', 'error');
      return;
    }
  }

  // Switch to Processing View
  document.getElementById('modal-payment').classList.remove('active');
  document.getElementById('modal-processing').classList.add('active');
  
  // Animate processing steps
  const steps = [
    { id: 'ps-1', delay: 1200 },
    { id: 'ps-2', delay: 1400 },
    { id: 'ps-3', delay: 1000 }
  ];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    await sleep(step.delay);
    const el = document.getElementById(step.id);
    if (el) {
      el.classList.remove('active');
      el.classList.add('completed');
      el.textContent = el.textContent.replace('...', ' ✓');
    }
    if (i < steps.length - 1) {
      const nextEl = document.getElementById(steps[i+1].id);
      if (nextEl) nextEl.classList.add('active');
    }
  }
  
  await sleep(400);

  // Success Step Setup
  const succSubtitle = document.getElementById('success-subtitle');
  if (succSubtitle) {
    if (selectedPlan === 'trial') {
      succSubtitle.textContent = 'การเปิดสิทธิ์ทดลองใช้ฟรี 3 วันสำเร็จ บัญชีของคุณได้รับการเปิดสิทธิ์ระดับ Premium ชั่วคราวแล้ว';
    } else {
      succSubtitle.textContent = 'การสั่งซื้อแพ็กเกจถาวร (Lifetime) สำเร็จ บัญชีของคุณได้รับการอัปเกรดเป็น Premium ตลอดชีพเรียบร้อยแล้ว';
    }
  }

  document.getElementById('modal-processing').classList.remove('active');
  document.getElementById('modal-success').classList.add('active');
}

// Activate Premium flow & close modal
function activatePremium() {
  if (typeof state !== 'undefined') {
    state.isPremium = true;
    state.planType = selectedPlan;
  }
  
  // Show plan status badge in Navbar
  const badge = document.getElementById('plan-badge');
  if (badge) {
    badge.textContent = selectedPlan === 'trial' ? 'Premium (Trial)' : 'Premium (Lifetime)';
    badge.className = selectedPlan === 'trial' ? 'plan-badge premium-badge' : 'plan-badge lifetime-badge';
    badge.classList.remove('hidden');
  }
  
  // Hide Navbar upgrade button
  const navUpgradeBtn = document.getElementById('btn-upgrade-nav');
  if (navUpgradeBtn) {
    navUpgradeBtn.classList.add('hidden');
  }
  
  // Hide premium gates overlays
  const gates = ['gate-treatment', 'gate-risk', 'gate-consult'];
  gates.forEach(gid => {
    const gate = document.getElementById(gid);
    if (gate) {
      gate.classList.add('hidden');
    }
  });

  // Remove premium classes from sections to unlock inputs
  const pSections = ['treatment-section-wrap', 'risk-section-wrap', 'consult-section'];
  pSections.forEach(sid => {
    const sec = document.getElementById(sid);
    if (sec) {
      sec.classList.remove('premium-section');
    }
  });

  closePaymentModal();
  
  // Show success toast
  showToast('🚀 อัปเกรดบัญชี Premium สำเร็จแล้ว! ยินดีต้อนรับสู่ NeuroTwin Premium', 'success');
  
  // If we are currently on Step 4 (Results Dashboard), trigger re-render of components
  if (typeof state !== 'undefined' && state.currentStep === 4) {
    renderDashboard();
  }
}

// Helper sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper show toast (in case main is not defined)
function showToast(msg, type = '') {
  if (typeof window.showToast === 'function') {
    window.showToast(msg, type);
  } else {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = msg;
      toast.className = `toast ${type}`;
      setTimeout(() => { toast.className = 'toast hidden'; }, 3000);
    }
  }
}

// Event Listeners for Nav clicks or upgrades
document.addEventListener('DOMContentLoaded', () => {
  // Add direct listeners if needed
});

// Navbar/link helpers
function showPricingSection() {
  if (typeof resetApp === 'function' && typeof state !== 'undefined' && state.currentStep > 0) {
    resetApp();
  }
  setTimeout(() => {
    const el = document.getElementById('pricing-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 50);
}

function openPricingModal() {
  openPaymentModal('trial');
}
