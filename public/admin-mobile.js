// --- React Checks ---
if (typeof React === 'undefined') {
  document.body.innerHTML = '<div style="padding:20px;text-align:center;color:red"><h3>Error: React Library not loaded.</h3><p>Please check your internet connection or CDN availability.</p></div>';
  throw new Error('React is not defined');
}

const { useState, useEffect, useContext, createContext, useMemo } = React

// --- Helpers ---
function api(path, method, token, body) {
  return fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: token ? 'Bearer ' + token : '' },
    body: body ? JSON.stringify(body) : undefined
  }).then(async r => {
    if (!r.ok) {
      if (r.status === 401 || r.status === 403) {
        window.dispatchEvent(new Event('auth-error'))
      }
      const err = await r.json().catch(() => ({}))
      throw new Error(err.error || 'request_failed')
    }
    return r.json()
  })
}

function currency(n) {
  const v = Number(n || 0)
  return new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Math.round(v)) + ' TZS'
}

function getLocal(k, d) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d }
}
function setLocal(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch {}
}
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// --- Context ---
const AppContext = createContext()

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', { className: 'center-page', style: { flexDirection: 'column', padding: 20, textAlign: 'center' } },
        React.createElement('h2', { style: { color: 'red' } }, 'Something went wrong'),
        React.createElement('pre', { style: { background: '#eee', padding: 10, borderRadius: 8, overflow: 'auto', maxWidth: '100%' } }, String(this.state.error)),
        React.createElement('button', { className: 'primary', style: { marginTop: 20 }, onClick: () => window.location.reload() }, 'Reload App')
      )
    }
    return this.props.children
  }
}

// --- Components ---

function Nav() {
  const { route, navigate } = useContext(AppContext)
  const Item = (key, icon, label) => React.createElement('a', {
    href: '#',
    className: 'nav-item ' + (route === key ? 'active' : ''),
    onClick: e => { e.preventDefault(); navigate(key) }
  },
    React.createElement('div', { className: 'nav-icon' }, icon),
    React.createElement('div', null, label)
  )
  return React.createElement('div', { className: 'bottomnav' },
    Item('home', '⌂', 'Home'),
    Item('shops', '🏬', 'Shops'),
    Item('products', '📦', 'Products'),
    Item('settings', '⚙', 'Settings')
  )
}

function SellerActionsPage() {
  const { navigate, currentProduct, lang } = useContext(AppContext)
  if (!currentProduct) return React.createElement('div', { className: 'center-page' }, React.createElement('div', { className: 'card' }, 'No product'))
  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'row' },
        React.createElement('button', { className: 'icon-btn', onClick: () => navigate('seller-products') }, '←'),
        React.createElement('h3', { style: { margin: 0 } }, currentProduct.name)
      )
    ),
    React.createElement('div', { className: 'center-page' },
      React.createElement('div', { className: 'card', style: { width: '90%', maxWidth: 420 } },
        React.createElement('button', { className: 'primary', onClick: () => navigate('seller-amount'), style: { marginBottom: 12 } }, lang === 'sw' ? 'Idadi uliopokea' : 'Amount Received'),
        React.createElement('button', { className: 'primary', onClick: () => navigate('seller-sell') }, lang === 'sw' ? 'Uuzaji' : 'Sell')
      )
    )
  )
}

function FloatingMenu({ show, onClose }) {
  const { route, navigate, setShopPopup, setShopDeleteOpen, setToken, setRole, setUser, setShopId } = useContext(AppContext)
  if (!show) return null
  
  return React.createElement('div', { className: 'modal-overlay', onClick: onClose },
    React.createElement('div', { className: 'modal-card', style: { position: 'absolute', top: 60, right: 16, width: 250, animation: 'fadeIn 0.2s' }, onClick: e => e.stopPropagation() },
      route === 'home' && React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'list-item', onClick: () => { navigate('sellers'); onClose() } }, 'Add / Remove Seller'),
        React.createElement('div', { className: 'list-item', onClick: () => { navigate('calculate'); onClose() } }, 'Calculate Sales'),
        React.createElement('div', { className: 'list-item', onClick: () => { navigate('help'); onClose() } }, 'Help'),
        React.createElement('div', { className: 'list-item', onClick: () => { setToken(''); setRole(''); setUser(null); setShopId(''); navigate('login'); onClose() } }, 'Log Out')
      ),
      route === 'shops' && React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'list-item', onClick: () => { setShopPopup({ show: true, mode: 'add', shop: null }); onClose() } }, 'Add Shop'),
        React.createElement('div', { className: 'list-item', onClick: () => { setShopDeleteOpen(true); onClose() } }, 'Delete Shop')
      ),
      route === 'products' && React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'list-item', onClick: () => { navigate('products-register'); onClose() } }, 'Register New Product'),
        React.createElement('div', { className: 'list-item', onClick: () => { navigate('products-stock'); onClose() } }, 'Add Stock to Store'),
        React.createElement('div', { className: 'list-item', onClick: () => { navigate('stock-shops'); onClose() } }, 'Add Stock to Shop')
      )
    )
  )
}

function Home() {
  const { dailyPerShop, weeklyPerShop, weeklyTopProducts, weeklyTotals, monthlyTotals, profitDaily, profitWeekly, profitOverview, stockSummary, navigate, toggleMenu } = useContext(AppContext)
  const ov = profitOverview || { weekly_total_formatted: '0 TZS', monthly_total_formatted: '0 TZS', weekly_total: 0, monthly_total: 0 }
  
  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('h3', { style: { margin: 0 } }, 'Dashboard'),
      React.createElement('button', { className: 'icon-btn', onClick: toggleMenu }, '≡')
    ),
    React.createElement('div', { className: 'grid' },
      React.createElement('div', { className: 'card widget-large', onClick: () => navigate('details-profit-daily') },
        React.createElement('h3', null, 'Total Daily Sales'),
        React.createElement('div', { className: 'list' },
          dailyPerShop.map(s => {
            const p = Array.isArray(profitDaily) ? profitDaily.find(x => x.shop_id === s.shop_id) : null
            return React.createElement('div', { className: 'list-item', key: s.shop_id },
              React.createElement('div', null, s.shop_name),
              React.createElement('div', { style: { fontWeight: 'bold' } }, currency(s.grand_total)),
              p ? React.createElement('div', { style: { fontSize: 12, color: 'var(--primary)' } }, 'Profit: ' + (p.profit_formatted || currency(p.profit))) : null
            )
          })
        )
      ),
      React.createElement('div', { className: 'card', onClick: () => navigate('details-profit-weekly') },
        React.createElement('h3', null, 'Weekly Sales'),
        React.createElement('div', { className: 'list' },
          weeklyPerShop.slice(0, 3).map(s => {
            const p = Array.isArray(profitWeekly) ? profitWeekly.find(x => x.shop_id === s.shop_id) : null
            return React.createElement('div', { className: 'list-item', key: s.shop_id },
              React.createElement('div', { style: { fontSize: 13 } }, s.shop_name),
              React.createElement('div', { style: { fontSize: 13 } }, currency(s.grand_total)),
              p ? React.createElement('div', { style: { fontSize: 12, color: 'var(--primary)' } }, 'Profit: ' + (p.profit_formatted || currency(p.profit))) : null
            )
          })
        )
      ),
      React.createElement('div', { className: 'card', onClick: () => navigate('stock-shops') },
        React.createElement('h3', null, 'Stock by Shop'),
        React.createElement('div', { className: 'list' },
          stockSummary.slice(0, 3).map(s => React.createElement('div', { className: 'list-item', key: s.shop_id },
            React.createElement('div', { style: { fontSize: 13 } }, s.shop_name),
            React.createElement('div', { style: { fontSize: 13 } }, 'Stock: ' + String(s.stock_on_hand || 0)),
            React.createElement('div', { style: { fontSize: 12, color: 'var(--muted)' } }, 'Sold: ' + String(s.sold_count || 0))
          ))
        )
      ),
      React.createElement('div', { className: 'card', onClick: () => navigate('details-weekly-top') },
        React.createElement('h3', null, 'Top Products'),
        React.createElement('div', { className: 'list' },
          weeklyTopProducts.slice(0, 3).map(p => React.createElement('div', { className: 'list-item', key: p.product_id },
            React.createElement('div', { style: { fontSize: 13 } }, p.name),
            React.createElement('div', { style: { fontSize: 13 } }, p.total_quantity)
          ))
        )
      ),
      React.createElement('div', { className: 'card', onClick: () => navigate('details-profit-weekly') },
        React.createElement('h4', null, 'Weekly Total'),
        React.createElement('div', { style: { fontSize: 18, fontWeight: 'bold', color: 'var(--primary)' } }, (ov.weekly_total_formatted || currency(ov.weekly_total)))
      ),
      React.createElement('div', { className: 'card', onClick: () => navigate('details-profit-monthly') },
        React.createElement('h4', null, 'Monthly Total'),
        React.createElement('div', { style: { fontSize: 18, fontWeight: 'bold', color: 'var(--primary)' } }, (ov.monthly_total_formatted || currency(ov.monthly_total)))
      )
    )
  )
}

