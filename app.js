/* ====== CLAVES DE SUPABASE ====== */
const SUPABASE_URL = 'https://sayehiisneupxkivuqmo.supabase.co'
const SUPABASE_KEY = 'sb_publishable_VyxX3M6CsBNEhRw_BwojtA_bPP_36wa'


/* ====== TEMAS ====== */
const T = [
  ['jirai', 'Jirai Kei', '#ff7eb6', '#2a1830'],
  ['cutecore', 'Cutecore', '#ff9ccb', '#fff0f6'],
  ['y2k', 'Y2K', '#ff3fb4', '#00ccff'],
  ['frutiger', 'Frutiger Aero', '#2aa8ff', '#8fd3ff'],
  ['webcore', 'Webcore', '#0000ee', '#008080'],
  ['weirdcore', 'Weirdcore', '#e00000', '#dcd7c9'],
  ['cybercore', 'Cybercore', '#00ff88', '#ff006e'],
  ['fairycore', 'Fairycore', '#ff8fc7', '#9a7fd1'],
  ['scene', 'Scene', '#ff2e9a', '#b6ff00'],
  ['gothic', 'Gothic', '#a78bfa', '#f472b6'],
  ['pastel', 'Pastel Dreams', '#d946ef', '#ec4899'],
  ['retro', 'Retro', '#d9482b', '#f3e3c3'],
  ['vaporwave', 'Vaporwave', '#ff71ce', '#01cdfe'],
  ['minimal', 'Minimalista', '#111111', '#dddddd']
]

const THEMES = Object.fromEntries(
  T.map(([id, name, a, b]) => [
    id,
    { name, preview: `linear-gradient(135deg, ${a}, ${b})`, class: 'theme-' + id }
  ])
)


/* ====== UTILIDADES ====== */
const $ = id => document.getElementById(id)

const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))

const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23d8b4fe"/><text x="50" y="66" font-size="52" text-anchor="middle">🙂</text></svg>'

const av = u => esc(u || DEFAULT_AVATAR)

// Las columnas "timestamp" (sin zona horaria) llegan sin "Z": se interpretan como UTC
const asDate = d =>
  new Date(typeof d === 'string' && /T[\d:.]+$/.test(d) ? d + 'Z' : d)

const ago = d => {
  const s = (Date.now() - asDate(d)) / 1000

  if (s < 60) return 'ahora'
  if (s < 3600) return Math.floor(s / 60) + ' min'
  if (s < 86400) return Math.floor(s / 3600) + ' h'

  return asDate(d).toLocaleDateString('es')
}


/* ====== ESTADO ====== */
let db
let me = null
let viewId = null
let pickedFile = null
let mode = 'in'
let lastId = null

let currentChatUserId = null
let currentConversationId = null
let chatListCache = []
let chatTimer = null
let chatTick = 0
let lastMsgSig = ''
const chatProfiles = new Map()


/* ====== ACCESO ====== */
function setMode(m) {
  mode = m

  $('auth-title').textContent = m === 'in' ? 'Entrar a tu rincón' : 'Crear tu cuenta'
  $('auth-submit').textContent = m === 'in' ? 'Entrar ✨' : 'Crear cuenta ✨'
  $('auth-toggle').textContent = m === 'in' ? 'Crear cuenta' : 'Ya tengo cuenta'
  $('auth-user-group').classList.toggle('hidden', m === 'in')
  $('auth-user').required = m === 'up'
}


async function route(session) {
  const id = session?.user?.id || null

  if (id === lastId) return

  lastId = id

  if (!id) {
    me = null
    viewId = null
    stopChatPolling()
    currentChatUserId = null
    currentConversationId = null
    chatListCache = []
    chatProfiles.clear()
    $('auth-screen').classList.remove('hidden')
    return
  }

  const { data, error } = await db.from('profiles').select('*').eq('id', id).single()

  if (error || !data) {
    console.error('Error cargando perfil:', error)
    $('auth-msg').textContent =
      'No se encontró tu perfil. Ejecuta schema.sql en Supabase y vuelve a entrar.'
    return
  }

  me = data

  $('auth-screen').classList.add('hidden')

  boot()
}


function boot() {
  renderThemes()
  applyTheme(me.theme, false)
  $('full-post-input').value = localStorage.getItem('mystyle-draft') || ''
  refreshMini()
  showPage('feed')
}


