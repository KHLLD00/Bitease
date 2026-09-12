/* ============================================
   BiteEase — Cart store + floating cart panel
   Shared across every page. No backend: cart lives
   in localStorage, and "checkout" produces a receipt
   the customer sends to us on WhatsApp.
   ============================================ */

const BITEASE_WHATSAPP_NUMBER = "2348033536667";
const CART_KEY = "bitease_cart_v1";
const CURRENCY = "₦";

function formatNaira(amount) {
  return CURRENCY + amount.toLocaleString("en-NG");
}

const Cart = {
  read() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },
  write(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent("cart:change", { detail: items }));
  },
  add(item) {
    const items = this.read();
    const existing = items.find((i) => i.name === item.name);
    if (existing) {
      existing.qty += 1;
    } else {
      items.push({ name: item.name, price: item.price, category: item.category, qty: 1 });
    }
    this.write(items);
  },
  setQty(name, qty) {
    let items = this.read();
    if (qty <= 0) {
      items = items.filter((i) => i.name !== name);
    } else {
      const existing = items.find((i) => i.name === name);
      if (existing) existing.qty = qty;
    }
    this.write(items);
  },
  remove(name) {
    const items = this.read().filter((i) => i.name !== name);
    this.write(items);
  },
  clear() {
    this.write([]);
  },
  count(items) {
    return (items || this.read()).reduce((sum, i) => sum + i.qty, 0);
  },
  total(items) {
    return (items || this.read()).reduce((sum, i) => sum + i.qty * i.price, 0);
  },
};

/* ---------- Build the floating button + panel DOM once ---------- */
function mountCartUI() {
  const fab = document.createElement("button");
  fab.className = "cart-fab";
  fab.id = "cart-fab";
  fab.setAttribute("aria-haspopup", "dialog");
  fab.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
    <span class="cart-fab-label">Cart</span>
    <span class="cart-fab-count" id="cart-fab-count">0</span>
  `;

  const overlay = document.createElement("div");
  overlay.className = "cart-overlay";
  overlay.id = "cart-overlay";

  const panel = document.createElement("div");
  panel.className = "cart-panel";
  panel.id = "cart-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Your order");
  panel.innerHTML = `
    <div class="cart-panel-head">
      <h2>Your order</h2>
      <button class="cart-close" id="cart-close" aria-label="Close cart">&times;</button>
    </div>
    <div class="cart-panel-body" id="cart-panel-body"></div>
    <div class="cart-panel-foot" id="cart-panel-foot"></div>
  `;

  const clearModal = document.createElement("div");
  clearModal.className = "confirm-modal";
  clearModal.id = "clear-cart-modal";
  clearModal.innerHTML = `
    <div class="confirm-modal-box" role="dialog" aria-label="Clear cart confirmation">
      <h3>Clear your cart?</h3>
      <p>This will remove all items from your order. This can't be undone.</p>
      <div class="confirm-modal-actions">
        <button type="button" class="btn btn-outline-dark btn-sm" id="clear-cart-cancel">Cancel</button>
        <button type="button" class="btn btn-sm btn-danger" id="clear-cart-confirm">Clear cart</button>
      </div>
    </div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  document.body.appendChild(clearModal);

  fab.addEventListener("click", openCart);
  overlay.addEventListener("click", closeCart);
  panel.querySelector("#cart-close").addEventListener("click", closeCart);
  clearModal.addEventListener("click", (e) => {
    if (e.target === clearModal) closeClearCartModal();
  });
  clearModal.querySelector("#clear-cart-cancel").addEventListener("click", closeClearCartModal);
  clearModal.querySelector("#clear-cart-confirm").addEventListener("click", () => {
    Cart.clear();
    closeClearCartModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (clearModal.classList.contains("open")) closeClearCartModal();
    else closeCart();
  });

  document.addEventListener("cart:change", () => {
    renderFab();
    if (panel.classList.contains("open")) renderCartBody();
  });

  renderFab();
}