function ShopsPage() {
  const { shops, shopRanking, loadShops, loadShopRanking, toggleMenu, api, token, sellersOptions, shopPopup, setShopPopup, shopDeleteOpen, setShopDeleteOpen } = useContext(AppContext)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', seller_id: '' })
  const [errors, setErrors] = useState({})

  // Update form when popup opens/edit mode
  useEffect(() => {
    if (shopPopup.show && shopPopup.mode === 'edit' && shopPopup.shop) {
      setForm({ name: shopPopup.shop.name, seller_id: '' }) // Seller ID not exposed in shop list usually, but required for edit? Assuming new assignment or keep existing.
    } else if (shopPopup.show && shopPopup.mode === 'add') {
      setForm({ name: '', seller_id: '' })
    }
    setErrors({})
  }, [shopPopup.show, shopPopup.mode, shopPopup.shop])

  async function save(e) {
    e.preventDefault()
    const errs = {}
    if (!form.name) errs.name = 'Name required'
    if (!form.seller_id) errs.seller_id = 'Seller required'
    setErrors(errs)
    if (Object.keys(errs).length) return

    try {
      if (shopPopup.mode === 'add') {
        await api('/shops', 'POST', token, { name: form.name, seller_id: Number(form.seller_id) })
      } else {
        await api('/shops/' + shopPopup.shop.id, 'PUT', token, { name: form.name, seller_id: Number(form.seller_id) })
      }
      setShopPopup({ show: false, mode: 'add', shop: null })
      loadShops()
      loadShopRanking()
    } catch (err) {
      alert('Save failed: ' + err.message)
    }
  }

  async function remove() {
    if (!confirm('Delete shop permanently?')) return
    try {
      await api('/shops/' + shopPopup.shop.id, 'DELETE', token)
      setShopPopup({ show: false, mode: 'add', shop: null })
      loadShops()
      loadShopRanking()
    } catch (err) {
      alert('Cannot delete shop with sales')
    }
  }

  const filtered = shops.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('h3', { style: { margin: 0 } }, 'Shops'),
      React.createElement('div', { className: 'row' },
        React.createElement('button', { className: 'icon-btn', onClick: toggleMenu }, '≡')
      )
    ),
    React.createElement('div', { style: { padding: '0 16px' } },
      React.createElement('input', { placeholder: 'Search shops...', value: search, onChange: e => setSearch(e.target.value) })
    ),
    React.createElement('div', { className: 'grid', style: { padding: 16 } },
      React.createElement('div', { className: 'card' },
        React.createElement('h4', null, 'Registered Shops'),
        React.createElement('div', { className: 'list' },
          filtered.map(s => React.createElement('div', { className: 'list-item', key: s.id, onClick: () => { setShopPopup({ show: true, mode: 'edit', shop: s }); setForm({ name: s.name, seller_id: '' }) } },
            React.createElement('div', null, s.name)
          ))
        )
      ),
      React.createElement('div', { className: 'card' },
        React.createElement('h4', null, 'Sales Ranking'),
        React.createElement('div', { className: 'list' },
          shopRanking.map(r => React.createElement('div', { className: 'list-item', key: r.shop_id },
            React.createElement('div', { style: { fontSize: 13 } }, r.shop_name),
            React.createElement('div', { style: { fontSize: 13, fontWeight: 'bold' } }, currency(r.total_sales))
          ))
        )
      )
    ),
    shopDeleteOpen && React.createElement('div', { className: 'modal-overlay', onClick: () => setShopDeleteOpen(false) },
      React.createElement('div', { className: 'modal-card', onClick: e => e.stopPropagation() },
        React.createElement('h3', null, 'Select Shop to Delete'),
        React.createElement('div', { className: 'list' },
          shops.map(s => React.createElement('div', { className: 'list-item', key: s.id, onClick: () => { setShopPopup({ show: true, mode: 'edit', shop: s }); setShopDeleteOpen(false) } },
            React.createElement('div', null, s.name),
            React.createElement('div', { style: { color: 'red' } }, 'Select')
          ))
        ),
        React.createElement('button', { style: { marginTop: 16 }, onClick: () => setShopDeleteOpen(false) }, 'Cancel')
      )
    ),
    shopPopup.show && React.createElement('div', { className: 'modal-overlay' },
      React.createElement('div', { className: 'modal-card' },
        React.createElement('h3', null, shopPopup.mode === 'add' ? 'Add Shop' : 'Edit Shop'),
        React.createElement('form', { onSubmit: save },
          React.createElement('input', { placeholder: 'Shop Name', value: form.name, onChange: e => setForm({ ...form, name: e.target.value }) }),
          errors.name && React.createElement('div', { className: 'error' }, errors.name),
          React.createElement('select', { value: form.seller_id, onChange: e => setForm({ ...form, seller_id: e.target.value }) },
            React.createElement('option', { value: '' }, 'Select Seller'),
            sellersOptions.map(s => React.createElement('option', { key: s.id, value: s.id }, s.name))
          ),
          errors.seller_id && React.createElement('div', { className: 'error' }, errors.seller_id),
          React.createElement('div', { className: 'row' },
            React.createElement('button', { type: 'submit', className: 'primary' }, 'Save'),
            React.createElement('button', { type: 'button', onClick: () => setShopPopup({ show: false, mode: 'add', shop: null }) }, 'Cancel')
          ),
          shopPopup.mode === 'edit' && React.createElement('button', { type: 'button', style: { marginTop: 12, background: '#ef4444', color: '#fff', border: 'none', padding: 14, borderRadius: 12, width: '100%' }, onClick: remove }, 'Delete Shop')
        )
      )
    )
  )
}

function ProductsPage() {
  const { frequentProducts, bestProducts, toggleMenu } = useContext(AppContext)
  
  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('h3', { style: { margin: 0 } }, 'Products'),
      React.createElement('button', { className: 'icon-btn', onClick: toggleMenu }, '≡')
    ),
    React.createElement('div', { className: 'grid', style: { padding: 16 } },
      React.createElement('div', { className: 'card' },
        React.createElement('h4', null, 'Frequently Sold'),
        React.createElement('div', { className: 'list' },
          frequentProducts.map(p => React.createElement('div', { className: 'list-item', key: p.product_id || p.id },
            React.createElement('div', { style: { fontSize: 13 } }, p.name),
            React.createElement('div', { style: { fontSize: 13 } }, p.total_quantity)
          ))
        )
      ),
      React.createElement('div', { className: 'card' },
        React.createElement('h4', null, 'Best Selling'),
        React.createElement('div', { className: 'list' },
          bestProducts.map(p => React.createElement('div', { className: 'list-item', key: p.product_id || p.id },
            React.createElement('div', { style: { fontSize: 13 } }, p.name),
            React.createElement('div', { style: { fontSize: 13 } }, p.total_quantity)
          ))
        )
      )
    )
  )
}

function ProductsRegisterPage() {
  const { recentProducts, api, token, loadRecentProducts, navigate } = useContext(AppContext)
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ name: '', unit: '', cost_price: '', sell_price: '', initial_stock: '' })
  const [errors, setErrors] = useState({})

  async function save(e) {
    e.preventDefault()
    const errs = {}
    if (!form.name) errs.name = 'Required'
    if (!form.unit) errs.unit = 'Required'
    if (!form.cost_price) errs.cost_price = 'Required'
    if (!form.sell_price) errs.sell_price = 'Required'
    setErrors(errs)
    if (Object.keys(errs).length) return

    try {
      await api('/products/register', 'POST', token, {
        name: form.name,
        unit: form.unit,
        cost_price: Number(form.cost_price),
        sell_price: Number(form.sell_price),
        initial_stock: Number(form.initial_stock || 0)
      })
      setForm({ name: '', unit: '', cost_price: '', sell_price: '', initial_stock: '' })
      setShow(false)
      loadRecentProducts()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete product? This cannot be undone if sales exist.')) return
    try {
      await api('/products/' + id, 'DELETE', token)
      loadRecentProducts()
    } catch (err) {
      alert('Delete failed: ' + (err.message || 'Dependencies exist'))
    }
  }

  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'row' },
        React.createElement('button', { className: 'icon-btn', onClick: () => navigate('products') }, '←'),
        React.createElement('h3', { style: { margin: 0 } }, 'Register Product')
      ),
      React.createElement('button', { className: 'icon-btn', style: { background: 'var(--primary)', color: 'var(--primary-fg)' }, onClick: () => setShow(true) }, '+')
    ),
    React.createElement('div', { style: { padding: 16 } },
      React.createElement('div', { className: 'card' },
        React.createElement('h4', null, 'Recently Registered'),
        React.createElement('div', { className: 'list' },
          recentProducts.slice(0, 10).map(p => React.createElement('div', { className: 'list-item', key: p.id },
            React.createElement('div', null, p.name),
            React.createElement('div', { className: 'row', style: { gap: 10 } },
                React.createElement('div', { style: { fontWeight: 'bold' } }, currency(p.sell_price)),
                React.createElement('button', { style: { background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 12 }, onClick: (e) => { e.stopPropagation(); remove(p.id) } }, 'Del')
            )
          ))
        )
      )
    ),
    show && React.createElement('div', { className: 'modal-overlay' },
      React.createElement('div', { className: 'modal-card' },
        React.createElement('h3', null, 'New Product'),
        React.createElement('form', { onSubmit: save },
          React.createElement('input', { placeholder: 'Product Name', value: form.name, onChange: e => setForm({ ...form, name: e.target.value }) }),
          errors.name && React.createElement('div', { className: 'error' }, errors.name),
          React.createElement('input', { placeholder: 'Count/Unit', value: form.unit, onChange: e => setForm({ ...form, unit: e.target.value }) }),
          errors.unit && React.createElement('div', { className: 'error' }, errors.unit),
          React.createElement('input', { type: 'number', placeholder: 'Initial Store Stock', value: form.initial_stock, onChange: e => setForm({ ...form, initial_stock: e.target.value }) }),
          React.createElement('input', { type: 'number', placeholder: 'Cost Price (TZS)', value: form.cost_price, onChange: e => setForm({ ...form, cost_price: e.target.value }) }),
          errors.cost_price && React.createElement('div', { className: 'error' }, errors.cost_price),
          React.createElement('input', { type: 'number', placeholder: 'Selling Price (TZS)', value: form.sell_price, onChange: e => setForm({ ...form, sell_price: e.target.value }) }),
          errors.sell_price && React.createElement('div', { className: 'error' }, errors.sell_price),
          React.createElement('div', { className: 'row' },
            React.createElement('button', { type: 'submit', className: 'primary' }, 'Save'),
            React.createElement('button', { type: 'button', onClick: () => setShow(false) }, 'Cancel')
          )
        )
      )
    )
  )
}