/* ====== NAVEGACIÓN ====== */
function showPage(n) {
  document.querySelectorAll('.page').forEach(p =>
    p.classList.toggle('active', p.id === n + '-page'))

  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.page === n))

  if (n !== 'chat') stopChatPolling()

  if (n === 'feed') {
    loadFeed()
  } else if (n === 'explore') {
    loadExplore()
  } else if (n === 'profile') {
    openProfile(viewId || me.id)
  } else if (n === 'settings') {
    fillSettings()
  } else if (n === 'chat') {
    startChatPolling()
    return loadConversations()
  }
}


/* ====== PERFIL MINI ====== */
async function refreshMini() {
  const [p, f] = await Promise.all([
    db.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', me.id),
    db.from('friendships').select('*', { count: 'exact', head: true }).eq('user_id', me.id)
  ])

  $('mini-name').textContent = me.display_name
  $('mini-handle').textContent = '@' + me.username
  $('mini-bio').textContent = me.bio || ''
  $('current-mood').textContent = me.mood || '—'
  $('mini-posts').textContent = p.count ?? 0
  $('mini-friends').textContent = f.count ?? 0
  $('mini-avatar').src = $('composer-avatar').src = me.avatar_url || DEFAULT_AVATAR
}


/* ====== TEMAS (selector) ====== */
function renderThemes() {
  $('themes-grid').innerHTML = Object.entries(THEMES).map(([k, t]) => `
    <button class="theme-card ${k === me.theme ? 'active' : ''}" data-theme="${k}">
      <div class="theme-preview" style="background:${t.preview}"></div>
      <div class="theme-name">${t.name}</div>
    </button>`).join('')
}

function setSectionTheme(k) {
  const sec = $('profile-page')

  ;[...sec.classList].filter(c => c.startsWith('theme-')).forEach(c => sec.classList.remove(c))

  sec.classList.add((THEMES[k] || THEMES.pastel).class)
}

async function applyTheme(k, save = true) {
  if (!THEMES[k]) return

  document.body.className = THEMES[k].class

  me.theme = k

  if (!viewId || viewId === me.id) setSectionTheme(k)

  document.querySelectorAll('.theme-card').forEach(c =>
    c.classList.toggle('active', c.dataset.theme === k))

  if (save) await db.from('profiles').update({ theme: k }).eq('id', me.id)
}