function renderFab() {
  const items = Cart.read();
  const count = Cart.count(items);
  const fab = document.getElementById("cart-fab");
  const countEl = document.getElementById("cart-fab-count");
  if (!fab) return;
  countEl.textContent = count;
  fab.hidden = count === 0;
  fab.classList.remove("bump");
  void fab.offsetWidth;
  fab.classList.add("bump");
}

function openCart() {
  document.getElementById("cart-overlay").classList.add("open");
  document.getElementById("cart-panel").classList.add("open");
  document.body.style.overflow = "hidden";
  renderCartBody();
}

function closeCart() {
  document.getElementById("cart-overlay").classList.remove("open");
  document.getElementById("cart-panel").classList.remove("open");
  document.body.style.overflow = "";
}

function openClearCartModal() {
  document.getElementById("clear-cart-modal").classList.add("open");
}

function closeClearCartModal() {
  document.getElementById("clear-cart-modal").classList.remove("open");
}

let checkoutState = { fulfilment: "pickup" };

function renderCartBody() {
  const body = document.getElementById("cart-panel-body");
  const foot = document.getElementById("cart-panel-foot");
  const items = Cart.read();

  if (items.length === 0) {
    body.innerHTML = `
      <div class="cart-empty">
        <p>Your cart is empty.</p>
        <p style="font-size:0.85rem;">Add something delicious from the menu to get started.</p>
      </div>`;
    foot.innerHTML = `<a href="order.html" class="btn btn-gold btn-block">Browse the menu</a>`;
    return;
  }

  const lines = items
    .map(
      (i) => `
      <div class="cart-line">
        <div>
          <div class="cart-line-name">${i.name}</div>
          <div class="cart-line-price">${formatNaira(i.price)} each</div>
          <button class="cart-line-remove" data-remove="${encodeURIComponent(i.name)}">Remove</button>
        </div>
        <div class="cart-line-qty">
          <button data-dec="${encodeURIComponent(i.name)}" aria-label="Decrease quantity">&minus;</button>
          <span>${i.qty}</span>
          <button data-inc="${encodeURIComponent(i.name)}" aria-label="Increase quantity">+</button>
        </div>
      </div>`
    )
    .join("");

  const total = Cart.total(items);

  body.innerHTML = `
    ${lines}
    <div class="cart-total-row"><span>Total</span><span>${formatNaira(total)}</span></div>
    <button type="button" class="clear-cart-link" id="clear-cart-btn">Clear cart</button>

    <div class="fulfilment-toggle" id="fulfilment-toggle">
      <button type="button" data-fulfil="pickup" class="${checkoutState.fulfilment === "pickup" ? "active" : ""}">Pickup</button>
      <button type="button" data-fulfil="delivery" class="${checkoutState.fulfilment === "delivery" ? "active" : ""}">Delivery</button>
    </div>

    <form class="checkout-form" id="checkout-form" novalidate>
      <div class="field" id="field-name">
        <label for="cust-name">Full name</label>
        <input type="text" id="cust-name" name="name" autocomplete="name" />
        <div class="field-error">Please enter your name.</div>
      </div>
      <div class="field" id="field-phone">
        <label for="cust-phone">Phone number</label>
        <input type="tel" id="cust-phone" name="phone" autocomplete="tel" />
        <div class="field-error">Please enter a phone number we can reach you on.</div>
      </div>
      <div class="field" id="delivery-address-field" ${checkoutState.fulfilment === "delivery" ? "" : "hidden"}>
        <label for="cust-address">Delivery address</label>
        <input type="text" id="cust-address" name="address" autocomplete="street-address" />
        <div class="field-error">Please enter your delivery address.</div>
      </div>
      <div class="field" id="field-notes">
        <label for="cust-notes">Special instructions (optional)</label>
        <textarea id="cust-notes" name="notes" placeholder="Extra spicy, no onions, call on arrival..."></textarea>
      </div>
    </form>
  `;

  foot.innerHTML = `
    <button class="btn btn-gold btn-block" id="checkout-btn">Review &amp; send order</button>
    <p class="receipt-note">You'll get a receipt to send us on WhatsApp — no payment happens on this site.</p>
  `;

  body.querySelectorAll("[data-inc]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const name = decodeURIComponent(btn.dataset.inc);
      const item = Cart.read().find((i) => i.name === name);
      Cart.setQty(name, item.qty + 1);
    })
  );
  body.querySelectorAll("[data-dec]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const name = decodeURIComponent(btn.dataset.dec);
      const item = Cart.read().find((i) => i.name === name);
      Cart.setQty(name, item.qty - 1);
    })
  );
  body.querySelectorAll("[data-remove]").forEach((btn) =>
    btn.addEventListener("click", () => Cart.remove(decodeURIComponent(btn.dataset.remove)))
  );
  body.querySelectorAll("[data-fulfil]").forEach((btn) =>
    btn.addEventListener("click", () => {
      checkoutState.fulfilment = btn.dataset.fulfil;
      renderCartBody();
    })
  );

  document.getElementById("checkout-btn").addEventListener("click", handleCheckoutSubmit);
  document.getElementById("clear-cart-btn").addEventListener("click", openClearCartModal);
}

