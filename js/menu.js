/* ============================================
   BiteEase — Menu browsing (order.html)
   Category tabs + live search over the menu data.
   ============================================ */

let MENU_ITEMS = [];
let activeCategory = "All";
let searchTerm = "";

async function loadMenu() {
  const res = await fetch("data/menu-data.json");
  const data = await res.json();
  MENU_ITEMS = data.items;
  buildTabs();
  applyHashCategory();
  renderMenu();
}

function buildTabs() {
  const categories = ["All", ...new Set(MENU_ITEMS.map((i) => i.category))];
  const tabsEl = document.getElementById("category-tabs");
  tabsEl.innerHTML = categories
    .map(
      (cat) =>
        `<button class="tab-btn${cat === activeCategory ? " active" : ""}" data-cat="${cat}">${cat}</button>`
    )
    .join("");

  tabsEl.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
      tabsEl.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderMenu();
    });
  });
}

function applyHashCategory() {
  const hash = decodeURIComponent(window.location.hash.replace("#", ""));
  if (hash && MENU_ITEMS.some((i) => i.category === hash)) {
    activeCategory = hash;
  }
}

function matchesSearch(item, term) {
  if (!term) return true;
  const haystack = (item.name + " " + item.category + " " + (item.description || "")).toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function renderMenu() {
  const container = document.getElementById("menu-results");
  let items = MENU_ITEMS.filter((i) => matchesSearch(i, searchTerm));
  if (activeCategory !== "All") {
    items = items.filter((i) => i.category === activeCategory);
  }

  if (items.length === 0) {
    container.innerHTML = `<div class="no-results"><p>No dishes match “${searchTerm}”. Try another search or category.</p></div>`;
    return;
  }

  const byCategory = {};
  items.forEach((i) => {
    byCategory[i.category] = byCategory[i.category] || [];
    byCategory[i.category].push(i);
  });

  container.innerHTML = Object.entries(byCategory)
    .map(
      ([cat, catItems]) => `
      <div class="menu-category-block" id="cat-${cat.replace(/\s+/g, "-")}">
        <h2>${cat}</h2>
        <div class="menu-grid">
          ${catItems.map(renderItem).join("")}
        </div>
      </div>`
    )
    .join("");

  container.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = decodeURIComponent(btn.dataset.add);
      const item = MENU_ITEMS.find((i) => i.name === name);
      Cart.add(item);
      btn.textContent = "Added";
      btn.classList.add("added");
      setTimeout(() => {
        btn.textContent = "Add";
        btn.classList.remove("added");
      }, 900);
    });
  });
}

function renderItem(item) {
  return `
    <article class="menu-item">
      <div class="menu-item-info">
        <h3>${item.name}</h3>
        ${item.description ? `<p>${item.description}</p>` : ""}
        <div class="menu-item-price">${formatNaira(item.price)}</div>
      </div>
      <div class="menu-item-add">
        <button class="add-btn" data-add="${encodeURIComponent(item.name)}">Add</button>
      </div>
    </article>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  loadMenu();
  const searchInput = document.getElementById("menu-search");
  let debounceTimer;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchTerm = e.target.value.trim();
      renderMenu();
    }, 180);
  });
});