/* ====== PUBLICACIONES ====== */
async function fetchPosts(authorId) {
  let q = db
    .from('posts')
    .select('*, author:profiles!author_id(id,username,display_name,avatar_url), likes(user_id), replies(count)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (authorId) q = q.eq('author_id', authorId)

  const r = await q

  if (r.error) {
    console.error('Error publicaciones:', r.error)
    alert('Error al cargar publicaciones: ' + r.error.message)
  }

  return r.data || []
}

const postHtml = p => {
  const a = p.author
  const liked = p.likes?.some(l => l.user_id === me.id) || false

  return `
    <article class="post-card" id="post-${p.id}">
      <div class="post-header" data-profile="${a.id}">
        <img src="${av(a.avatar_url)}" alt="" class="post-avatar">
        <div class="post-user-info">
          <p class="post-user">${esc(a.display_name)}</p>
          <p class="post-handle">@${esc(a.username)}</p>
          <p class="post-date">${ago(p.created_at)}</p>
        </div>
      </div>

      <div class="post-content">${esc(p.body)}</div>

      ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" class="post-image">` : ''}

      <div class="post-actions">
        <button class="post-action ${liked ? 'on' : ''}" data-like="${p.id}" data-liked="${liked}">💜 ${p.likes?.length || 0}</button>
        <button class="post-action" data-reply="${p.id}">💬 ${p.replies?.[0]?.count || 0}</button>
        <button class="post-action" data-share="${p.id}">↻ Compartir</button>
      </div>

      <div class="replies hidden" id="r-${p.id}"></div>
    </article>`
}

async function loadFeed() {
  const posts = await fetchPosts()

  $('feed-posts').innerHTML =
    posts.map(postHtml).join('') ||
    '<p class="card" style="padding:16px">Aún no hay publicaciones. ¡Escribe la primera! ✨</p>'
}

async function loadReplies(id) {
  const { data, error } = await db
    .from('replies')
    .select('*, author:profiles!author_id(username)')
    .eq('post_id', id)
    .order('created_at')

  if (error) {
    console.error(error)
    return
  }

  $('r-' + id).innerHTML =
    (data || []).map(r =>
      `<p class="reply"><strong>@${esc(r.author.username)}</strong> ${esc(r.body)}</p>`).join('') +
    `<form class="reply-form" data-form="${id}">
       <input placeholder="Responder…" required maxlength="300">
       <button class="btn-publish">Enviar</button>
     </form>`
}


/* ====== SUBIDA DE ARCHIVOS ====== */
async function upload(file, prefix = '') {
  const path = `${me.id}/${prefix}${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`

  const { error } = await db.storage.from('media').upload(path, file)

  if (error) {
    alert('No se pudo subir la imagen: ' + error.message)
    return null
  }

  return db.storage.from('media').getPublicUrl(path).data.publicUrl
}


/* ====== PUBLICAR ====== */
async function publish(text, file) {
  text = text.trim()

  if (!text && !file) return alert('Escribe algo primero 💭')

  let image_url = null

  if (file) {
    image_url = await upload(file)
    if (!image_url) return
  }

  const { error } = await db.from('posts').insert({ author_id: me.id, body: text, image_url })

  if (error) return alert('No se pudo publicar: ' + error.message)

  $('quick-post-input').value = ''
  $('full-post-input').value = ''

  localStorage.removeItem('mystyle-draft')

  clearPreview()
  refreshMini()
  showPage('feed')
}

function clearPreview() {
  pickedFile = null
  $('file-input').value = ''
  $('preview-container').classList.add('hidden')
}


/* ====== EXPLORAR / AMIGOS ====== */
async function toggleFollow(id, on) {
  const t = db.from('friendships')

  const { error } = on
    ? await t.delete().match({ user_id: me.id, friend_id: id })
    : await t.insert({ user_id: me.id, friend_id: id })

  if (error) alert(error.message)

  refreshMini()
}

async function loadExplore() {
  const q = $('search-input').value.trim().replace(/[,()%]/g, '')

  let r = db.from('profiles').select('id,username,display_name,avatar_url').neq('id', me.id).limit(24)

  if (q) r = r.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)

  const [{ data }, { data: fl }] = await Promise.all([
    r,
    db.from('friendships').select('friend_id').eq('user_id', me.id)
  ])

  const mine = new Set((fl || []).map(x => x.friend_id))

  $('explore-users').innerHTML =
    (data || []).map(u => `
      <div class="user-card">
        <img src="${av(u.avatar_url)}" alt="" data-profile="${u.id}">
        <h4 data-profile="${u.id}">${esc(u.display_name)}</h4>
        <p>@${esc(u.username)}</p>
        <button class="user-btn" data-follow="${u.id}" data-on="${mine.has(u.id)}">
          ${mine.has(u.id) ? 'Siguiendo ✓' : 'Agregar ✨'}
        </button>
      </div>`).join('') ||
    '<p>No se encontraron personas.</p>'
}


/* ====== PERFIL COMPLETO ====== */
async function openProfile(id) {
  viewId = id

  const own = id === me.id

  const [pr, fr, posts, cm, fl] = await Promise.all([
    db.from('profiles').select('*').eq('id', id).single(),
    db.from('friendships').select('friend:profiles!friend_id(id,username,display_name,avatar_url)').eq('user_id', id),
    fetchPosts(id),
    own ? { data: [] } : db.rpc('common_friends', { a: me.id, b: id }),
    own ? { data: [] } : db.from('friendships').select('friend_id').match({ user_id: me.id, friend_id: id })
  ])

  const p = pr.data

  if (!p) return

  const friends = (fr.data || []).map(x => x.friend).filter(Boolean)
  const common = cm.data || []
  const following = (fl.data || []).length > 0

  setSectionTheme(p.theme)

  $('profile-name').textContent = p.display_name
  $('profile-handle').textContent = '@' + p.username
  $('profile-bio').textContent = p.bio || ''
  $('about-bio').textContent = p.bio || 'Todavía no hay biografía.'
  $('profile-avatar').src = p.avatar_url || DEFAULT_AVATAR
  $('profile-joined').textContent =
    'Se unió en ' + new Date(p.created_at).toLocaleDateString('es', { month: 'long', year: 'numeric' })

  $('profile-common').textContent = own
    ? ''
    : `${common.length} amigos en común` +
      (common.length ? ': ' + common.map(c => '@' + c.username).join(', ') : '')

  $('profile-stat-posts').textContent = posts.length
  $('profile-stat-friends').textContent = friends.length
  $('profile-stat-likes').textContent = posts.reduce((n, x) => n + (x.likes?.length || 0), 0)

  /* botón editar / agregar */
  const btn = $('edit-profile-main')

  if (own) {
    delete btn.dataset.follow
    delete btn.dataset.on
    btn.textContent = '✏️ Editar'
  } else {
    btn.dataset.follow = id
    btn.dataset.on = following
    btn.textContent = following ? 'Siguiendo ✓' : 'Agregar ✨'
  }

  /* botón mensaje (solo en perfiles de otras personas) */
  const messageBtn = $('message-profile-btn')

  if (messageBtn) {
    if (own) {
      messageBtn.classList.add('hidden')
      delete messageBtn.dataset.messageUser
    } else {
      messageBtn.classList.remove('hidden')
      messageBtn.dataset.messageUser = id
    }
  }

  $('profile-posts').innerHTML =
    posts.map(postHtml).join('') ||
    '<p style="text-align:center">Aún no hay publicaciones.</p>'

  $('profile-friends').innerHTML =
    friends.map(f => `
      <div class="friend-card" data-profile="${f.id}">
        <img src="${av(f.avatar_url)}" alt="">
        <h4>${esc(f.display_name)}</h4>
        <p>@${esc(f.username)}</p>
      </div>`).join('') ||
    '<p>Todavía no tiene amigos.</p>'
}


/* ====== CONFIGURACIÓN ====== */
function fillSettings() {
  $('settings-name').value = me.display_name || ''
  $('settings-username').value = me.username || ''
  $('settings-bio').value = me.bio || ''
  $('settings-mood').value = me.mood || ''
}

async function saveProfile(fields) {
  const { data, error } = await db.from('profiles').update(fields).eq('id', me.id).select().single()

  if (error) {
    alert('No se pudo guardar: ' + error.message)
    return false
  }

  me = data
  refreshMini()

  return true
}


/* =====================================================================
   CHAT
   - La lista de la izquierda muestra TUS CONTACTOS (gente a la que sigues)
     más cualquier persona con la que ya tengas una conversación.
   - La conversación se crea al enviar el primer mensaje.
   - No usa relaciones embebidas hacia profiles (conversations/messages
     apuntan a auth.users): los perfiles se piden aparte.
   ===================================================================== */
const PROFILE_COLS = 'id,username,display_name,avatar_url'

const focusChatInput = (force = false) => {
  if (!force && window.matchMedia('(max-width: 768px)').matches) return
  setTimeout(() => $('chat-input')?.focus(), 60)
}

async function ensureChatProfile(id) {
  if (chatProfiles.has(id)) return chatProfiles.get(id)

  const { data, error } = await db.from('profiles').select(PROFILE_COLS).eq('id', id).maybeSingle()

  if (error) console.error('Error cargando perfil del chat:', error)

  if (data) chatProfiles.set(id, data)

  return data || null
}

async function findConversation(otherId) {
  const { data, error } = await db
    .from('conversations')
    .select('id')
    .or(`and(user_a.eq.${me.id},user_b.eq.${otherId}),and(user_a.eq.${otherId},user_b.eq.${me.id})`)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error buscando conversación:', error)
    return null
  }

  return data?.[0]?.id || null
}

async function getOrCreateConversation(otherId) {
  if (!otherId || otherId === me.id) return null

  let id = await findConversation(otherId)

  if (!id) {
    const { data, error } = await db
      .from('conversations')
      .insert({ user_a: me.id, user_b: otherId })
      .select('id')
      .single()

    if (error) {
      console.error('Error creando conversación:', error)
      alert('No se pudo crear la conversación: ' + error.message)
      return null
    }

    id = data.id
  }

  currentConversationId = id
  currentChatUserId = otherId

  return id
}

/* Conversaciones existentes (más recientes primero) + contactos sin chat todavía */
async function buildChatList() {
  const [cv, fr] = await Promise.all([
    db.from('conversations')
      .select('id,user_a,user_b,updated_at')
      .or(`user_a.eq.${me.id},user_b.eq.${me.id}`)
      .order('updated_at', { ascending: false }),

    db.from('friendships')
      .select(`friend:profiles!friend_id(${PROFILE_COLS})`)
      .eq('user_id', me.id)
  ])

  if (cv.error) console.error('Error al cargar conversaciones:', cv.error)
  if (fr.error) console.error('Error al cargar contactos:', fr.error)

  const friends = (fr.data || []).map(x => x.friend).filter(Boolean)

  friends.forEach(f => chatProfiles.set(f.id, f))

  /* una conversación por persona */
  const seen = new Set()
  const convs = []

  for (const c of cv.data || []) {
    const otherId = c.user_a === me.id ? c.user_b : c.user_a

    if (seen.has(otherId)) continue

    seen.add(otherId)
    convs.push({ id: c.id, otherId })
  }

  /* perfiles que todavía no conocemos */
  const missing = convs.map(c => c.otherId).filter(id => !chatProfiles.has(id))

  if (currentChatUserId && !chatProfiles.has(currentChatUserId)) missing.push(currentChatUserId)

  const unique = [...new Set(missing)]

  if (unique.length) {
    const { data, error } = await db.from('profiles').select(PROFILE_COLS).in('id', unique)

    if (error) console.error('Error cargando perfiles del chat:', error)

    ;(data || []).forEach(p => chatProfiles.set(p.id, p))
  }

  const list = convs
    .map(c => ({ id: c.id, user: chatProfiles.get(c.otherId) }))
    .filter(i => i.user)

  const withChat = new Set(list.map(i => i.user.id))

  friends
    .filter(f => !withChat.has(f.id))
    .sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''))
    .forEach(f => list.push({ id: null, user: f }))

  /* persona elegida desde un perfil que no es contacto ni tiene chat */
  if (currentChatUserId && !list.some(i => i.user.id === currentChatUserId)) {
    const p = chatProfiles.get(currentChatUserId)
    if (p) list.unshift({ id: null, user: p })
  }

  return list
}

function renderChatList(list) {
  const box = $('chat-list')

  if (!list.length) {
    box.innerHTML = `
      <div class="chat-empty-state">
        Aún no tienes contactos 💜<br>
        Agrega personas desde Explorar para chatear con ellas.<br>
        <button class="btn-publish" data-goto="explore">Ir a Explorar 🔍</button>
      </div>`
    return
  }

  box.innerHTML = list.map(item => `
    <button
      class="chat-item ${item.id ? '' : 'new'} ${currentChatUserId === item.user.id ? 'active' : ''}"
      data-chat-user="${item.user.id}"
    >
      <img src="${av(item.user.avatar_url)}" class="chat-item-avatar" alt="">
      <div class="chat-item-meta">
        <p class="chat-item-name">${esc(item.user.display_name || item.user.username)}</p>
        <p class="chat-item-preview">${item.id ? '@' + esc(item.user.username) : 'Toca para escribir ✨'}</p>
      </div>
    </button>`).join('')
}

function renderChatPlaceholder() {
  $('chat-header').innerHTML = '<div class="chat-header-empty">Selecciona un contacto</div>'
  $('chat-messages').innerHTML =
    '<div class="chat-empty-state">Elige a alguien de la lista para empezar a chatear 💬</div>'
}

async function renderMessages(convId, onlyIfChanged = false) {
  const box = $('chat-messages')

  const { data, error } = await db
    .from('messages')
    .select('*')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Error cargando mensajes:', error)

    if (!onlyIfChanged) {
      box.innerHTML = '<div class="chat-empty-state">No se pudieron cargar los mensajes.</div>'
    }

    return
  }

  /* la persona cambió de chat mientras cargaba */
  if (convId !== currentConversationId) return

  const msgs = (data || []).reverse()
  const sig = msgs.length + ':' + (msgs[msgs.length - 1]?.id || '')

  if (onlyIfChanged && sig === lastMsgSig) return

  lastMsgSig = sig

  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80

  if (!msgs.length) {
    box.innerHTML = '<div class="chat-empty-state">No hay mensajes todavía. ¡Escribe el primero! ✨</div>'
    return
  }

  box.innerHTML = msgs.map(m => `
    <div class="chat-message ${m.sender_id === me.id ? 'mine' : 'other'}">
      <div>${esc(m.body || '')}</div>
      <span class="chat-message-time">${ago(m.created_at)}</span>
    </div>`).join('')

  if (!onlyIfChanged || nearBottom) box.scrollTop = box.scrollHeight
}

async function renderChatWindow(userId, convId) {
  lastMsgSig = ''

  const profile = await ensureChatProfile(userId)

  /* la persona cambió de chat mientras cargaba */
  if (userId !== currentChatUserId) return

  if (!profile) {
    $('chat-header').innerHTML = '<div class="chat-header-empty">No se encontró a esta persona</div>'
    $('chat-messages').innerHTML = '<div class="chat-empty-state">No se pudo abrir este chat.</div>'
    return
  }

  const name = esc(profile.display_name || profile.username)

  $('chat-header').innerHTML = `
    <img src="${av(profile.avatar_url)}" class="chat-header-avatar" alt="" data-profile="${profile.id}" title="Ver perfil">
    <div data-profile="${profile.id}" title="Ver perfil">
      <p class="chat-header-name">${name}</p>
      <span class="chat-header-status">@${esc(profile.username)}</span>
    </div>`

  if (!convId) {
    $('chat-messages').innerHTML =
      `<div class="chat-empty-state">Todavía no hablas con ${name}.<br>¡Escribe el primer mensaje! ✨</div>`
    return
  }

  await renderMessages(convId)
}

async function loadConversations() {
  const heading = document.querySelector('.chat-sidebar-header h3')
  if (heading) heading.textContent = 'Tus contactos 💬'

  const list = await buildChatList()

  chatListCache = list

  if (currentChatUserId) {
    const item = list.find(i => i.user.id === currentChatUserId)
    currentConversationId = item ? item.id : null
  } else {
    const first = list.find(i => i.id)

    if (first) {
      currentChatUserId = first.user.id
      currentConversationId = first.id
    }
  }

  renderChatList(list)

  if (currentChatUserId) {
    await renderChatWindow(currentChatUserId, currentConversationId)
  } else {
    renderChatPlaceholder()
  }
}

/* Actualiza solo la lista (y engancha la conversación si la otra persona escribió primero) */
async function refreshChatList() {
  const list = await buildChatList()

  chatListCache = list

  if (currentChatUserId && !currentConversationId) {
    const item = list.find(i => i.user.id === currentChatUserId)

    if (item && item.id) {
      currentConversationId = item.id
      await renderMessages(item.id)
    }
  }

  renderChatList(list)
}

async function openChatWithUser(userId) {
  if (!userId || userId === me.id) return

  currentChatUserId = userId

  const known = chatListCache.find(i => i.user.id === userId)

  currentConversationId = known?.id || (await findConversation(userId))

  const profile = await ensureChatProfile(userId)

  if (profile && !known) chatListCache.unshift({ id: currentConversationId, user: profile })

  renderChatList(chatListCache)

  await renderChatWindow(userId, currentConversationId)
}

async function sendChatMessage() {
  const input = $('chat-input')
  const text = input.value.trim()

  if (!text) return

  if (!currentChatUserId) {
    alert('Elige un contacto primero 💬')
    return
  }

  const sendBtn = $('chat-form').querySelector('button')

  sendBtn.disabled = true

  try {
    if (!currentConversationId) {
      const created = await getOrCreateConversation(currentChatUserId)
      if (!created) return
    }

    const convId = currentConversationId

    const { error } = await db.from('messages').insert({
      conversation_id: convId,
      sender_id: me.id,
      body: text
    })

    if (error) {
      console.error('Error enviando mensaje:', error)
      alert('No se pudo enviar el mensaje: ' + error.message)
      return
    }

    input.value = ''

    /* sube la conversación al inicio de la lista */
    await db.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)

    await renderMessages(convId)
    await refreshChatList()
  } finally {
    sendBtn.disabled = false
    input.focus()
  }
}

/* Revisa mensajes nuevos cada pocos segundos mientras el chat está abierto */
function stopChatPolling() {
  if (chatTimer) {
    clearInterval(chatTimer)
    chatTimer = null
  }
}

function startChatPolling() {
  stopChatPolling()

  chatTick = 0

  chatTimer = setInterval(async () => {
    if (document.hidden || !me || !$('chat-page').classList.contains('active')) return

    chatTick++

    try {
      if (currentConversationId) await renderMessages(currentConversationId, true)
      if (chatTick % 4 === 0) await refreshChatList()
    } catch (err) {
      console.error('Error actualizando el chat:', err)
    }
  }, 5000)
}


/* ====== EVENTOS ====== */
function wire() {

  /* ----- login / registro ----- */
  $('auth-toggle').addEventListener('click', e => {
    e.preventDefault()
    setMode(mode === 'in' ? 'up' : 'in')
  })

  $('auth-form').addEventListener('submit', async e => {
    e.preventDefault()

    const email = $('auth-email').value.trim()
    const password = $('auth-pass').value

    if (!email || !password) {
      $('auth-msg').textContent = 'Completa tu correo y contraseña.'
      return
    }

    let result

    if (mode === 'in') {
      result = await db.auth.signInWithPassword({ email, password })
    } else {
      const username = $('auth-user').value.trim()

      if (!username) {
        $('auth-msg').textContent = 'Escribe un nombre de usuario.'
        return
      }

      result = await db.auth.signUp({ email, password, options: { data: { username } } })
    }

    const { data, error } = result

    if (error) {
      console.error('ERROR AUTH:', error)
      $('auth-msg').textContent = error.message
      return
    }

    $('auth-msg').textContent = mode === 'up' ? 'Si te pide confirmar, revisa tu correo. ✨' : ''

    if (mode === 'in' && data?.session) await route(data.session)
  })

  /* ----- navegación ----- */
  document.querySelectorAll('.nav-link').forEach(l => {
    l.addEventListener('click', e => {
      e.preventDefault()

      if (l.dataset.page === 'profile') viewId = me.id

      showPage(l.dataset.page)
    })
  })

  /* ----- publicar ----- */
  $('quick-publish-btn').addEventListener('click', () => publish($('quick-post-input').value, null))
  $('full-publish-btn').addEventListener('click', () => publish($('full-post-input').value, pickedFile))

  const [photoBtn, emojiBtn] = document.querySelectorAll('.btn-compose')

  if (photoBtn) photoBtn.addEventListener('click', () => showPage('create'))
  if (emojiBtn) emojiBtn.addEventListener('click', () => { $('quick-post-input').value += '✨' })

  $('draft-btn').addEventListener('click', () => {
    localStorage.setItem('mystyle-draft', $('full-post-input').value)
    alert('Borrador guardado en este dispositivo 💾')
  })

  $('upload-area').addEventListener('click', () => $('file-input').click())

  $('file-input').addEventListener('change', e => {
    pickedFile = e.target.files[0] || null

    if (!pickedFile) return

    $('preview-img').src = URL.createObjectURL(pickedFile)
    $('preview-container').classList.remove('hidden')
  })

  $('remove-preview').addEventListener('click', clearPreview)

  /* ----- búsqueda ----- */
  let timer

  $('search-input').addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(loadExplore, 300)
  })

  /* ----- editar perfil ----- */
  const openEdit = () => {
    $('edit-name').value = me.display_name || ''
    $('edit-bio').value = me.bio || ''
    $('edit-avatar').value = me.avatar_url || ''
    $('edit-mood').value = me.mood || ''
    $('edit-profile-modal').classList.remove('hidden')
  }

  const closeEdit = () => $('edit-profile-modal').classList.add('hidden')

  $('edit-profile-btn').addEventListener('click', openEdit)

  $('edit-profile-main').addEventListener('click', () => {
    if (viewId === me.id) openEdit()
  })

  $('modal-close').addEventListener('click', closeEdit)

  $('edit-profile-modal').addEventListener('click', e => {
    if (e.target === $('edit-profile-modal')) closeEdit()
  })

  $('edit-form').addEventListener('submit', async e => {
    e.preventDefault()

    const file = $('edit-avatar-file').files[0]

    const avatar_url = file
      ? await upload(file, 'avatar-')
      : ($('edit-avatar').value.trim() || null)

    const ok = await saveProfile({
      display_name: $('edit-name').value || me.display_name,
      bio: $('edit-bio').value,
      mood: $('edit-mood').value,
      avatar_url
    })

    if (ok) {
      closeEdit()
      $('edit-avatar-file').value = ''

      if (!$('profile-page').classList.contains('active')) return

      openProfile(me.id)
    }
  })

  /* ----- botón "Mensaje" del perfil: abre el chat con esa persona ----- */
  const messageBtn = $('message-profile-btn')

  if (messageBtn) {
    messageBtn.addEventListener('click', async () => {
      const userId = messageBtn.dataset.messageUser

      if (!userId || userId === me.id) return

      currentChatUserId = userId
      currentConversationId = null

      await showPage('chat')

      focusChatInput(true)
    })
  }

  /* ----- pestañas del perfil ----- */
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(x => x.classList.toggle('active', x === b))

      document.querySelectorAll('.tab-pane').forEach(p =>
        p.classList.toggle('active', p.dataset.tab === b.dataset.tab))
    })
  })

  /* ----- configuración ----- */
  $('settings-form').addEventListener('submit', async e => {
    e.preventDefault()

    const ok = await saveProfile({
      display_name: $('settings-name').value || me.display_name,
      bio: $('settings-bio').value,
      mood: $('settings-mood').value
    })

    if (ok) alert('Cambios guardados ✨')
  })

  $('clear-data-btn').addEventListener('click', () => db.auth.signOut())

  /* ----- chat ----- */
  $('chat-form').addEventListener('submit', async e => {
    e.preventDefault()
    await sendChatMessage()
  })

  /* ----- clics en elementos creados dinámicamente ----- */
  document.addEventListener('click', async e => {
    const theme = e.target.closest('.theme-card')

    if (theme) return applyTheme(theme.dataset.theme)

    const goto = e.target.closest('[data-goto]')

    if (goto) return showPage(goto.dataset.goto)

    const chatUser = e.target.closest('[data-chat-user]')

    if (chatUser) {
      await openChatWithUser(chatUser.dataset.chatUser)
      focusChatInput()
      return
    }

    const t = e.target.closest('[data-like],[data-reply],[data-share],[data-profile],[data-follow]')

    if (!t) return

    const d = t.dataset

    /* perfil */
    if (d.profile) {
      viewId = d.profile
      showPage('profile')
      return
    }

    /* seguir */
    if (d.follow) {
      const on = d.on === 'true'

      await toggleFollow(d.follow, on)

      t.dataset.on = String(!on)
      t.textContent = on ? 'Agregar ✨' : 'Siguiendo ✓'

      return
    }

    /* me gusta */
    if (d.like) {
      const liked = d.liked === 'true'
      const tb = db.from('likes')

      const { error } = liked
        ? await tb.delete().match({ user_id: me.id, post_id: d.like })
        : await tb.insert({ user_id: me.id, post_id: d.like })

      if (error) return alert(error.message)

      const current = parseInt((t.textContent.match(/\d+/) || ['0'])[0], 10)

      t.textContent = '💜 ' + (current + (liked ? -1 : 1))
      t.classList.toggle('on', !liked)
      t.dataset.liked = String(!liked)

      return
    }

    /* respuestas */
    if (d.reply) {
      const box = $('r-' + d.reply)

      box.classList.toggle('hidden')

      if (!box.classList.contains('hidden')) loadReplies(d.reply)

      return
    }

    /* compartir */
    if (d.share) {
      navigator.clipboard?.writeText(location.href.split('#')[0] + '#post-' + d.share)
      alert('Enlace copiado 🔗')
    }
  })

  /* ----- responder a un post ----- */
  document.addEventListener('submit', async e => {
    const f = e.target.closest('.reply-form')

    if (!f) return

    e.preventDefault()

    const body = f.querySelector('input').value.trim()

    if (!body) return

    const { error } = await db.from('replies').insert({
      post_id: f.dataset.form,
      author_id: me.id,
      body
    })

    if (error) return alert(error.message)

    await loadReplies(f.dataset.form)

    const b = document.querySelector(`[data-reply="${f.dataset.form}"]`)
    const oldCount = parseInt(b.textContent.replace(/\D/g, '')) || 0

    b.textContent = '💬 ' + (oldCount + 1)
  })
}


/* ====== INICIO ====== */
async function start() {
  if (!window.supabase) {
    alert('No se pudo cargar Supabase desde internet. Revisa tu conexión.')
    return
  }

  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

  wire()

  const { data } = await db.auth.getSession()

  await route(data.session)

  db.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => route(session), 0)
  })
}


/* ====== ERRORES ====== */
window.addEventListener('unhandledrejection', e => {
  console.error('Promise error:', e.reason)
})

window.addEventListener('error', e => {
  console.error('JS error:', e.error || e.message)
})


/* ====== ARRANQUE ====== */
document.addEventListener('DOMContentLoaded', start)
