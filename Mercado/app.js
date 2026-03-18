const STORAGE_KEY = "mercadinho_sistema_v2";

const state = {
  products: [],
  sales: [],
  expenses: [],
  cart: []
};

const moneyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const metricAnimations = new WeakMap();
const dashboardFx = {
  hoverIndex: null,
  points: [],
  values: [],
  labels: []
};

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toMoney(value) {
  return moneyFmt.format(Number(value) || 0);
}

function animateTextValue(el, target, formatter, duration = 520) {
  if (!el) return;
  const currentValue = Number(el.dataset.value || 0);
  const endValue = Number(target) || 0;
  const startValue = Number.isFinite(currentValue) ? currentValue : 0;

  if (metricAnimations.has(el)) {
    cancelAnimationFrame(metricAnimations.get(el));
  }

  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = startValue + (endValue - startValue) * eased;
    el.dataset.value = value.toString();
    el.textContent = formatter(value);
    if (progress < 1) {
      const id = requestAnimationFrame(tick);
      metricAnimations.set(el, id);
    }
  };

  const id = requestAnimationFrame(tick);
  metricAnimations.set(el, id);
}

function toDate(ts, full = false) {
  if (full) {
    return new Date(ts).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  return new Date(ts).toLocaleDateString("pt-BR");
}

function sameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function sameMonth(ts, ref = new Date()) {
  const d = new Date(ts);
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
}

function statusBadge(stock) {
  if (stock <= 0) return '<span class="badge critical">Sem estoque</span>';
  if (stock <= 8) return '<span class="badge low">Baixo</span>';
  return '<span class="badge ok">Normal</span>';
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.remove("show"), 2200);
}

function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      products: state.products,
      sales: state.sales,
      expenses: state.expenses
    })
  );
}

function seed() {
  const now = Date.now();
  state.products = [
    { id: uid(), name: "Arroz 5kg", category: "Mercearia", price: 29.9, stock: 22, createdAt: now },
    { id: uid(), name: "Feijão 1kg", category: "Mercearia", price: 8.9, stock: 15, createdAt: now },
    { id: uid(), name: "Leite 1L", category: "Laticínios", price: 5.8, stock: 18, createdAt: now },
    { id: uid(), name: "Café 500g", category: "Bebidas", price: 18.5, stock: 7, createdAt: now },
    { id: uid(), name: "Açúcar 1kg", category: "Mercearia", price: 4.6, stock: 10, createdAt: now }
  ];

  state.sales = [
    {
      id: uid(),
      createdAt: now - 86400000,
      payment: "Pix",
      discount: 0,
      items: [
        { productId: state.products[0].id, name: state.products[0].name, qty: 1, price: 29.9 },
        { productId: state.products[1].id, name: state.products[1].name, qty: 2, price: 8.9 }
      ],
      subtotal: 47.7,
      total: 47.7
    },
    {
      id: uid(),
      createdAt: now - 2 * 86400000,
      payment: "Dinheiro",
      discount: 2,
      items: [{ productId: state.products[2].id, name: state.products[2].name, qty: 4, price: 5.8 }],
      subtotal: 23.2,
      total: 21.2
    }
  ];

  state.expenses = [
    { id: uid(), createdAt: now - 3 * 86400000, description: "Conta de energia", category: "Contas", value: 198.5 },
    { id: uid(), createdAt: now - 5 * 86400000, description: "Compra de sacolas", category: "Operacional", value: 64.9 }
  ];

  state.cart = [];
  persist();
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    seed();
    return;
  }

  try {
    const data = JSON.parse(raw);
    state.products = Array.isArray(data.products) ? data.products : [];
    state.sales = Array.isArray(data.sales) ? data.sales : [];
    state.expenses = Array.isArray(data.expenses) ? data.expenses : [];
    state.cart = [];
  } catch {
    seed();
  }
}

