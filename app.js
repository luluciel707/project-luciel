/* ====== CLAVES DE SUPABASE ====== */
const SUPABASE_URL = 'https://sayehiisneupxkivuqmo.supabase.co'
const SUPABASE_KEY = 'sb_publishable_VyxX3M6CsBNEhRw_BwojtA_bPP_36wa'

/* ====== TEMAS ====== */
const T = [
  ['jirai','Jirai Kei','#ff7eb6','#2a1830'],
  ['cutecore','Cutecore','#ff9ccb','#fff0f6'],
  ['y2k','Y2K','#ff3fb4','#00ccff'],
  ['frutiger','Frutiger Aero','#2aa8ff','#8fd3ff'],
  ['webcore','Webcore','#0000ee','#008080'],
  ['weirdcore','Weirdcore','#e00000','#dcd7c9'],
  ['cybercore','Cybercore','#00ff88','#ff006e'],
  ['fairycore','Fairycore','#ff8fc7','#9a7fd1'],
  ['scene','Scene','#ff2e9a','#b6ff00'],
  ['gothic','Gothic','#a78bfa','#f472b6'],
  ['pastel','Pastel Dreams','#d946ef','#ec4899'],
  ['retro','Retro','#d9482b','#f3e3c3'],
  ['vaporwave','Vaporwave','#ff71ce','#01cdfe'],
  ['minimal','Minimalista','#111111','#dddddd']
]

const THEMES = Object.fromEntries(T.map(([id, name, a, b]) => [id, { name, preview: `linear-gradient(135deg, ${a}, ${b})`, class: 'theme-' + id }]))

const $ = id => document.getElementById(id)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23d8b4fe"/><text x="50" y="66" font-size="52" text-anchor="middle">🙂</text></svg>'
const av = u => esc(u || DEFAULT_AVATAR)
const ago = d => {
  const s = (Date.now() - new Date(d)) / 1000
  if (s < 60) return 'ahora'
  if (s < 3600) return Math.floor(s / 60) + ' min'
  if (s < 86400) return Math.floor(s / 3600) + ' h'
  return new Date(d).toLocaleDateString('es')
}

let db, me = null, viewId = null, pickedFile = null, mode = 'in', lastId
let currentChatUserId = null
let currentConversationId = null

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
  const id = session?.user.id || null
  if (id === lastId) return
  lastId = id
  if (!id) {
    me = null
    viewId = null
    $('auth-screen').classList.remove('hidden')
    return
  }

  const { data, error } = await db.from('profiles').select('*').eq('id', id).single()
  if (error || !data) {
    $('auth-msg').textContent = 'No se encontró tu perfil. Ejecuta schema.sql en Supabase y vuelve a entrar.'
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
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === n + '-page'))
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === n))

  if (n === 'feed') loadFeed()
  else if (n === 'explore') loadExplore()
  else if (n === 'profile') openProfile(viewId || me.id)
  else if (n === 'settings') fillSettings()
  else if (n === 'chat') loadConversations()
}

/* ====== PERFIL MINI ====== */
async function refreshMini() {
  const [p, f] = await Promise.all([
    db.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', me.id),
    db.from('friendships').select('*', { count: 'exact', head: true }).eq('user_id', me.id),
  ])

  $('mini-name').textContent = me.display_name
  $('mini-handle').textContent = '@' + me.username
  $('mini-bio').textContent = me.bio || ''
  $('current-mood').textContent = me.mood || '—'
  $('mini-posts').textContent = p.count ?? 0
  $('mini-friends').textContent = f.count ?? 0
  $('mini-avatar').src = $('composer-avatar').src = me.avatar_url || DEFAULT_AVATAR
}