function ProductsStockPage() {
  const { bestProducts, frequentProducts, recentProducts, loadRecentProducts, api, token, navigate } = useContext(AppContext)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('recent')
  const [popup, setPopup] = useState({ show: false, product: null, current: 0, addQty: '' })

  const source = sort === 'best' ? bestProducts : sort === 'frequent' ? frequentProducts : recentProducts
  const list = source
    .map(p => ({ ...p, id: p.product_id || p.id }))
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'alpha' ? a.name.localeCompare(b.name) : 0)

  function open(p) {
    const fullP = recentProducts.find(x => x.id === (p.product_id || p.id)) || p
    setPopup({ show: true, product: fullP, current: fullP.total_stock || 0, addQty: '' })
  }

  async function save(e) {
    e.preventDefault()
    const qty = Number(popup.addQty)
    if (!qty || qty <= 0) return
    try {
      await api(`/products/${popup.product.id}/add-stock`, 'POST', token, { quantity: qty })
      alert('Store stock updated!')
      setPopup({ show: false, product: null, current: 0, addQty: '' })
      loadRecentProducts()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'row' },
        React.createElement('button', { className: 'icon-btn', onClick: () => navigate('products') }, '←'),
        React.createElement('h3', { style: { margin: 0 } }, 'Restock Store')
      )
    ),
    React.createElement('div', { style: { padding: '0 16px' } },
      React.createElement('div', { className: 'row', style: { marginBottom: 16 } },
        React.createElement('input', { style: { marginBottom: 0 }, placeholder: 'Search products...', value: search, onChange: e => setSearch(e.target.value) }),
        React.createElement('select', { style: { marginBottom: 0, width: 140 }, value: sort, onChange: e => setSort(e.target.value) },
          React.createElement('option', { value: 'recent' }, 'Recent'),
          React.createElement('option', { value: 'best' }, 'Best'),
          React.createElement('option', { value: 'frequent' }, 'Freq'),
          React.createElement('option', { value: 'alpha' }, 'A-Z')
        )
      ),
      React.createElement('div', { className: 'list' },
        list.map(p => React.createElement('div', { className: 'card list-item', style: { margin: 0 }, key: p.id, onClick: () => open(p) },
          React.createElement('div', null, p.name),
          React.createElement('div', null, 
            React.createElement('span', { style: { color: 'var(--muted)', fontSize: 12, marginRight: 8 } }, 'Store:'),
            React.createElement('strong', null, p.total_stock || 0)
          )
        ))
      )
    ),
    popup.show && React.createElement('div', { className: 'modal-overlay' },
      React.createElement('div', { className: 'modal-card' },
        React.createElement('h3', { style: { fontSize: 24, fontWeight: 800, textAlign: 'center' } }, popup.product.name),
        React.createElement('div', { style: { textAlign: 'center', marginBottom: 16, color: 'var(--muted)' } }, 'Current Store Stock: ' + popup.current),
        React.createElement('form', { onSubmit: save },
          React.createElement('input', { type: 'number', placeholder: 'Quantity to Add', value: popup.addQty, onChange: e => setPopup({ ...popup, addQty: e.target.value }) }),
          React.createElement('div', { className: 'row' },
            React.createElement('button', { type: 'submit', className: 'primary' }, 'Save'),
            React.createElement('button', { type: 'button', onClick: () => setPopup({ show: false, product: null, current: 0, addQty: '' }) }, 'Cancel')
          )
        )
      )
    )
  )
}

function SellersPage() {
  const { sellers, ranking, loadSellers, loadRanking, navigate, api, token, shops } = useContext(AppContext)
  const [search, setSearch] = useState('')
  const [popup, setPopup] = useState({ show: false, mode: 'add', seller: null })
  const [form, setForm] = useState({ name: '', contact: '', shop_id: '', password: '' })
  const [pwVisible, setPwVisible] = useState(false)
  const [errors, setErrors] = useState({})
  const shopList = Array.isArray(shops) ? shops : []

  useEffect(() => {
    if (popup.show && popup.seller) {
      setForm({
        name: popup.seller.name,
        contact: popup.seller.email,
        shop_id: String(popup.seller.shop_id),
        password: '' // Don't show existing hash
      })
    } else {
      setForm({ name: '', contact: '', shop_id: '', password: '' })
    }
    setErrors({})
    setPwVisible(false)
  }, [popup.show, popup.seller])

  async function save(e) {
    e.preventDefault()
    const errs = {}
    if (!form.name) errs.name = 'Required'
    if (!form.contact) errs.contact = 'Required'
    // if (!form.shop_id) errs.shop_id = 'Required' // Made optional
    if (!form.password) errs.password = 'Required'
    if (form.password && !/^\d{4}$/.test(form.password)) errs.password = 'Must be 4 digits'
    setErrors(errs)
    if (Object.keys(errs).length) return

    try {
      const payload = { ...form, shop_id: form.shop_id ? Number(form.shop_id) : null }
      if (popup.mode === 'add') {
        await api('/sellers', 'POST', token, payload)
      } else {
        await api('/sellers/' + popup.seller.id, 'PUT', token, payload)
      }
      setPopup({ show: false, mode: 'add', seller: null })
      loadSellers()
      loadRanking()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete seller?')) return
    try {
      await api('/sellers/' + id, 'DELETE', token)
      loadSellers()
      loadRanking()
    } catch (err) { alert('Cannot delete') }
  }

  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'row' },
        React.createElement('button', { className: 'icon-btn', onClick: () => navigate('home') }, '←'),
        React.createElement('h3', { style: { margin: 0 } }, 'Sellers')
      ),
      React.createElement('button', { className: 'primary', style: { width: 'auto', padding: '8px 16px' }, onClick: () => setPopup({ show: true, mode: 'add', seller: null }) }, 'Add')
    ),
    React.createElement('div', { style: { padding: 16 } },
      React.createElement('input', { placeholder: 'Search...', value: search, onChange: e => setSearch(e.target.value) }),
      React.createElement('div', { className: 'grid' },
        React.createElement('div', { className: 'card' },
          React.createElement('h4', null, 'Sellers'),
          React.createElement('div', { className: 'list' },
            (Array.isArray(sellers) ? sellers : []).filter(s => s.name.toLowerCase().includes(search.toLowerCase())).map(s => React.createElement('div', { className: 'list-item', key: s.id },
              React.createElement('div', null, s.name),
              React.createElement('div', { className: 'row' },
                React.createElement('button', { style: { padding: '4px 8px', fontSize: 12 }, onClick: () => setPopup({ show: true, mode: 'edit', seller: s }) }, 'Edit'),
                React.createElement('button', { style: { padding: '4px 8px', fontSize: 12, background: '#ef4444', color: '#fff' }, onClick: () => remove(s.id) }, 'Del')
              )
            ))
          )
        ),
        React.createElement('div', { className: 'card' },
          React.createElement('h4', null, 'Ranking'),
          React.createElement('div', { className: 'list' },
            ranking.map(r => React.createElement('div', { className: 'list-item', key: r.seller_id },
              React.createElement('div', null, r.seller_name),
              React.createElement('div', { style: { fontWeight: 'bold' } }, currency(r.total_sales))
            ))
          )
        )
      )
    ),
    popup.show && React.createElement('div', { className: 'modal-overlay' },
      React.createElement('div', { className: 'modal-card' },
        React.createElement('h3', null, popup.mode === 'add' ? 'Add Seller' : 'Edit Seller'),
        React.createElement('form', { onSubmit: save },
          React.createElement('input', { placeholder: 'Name', value: form.name, onChange: e => setForm({ ...form, name: e.target.value }) }),
          errors.name && React.createElement('div', { className: 'error' }, errors.name),
          React.createElement('input', { placeholder: 'Contact', value: form.contact, onChange: e => setForm({ ...form, contact: e.target.value }) }),
          errors.contact && React.createElement('div', { className: 'error' }, errors.contact),
          React.createElement('select', { value: form.shop_id, onChange: e => setForm({ ...form, shop_id: e.target.value }) },
            React.createElement('option', { value: '' }, 'Select Shop (Optional)'),
            shopList.map(s => React.createElement('option', { key: s.id, value: s.id }, s.name))
          ),
          // errors.shop_id && React.createElement('div', { className: 'error' }, errors.shop_id), // Removed validation
          React.createElement('div', { className: 'password-field' },
            React.createElement('input', { type: pwVisible ? 'text' : 'password', placeholder: popup.mode === 'edit' ? 'Password (Unchanged)' : '4-digit PIN', value: form.password, onChange: e => setForm({ ...form, password: e.target.value }) }),
            React.createElement('button', { type: 'button', className: 'password-toggle', onClick: () => setPwVisible(!pwVisible) }, pwVisible ? '👁' : '🔒')
          ),
          popup.mode === 'edit' && React.createElement('div', { style: { fontSize: 11, color: 'gray', marginTop: -8, marginBottom: 8 } }, 'Leave blank to keep current password'),
          errors.password && React.createElement('div', { className: 'error' }, errors.password),
          React.createElement('div', { className: 'row' },
            React.createElement('button', { type: 'submit', className: 'primary' }, 'Save'),
            React.createElement('button', { type: 'button', onClick: () => setPopup({ show: false, mode: 'add', seller: null }) }, 'Cancel')
          )
        )
      )
    )
  )
}