function currentMonthData() {
  const salesMonth = state.sales.filter((sale) => sameMonth(sale.createdAt));
  const expensesMonth = state.expenses.filter((exp) => sameMonth(exp.createdAt));

  const faturamento = salesMonth.reduce((sum, sale) => sum + sale.total, 0);
  const despesas = expensesMonth.reduce((sum, exp) => sum + exp.value, 0);
  const lucro = faturamento - despesas;
  const qtdVendas = salesMonth.length;
  const qtdItens = salesMonth.reduce((sum, sale) => sum + sale.items.reduce((acc, item) => acc + item.qty, 0), 0);
  const ticket = qtdVendas ? faturamento / qtdVendas : 0;
  const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

  return { salesMonth, expensesMonth, faturamento, despesas, lucro, qtdVendas, qtdItens, ticket, margem };
}

function setupNavigation() {
  const buttons = document.querySelectorAll(".menu-btn");
  const pages = document.querySelectorAll(".page");
  const title = document.getElementById("pageTitle");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      pages.forEach((page) => page.classList.remove("active"));
      document.getElementById(`page-${btn.dataset.page}`).classList.add("active");
      title.textContent = btn.innerText.trim();
      renderAll();
    });
  });
}

function setupTopBarActions() {
  document.getElementById("btnExportar").addEventListener("click", () => {
    downloadFile(
      `mercadinho-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(
        {
          exportadoEm: new Date().toISOString(),
          products: state.products,
          sales: state.sales,
          expenses: state.expenses
        },
        null,
        2
      ),
      "application/json"
    );
    toast("Backup exportado em JSON.");
  });

  document.getElementById("btnResetar").addEventListener("click", () => {
    const ok = window.confirm("Isso vai apagar dados atuais e recriar dados de exemplo. Continuar?");
    if (!ok) return;
    seed();
    renderAll();
    toast("Dados de demonstração restaurados.");
  });
}

function setupProdutos() {
  const form = document.getElementById("produtoForm");
  const btnCancelar = document.getElementById("produtoCancelar");
  const busca = document.getElementById("produtoBusca");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const id = document.getElementById("produtoId").value;
    const name = document.getElementById("produtoNome").value.trim();
    const category = document.getElementById("produtoCategoria").value.trim();
    const price = Number(document.getElementById("produtoPreco").value);
    const stock = Number(document.getElementById("produtoEstoque").value);

    if (!name || !category) {
      toast("Preencha nome e categoria.");
      return;
    }

    if (price <= 0 || stock < 0) {
      toast("Preço e estoque inválidos.");
      return;
    }

    if (id) {
      const product = state.products.find((item) => item.id === id);
      if (!product) return;
      product.name = name;
      product.category = category;
      product.price = price;
      product.stock = stock;
      toast("Produto atualizado.");
    } else {
      state.products.unshift({ id: uid(), name, category, price, stock, createdAt: Date.now() });
      toast("Produto cadastrado.");
    }

    form.reset();
    document.getElementById("produtoId").value = "";
    document.getElementById("produtoSalvar").textContent = "Salvar";
    persist();
    renderAll();
  });

  btnCancelar.addEventListener("click", () => {
    form.reset();
    document.getElementById("produtoId").value = "";
    document.getElementById("produtoSalvar").textContent = "Salvar";
  });

  busca.addEventListener("input", renderProductsTable);

  document.getElementById("produtosBody").addEventListener("click", (event) => {
    const target = event.target;
    const editId = target.dataset.edit;
    const delId = target.dataset.delete;

    if (editId) {
      const p = state.products.find((item) => item.id === editId);
      if (!p) return;
      document.getElementById("produtoId").value = p.id;
      document.getElementById("produtoNome").value = p.name;
      document.getElementById("produtoCategoria").value = p.category;
      document.getElementById("produtoPreco").value = p.price;
      document.getElementById("produtoEstoque").value = p.stock;
      document.getElementById("produtoSalvar").textContent = "Atualizar";
      document.getElementById("produtoNome").focus();
      return;
    }

    if (delId) {
      const used = state.sales.some((sale) => sale.items.some((item) => item.productId === delId));
      if (used) {
        toast("Produto já usado em venda. Desative com estoque 0 em vez de excluir.");
        return;
      }

      const ok = window.confirm("Excluir esse produto?");
      if (!ok) return;

      state.products = state.products.filter((item) => item.id !== delId);
      persist();
      renderAll();
      toast("Produto excluído.");
    }
  });
}

function renderProductsTable() {
  const body = document.getElementById("produtosBody");
  const search = document.getElementById("produtoBusca").value.trim().toLowerCase();

  const filtered = state.products
    .filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(search))
    .sort((a, b) => a.name.localeCompare(b.name));

  body.innerHTML = "";

  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="6">Nenhum produto encontrado.</td></tr>';
    return;
  }

  filtered.forEach((product) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${product.name}</td>
      <td>${product.category}</td>
      <td>${toMoney(product.price)}</td>
      <td>${product.stock}</td>
      <td>${statusBadge(product.stock)}</td>
      <td>
        <div class="actions">
          <button class="btn" data-edit="${product.id}">Editar</button>
          <button class="btn btn-danger-soft" data-delete="${product.id}">Excluir</button>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
}

function setupVendas() {
  document.getElementById("vendaBusca").addEventListener("input", renderCatalog);

  document.getElementById("catalogoVenda").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-add]");
    if (!btn) return;

    const id = btn.dataset.add;
    const qtyInput = document.querySelector(`input[data-qty='${id}']`);
    const qty = Number(qtyInput ? qtyInput.value : 1);
    addToCart(id, qty);
  });

  document.getElementById("cartItems").addEventListener("click", (event) => {
    const plus = event.target.closest("button[data-plus]");
    const minus = event.target.closest("button[data-minus]");
    const remove = event.target.closest("button[data-remove]");

    if (plus) {
      changeCartQty(plus.dataset.plus, 1);
      return;
    }

    if (minus) {
      changeCartQty(minus.dataset.minus, -1);
      return;
    }

    if (remove) {
      removeFromCart(remove.dataset.remove);
    }
  });

  document.getElementById("vendaFinalForm").addEventListener("submit", (event) => {
    event.preventDefault();
    finalizeSale();
  });

  document.getElementById("vendaDesconto").addEventListener("input", renderCart);
}

function addToCart(productId, qty) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;

  const quantity = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
  if (product.stock <= 0) {
    toast("Produto sem estoque.");
    return;
  }

  const existing = state.cart.find((item) => item.productId === productId);
  const inCart = existing ? existing.qty : 0;

  if (inCart + quantity > product.stock) {
    toast("Quantidade acima do estoque disponível.");
    return;
  }

  if (existing) existing.qty += quantity;
  else state.cart.push({ productId: product.id, name: product.name, price: product.price, qty: quantity });

  renderCart();
  toast("Item adicionado ao carrinho.");
}

function changeCartQty(productId, delta) {
  const cartItem = state.cart.find((item) => item.productId === productId);
  const product = state.products.find((item) => item.id === productId);
  if (!cartItem || !product) return;

  const next = cartItem.qty + delta;
  if (next <= 0) {
    removeFromCart(productId);
    return;
  }

  if (next > product.stock) {
    toast("Estoque insuficiente.");
    return;
  }

  cartItem.qty = next;
  renderCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((item) => item.productId !== productId);
  renderCart();
}

function finalizeSale() {
  if (!state.cart.length) {
    toast("Carrinho vazio.");
    return;
  }

  const payment = document.getElementById("vendaPagamento").value;
  const discount = Number(document.getElementById("vendaDesconto").value || 0);
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  if (discount < 0 || discount > subtotal) {
    toast("Desconto inválido.");
    return;
  }

  for (const item of state.cart) {
    const product = state.products.find((p) => p.id === item.productId);
    if (!product || product.stock < item.qty) {
      toast(`Estoque insuficiente para ${item.name}.`);
      return;
    }
  }

  state.cart.forEach((item) => {
    const product = state.products.find((p) => p.id === item.productId);
    product.stock -= item.qty;
  });

  state.sales.unshift({
    id: uid(),
    createdAt: Date.now(),
    payment,
    discount,
    items: state.cart.map((item) => ({ ...item })),
    subtotal,
    total: subtotal - discount
  });

  state.cart = [];
  document.getElementById("vendaDesconto").value = "0";
  persist();
  renderAll();
  toast("Venda finalizada com sucesso.");
}

function renderCatalog() {
  const grid = document.getElementById("catalogoVenda");
  const search = document.getElementById("vendaBusca").value.trim().toLowerCase();

  const filtered = state.products
    .filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(search))
    .sort((a, b) => a.name.localeCompare(b.name));

  grid.innerHTML = "";

  if (!filtered.length) {
    grid.innerHTML = '<p class="muted">Nenhum produto encontrado.</p>';
    return;
  }

  filtered.forEach((product) => {
    const item = document.createElement("article");
    item.className = "product-card";
    item.innerHTML = `
      <h4>${product.name}</h4>
      <div class="product-meta">${product.category}</div>
      <div class="product-meta">${toMoney(product.price)} | Estoque: ${product.stock}</div>
      <div class="product-foot">
        <input type="number" min="1" value="1" data-qty="${product.id}" ${product.stock <= 0 ? "disabled" : ""} />
        <button class="btn btn-primary" data-add="${product.id}" ${product.stock <= 0 ? "disabled" : ""}>Adicionar</button>
      </div>
    `;
    grid.appendChild(item);
  });
}

function renderCart() {
  const container = document.getElementById("cartItems");
  const discount = Number(document.getElementById("vendaDesconto").value || 0);

  container.innerHTML = "";

  if (!state.cart.length) {
    container.innerHTML = '<div class="list-item"><span>Carrinho vazio</span></div>';
  } else {
    state.cart.forEach((item) => {
      const line = document.createElement("div");
      line.className = "list-item";
      line.innerHTML = `
        <div>
          <strong>${item.name}</strong>
          <div class="muted">${toMoney(item.price)} cada</div>
        </div>
        <div class="actions">
          <button class="btn" data-minus="${item.productId}">-</button>
          <span>${item.qty}</span>
          <button class="btn" data-plus="${item.productId}">+</button>
          <button class="btn btn-danger-soft" data-remove="${item.productId}">x</button>
        </div>
      `;
      container.appendChild(line);
    });
  }

  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const safeDiscount = Math.min(Math.max(0, discount), subtotal);
  const total = subtotal - safeDiscount;

  document.getElementById("cartSubtotal").textContent = toMoney(subtotal);
  document.getElementById("cartDesconto").textContent = toMoney(safeDiscount);
  document.getElementById("cartTotal").textContent = toMoney(total);
}

function renderSalesHistory() {
  const body = document.getElementById("salesHistoryBody");
  body.innerHTML = "";

  if (!state.sales.length) {
    body.innerHTML = '<tr><td colspan="4">Sem vendas registradas.</td></tr>';
    return;
  }

  state.sales.slice(0, 20).forEach((sale) => {
    const row = document.createElement("tr");
    const items = sale.items.map((item) => `${item.name} x${item.qty}`).join(", ");
    row.innerHTML = `
      <td>${toDate(sale.createdAt, true)}</td>
      <td>${sale.payment}</td>
      <td>${items}</td>
      <td>${toMoney(sale.total)}</td>
    `;
    body.appendChild(row);
  });
}

function setupDespesas() {
  const form = document.getElementById("despesaForm");
  const filter = document.getElementById("filtroDespesaMes");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const description = document.getElementById("despesaDescricao").value.trim();
    const category = document.getElementById("despesaCategoria").value.trim();
    const value = Number(document.getElementById("despesaValor").value);

    if (!description || !category || value <= 0) {
      toast("Preencha os dados da despesa corretamente.");
      return;
    }

    state.expenses.unshift({ id: uid(), createdAt: Date.now(), description, category, value });
    form.reset();
    persist();
    renderAll();
    toast("Despesa registrada.");
  });

  filter.addEventListener("change", renderExpenses);

  document.getElementById("despesasBody").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-del-expense]");
    if (!btn) return;

    const ok = window.confirm("Excluir despesa?");
    if (!ok) return;

    state.expenses = state.expenses.filter((exp) => exp.id !== btn.dataset.delExpense);
    persist();
    renderAll();
    toast("Despesa excluída.");
  });
}

function renderExpenses() {
  const body = document.getElementById("despesasBody");
  const filter = document.getElementById("filtroDespesaMes").value;

  const list = filter === "current" ? state.expenses.filter((exp) => sameMonth(exp.createdAt)) : [...state.expenses];

  body.innerHTML = "";

  if (!list.length) {
    body.innerHTML = '<tr><td colspan="5">Sem despesas no filtro selecionado.</td></tr>';
    return;
  }

  list.forEach((exp) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${toDate(exp.createdAt)}</td>
      <td>${exp.description}</td>
      <td>${exp.category}</td>
      <td>${toMoney(exp.value)}</td>
      <td><button class="btn btn-danger-soft" data-del-expense="${exp.id}">Excluir</button></td>
    `;
    body.appendChild(row);
  });
}

function drawSalesChart() {
  const canvas = document.getElementById("salesChart");
  const ctx = canvas.getContext("2d");

  const labels = [];
  const values = [];

  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);

    const total = state.sales.filter((sale) => sameDay(sale.createdAt, day.getTime())).reduce((sum, sale) => sum + sale.total, 0);

    labels.push(day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
    values.push(total);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fbfdff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pad = 36;
  const width = canvas.width - pad * 2;
  const height = canvas.height - pad * 2;
  const maxValue = Math.max(...values, 50);

  ctx.strokeStyle = "#d7e4fb";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad + (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(pad + width, y);
    ctx.stroke();
  }

  const points = values.map((value, index) => ({
    x: pad + (width / (values.length - 1)) * index,
    y: pad + height - (value / maxValue) * height,
    value,
    label: labels[index]
  }));
  dashboardFx.points = points;
  dashboardFx.values = values;
  dashboardFx.labels = labels;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.lineTo(points[points.length - 1].x, pad + height);
  ctx.lineTo(points[0].x, pad + height);
  ctx.closePath();
  ctx.fillStyle = "rgba(31, 111, 255, 0.15)";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = "#1f6fff";
  ctx.lineWidth = 3;
  ctx.stroke();

  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#1f6fff";
    ctx.fill();

    ctx.font = "12px Segoe UI";
    ctx.fillStyle = "#5c6b85";
    ctx.fillText(point.label, point.x - 18, canvas.height - 9);
  });

  if (dashboardFx.hoverIndex !== null && points[dashboardFx.hoverIndex]) {
    const active = points[dashboardFx.hoverIndex];

    ctx.beginPath();
    ctx.moveTo(active.x, pad);
    ctx.lineTo(active.x, pad + height);
    ctx.strokeStyle = "rgba(31, 111, 255, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(active.x, active.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#1f6fff";
    ctx.stroke();

    const text = `${active.label} • ${toMoney(active.value)}`;
    ctx.font = "600 12px Segoe UI";
    const boxW = Math.max(130, ctx.measureText(text).width + 18);
    const boxH = 28;
    const boxX = Math.min(canvas.width - boxW - 8, Math.max(8, active.x - boxW / 2));
    const boxY = Math.max(8, active.y - boxH - 14);

    ctx.fillStyle = "rgba(19, 34, 58, 0.95)";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, boxX + 9, boxY + 18);
  }
}

