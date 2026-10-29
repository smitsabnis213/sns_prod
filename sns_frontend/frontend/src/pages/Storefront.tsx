import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState, LocationDialog, ProductCard } from '../components/StorefrontParts'
import { ApiError, api, formatApiError } from '../services/api'
import { useCart, useDeliveryLocation } from '../state/AppState'
import type { Category, DeliveryMode, Product, UfdCatalogue } from '../types'

const heroSlides = [
  {
    eyebrow: 'GOOD FOOD, GOOD NEIGHBORS',
    title: <>Kya aap aaj bhi<br /><em>mandi jaate ho?</em></>,
    copy: 'Meet the local Buddies who bring fresh produce from their neighborhood to your doorstep.',
    label: 'Shop your neighborhood',
    tone: 'cream',
    art: '🥬',
  },
  {
    eyebrow: 'A LITTLE CLOSER TO HOME',
    title: <>Fresh finds from<br /><em>your nearby Buddy.</em></>,
    copy: 'Independent local vendors, connected by Buddyyaa. Availability follows real neighborhood stock.',
    label: 'Discover local produce',
    tone: 'green',
    art: '🥑',
  },
  {
    eyebrow: 'YOUR QUICKER WAY TO FRESH',
    title: <>The good stuff,<br /><em>closer to you.</em></>,
    copy: 'Choose UFD to see the products available from one nearby Buddy for your location.',
    label: 'Explore UFD',
    tone: 'blue',
    art: '🍋',
  },
]

function ProductSkeletons() {
  return <div className="product-grid" aria-label="Loading products">{Array.from({ length: 4 }, (_, index) => <div className="product-skeleton" key={index}><span /><i /><i /><b /></div>)}</div>
}

