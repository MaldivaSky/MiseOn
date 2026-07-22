-- ChatAdmin profissional (§7.2): nome do contato direto na conversa.
-- Para WhatsApp vem do perfil (contacts[].profile.name); para vitrine
-- pode ser preenchido quando o cliente se identificar.

alter table chat_conversations
  add column if not exists cliente_nome text;