function SettingsPage() {
  const { theme, setTheme, navigate, shopId, setShopId, setToken } = useContext(AppContext)
  
  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('h3', { style: { margin: 0 } }, 'Settings')
    ),
    React.createElement('div', { style: { padding: 16 } },
      React.createElement('div', { className: 'card' },
        React.createElement('h4', null, 'Appearance'),
        React.createElement('div', { className: 'row' },
          React.createElement('button', { className: theme === 'light' ? 'primary' : '', onClick: () => setTheme('light') }, 'Light'),
          React.createElement('button', { className: theme === 'dark' ? 'primary' : '', onClick: () => setTheme('dark') }, 'Dark')
        )
      ),
      React.createElement('div', { className: 'card' },
        React.createElement('h4', null, 'Configuration'),
        React.createElement('input', { placeholder: 'Shop ID Filter', value: shopId, onChange: e => setShopId(e.target.value) })
      ),
      React.createElement('button', { className: 'primary', onClick: () => {
        // Login demo
        fetch('/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:'admin@example.com',password:'secret'}) })
          .then(r => r.json()).then(d => setToken(d.token))
      } }, 'Login (Demo)')
    )
  )
}

function HelpPage() {
  const { navigate } = useContext(AppContext)
  return React.createElement('div', { className: 'center-page' },
    React.createElement('div', { className: 'card', style: { width: '90%', maxWidth: 400 } },
      React.createElement('div', { className: 'row', style: { marginBottom: 16 } },
        React.createElement('button', { className: 'icon-btn', onClick: () => navigate('home') }, '←'),
        React.createElement('h3', { style: { margin: 0 } }, 'Help Center')
      ),
      React.createElement('div', { className: 'list' },
        React.createElement('div', { className: 'list-item' }, React.createElement('span', null, 'WhatsApp'), React.createElement('span', { style: { fontWeight: 'bold' } }, '+255 657 157 770')),
        React.createElement('div', { className: 'list-item' }, React.createElement('span', null, 'Email'), React.createElement('span', { style: { fontWeight: 'bold' } }, 'zinedinejonas@gmail.com')),
        React.createElement('div', { className: 'list-item' }, React.createElement('span', null, 'Call'), React.createElement('span', { style: { fontWeight: 'bold' } }, '+255 761 685 991'))
      )
    )
  )
}

function CalculatePage() {
  const { weeklyTotals, monthlyTotals, navigate } = useContext(AppContext)
  const [result, setResult] = useState(null)
  const weeks = weeklyTotals.map(w => String(w.period))
  const months = monthlyTotals.map(m => String(m.period))
  
  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'row' },
        React.createElement('button', { className: 'icon-btn', onClick: () => navigate('home') }, '←'),
        React.createElement('h3', { style: { margin: 0 } }, 'Calculator')
      )
    ),
    React.createElement('div', { style: { padding: 16 } },
      React.createElement('div', { className: 'card' },
        React.createElement('h4', null, 'Add Weeks'),
        React.createElement('div', { className: 'row' },
          React.createElement('select', { id: 'w1' }, weeks.map(w => React.createElement('option', { key: w, value: w }, new Date(w).toLocaleDateString()))),
          React.createElement('span', null, '+'),
          React.createElement('select', { id: 'w2' }, weeks.map(w => React.createElement('option', { key: w, value: w }, new Date(w).toLocaleDateString())))
        ),
        React.createElement('button', { className: 'primary', style: { marginTop: 8 }, onClick: () => {
           const a = weeklyTotals.find(x => String(x.period) === document.getElementById('w1').value)
           const b = weeklyTotals.find(x => String(x.period) === document.getElementById('w2').value)
           setResult((Number(a?.grand_total)||0) + (Number(b?.grand_total)||0))
        } }, 'Calculate')
      ),
      result !== null && React.createElement('div', { className: 'card', style: { background: 'var(--primary)', color: '#fff', textAlign: 'center', fontSize: 24 } }, currency(result))
    )
  )
}

function DetailsPage({ title, data, mapFn }) {
  const { navigate } = useContext(AppContext)
  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'row' },
        React.createElement('button', { className: 'icon-btn', onClick: () => navigate('home') }, '←'),
        React.createElement('h3', { style: { margin: 0 } }, title)
      )
    ),
    React.createElement('div', { style: { padding: 16 } },
      React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'list' },
          data.map(mapFn)
        )
      )
    )
  )
}