/* ====== TEMAS ====== */
function renderThemes() {
  $('themes-grid').innerHTML = Object.entries(THEMES).map(([k, t]) => `
    <button class="theme-card ${k === me.theme ? 'active' : ''}" data-theme="${k}">
      <div class="theme-preview" style="background:${t.preview}"></div>
      <div class="theme-name">${t.name}</div>
    </button>
  `).join('')
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
  document.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === k))
  if (save) await db.from('profiles').update({ theme: k }).eq('id', me.id)
}

/* ====== PUBLICACIONES ====== */
async function fetchPosts(authorId) {
  let q = db.from('posts')
    .select('*, author:profiles!author_id(id,username,display_name,avatar_url), likes(user_id), replies(count)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (authorId) q = q.eq('author_id', authorId)

  const r = await q
  if (r.error) alert('Error al cargar publicaciones: ' + r.error.message)
  return r.data || []
}

const postHtml = p => {
  const a = p.author
  const liked = p.likes.some(l => l.user_id === me.id)

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
        <button class="post-action ${liked ? 'on' : ''}" data-like="${p.id}" data-liked="${liked}">
          💜 ${p.likes.length}
        </button>

        <button class="post-action" data-reply="${p.id}">
          💬 ${p.replies?.[0]?.count || 0}
        </button>

        <button class="post-action" data-share="${p.id}">
          ↻ Compartir
        </button>
      </div>

      <div class="replies hidden" id="r-${p.id}"></div>
    </article>
  `
}

async function loadFeed() {
  const posts = await fetchPosts()
  $('feed-posts').innerHTML = posts.map(postHtml).join('') || '<p class="card" style="padding:16px">Aún no hay publicaciones. ¡Escribe la primera! ✨</p>'
}

async function loadReplies(id) {
  const { data } = await db.from('replies')
    .select('*, author:profiles!author_id(username)')
    .eq('post_id', id)
    .order('created_at')

  $('r-' + id).innerHTML =
    (data || []).map(r => `<p class="reply"><strong>@${esc(r.author.username)}</strong> ${esc(r.body)}</p>`).join('') +
    `<form class="reply-form" data-form="${id}"><input placeholder="Responder…" required maxlength="300"><button class="btn-publish">Enviar</button></form>`
}

async function upload(file, prefix = '') {
  const path = `${me.id}/${prefix}${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
  const { error } = await db.storage.from('media').upload(path, file)
  if (error) {
    alert('No se pudo subir la imagen: ' + error.message)
    return null
  }
  return db.storage.from('media').getPublicUrl(path).data.publicUrl
}

async function publish(text, file) {
  text = text.trim()
  if (!text && !file) return alert('Escribe algo primero 💭')

  let image_url = null
  if (file) {
    image_url = await upload(file)
    if (!image_url) return
  }

  const { error } = await db.from('posts').insert({
    author_id: me.id,
    body: text,
    image_url
  })

  if (error) return alert('No se pudo publicar: ' + error.message)

  $('quick-post-input').value = $('full-post-input').value = ''
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

  $('explore-users').innerHTML = (data || []).map(u => `
    <div class="user-card">
      <img src="${av(u.avatar_url)}" alt="" data-profile="${u.id}">
      <h4 data-profile="${u.id}">${esc(u.display_name)}</h4>
      <p>@${esc(u.username)}</p>
      <button class="user-btn" data-follow="${u.id}" data-on="${mine.has(u.id)}">
        ${mine.has(u.id) ? 'Siguiendo ✓' : 'Agregar ✨'}
      </button>
    </div>
  `).join('') || '<p>No se encontraron personas.</p>'
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
    own ? { data: [] } : db.from('friendships').select('friend_id').match({ user_id: me.id, friend_id: id }),
  ])

  const p = pr.data
  if (!p) return

  const friends = (fr.data || []).map(x => x.friend)
  const common = cm.data || []
  const following = (fl.data || []).length > 0

  setSectionTheme(p.theme)
  $('profile-name').textContent = p.display_name
  $('profile-handle').textContent = '@' + p.username
  $('profile-bio').textContent = p.bio || ''
  $('about-bio').textContent = p.bio || 'Todavía no hay biografía.'
  $('profile-avatar').src = p.avatar_url || DEFAULT_AVATAR
  $('profile-joined').textContent = 'Se unió en ' + new Date(p.created_at).toLocaleDateString('es', { month: 'long', year: 'numeric' })
  $('profile-common').textContent = own
    ? ''
    : `${common.length} amigos en común` + (common.length ? ': ' + common.map(c => '@' + c.username).join(', ') : '')

  $('profile-stat-posts').textContent = posts.length
  $('profile-stat-friends').textContent = friends.length
  $('profile-stat-likes').textContent = posts.reduce((n, x) => n + x.likes.length, 0)

  const btn = $('edit-profile-main')
  if (own) {
    delete btn.dataset.follow
    btn.textContent = '✏️ Editar'
  } else {
    btn.dataset.follow = id
    btn.dataset.on = following
    btn.textContent = following ? 'Siguiendo ✓' : 'Agregar ✨'
  }

  $('profile-posts').innerHTML = posts.map(postHtml).join('') || '<p style="text-align:center">Aún no hay publicaciones.</p>'
  $('profile-friends').innerHTML = friends.map(f => `
    <div class="friend-card" data-profile="${f.id}">
      <img src="${av(f.avatar_url)}" alt="">
      <h4>${esc(f.display_name)}</h4>
      <p>@${esc(f.username)}</p>
    </div>
  `).join('') || '<p>Todavía no tiene amigos.</p>'
}