function handleCheckoutSubmit() {
  const form = document.getElementById("checkout-form");
  const name = form.name.value.trim();
  const phone = form.phone.value.trim();
  const address = form.address ? form.address.value.trim() : "";
  const notes = form.notes.value.trim();

  let valid = true;
  toggleFieldError("field-name", name.length === 0);
  toggleFieldError("field-phone", phone.length < 6);
  if (checkoutState.fulfilment === "delivery") {
    toggleFieldError("delivery-address-field", address.length === 0);
  }
  if (name.length === 0 || phone.length < 6 || (checkoutState.fulfilment === "delivery" && address.length === 0)) {
    valid = false;
  }
  if (!valid) return;

  showReceipt({ name, phone, address, notes });
}

function toggleFieldError(fieldId, isInvalid) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.classList.toggle("invalid", isInvalid);
}

function showReceipt(details) {
  const items = Cart.read();
  const total = Cart.total(items);
  const orderId = "BE" + Date.now().toString().slice(-6);
  const now = new Date();

  const itemLines = items
    .map((i) => `${i.qty} × ${i.name} — ${formatNaira(i.qty * i.price)}`)
    .join("\n");

  const receiptText =
    `BiteEase — Order Receipt\n` +
    `Order #${orderId}\n` +
    `${now.toLocaleString("en-NG")}\n` +
    `------------------------------\n` +
    `${itemLines}\n` +
    `------------------------------\n` +
    `Total: ${formatNaira(total)}\n\n` +
    `Fulfilment: ${checkoutState.fulfilment === "pickup" ? "Pickup" : "Delivery"}\n` +
    `Name: ${details.name}\n` +
    `Phone: ${details.phone}\n` +
    (checkoutState.fulfilment === "delivery" ? `Address: ${details.address}\n` : "") +
    (details.notes ? `Notes: ${details.notes}\n` : "") +
    `\nOpp. Civil Defense HQ, before Zone 8 Roundabout, Lokoja, Nigeria`;

  const body = document.getElementById("cart-panel-body");
  const foot = document.getElementById("cart-panel-foot");

  body.innerHTML = `
    <div class="receipt-view">
      <h3>Order ready to send</h3>
      <p style="color:var(--ink-700); font-size:0.88rem;">Download your receipt, then send it to us on WhatsApp to confirm — we'll take it from there.</p>
      <div class="receipt-box">
        <p><strong>Order #${orderId}</strong></p>
        ${items
          .map(
            (i) => `<div class="receipt-row"><span>${i.qty} × ${i.name}</span><span>${formatNaira(i.qty * i.price)}</span></div>`
          )
          .join("")}
        <div class="receipt-divider"></div>
        <div class="receipt-row"><strong>Total</strong><strong>${formatNaira(total)}</strong></div>
        <div class="receipt-divider"></div>
        <p>${checkoutState.fulfilment === "pickup" ? "Pickup" : "Delivery"} · ${details.name} · ${details.phone}</p>
        ${checkoutState.fulfilment === "delivery" ? `<p>${details.address}</p>` : ""}
        ${details.notes ? `<p>Notes: ${details.notes}</p>` : ""}
      </div>
    </div>
  `;

  const waText = encodeURIComponent(receiptText);
  const waLink = `https://wa.me/${BITEASE_WHATSAPP_NUMBER}?text=${waText}`;

  foot.innerHTML = `
    <button class="btn btn-outline-dark btn-block" id="download-receipt-btn">Download receipt</button>
    <a class="btn btn-gold btn-block" href="${waLink}" target="_blank" rel="noopener" id="whatsapp-btn">Send order on WhatsApp</a>
  `;

  document.getElementById("download-receipt-btn").addEventListener("click", async () => {
    const canvas = await drawReceiptImage({ orderId, now, items, total, details });
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BiteEase-Receipt-${orderId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  });

  document.getElementById("whatsapp-btn").addEventListener("click", () => {
    Cart.clear();
  });
}

async function drawReceiptImage({ orderId, now, items, total, details }) {
  const width = 600;
  const padX = 40;
  const lineH = 24;
  let height = 320 + items.length * lineH + (checkoutState.fulfilment === "delivery" ? lineH : 0) + (details.notes ? lineH : 0);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (document.fonts && document.fonts.ready) await document.fonts.ready;

  ctx.fillStyle = "#faf5e9";
  ctx.fillRect(0, 0, width, height);

  let y = 50;
  ctx.textAlign = "center";
  ctx.fillStyle = "#07211f";
  ctx.font = "600 26px Fraunces, serif";
  ctx.fillText("BiteEase", width / 2, y);

  y += 26;
  ctx.fillStyle = "#3b4642";
  ctx.font = "500 13px Inter, sans-serif";
  ctx.fillText("Order Receipt", width / 2, y);

  y += 28;
  ctx.font = "600 13px Inter, sans-serif";
  ctx.fillText(`Order #${orderId}`, width / 2, y);

  y += 18;
  ctx.font = "400 12px Inter, sans-serif";
  ctx.fillText(now.toLocaleString("en-NG"), width / 2, y);

  y += 20;
  drawDashedLine(ctx, padX, width - padX, y);

  y += 26;
  ctx.textAlign = "left";
  ctx.font = "400 13px Inter, sans-serif";
  items.forEach((i) => {
    ctx.fillStyle = "#1b2320";
    ctx.textAlign = "left";
    ctx.fillText(`${i.qty} × ${i.name}`, padX, y);
    ctx.textAlign = "right";
    ctx.fillText(formatNaira(i.qty * i.price), width - padX, y);
    y += lineH;
  });

  drawDashedLine(ctx, padX, width - padX, y);
  y += 26;

  ctx.font = "600 15px Fraunces, serif";
  ctx.fillStyle = "#0b302d";
  ctx.textAlign = "left";
  ctx.fillText("Total", padX, y);
  ctx.textAlign = "right";
  ctx.fillText(formatNaira(total), width - padX, y);

  y += 20;
  drawDashedLine(ctx, padX, width - padX, y);
  y += 26;

  ctx.font = "400 13px Inter, sans-serif";
  ctx.fillStyle = "#1b2320";
  ctx.textAlign = "left";
  ctx.fillText(`${checkoutState.fulfilment === "pickup" ? "Pickup" : "Delivery"} · ${details.name} · ${details.phone}`, padX, y);

  if (checkoutState.fulfilment === "delivery") {
    y += lineH;
    ctx.fillText(details.address, padX, y);
  }
  if (details.notes) {
    y += lineH;
    ctx.fillText(`Notes: ${details.notes}`, padX, y);
  }

  y += 30;
  ctx.font = "400 11px Inter, sans-serif";
  ctx.fillStyle = "#3b4642";
  ctx.textAlign = "center";
  ctx.fillText("Opp. Civil Defense HQ, before Zone 8 Roundabout, Lokoja, Nigeria", width / 2, y);

  return canvas;
}

function drawDashedLine(ctx, xStart, xEnd, y) {
  ctx.strokeStyle = "#e7d7b2";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(xStart, y);
  ctx.lineTo(xEnd, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

document.addEventListener("DOMContentLoaded", mountCartUI);