function SellerProductsPage() {
  const { api, token, navigate, lang, setToken, setRole, setUser, setShopId, user, shopId, syncOffline } = useContext(AppContext)
  const [search, setSearch] = useState('')
  const [list, setList] = useState([])
  const [detailsPopup, setDetailsPopup] = useState({ show: false, product: null, info: null })
  const [sellPopup, setSellPopup] = useState({ show: false, product: null, price: '', useAdminPrice: true })
  
  const myShopId = Number(shopId || user?.shop_id || 0)

  useEffect(() => {
    let mounted = true
    if (!myShopId) return
    api(`/stock/shops/${myShopId}/products`, 'GET', token).then(res => { if (mounted) setList(Array.isArray(res) ? res : []) }).catch(() => setList([]))
    return () => { mounted = false }
  }, [token, myShopId])

  const filtered = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  async function handleSync() {
    if (syncOffline) {
      await syncOffline()
      alert('Sync completed')
    }
  }

  async function openDetails(p) {
    try {
      const res = await api(`/stock/shops/${myShopId}/products/${p.id}`, 'GET', token)
      const offline = getLocal('offline_sales', []).filter(s => s.shop_id === myShopId && s.product_id === p.id && !s.synced)
      const offlineSold = offline.reduce((a, b) => a + Number(b.quantity), 0)
      const info = {
        ...res,
        on_hand: Math.max(0, (Number(res.on_hand) || 0) - offlineSold),
        sold_count: (Number(res.sold_count) || 0) + offlineSold
      }
      setDetailsPopup({ show: true, product: p, info })
    } catch {
      alert('Failed to load details')
    }
  }

  function openSell(p) {
    setSellPopup({ show: true, product: p, price: p.sell_price, useAdminPrice: true })
  }

  async function saveSale(e) {
    e.preventDefault()
    const p = sellPopup.product
    const price = Number(sellPopup.price)
    if (!price || price <= 0) return

    const sale = {
      id: uid(),
      shop_id: myShopId,
      product_id: p.id,
      quantity: 1,
      discount_price: price,
      client_created_at: new Date().toISOString(),
      synced: false
    }
    
    const currentSales = getLocal('offline_sales', [])
    setLocal('offline_sales', [...currentSales, sale])
    
    setSellPopup({ show: false, product: null, price: '', useAdminPrice: true })
    alert('Sale recorded!')
    
    if (navigator.onLine) {
      window.dispatchEvent(new Event('online'))
    }
  }

  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('h3', { style: { margin: 0 } }, lang === 'sw' ? 'Bidhaa' : 'Products'),
      React.createElement('div', { className: 'row', style: { display: 'flex', gap: 12, alignItems: 'center', whiteSpace: 'nowrap' } },
        React.createElement('button', { style: { background: 'var(--primary)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, padding: '6px 10px' }, onClick: handleSync }, lang === 'sw' ? 'Sawazisha' : 'Sync'),
        React.createElement('button', { style: { background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 16, padding: '6px 10px' }, onClick: () => navigate('seller-settings') }, lang === 'sw' ? 'Mipangilio - setting' : 'Settings'),
        React.createElement('button', { style: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '6px 10px' }, onClick: () => { setToken(''); setRole(''); setUser(null); setShopId(''); navigate('login') } }, 'Log Out')
      )
    ),
    React.createElement('div', { style: { padding: '0 16px' } },
      React.createElement('input', { placeholder: lang === 'sw' ? 'Tafuta...' : 'Search...', value: search, onChange: e => setSearch(e.target.value) })
    ),
    React.createElement('div', { className: 'list', style: { padding: 16 } },
      filtered.map(p => React.createElement('div', { className: 'card list-item', style: { margin: 0, alignItems: 'center' }, key: p.id },
        React.createElement('div', { style: { flex: 1 } },
          React.createElement('div', { style: { fontWeight: 'bold' } }, p.name),
          React.createElement('div', { style: { fontSize: 12, color: 'var(--muted)' } }, currency(p.sell_price))
        ),
        React.createElement('div', { className: 'row', style: { gap: 16 } },
          React.createElement('div', { style: { textAlign: 'center', cursor: 'pointer' }, onClick: () => openDetails(p) },
            React.createElement('div', { style: { fontSize: 20 } }, 'ℹ️'),
            React.createElement('div', { style: { fontSize: 10 } }, 'Details')
          ),
          React.createElement('div', { style: { textAlign: 'center', cursor: 'pointer' }, onClick: () => openSell(p) },
            React.createElement('div', { style: { fontSize: 20 } }, '🛒'),
            React.createElement('div', { style: { fontSize: 10 } }, 'Sell')
          )
        )
      ))
    ),
    detailsPopup.show && React.createElement('div', { className: 'modal-overlay', onClick: () => setDetailsPopup({ show: false, product: null, info: null }) },
      React.createElement('div', { className: 'modal-card', onClick: e => e.stopPropagation() },
        React.createElement('h3', null, detailsPopup.product.name),
        React.createElement('div', { className: 'list' },
          React.createElement('div', { className: 'list-item' },
            React.createElement('span', null, 'Current Stock'),
            React.createElement('span', { style: { fontWeight: 'bold' } }, detailsPopup.info ? detailsPopup.info.on_hand : '...')
          ),
          React.createElement('div', { className: 'list-item' },
            React.createElement('span', null, 'Sold Count'),
            React.createElement('span', { style: { fontWeight: 'bold' } }, detailsPopup.info ? detailsPopup.info.sold_count : '...')
          )
        ),
        React.createElement('button', { style: { marginTop: 16, width: '100%' }, onClick: () => setDetailsPopup({ show: false, product: null, info: null }) }, 'Close')
      )
    ),
    sellPopup.show && React.createElement('div', { className: 'modal-overlay' },
      React.createElement('div', { className: 'modal-card' },
        React.createElement('h3', null, 'Sell: ' + sellPopup.product.name),
        React.createElement('form', { onSubmit: saveSale },
          React.createElement('div', { style: { marginBottom: 12 } },
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              React.createElement('input', { type: 'checkbox', checked: sellPopup.useAdminPrice, onChange: e => setSellPopup({ ...sellPopup, useAdminPrice: e.target.checked, price: e.target.checked ? sellPopup.product.sell_price : sellPopup.price }) }),
              React.createElement('span', null, 'Use Admin Price (' + currency(sellPopup.product.sell_price) + ')')
            )
          ),
          !sellPopup.useAdminPrice && React.createElement('input', { type: 'number', placeholder: 'Enter Custom Price', value: sellPopup.price, onChange: e => setSellPopup({ ...sellPopup, price: e.target.value }) }),
          React.createElement('div', { className: 'row' },
            React.createElement('button', { type: 'submit', className: 'primary' }, 'Confirm Sale'),
            React.createElement('button', { type: 'button', onClick: () => setSellPopup({ show: false, product: null, price: '', useAdminPrice: true }) }, 'Cancel')
          )
        )
      )
    )
  )
}

function SellerSettingsPage() {
  const { theme, setTheme, lang, setLang, navigate, setToken, setRole, setUser, setShopId } = useContext(AppContext)
  return React.createElement('div', { className: 'center-page' },
    React.createElement('div', { className: 'card', style: { width: '90%', maxWidth: 420 } },
      React.createElement('div', { className: 'row', style: { marginBottom: 12 } },
        React.createElement('button', { className: 'icon-btn', onClick: () => navigate('seller-products') }, '←'),
        React.createElement('h3', { style: { margin: 0 } }, lang === 'sw' ? 'Mipangilio - setting' : 'Settings')
      ),
      React.createElement('div', { className: 'list' },
        React.createElement('div', { className: 'list-item' },
          React.createElement('span', null, lang === 'sw' ? 'Mwanga' : 'Light/Dark'),
          React.createElement('select', { value: theme, onChange: e => setTheme(e.target.value) },
            React.createElement('option', { value: 'light' }, lang === 'sw' ? 'Mwanga' : 'Light'),
            React.createElement('option', { value: 'dark' }, lang === 'sw' ? 'Giza' : 'Dark')
          )
        ),
        React.createElement('div', { className: 'list-item' },
          React.createElement('span', null, lang === 'sw' ? 'Lugha' : 'Language'),
          React.createElement('select', { value: lang, onChange: e => setLang(e.target.value) },
            React.createElement('option', { value: 'sw' }, 'Swahili'),
            React.createElement('option', { value: 'en' }, 'English')
          )
        ),
        React.createElement('div', { className: 'list-item', onClick: () => { setToken(''); setRole(''); setUser(null); setShopId(''); navigate('login') } },
          React.createElement('span', null, 'Log Out'))
      )
    )
  )
}

function SellerAmountPage() {
  const { api, token, navigate, currentProduct, user, shopId, lang } = useContext(AppContext)
  const [summary, setSummary] = useState({ total_on_hand: 0, shops: [] })
  const [qty, setQty] = useState('')
  const myShopId = Number(shopId || user?.shop_id || 0)
  useEffect(() => {
    if (!currentProduct) return
    api(`/stock/products/${currentProduct.id}/summary`, 'GET', token).then(r => setSummary(r)).catch(() => setSummary({ total_on_hand: 0, shops: [] }))
  }, [currentProduct, token])
  const save = async (e) => {
    e.preventDefault()
    const v = Number(qty)
    if (!v || v <= 0 || !myShopId || !currentProduct) return
    if (navigator.onLine) {
      try {
        await api(`/stock/shops/${myShopId}/products/${currentProduct.id}/add`, 'POST', token, { quantity: v })
        navigate('seller-products')
      } catch {}
    } else {
      const q = getLocal('offline_stock', [])
      q.push({ client_id: uid(), shop_id: myShopId, product_id: currentProduct.id, quantity: v, synced: false, client_created_at: new Date().toISOString() })
      setLocal('offline_stock', q)
      navigate('seller-products')
    }
  }
  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'row' },
        React.createElement('button', { className: 'icon-btn', onClick: () => navigate('seller-products') }, '←'),
        React.createElement('h3', { style: { margin: 0 } }, lang === 'sw' ? 'Idadi uliopokea' : 'Amount Received')
      )
    ),
    React.createElement('div', { style: { padding: 16 } },
      React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'list' },
          React.createElement('div', { className: 'list-item' }, React.createElement('span', null, lang === 'sw' ? 'Jumla' : 'Total'), React.createElement('span', null, String(summary.total_on_hand))),
          summary.shops.map(s => React.createElement('div', { className: 'list-item', key: s.shop_id },
            React.createElement('div', null, s.shop_name),
            React.createElement('div', null, String(s.on_hand))
          ))
        )
      ),
      React.createElement('form', { onSubmit: save },
        React.createElement('div', { className: 'card' },
          React.createElement('h4', null, lang === 'sw' ? 'Ongezea duka langu' : 'Add to my shop'),
          React.createElement('input', { placeholder: lang === 'sw' ? 'Kiasi' : 'Quantity', value: qty, onChange: e => setQty(e.target.value) }),
          React.createElement('button', { type: 'submit', className: 'primary' }, lang === 'sw' ? 'Hifadhi' : 'Save')
        )
      )
    )
  )
}