/* ====== CONFIGURACIÓN Y EDICIÓN ====== */
function fillSettings() {
  $('settings-name').value = me.display_name || ''
  $('settings-username').value = me.username
  $('settings-bio').value = me.bio || ''
  $('settings-mood').value = me.mood || ''
}

async function saveProfile(fields) {
  const { data, error } = await db.from('profiles').update(fields).eq('id', me.id).select().single()
  if (error) return alert('No se pudo guardar: ' + error.message), false
  me = data
  refreshMini()
  return true
}

/* ====== CHAT ====== */
async function getOrCreateConversation(otherUserId) {
  if (!otherUserId || otherUserId === me.id) return null

  const { data: a } = await db
    .from('conversations')
    .select('*')
    .match({ user_a: me.id, user_b: otherUserId })

  if (a && a.length) {
    currentConversationId = a[0].id
    currentChatUserId = otherUserId
    return a[0].id
  }

  const { data: b } = await db
    .from('conversations')
    .select('*')
    .match({ user_a: otherUserId, user_b: me.id })

  if (b && b.length) {
    currentConversationId = b[0].id
    currentChatUserId = otherUserId
    return b[0].id
  }

  const { data: inserted, error } = await db
    .from('conversations')
    .insert({ user_a: me.id, user_b: otherUserId })
    .select()
    .single()

  if (error) {
    alert('No se pudo crear la conversación: ' + error.message)
    return null
  }

  currentConversationId = inserted.id
  currentChatUserId = otherUserId
  return inserted.id
}

async function loadConversations() {
  const { data, error } = await db
    .from('conversations')
    .select(`
      id,
      user_a,
      user_b,
      updated_at,
      user_a_profile:profiles!user_a(id, display_name, username, avatar_url),
      user_b_profile:profiles!user_b(id, display_name, username, avatar_url)
    `)
    .or(`user_a.eq.${me.id},user_b.eq.${me.id}`)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error(error)
    return
  }

  const list = (data || []).map(c => {
    const other = c.user_a === me.id ? c.user_b_profile : c.user_a_profile
    return {
      id: c.id,
      user: other,
      updated_at: c.updated_at
    }
  })

  if (!list.length) {
    $('chat-list').innerHTML = '<div class="chat-empty-state">Todavía no tienes chats.</div>'
    $('chat-header').innerHTML = '<div class="chat-header-empty">Selecciona un chat</div>'
    $('chat-messages').innerHTML = '<div class="chat-empty-state">No hay mensajes todavía.</div>'
    return
  }

  const last = list[0]
  currentChatUserId = last.user.id
  currentConversationId = last.id
  renderChatList(list)
  await renderChatWindow(currentChatUserId, currentConversationId)
}