export function Storefront() {
  const cart = useCart()
  const { refreshProducts, syncUfdCatalogue } = cart
  const { location, setLocation } = useDeliveryLocation()
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q')?.trim() ?? ''
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [catalogueLoading, setCatalogueLoading] = useState(true)
  const [catalogueError, setCatalogueError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [catalogueRefreshKey, setCatalogueRefreshKey] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [mode, setMode] = useState<DeliveryMode>(cart.state.mode)
  const [ufd, setUfd] = useState<UfdCatalogue | null>(null)
  const [ufdLoading, setUfdLoading] = useState(false)
  const [ufdError, setUfdError] = useState('')
  const [ufdRefreshKey, setUfdRefreshKey] = useState(0)
  const [locationOpen, setLocationOpen] = useState(false)
  const [slide, setSlide] = useState(0)
  const [noticeVisible, setNoticeVisible] = useState(() => sessionStorage.getItem('buddyyaa-notice-dismissed') !== 'yes')
  const [showTop, setShowTop] = useState(false)
  const locationLatitude = location?.latitude
  const locationLongitude = location?.longitude
  useEffect(() => {
    let active = true
    setCatalogueError('')
    setCategoryError('')
    void Promise.allSettled([api.products(), api.categories()])
      .then(([productResult, categoryResult]) => {
        if (!active) return
        if (productResult.status === 'fulfilled') setProducts(productResult.value)
        else setCatalogueError(formatApiError(productResult.reason))
        if (categoryResult.status === 'fulfilled') setCategories(categoryResult.value)
        else setCategoryError(formatApiError(categoryResult.reason))
      })
      .finally(() => { if (active) setCatalogueLoading(false) })
    return () => { active = false }
  }, [catalogueRefreshKey])

  useEffect(() => { refreshProducts(products, 'normal') }, [refreshProducts, products])

  useEffect(() => {
    if (mode !== 'ufd' || locationLatitude === undefined || locationLongitude === undefined) {
      setUfd(null)
      setUfdError('')
      setUfdLoading(false)
      return
    }
    let active = true
    setUfd(null)
    setUfdLoading(true)
    setUfdError('')
    void api.ufdCatalogue({ latitude: locationLatitude, longitude: locationLongitude })
      .then((result) => {
        if (active) {
          setUfd(result)
          syncUfdCatalogue(result.buddy.id, result.buddy.name, result.products)
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setUfd(null)
          setUfdError(error instanceof ApiError && error.status === 404
            ? 'UFD is not available around this location yet. Try again after choosing another delivery location.'
            : formatApiError(error))
        }
      })
      .finally(() => { if (active) setUfdLoading(false) })
    return () => { active = false }
  }, [syncUfdCatalogue, mode, locationLatitude, locationLongitude, ufdRefreshKey])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setSlide((value) => (value + 1) % heroSlides.length), 6500)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const update = () => setShowTop(window.scrollY > 560)
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  const visibleProducts = useMemo(() => {
    const source = mode === 'ufd' ? ufd?.products ?? [] : products
    const lowered = query.toLocaleLowerCase()
    return source.filter((product) => {
      const matchesQuery = !lowered || `${product.name} ${product.categoryName ?? ''}`.toLocaleLowerCase().includes(lowered)
      const matchesCategory = selectedCategory === 'all' || product.categoryId === selectedCategory
        || product.categoryName?.toLocaleLowerCase() === categories.find((item) => item.id === selectedCategory)?.name.toLocaleLowerCase()
      return matchesQuery && matchesCategory
    })
  }, [categories, mode, products, query, selectedCategory, ufd])

  const selectedSlide = heroSlides[slide]
  const linesForMode = mode === 'ufd' ? cart.state.ufd : cart.state.normal

  function chooseMode(next: DeliveryMode) {
    setMode(next)
    cart.setMode(next)
    setSelectedCategory('all')
    if (next === 'ufd' && !location) setLocationOpen(true)
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    document.getElementById('shop')?.scrollIntoView({ behavior, block: 'start' })
  }

  return (
    <main>
      {noticeVisible && <div className="neighborhood-banner"><div className="shell"><span><Sparkles size={15} /> <strong>Rooted here, ready for your table.</strong> Buddyyaa connects your order with independent local Buddies.</span><button aria-label="Dismiss neighborhood notice" onClick={() => { sessionStorage.setItem('buddyyaa-notice-dismissed', 'yes'); setNoticeVisible(false) }} type="button">×</button></div></div>}
      {!noticeVisible && <button className="reopen-notice" onClick={() => { sessionStorage.removeItem('buddyyaa-notice-dismissed'); setNoticeVisible(true) }} type="button">Show neighborhood note</button>}

      <section className={`hero hero--${selectedSlide.tone}`}>
        <div className="shell hero__inner">
          <div className="hero__copy">
            <AnimatePresence mode="wait">
              <motion.div key={slide} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                <span className="hero__eyebrow">{selectedSlide.eyebrow}</span>
                <h1>{selectedSlide.title}</h1>
                <p>{selectedSlide.copy}</p>
                <button className="button button--dark" type="button" onClick={() => chooseMode(slide === 2 ? 'ufd' : 'normal')}>{selectedSlide.label} <ArrowRight size={17} /></button>
              </motion.div>
            </AnimatePresence>
            <div className="hero__controls">
              <button onClick={() => setSlide((slide + heroSlides.length - 1) % heroSlides.length)} aria-label="Previous slide" type="button"><ChevronLeft size={17} /></button>
              {heroSlides.map((item, index) => <button key={item.eyebrow} className={index === slide ? 'is-active' : ''} aria-label={`Go to slide ${index + 1}`} onClick={() => setSlide(index)} type="button" />)}
              <button onClick={() => setSlide((slide + 1) % heroSlides.length)} aria-label="Next slide" type="button"><ChevronRight size={17} /></button>
            </div>
          </div>
          <motion.div className="hero-art" key={slide} initial={{ opacity: 0, scale: 0.85, rotate: -7 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 17 }}>
            <div className="hero-art__halo" />
            <div className="hero-art__sun" />
            <span className="hero-art__produce" aria-hidden="true">{selectedSlide.art}</span>
            <div className="hero-art__label"><span className="hero-art__badge">FROM A LOCAL BUDDY</span><strong>Good things grow<br />close to home.</strong><span>Fresh choices. Real neighbors.</span></div>
            <span className="hero-art__spark hero-art__spark--one">✳</span><span className="hero-art__spark hero-art__spark--two">✦</span>
          </motion.div>
          <div className="hero__side-note"><span>01</span><i /> FRESHNESS, FROM THE NEIGHBORHOOD</div>
        </div>
      </section>

      <div className="shell trust-strip">
        <div><span className="trust-icon trust-icon--green"><MapPin size={18} /></span><span><strong>Local by nature</strong><small>Supplied by nearby independent Buddies</small></span></div>
        <div><span className="trust-icon trust-icon--gold"><Clock3 size={18} /></span><span><strong>Availability that’s real</strong><small>Based on a Buddy’s own current stock</small></span></div>
        <div><span className="trust-icon trust-icon--blue"><ArrowDown size={18} /></span><span><strong>One order, one Buddy</strong><small>Your order stays with its fulfiller</small></span></div>
      </div>

      <section className="shop-section shell" id="shop">
        <div className="mode-header">
          <div><span className="eyebrow">HOW WOULD YOU LIKE TO SHOP?</span><h2>Choose your delivery style</h2></div>
          <div className="delivery-switch" role="group" aria-label="Delivery mode">
            <button type="button" className={mode === 'normal' ? 'is-selected' : ''} onClick={() => chooseMode('normal')}><span className="mode-switch-dot" /> Normal delivery</button>
            <button type="button" className={mode === 'ufd' ? 'is-selected delivery-switch__ufd' : ''} onClick={() => chooseMode('ufd')}><span className="mode-switch-dot" /> UFD · Ultra Fast</button>
          </div>
        </div>

        {mode === 'normal' ? (
          <>
            <div className="section-title-row">
              <div><span className="eyebrow">GOOD FOOD STARTS HERE</span><h2 id="shop-title">Shop fresh, shop local<span className="title-period">.</span></h2></div>
              <p>Browse the broader catalogue. At checkout, Buddyyaa finds one Buddy who can fulfill your whole basket.</p>
            </div>
            <CategoryBar categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
            {categoryError && <p className="subtle-warning" role="status">Category filters couldn’t be loaded. You can still browse the products below. {categoryError}</p>}
            <CatalogueSection
              categories={categories}
              error={catalogueError}
              loading={catalogueLoading}
              products={visibleProducts}
              allProducts={products}
              selectedCategory={selectedCategory}
              mode="normal"
              lines={linesForMode}
              onRetry={() => { setCatalogueLoading(true); setCatalogueRefreshKey((value) => value + 1) }}
              query={query}
            />
          </>
        ) : (
          <section className="ufd-panel" id="ufd">
            <div className="ufd-panel__top">
              <div>
                <span className="ufd-kicker"><span className="ufd-star">✦</span> THE NEIGHBORHOOD QUICK PICK</span>
                <h2><span>UFD</span> — Ultra Fast Delivery</h2>
                <p>Available from your nearest Buddy. One local inventory, selected for your location.</p>
                {ufd?.buddy && <div className="selected-buddy"><span className="selected-buddy__check">✓</span><span><small>YOUR UFD BUDDY</small><strong>{ufd.buddy.name}</strong></span><button onClick={() => setLocationOpen(true)} type="button">Change location</button></div>}
              </div>
              <div className="ufd-art" aria-hidden="true"><div className="ufd-art__ring" /><span>🥬</span><b>LOCAL<br />& QUICK</b><i>✦</i></div>
            </div>
            {!location && <div className="location-required"><MapPin size={20} /><div><strong>Set your delivery location to check nearby stock</strong><span>We don’t guess where you are or which Buddy can serve you.</span></div><button className="button button--dark" onClick={() => setLocationOpen(true)} type="button">Choose location</button></div>}
            {ufd && cart.state.ufd.length > 0 && cart.state.ufdBuddyId !== ufd.buddy.id && <div className="ufd-basket-warning"><span>Your existing UFD basket belongs to a different Buddy. It hasn’t been switched.</span><button className="button button--outline" onClick={() => cart.clear('ufd')} type="button">Clear old UFD basket</button></div>}
            {location && ufdLoading && <ProductSkeletons />}
            {location && !ufdLoading && ufdError && <div className="inline-error"><span>{ufdError}</span><button className="button button--outline" onClick={() => setUfdRefreshKey((value) => value + 1)} type="button"><RefreshCw size={15} /> Try again</button></div>}
            {location && !ufdLoading && !ufdError && ufd && <CatalogueSection
              categories={[]}
              error=""
              loading={false}
              products={visibleProducts}
              allProducts={ufd.products}
              selectedCategory="all"
              mode="ufd"
              buddyId={ufd.buddy.id}
              lines={linesForMode}
              onRetry={() => setLocation({ ...location })}
              query={query}
            />}
          </section>
        )}
      </section>

      <section className="local-story">
        <div className="shell local-story__inner">
          <div className="local-story__badge">A BETTER WAY<br />TO SHOP LOCAL</div>
          <div><span className="eyebrow">NOT A WAREHOUSE. A NEIGHBORHOOD.</span><h2>Local supply, made<br />a little more accessible.</h2><p>Your Buddy already knows the produce, the lanes, and the people around them. Buddyyaa brings that existing local know-how online—then connects your order with the Buddy who can fulfill it.</p><a href="#shop">Explore the catalogue <ArrowRight size={16} /></a></div>
          <div className="local-story__decor" aria-hidden="true"><span>🥕</span><i>✳</i><b>GROWN<br />CLOSER</b></div>
        </div>
      </section>

      {showTop && <button className="back-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} type="button"><ArrowDown size={16} /> Top</button>}
      {locationOpen && <LocationDialog onClose={() => setLocationOpen(false)} onSave={setLocation} />}
    </main>
  )
}

function CategoryBar({ categories, selected, onSelect }: {
  categories: Category[]
  selected: string
  onSelect: (id: string) => void
}) {
  if (!categories.length) return null
  return (
    <div className="category-area">
      <div className="category-area__label">BROWSE BY CATEGORY</div>
      <div className="category-list" role="tablist" aria-label="Product categories">
        <button role="tab" aria-selected={selected === 'all'} className={`category-chip${selected === 'all' ? ' is-active' : ''}`} onClick={() => onSelect('all')} type="button">Everything</button>
        {categories.map((category) => <button role="tab" aria-selected={selected === category.id} className={`category-chip${selected === category.id ? ' is-active' : ''}`} key={category.id} onClick={() => onSelect(category.id)} type="button">{category.name}</button>)}
      </div>
    </div>
  )
}

function CatalogueSection({ categories, error, loading, products, allProducts, selectedCategory, mode, buddyId, lines, onRetry, query }: {
  categories: Category[]
  error: string
  loading: boolean
  products: Product[]
  allProducts: Product[]
  selectedCategory: string
  mode: DeliveryMode
  buddyId?: string
  lines: Array<{ product: Product; quantity: number }>
  onRetry: () => void
  query: string
}) {
  if (loading) return <ProductSkeletons />
  if (error) return <div className="catalogue-error"><strong>We couldn’t load the catalogue.</strong><span>{error}</span><button className="button button--outline" onClick={onRetry} type="button"><RefreshCw size={15} /> Try again</button></div>
  if (!allProducts.length) {
    return <EmptyState title={mode === 'ufd' ? 'No nearby UFD products right now' : 'The shelves are being stocked'} message={mode === 'ufd' ? 'This Buddy has no available products in the current catalogue. Try again later or switch to normal delivery.' : 'There are no active products in the catalogue yet. An administrator can add categories and products in AdminJS.'} />
  }
  if (!products.length) {
    return <EmptyState icon={<Search size={24} />} title={query ? `No results for “${query}”` : 'No products in this category'} message="Try another search or choose a different category." />
  }
  return (
    <div className="catalogue-results">
      {mode === 'ufd' || query || selectedCategory !== 'all'
        ? <ProductGroup
            title={query ? 'Search results' : mode === 'ufd' ? 'Available from this Buddy' : categories.find((category) => category.id === selectedCategory)?.name ?? 'Fresh finds'}
            products={products}
            mode={mode}
            buddyId={buddyId}
            lines={lines}
          />
        : <>
            {categories.map((category) => {
              const categoryProducts = products.filter((product) => product.categoryId === category.id || product.categoryName?.toLocaleLowerCase() === category.name.toLocaleLowerCase())
              if (!categoryProducts.length) return null
              return <ProductGroup key={category.id} title={category.name} products={categoryProducts} mode={mode} lines={lines} />
            })}
            {products.filter((product) => !categories.some((category) => product.categoryId === category.id || product.categoryName?.toLocaleLowerCase() === category.name.toLocaleLowerCase())).length > 0 &&
              <ProductGroup title="Other fresh finds" products={products.filter((product) => !categories.some((category) => product.categoryId === category.id || product.categoryName?.toLocaleLowerCase() === category.name.toLocaleLowerCase()))} mode={mode} lines={lines} />}
          </>}
    </div>
  )
}

function ProductGroup({ title, products, mode, buddyId, lines }: {
  title: string
  products: Product[]
  mode: DeliveryMode
  buddyId?: string
  lines: Array<{ product: Product; quantity: number }>
}) {
  return (
    <section className="product-group">
      <div className="product-group__header"><div><span className="eyebrow">{mode === 'ufd' ? 'THIS BUDDY’S CURRENT STOCK' : 'FRESH FROM THE CATALOGUE'}</span><h3>{title}<span className="title-period">.</span></h3></div><span>{products.length} {products.length === 1 ? 'product' : 'products'}</span></div>
      <div className="product-grid">
        {products.map((product) => <ProductCard key={product.id} product={product} mode={mode} buddyId={buddyId} quantity={lines.find((line) => line.product.id === product.id)?.quantity ?? 0} />)}
      </div>
    </section>
  )
}