function setupDashboardInteractions() {
  const canvas = document.getElementById("salesChart");
  const kpis = document.querySelectorAll(".kpi");

  kpis.forEach((card) => {
    card.addEventListener("mousemove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 8;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * -8;
      card.style.transform = `perspective(600px) rotateX(${y.toFixed(2)}deg) rotateY(${x.toFixed(2)}deg) translateY(-2px)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
    let nearestIndex = null;
    let minDistance = Infinity;

    dashboardFx.points.forEach((point, index) => {
      const distance = Math.abs(mouseX - point.x);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = index;
      }
    });

    const next = minDistance <= 36 ? nearestIndex : null;
    if (dashboardFx.hoverIndex !== next) {
      dashboardFx.hoverIndex = next;
      drawSalesChart();
    }
  });

  canvas.addEventListener("mouseleave", () => {
    dashboardFx.hoverIndex = null;
    drawSalesChart();
  });
}

function renderDashboard() {
  const now = Date.now();
  const vendasHoje = state.sales.filter((sale) => sameDay(sale.createdAt, now)).reduce((sum, sale) => sum + sale.total, 0);
  const month = currentMonthData();

  animateTextValue(document.getElementById("kpiVendasHoje"), vendasHoje, toMoney);
  animateTextValue(document.getElementById("kpiFaturamento"), month.faturamento, toMoney);
  animateTextValue(document.getElementById("kpiDespesas"), month.despesas, toMoney);
  animateTextValue(document.getElementById("kpiLucro"), month.lucro, toMoney);

  drawSalesChart();

  const low = state.products.filter((product) => product.stock <= 8).sort((a, b) => a.stock - b.stock);
  const lowWrap = document.getElementById("lowStock");
  lowWrap.innerHTML = "";

  if (!low.length) {
    lowWrap.innerHTML = '<div class="list-item"><span>Sem produtos com estoque baixo.</span></div>';
  } else {
    low.forEach((product) => {
      const row = document.createElement("div");
      row.className = "list-item";
      row.innerHTML = `<span>${product.name}</span><strong>${product.stock} un</strong>`;
      lowWrap.appendChild(row);
    });
  }

  const salesBody = document.getElementById("lastSalesBody");
  salesBody.innerHTML = "";
  if (!state.sales.length) {
    salesBody.innerHTML = '<tr><td colspan="3">Sem vendas registradas.</td></tr>';
  } else {
    state.sales.slice(0, 8).forEach((sale) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${toDate(sale.createdAt, true)}</td>
        <td>${sale.items.map((item) => `${item.name} x${item.qty}`).join(", ")}</td>
        <td>${toMoney(sale.total)}</td>
      `;
      salesBody.appendChild(row);
    });
  }

  const ranking = new Map();
  state.sales.forEach((sale) => {
    sale.items.forEach((item) => ranking.set(item.name, (ranking.get(item.name) || 0) + item.qty));
  });

  const topWrap = document.getElementById("topProducts");
  topWrap.innerHTML = "";
  const top = [...ranking.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  if (!top.length) {
    topWrap.innerHTML = '<div class="list-item"><span>Sem dados de vendas.</span></div>';
  } else {
    top.forEach(([name, qty]) => {
      const row = document.createElement("div");
      row.className = "list-item";
      row.innerHTML = `<span>${name}</span><strong>${qty} un</strong>`;
      topWrap.appendChild(row);
    });
  }
}

function renderReports() {
  const month = currentMonthData();

  document.getElementById("repTicket").textContent = toMoney(month.ticket);
  document.getElementById("repQtdVendas").textContent = String(month.qtdVendas);
  document.getElementById("repQtdItens").textContent = String(month.qtdItens);
  document.getElementById("repMargem").textContent = `${month.margem.toFixed(1)}%`;

  const summary = document.getElementById("financialSummary");
  summary.innerHTML = "";

  const rows = [
    ["Faturamento do mês", toMoney(month.faturamento)],
    ["Despesas do mês", toMoney(month.despesas)],
    ["Lucro do mês", toMoney(month.lucro)],
    ["Total de produtos cadastrados", `${state.products.length}`]
  ];

  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    summary.appendChild(row);
  });
}

