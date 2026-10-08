/* =====================================================================
   chat-extra.css — pegar AL FINAL de style.css (después de extra-plus.css)
   - Da estilo de escritorio al botón "Mensaje" del perfil
   - Adapta el chat a los colores y formas de cada tema
   ===================================================================== */

/* ---------- botones del perfil: Agregar / Editar + Mensaje ---------- */
.profile-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}

/* el selector doble gana a la regla móvil, que usa un azul fijo */
.profile-actions .btn-message-profile{
  background:color-mix(in srgb,var(--color-primary) 14%,transparent);
  color:var(--color-primary);
  border:var(--bw,1.5px) var(--bs,solid) var(--border-color);
  border-radius:var(--btn-rad,12px);
  padding:10px 18px;font-weight:700;cursor:pointer;
  font-family:var(--btn-font,var(--font,inherit));
}
.profile-actions .btn-message-profile:hover{
  background:color-mix(in srgb,var(--color-primary) 26%,transparent);
  opacity:1;
}

/* ---------- marco del chat ---------- */
.chat-layout{
  background-color:var(--card-bg);background-image:var(--card-img,none);
  border:var(--bw,1.5px) var(--bs,solid) var(--border-color);
  border-radius:var(--rad,20px);box-shadow:var(--shadow);
}
.chat-sidebar{background:color-mix(in srgb,var(--text-primary) 4%,transparent)}
.chat-sidebar-header h3{font-family:var(--head-font,inherit);text-shadow:none}

/* ---------- lista de contactos ---------- */
.chat-item{
  border-radius:calc(var(--rad,20px)*.6);
  background:color-mix(in srgb,var(--color-primary) 8%,transparent);
  font-family:inherit;
}
.chat-item.new{border-style:dashed;background:transparent}
.chat-item:hover{background:color-mix(in srgb,var(--color-primary) 16%,transparent)}
.chat-item.active{
  background:color-mix(in srgb,var(--color-primary) 22%,transparent);
  border-color:var(--color-primary);
}
.chat-item-avatar,.chat-header-avatar{
  border:var(--av-bd,2px solid var(--color-secondary));
  border-radius:var(--av-rad,50%);
  filter:var(--img-filter,none);
}

/* ---------- cabecera de la conversación ---------- */
.chat-header [data-profile]{cursor:pointer}
.chat-header-name{font-family:var(--head-font,inherit)}

/* ---------- burbujas ---------- */
.chat-message{border-radius:calc(var(--rad,20px)*.7)}
.chat-message.mine{
  background:var(--btn-bg,linear-gradient(135deg,var(--color-primary),var(--color-accent)));
  color:var(--btn-fg,#fff);
  border:var(--btn-bd,0 solid transparent);
  box-shadow:var(--btn-sh,none);
}
.chat-message.other{
  background:color-mix(in srgb,var(--color-primary) 10%,var(--card-bg));
  border:1px solid var(--border-color);
  color:var(--text-primary);
}
.chat-message-time{opacity:.75}

/* ---------- estados vacíos ---------- */
.chat-empty-state .btn-publish{margin-top:12px}