function renderChatList(list) {
  $('chat-list').innerHTML = list.map(item => `
    <button class="chat-item ${currentChatUserId === item.user.id ? 'active' : ''}" data-chat-user="${item.user.id}">
      <img src="${av(item.user.avatar_url)}" class="chat-item-avatar" alt="">
      <div class="chat-item-meta">
        <p class="chat-item-name">${esc(item.user.display_name)}</p>
        <p class="chat-item-preview">@${esc(item.user.username)}</p>
      </div>
    </button>
  `).join('')
}

async function renderChatWindow(userId, conversationId) {
  if (!userId || !conversationId) {
    $('chat-header').innerHTML = '<div class="chat-header-empty">Selecciona un chat</div>'
    $('chat-messages').innerHTML = '<div class="chat-empty-state">No hay mensajes todavía.</div>'
    return
  }

  const { data: profile } = await db
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .eq('id', userId)
    .single()

  const { data: messages } = await db
    .from('messages')
    .select('*, sender:profiles!sender_id(id, username, display_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  $('chat-header').innerHTML = `
    <img src="${av(profile?.avatar_url)}" class="chat-header-avatar" alt="">
    <div>
      <p class="chat-header-name">${esc(profile?.display_name || 'Usuario')}</p>
      <span class="chat-header-status">@${esc(profile?.username || '')}</span>
    </div>
  `

  if (!messages || !messages.length) {
    $('chat-messages').innerHTML = '<div class="chat-empty-state">No hay mensajes todavía. ¡Escribe el primero!</div>'
    return
  }

  $('chat-messages').innerHTML = messages.map(msg => {
    const mine = msg.sender_id === me.id
    const sender = msg.sender
    return `
      <div class="chat-message ${mine ? 'mine' : 'other'}">
        <div>${esc(msg.body || '')}</div>
        <span class="chat-message-time">${ago(msg.created_at)} • ${esc(sender.display_name)}</span>
      </div>
    `
  }).join('')
}

async function sendChatMessage() {
  const input = $('chat-input')
  const text = input.value.trim()
  if (!text || !currentConversationId) return

  const { error } = await db.from('messages').insert({
    conversation_id: currentConversationId,
    sender_id: me.id,
    body: text
  })

  if (error) {
    alert('No se pudo enviar el mensaje: ' + error.message)
    return
  }

  input.value = ''
  await renderChatWindow(currentChatUserId, currentConversationId)
  await loadConversations()
}

function openChatWithUser(userId) {
  currentChatUserId = userId
  getOrCreateConversation(userId).then(async () => {
    await renderChatWindow(currentChatUserId, currentConversationId)
    await loadConversations()
  })
}

/* ====== EVENTOS ====== */
function wire() {
  $('auth-toggle').addEventListener('click', e => {
    e.preventDefault()
    setMode(mode === 'in' ? 'up' : 'in')
  })

  $('auth-form').addEventListener('submit', async e => {
    e.preventDefault()
    const email = $('auth-email').value
    const password = $('auth-pass').value

    const { error } = mode === 'in'
      ? await db.auth.signInWithPassword({ email, password })
      : await db.auth.signUp({
          email,
          password,
          options: { data: { username: $('auth-user').value.trim() } }
        })

    $('auth-msg').textContent = error
      ? error.message
      : mode === 'up'
        ? 'Si te pide confirmar, revisa tu correo.'
        : ''
  })

  document.querySelectorAll('.nav-link').forEach(l => {
    l.addEventListener('click', e => {
      e.preventDefault()
      if (l.dataset.page === 'profile') viewId = me.id
      showPage(l.dataset.page)
    })
  })

  $('quick-publish-btn').addEventListener('click', () => publish($('quick-post-input').value, null))
  $('full-publish-btn').addEventListener('click', () => publish($('full-post-input').value, pickedFile))

  const [photoBtn, emojiBtn] = document.querySelectorAll('.btn-compose')
  photoBtn.addEventListener('click', () => showPage('create'))
  emojiBtn.addEventListener('click', () => { $('quick-post-input').value += '✨' })

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

  let timer
  $('search-input').addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(loadExplore, 300)
  })

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
    const avatar_url = file ? await upload(file, 'avatar-') : ($('edit-avatar').value.trim() || null)

    if (await saveProfile({
      display_name: $('edit-name').value || me.display_name,
      bio: $('edit-bio').value,
      mood: $('edit-mood').value,
      avatar_url
    })) {
      closeEdit()
      $('edit-avatar-file').value = ''
      if (!$('profile-page').classList.contains('active')) return
      openProfile(me.id)
    }
  })

  document.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(x => x.classList.toggle('active', x === b))
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.dataset.tab === b.dataset.tab))
    })
  })

  $('settings-form').addEventListener('submit', async e => {
    e.preventDefault()
    if (await saveProfile({
      display_name: $('settings-name').value || me.display_name,
      bio: $('settings-bio').value,
      mood: $('settings-mood').value
    })) alert('Cambios guardados ✨')
  })

  $('clear-data-btn').addEventListener('click', () => db.auth.signOut())

  $('chat-form').addEventListener('submit', async e => {
    e.preventDefault()
    await sendChatMessage()
  })

  document.addEventListener('click', async e => {
    const theme = e.target.closest('.theme-card')
    if (theme) return applyTheme(theme.dataset.theme)

    const chatUser = e.target.closest('[data-chat-user]')
    if (chatUser) {
      openChatWithUser(chatUser.dataset.chatUser)
      return
    }

    const t = e.target.closest('[data-like],[data-reply],[data-share],[data-profile],[data-follow]')
    if (!t) return

    const d = t.dataset
    if (d.profile) {
      viewId = d.profile
      showPage('profile')
    } else if (d.follow) {
      const on = d.on === 'true'
      await toggleFollow(d.follow, on)
      t.dataset.on = String(!on)
      t.textContent = on ? 'Agregar ✨' : 'Siguiendo ✓'
    } else if (d.like) {
      const liked = d.liked === 'true'
      const tb = db.from('likes')

      const { error } = liked
        ? await tb.delete().match({ user_id: me.id, post_id: d.like })
        : await tb.insert({ user_id: me.id, post_id: d.like })

      if (error) return alert(error.message)

      const countEl = t.textContent
      const current = parseInt((countEl.match(/\d+/) || ['0'])[0], 10)
      t.textContent = '💜 ' + (current + (liked ? -1 : 1))
      t.classList.toggle('on', !liked)
      t.dataset.liked = String(!liked)
    } else if (d.reply) {
      const box = $('r-' + d.reply)
      box.classList.toggle('hidden')
      if (!box.classList.contains('hidden')) loadReplies(d.reply)
    } else if (d.share) {
      navigator.clipboard?.writeText(location.href.split('#')[0] + '#post-' + d.share)
      alert('Enlace copiado 🔗')
    }
  })

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
    b.textContent = '💬 ' + (parseInt(b.textContent.replace(/\D/g, '')) + 1)
  })
}

/* ====== INICIO ====== */
async function start() {
  if (!window.supabase) return alert('No se pudo cargar Supabase desde internet. Revisa tu conexión.')

  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  wire()

  const { data } = await db.auth.getSession()
  await route(data.session)

  db.auth.onAuthStateChange((_e, s) => setTimeout(() => route(s), 0))
}

window.addEventListener('unhandledrejection', e => console.error(e.reason))
document.addEventListener('DOMContentLoaded', start)