function SellerSellPage() {
  const { api, token, navigate, currentProduct, user, shopId, lang } = useContext(AppContext)
  const myShopId = Number(shopId || user?.shop_id || 0)
  const [qty, setQty] = useState('')
  const [useDefault, setUseDefault] = useState(true)
  const [price, setPrice] = useState(() => currentProduct ? Number(currentProduct.sell_price || 0) : 0)
  useEffect(() => {
    if (currentProduct) setPrice(Number(currentProduct.sell_price || 0))
  }, [currentProduct])
  const save = async (e) => {
    e.preventDefault()
    const v = Number(qty)
    if (!v || v <= 0 || !myShopId || !currentProduct) return
    const sale = { id: uid(), shop_id: myShopId, product_id: currentProduct.id, quantity: v, discount_price: useDefault ? null : Number(price), synced: false, client_created_at: new Date().toISOString() }
    const arr = getLocal('offline_sales', [])
    arr.push(sale)
    setLocal('offline_sales', arr)
    if (navigator.onLine) {
      try {
        await api('/sales/sync', 'POST', token, { sales: [{
          client_id: sale.id,
          shop_id: sale.shop_id,
          client_created_at: sale.client_created_at,
          items: [{ product_id: sale.product_id, quantity: sale.quantity, discount_price: sale.discount_price }]
        }] })
      } catch {}
    }
    navigate('seller-products')
  }
  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'row' },
        React.createElement('button', { className: 'icon-btn', onClick: () => navigate('seller-products') }, '←'),
        React.createElement('h3', { style: { margin: 0 } }, lang === 'sw' ? 'Uuzaji' : 'Sell')
      )
    ),
    currentProduct && React.createElement('div', { style: { padding: 16 } },
      React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'list-item' }, React.createElement('span', null, currentProduct.name), React.createElement('span', { style: { fontWeight: 'bold' } }, currency(currentProduct.sell_price))
      )),
      React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'list-item' },
          React.createElement('span', null, lang === 'sw' ? 'Bei ya kawaida' : 'Default price'),
          React.createElement('input', { type: 'checkbox', checked: useDefault, onChange: e => setUseDefault(e.target.checked) })
        ),
        !useDefault && React.createElement('div', { className: 'list-item' },
          React.createElement('span', null, lang === 'sw' ? 'Bei' : 'Price'),
          React.createElement('input', { type: 'number', value: price, onChange: e => setPrice(e.target.value) })
        ),
        React.createElement('div', { className: 'list-item' },
          React.createElement('span', null, lang === 'sw' ? 'Kiasi' : 'Quantity'),
          React.createElement('input', { type: 'number', value: qty, onChange: e => setQty(e.target.value) })
        ),
        React.createElement('button', { className: 'primary', onClick: save }, lang === 'sw' ? 'Uza' : 'Save')
      )
    )
  )
}

// --- Main App ---

function StockByShopPage() {
  const { stockSummary, navigate } = useContext(AppContext)
  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'row' },
        React.createElement('button', { className: 'icon-btn', onClick: () => navigate('home') }, '←'),
        React.createElement('h3', { style: { margin: 0 } }, 'Stock by Shop')
      )
    ),
    React.createElement('div', { style: { padding: 16 } },
      React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'list' },
          stockSummary.map(s => React.createElement('div', { className: 'list-item', key: s.shop_id, onClick: () => navigate('shop-details/' + s.shop_id) },
            React.createElement('div', null, s.shop_name),
            React.createElement('div', null, 'Stock: ' + (s.stock_on_hand || 0))
          ))
        )
      )
    )
  )
}

function ShopDetailsPage({ id }) {
  const { api, token, navigate } = useContext(AppContext)
  const [shop, setShop] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [popup, setPopup] = useState({ show: false, product: null, qty: '' })
  const [stockSearch, setStockSearch] = useState('')
  const [stockFilter, setStockFilter] = useState('recent')

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    try {
      setLoading(true)
      // Get shop name
      const shops = await api('/shops', 'GET', token)
      const s = shops.find(x => x.id === Number(id))
      setShop(s)

      // Get all products and their stock in this shop
      const allProds = await api(`/stock/shops/${id}/products`, 'GET', token)
      // Check if allProds is actually an array
      if (!Array.isArray(allProds)) {
        console.error('Expected array of products, got:', allProds)
        setProducts([])
        // Only alert if it's a real error (not just empty)
        if (allProds.error) throw new Error(allProds.error)
      } else {
        setProducts(allProds)
      }
    } catch (e) {
      console.error('ShopDetailsPage Load Error:', e)
      // Display a more friendly message in the UI instead of a popup
    } finally {
      setLoading(false)
    }
  }

  async function saveStock(e) {
    e.preventDefault()
    const qty = Number(popup.qty)
    if (!qty || qty <= 0) return
    
    // Validate against Main Store stock
    const max = Number(popup.product.total_stock || 0)
    if (qty > max) {
      alert('Cannot add more than available in Main Store (' + max + ')')
      return
    }

    try {
      await api(`/stock/shops/${id}/products/${popup.product.id}/add`, 'POST', token, { quantity: qty })
      setPopup({ show: false, product: null, qty: '' })
      // alert('Stock added!') // Removed as per request to reduce popups
      load() // Reload to show updated stock
    } catch (e) {
      console.error('Save Stock Error:', e)
      alert(e.message || 'Failed to add stock')
    }
  }

  if (loading) return React.createElement('div', { className: 'center-page' }, 'Loading...')
  if (!shop) return React.createElement('div', { className: 'center-page' }, 'Shop not found')

  // Calculate total items in stock for this shop
  const totalShopStock = products.reduce((sum, p) => sum + (Number(p.on_hand) || 0), 0)

  const filteredProducts = products
    .filter(p => !stockSearch || p.name.toLowerCase().includes(stockSearch.toLowerCase()))
    .sort((a, b) => {
      if (stockFilter === 'price_high') return Number(b.sell_price) - Number(a.sell_price)
      if (stockFilter === 'price_low') return Number(a.sell_price) - Number(b.sell_price)
      if (stockFilter === 'name') return a.name.localeCompare(b.name)
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })

  return React.createElement('div', null,
    React.createElement('div', { className: 'topbar' },
    React.createElement('div', { className: 'row' },
        React.createElement('button', { className: 'icon-btn', onClick: () => navigate('stock-shops') }, '←'),
        React.createElement('h3', { style: { margin: 0 } }, shop.name)
      )
    ),
    React.createElement('div', { style: { padding: 16 } },
      React.createElement('div', { className: 'card' },
        React.createElement('h4', null, 'Shop Summary'),
        React.createElement('div', { className: 'list-item' },
          React.createElement('span', null, 'Total Items in Stock'),
          React.createElement('span', { style: { fontWeight: 'bold', fontSize: 18 } }, totalShopStock)
        )
      ),
      React.createElement('div', { className: 'card' },
        React.createElement('h4', null, 'Add Stock to Shop'),
        React.createElement('div', { className: 'row', style: { marginBottom: 12, gap: 8 } },
            React.createElement('input', { placeholder: 'Search products...', value: stockSearch, onChange: e => setStockSearch(e.target.value), style: { marginBottom: 0, flex: 1 } }),
            React.createElement('select', { value: stockFilter, onChange: e => setStockFilter(e.target.value), style: { marginBottom: 0, width: 100 } },
                React.createElement('option', { value: 'recent' }, 'Recent'),
                React.createElement('option', { value: 'price_high' }, 'Price ↓'),
                React.createElement('option', { value: 'price_low' }, 'Price ↑'),
                React.createElement('option', { value: 'name' }, 'Name')
            )
        ),
        React.createElement('div', { className: 'list' },
          filteredProducts.map(p => React.createElement('div', { className: 'list-item', key: p.id, onClick: () => setPopup({ show: true, product: p, qty: '' }) },
            React.createElement('div', null, p.name),
            React.createElement('div', { className: 'row', style: { gap: 10 } },
               React.createElement('div', { style: { fontSize: 12 } }, 'Shop: ' + (p.on_hand || 0)),
               React.createElement('div', { style: { fontSize: 12, color: 'gray' } }, 'Store: ' + (p.total_stock || 0)),
               React.createElement('div', { style: { color: 'var(--primary)', fontWeight: 'bold' } }, '+ Add')
            )
          ))
        )
      )
    ),
    popup.show && React.createElement('div', { className: 'modal-overlay' },
      React.createElement('div', { className: 'modal-card' },
        React.createElement('h3', null, 'Add Stock: ' + popup.product.name),
        React.createElement('p', null, 'Adding to ' + shop.name),
        React.createElement('p', { style: { fontSize: 12, color: 'gray' } }, 'Available in Main Store: ' + (popup.product.total_stock || 0)),
        React.createElement('form', { onSubmit: saveStock },
          React.createElement('input', { type: 'number', placeholder: 'Quantity', value: popup.qty, onChange: e => setPopup({ ...popup, qty: e.target.value }) }),
          React.createElement('div', { className: 'row' },
            React.createElement('button', { type: 'submit', className: 'primary' }, 'Save'),
            React.createElement('button', { type: 'button', onClick: () => setPopup({ show: false, product: null, qty: '' }) }, 'Cancel')
          )
        )
      )
    )
  )
}