function setupReportActions() {
  document.getElementById("btnCsvVendas").addEventListener("click", () => {
    const lines = ["data,pagamento,itens,subtotal,desconto,total"];
    state.sales.forEach((sale) => {
      const items = sale.items.map((item) => `${item.name} x${item.qty}`).join(" | ");
      lines.push(
        [
          toDate(sale.createdAt, true),
          sale.payment,
          items,
          sale.subtotal.toFixed(2),
          sale.discount.toFixed(2),
          sale.total.toFixed(2)
        ]
          .map(csvEscape)
          .join(",")
      );
    });

    downloadFile(`vendas-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"), "text/csv");
    toast("CSV de vendas exportado.");
  });

  document.getElementById("btnCsvDespesas").addEventListener("click", () => {
    const lines = ["data,descricao,categoria,valor"];
    state.expenses.forEach((expense) => {
      lines.push([toDate(expense.createdAt), expense.description, expense.category, expense.value.toFixed(2)].map(csvEscape).join(","));
    });

    downloadFile(`despesas-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"), "text/csv");
    toast("CSV de despesas exportado.");
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderAll() {
  renderProductsTable();
  renderCatalog();
  renderCart();
  renderSalesHistory();
  renderExpenses();
  renderDashboard();
  renderReports();
}

function boot() {
  document.getElementById("todayDate").textContent = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  load();
  setupNavigation();
  setupTopBarActions();
  setupProdutos();
  setupVendas();
  setupDespesas();
  setupReportActions();
  setupDashboardInteractions();
  renderAll();
}

boot();