function App() {
  const [token, setToken] = useState('')
  const [role, setRole] = useState('')
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState('light')
  const [route, setRoute] = useState('login')
  const [menuOpen, setMenuOpen] = useState(false)
  const [shopId, setShopId] = useState('')
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'sw')
  const [currentProduct, setCurrentProduct] = useState(null)

  // Force login on initial load
  useEffect(() => {
    const hash = window.location.hash.substring(1)
    if (!token && hash !== 'login') {
       window.history.replaceState(null, '', '#login')
       setRoute('login')
    }
  }, []) // Run once on mount

  // Data State
  const [dailyPerShop, setDailyPerShop] = useState([])
  const [weeklyPerShop, setWeeklyPerShop] = useState([])
  const [weeklyTopProducts, setWeeklyTopProducts] = useState([])
  const [weeklyTotals, setWeeklyTotals] = useState([])
  const [monthlyTotals, setMonthlyTotals] = useState([])
  const [profitDaily, setProfitDaily] = useState([])
  const [profitWeekly, setProfitWeekly] = useState([])
  const [profitMonthly, setProfitMonthly] = useState([])
  const [profitOverview, setProfitOverview] = useState({ daily_per_shop: [], weekly_total: 0, monthly_total: 0, weekly_total_formatted: '0 TZS', monthly_total_formatted: '0 TZS' })
  const [stockSummary, setStockSummary] = useState([])
  const [sellers, setSellers] = useState([])
  const [ranking, setRanking] = useState([])
  const [shops, setShops] = useState([])
  const [shopRanking, setShopRanking] = useState([])
  const [sellersOptions, setSellersOptions] = useState([])
  const [recentProducts, setRecentProducts] = useState([])
  const [bestProducts, setBestProducts] = useState([])
  const [frequentProducts, setFrequentProducts] = useState([])
  
  // Shared Popup State
  const [shopPopup, setShopPopup] = useState({ show: false, mode: 'add', shop: null })
  const [shopDeleteOpen, setShopDeleteOpen] = useState(false)
  
  // Login State
  const [loginMode, setLoginMode] = useState('admin')
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [sellerForm, setSellerForm] = useState({ name: '', passkey: '', show: false })
  const [loginError, setLoginError] = useState('')

  // Persist Token
  useEffect(() => {
    if (token) localStorage.setItem('token', token)
    else localStorage.removeItem('token')
  }, [token])
  useEffect(() => {
    if (role) localStorage.setItem('role', role); else localStorage.removeItem('role')
  }, [role])
  useEffect(() => {
    setLocal('user', user)
  }, [user])
  useEffect(() => {
    localStorage.setItem('lang', lang)
  }, [lang])

  // Navigation & Auth Guard
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1)
      if (!token && hash !== 'login') {
        window.history.replaceState(null, '', '#login')
        setRoute('login')
      } else {
        setRoute(hash || 'login')
      }
    }

    if (!token && route !== 'login') {
      window.history.replaceState(null, '', '#login')
      setRoute('login')
    }

    window.addEventListener('popstate', handleHashChange)
    return () => window.removeEventListener('popstate', handleHashChange)
  }, [token, route])

  function navigate(key) {
    window.history.pushState(null, '', '#' + key)
    setRoute(key)
  }

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Data Loading
  useEffect(() => {
    if (!token) return
    if (role !== 'seller') { loadHomeData(); loadProfitData(); loadStockSummary() }
    if (route === 'sellers') { loadSellers(); loadRanking(); loadShops(); }
    if (route === 'shops') { loadShops(); loadShopRanking(); loadSellersOptions(); }
    if (route === 'products' || route === 'products-register' || route === 'products-stock') {
      loadRecentProducts(); loadBestWeeklyProducts(); loadFrequentWeeklyProducts();
    }
  }, [token, role, route, shopId])

  // ... (Data Loading Functions kept as is, but assuming they are accessible in closure or I need to preserve them)
  // Since I am replacing the top of App, I need to make sure I don't cut off functions.
  // I will use a larger context for SearchReplace or be careful.
  // I'll skip the function definitions in the replacement string to avoid rewriting them if they haven't changed.
  // But wait, SearchReplace replaces the *entire* match. I must include everything I matched.
  // I'll target the top part of App until `async function loadHomeData`.

  async function loadHomeData() {
    try {
      const [d, w, wt, mt] = await Promise.all([
        api('/reports/sales-per-shop?period=daily', 'GET', token),
        api('/reports/sales-per-shop?period=weekly', 'GET', token),
        api('/reports/sales?period=weekly', 'GET', token),
        api('/reports/sales?period=monthly', 'GET', token)
      ])
      setDailyPerShop(d); setWeeklyPerShop(w); setWeeklyTotals(wt); setMonthlyTotals(mt)
      const tp = await api('/reports/top-products?period=weekly' + (shopId ? '&shopId=' + shopId : ''), 'GET', token)
      setWeeklyTopProducts(tp)
    } catch(e) {}
  }

  async function loadProfitData() {
    try {
      const [pd, pw, pm, pov] = await Promise.all([
        api('/profit/daily', 'GET', token),
        api('/profit/weekly', 'GET', token),
        api('/profit/monthly', 'GET', token),
        api('/profit/overview', 'GET', token)
      ])
      setProfitDaily(Array.isArray(pd) ? pd : [])
      setProfitWeekly(Array.isArray(pw) ? pw : [])
      setProfitMonthly(Array.isArray(pm) ? pm : [])
      setProfitOverview(pov || { daily_per_shop: [], weekly_total: 0, monthly_total: 0, weekly_total_formatted: '0 TZS', monthly_total_formatted: '0 TZS' })
    } catch(e) {
      setProfitDaily([]); setProfitWeekly([]); setProfitMonthly([]); setProfitOverview({ daily_per_shop: [], weekly_total: 0, monthly_total: 0, weekly_total_formatted: '0 TZS', monthly_total_formatted: '0 TZS' })
    }
  }

  async function loadStockSummary() {
    try {
      const res = await api('/reports/stock-per-shop', 'GET', token)
      setStockSummary(Array.isArray(res) ? res : [])
    } catch {
      setStockSummary([])
    }
  }

  const loadSellers = async () => {
    try {
      const res = await api('/sellers', 'GET', token)
      setSellers(Array.isArray(res) ? res : [])
    } catch (e) { setSellers([]) }
  }
  const loadRanking = async () => {
    try {
      const res = await api('/sellers/ranking?period=daily', 'GET', token)
      setRanking(Array.isArray(res) ? res : [])
    } catch (e) { setRanking([]) }
  }
  const loadShops = async () => {
    try {
      const res = await api('/shops', 'GET', token)
      setShops(Array.isArray(res) ? res : [])
    } catch (e) { setShops([]) }
  }
  const loadShopRanking = async () => {
    try {
      const res = await api('/shops/ranking', 'GET', token)
      setShopRanking(Array.isArray(res) ? res : [])
    } catch (e) { setShopRanking([]) }
  }
  const loadSellersOptions = async () => {
    try {
      const res = await api('/sellers', 'GET', token)
      setSellersOptions(Array.isArray(res) ? res : [])
    } catch (e) { setSellersOptions([]) }
  }
  const loadRecentProducts = async () => {
    try {
      const res = await api('/products?sort=recent', 'GET', token)
      setRecentProducts(Array.isArray(res) ? res : [])
    } catch (e) { setRecentProducts([]) }
  }
  const loadBestWeeklyProducts = async () => {
    try {
      const res = await api('/reports/top-products?period=weekly' + (shopId ? '&shopId=' + shopId : ''), 'GET', token)
      setBestProducts(Array.isArray(res) ? res : [])
    } catch (e) { setBestProducts([]) }
  }
  const loadFrequentWeeklyProducts = async () => {
    try {
      const res = await api('/reports/top-products?period=monthly' + (shopId ? '&shopId=' + shopId : ''), 'GET', token)
      setFrequentProducts(Array.isArray(res) ? res : [])
    } catch (e) { setFrequentProducts([]) }
  }

  async function doLogin(e) {
    e.preventDefault()
    setLoginError('')
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      setToken(data.token)
      setRole(data.user.role || 'admin')
      setUser(data.user)
      navigate('home') // Admin home
    } catch (err) {
      setLoginError(err.message)
    }
  }

  async function doSellerLogin(e) {
    e.preventDefault()
    setLoginError('')
    try {
      if (!sellerForm.name || !/^\d{4}$/.test(sellerForm.passkey)) {
        setLoginError('Enter name and 4-digit passkey')
        return
      }
      const res = await fetch('/auth/seller-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sellerForm.name.trim(), passkey: sellerForm.passkey })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      setToken(data.token)
      setRole('seller')
      setUser(data.user)
      setShopId(String(data.user.shop_id || ''))
      navigate('seller-products') // Seller home
    } catch (err) {
      setLoginError(err.message)
    }
  }

  async function syncOffline() {
    if (!token) return
    const sales = getLocal('offline_sales', []).filter(x => !x.synced)
    if (sales.length && navigator.onLine) {
      try {
        const payload = sales.map(s => ({
          client_id: s.id || s.client_id,
          shop_id: s.shop_id,
          client_created_at: s.client_created_at,
          items: [{ product_id: s.product_id, quantity: s.quantity, discount_price: s.discount_price }]
        }))
        const res = await api('/sales/sync', 'POST', token, { sales: payload })
        const results = res.results || []
        const updated = getLocal('offline_sales', [])
        for (const r of results) {
          const idx = updated.findIndex(s => (s.id || s.client_id) === r.client_id)
          if (idx >= 0 && (r.status === 'synced' || r.status === 'duplicate')) {
            updated[idx].synced = true
            updated[idx].server_id = r.sale_id
          }
        }
        setLocal('offline_sales', updated)
      } catch {}
    }
    const receipts = getLocal('offline_stock', []).filter(x => !x.synced)
    if (receipts.length && navigator.onLine) {
      const updated = getLocal('offline_stock', [])
      for (let i = 0; i < updated.length; i++) {
        const r = updated[i]
        if (r.synced) continue
        try {
          await api(`/stock/shops/${r.shop_id}/products/${r.product_id}/add`, 'POST', token, { quantity: r.quantity })
          updated[i].synced = true
        } catch {}
      }
      setLocal('offline_stock', updated)
    }
  }

  useEffect(() => {
    syncOffline()
    const h = () => syncOffline()
    window.addEventListener('online', h)
    return () => window.removeEventListener('online', h)
  }, [token])

  const ctx = useMemo(() => ({
    token, setToken, role, setRole, user, setUser, theme, setTheme, lang, setLang, route, navigate,
    dailyPerShop, weeklyPerShop, weeklyTopProducts, weeklyTotals, monthlyTotals,
    sellers, ranking, loadSellers, loadRanking,
    shops, shopRanking, loadShops, loadShopRanking, sellersOptions,
    recentProducts, bestProducts, frequentProducts, loadRecentProducts,
    shopPopup, setShopPopup, shopDeleteOpen, setShopDeleteOpen,
    api, shopId, setShopId, currentProduct, setCurrentProduct, stockSummary, toggleMenu: () => setMenuOpen(o => !o),
    syncOffline
  }), [
    token, role, user, theme, lang, route,
    dailyPerShop, weeklyPerShop, weeklyTopProducts, weeklyTotals, monthlyTotals,
    sellers, ranking,
    shops, shopRanking, sellersOptions,
    recentProducts, bestProducts, frequentProducts,
    shopPopup, shopDeleteOpen, shopId, currentProduct, stockSummary
  ])

  let content
  if (!token) {
    content = React.createElement('div', { className: 'center-page' },
      React.createElement('div', { className: 'card', style: { width: '90%', maxWidth: 420 } },
        React.createElement('div', { className: 'row', style: { display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12 } },
          React.createElement('button', { style: { padding: '8px 14px', fontSize: 16, borderRadius: 10, border: '1px solid var(--border)', background: loginMode === 'admin' ? 'var(--card)' : 'transparent', color: 'var(--text)' }, onClick: () => setLoginMode('admin') }, 'Admin'),
          React.createElement('button', { style: { padding: '8px 14px', fontSize: 16, borderRadius: 10, border: '1px solid var(--border)', background: loginMode === 'seller' ? 'var(--card)' : 'transparent', color: 'var(--text)' }, onClick: () => setLoginMode('seller') }, 'Seller')
        ),
        loginMode === 'admin' ?
        React.createElement('form', { onSubmit: doLogin },
          React.createElement('h3', { style: { textAlign: 'center' } }, 'Admin Login'),
          React.createElement('input', { type: 'email', placeholder: 'Email', value: loginForm.email, onChange: e => setLoginForm({ ...loginForm, email: e.target.value }) }),
          React.createElement('input', { type: 'password', placeholder: 'Password', value: loginForm.password, onChange: e => setLoginForm({ ...loginForm, password: e.target.value }) }),
          loginError && React.createElement('div', { className: 'error' }, loginError),
          React.createElement('button', { type: 'submit', className: 'primary' }, 'Login')
        )
        :
        React.createElement('form', { onSubmit: doSellerLogin },
          React.createElement('h3', { style: { textAlign: 'center' } }, 'Seller Login'),
          React.createElement('input', { placeholder: 'Name', value: sellerForm.name, onChange: e => setSellerForm({ ...sellerForm, name: e.target.value }) }),
          React.createElement('div', { className: 'row' },
            React.createElement('input', { type: sellerForm.show ? 'text' : 'password', placeholder: '4-digit passkey', value: sellerForm.passkey, onChange: e => setSellerForm({ ...sellerForm, passkey: e.target.value.slice(0,4) }) }),
            React.createElement('button', { type: 'button', className: 'icon-btn', onClick: () => setSellerForm({ ...sellerForm, show: !sellerForm.show }) }, sellerForm.show ? '🙈' : '👁')
          ),
          loginError && React.createElement('div', { className: 'error' }, loginError),
          React.createElement('button', { type: 'submit', className: 'primary' }, 'Login')
        )
      )
    )
  } else {
    switch (route) {
      case 'home': content = React.createElement(Home); break;
      case 'shops': content = React.createElement(ShopsPage); break;
      case 'products': content = React.createElement(ProductsPage); break;
      case 'products-register': content = React.createElement(ProductsRegisterPage); break;
      case 'products-stock': content = React.createElement(ProductsStockPage); break;
      case 'sellers': content = React.createElement(SellersPage); break;
      case 'settings': content = React.createElement(SettingsPage); break;
      case 'calculate': content = React.createElement(CalculatePage); break;
      case 'help': content = React.createElement(HelpPage); break;
      case 'seller-actions': content = React.createElement(SellerActionsPage); break;
      case 'seller-products': content = React.createElement(SellerProductsPage); break;
      case 'seller-settings': content = React.createElement(SellerSettingsPage); break;
      case 'seller-amount': content = React.createElement(SellerAmountPage); break;
      case 'seller-sell': content = React.createElement(SellerSellPage); break;
      case 'details-daily':
        content = React.createElement(DetailsPage, {
          title: 'Daily Sales', data: dailyPerShop,
          mapFn: s => React.createElement('div', { className: 'list-item', key: s.shop_id },
            React.createElement('div', null, s.shop_name), React.createElement('div', null, currency(s.grand_total)))
        }); break;
      case 'details-weekly-shop':
        content = React.createElement(DetailsPage, {
          title: 'Weekly Sales', data: weeklyPerShop,
          mapFn: s => React.createElement('div', { className: 'list-item', key: s.shop_id },
            React.createElement('div', null, s.shop_name), React.createElement('div', null, currency(s.grand_total)))
        }); break;
      case 'details-weekly-top':
        content = React.createElement(DetailsPage, {
          title: 'Top Products', data: weeklyTopProducts,
          mapFn: p => React.createElement('div', { className: 'list-item', key: p.product_id },
            React.createElement('div', null, p.name), React.createElement('div', null, p.total_quantity))
        }); break;
      case 'details-profit-daily':
        content = React.createElement(DetailsPage, {
          title: 'Daily Profit', data: profitDaily,
          mapFn: r => React.createElement('div', { className: 'list-item', key: r.shop_id },
            React.createElement('div', null, r.shop_name), React.createElement('div', null, r.profit_formatted || currency(r.profit)))
        }); break;
      case 'details-profit-weekly':
        content = React.createElement(DetailsPage, {
          title: 'Weekly Profit', data: profitWeekly,
          mapFn: r => React.createElement('div', { className: 'list-item', key: r.shop_id },
            React.createElement('div', null, r.shop_name), React.createElement('div', null, r.profit_formatted || currency(r.profit)))
        }); break;
      case 'details-profit-monthly':
        content = React.createElement(DetailsPage, {
          title: 'Monthly Profit', data: profitMonthly,
          mapFn: r => React.createElement('div', { className: 'list-item', key: r.shop_id },
            React.createElement('div', null, r.shop_name), React.createElement('div', null, r.profit_formatted || currency(r.profit)))
        }); break;
      case 'stock-shops': content = React.createElement(StockByShopPage); break;
      case 'admin/home': content = React.createElement(Home); break;
      case 'seller/home': content = React.createElement(SellerProductsPage); break;
      default: 
        if (route.startsWith('shop-details/')) {
          const id = route.split('/')[1]
          content = React.createElement(ShopDetailsPage, { id })
        } else {
          content = React.createElement(Home)
        }
    }
  }

  return React.createElement(ErrorBoundary, null,
    React.createElement(AppContext.Provider, { value: ctx },
      React.createElement('div', { className: 'app' },
        React.createElement('div', { className: 'content' }, content),
        token && role !== 'seller' && React.createElement(Nav),
        token && React.createElement(FloatingMenu, { show: menuOpen, onClose: () => setMenuOpen(false) })
      )
    )
  )
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(React.createElement(App))
