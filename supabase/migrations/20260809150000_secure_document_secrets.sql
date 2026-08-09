-- A shared document row can contain GM-only cells. Row-level security protects
-- the document, but cannot protect one JSON subtree inside that row. Readers
-- therefore fetch bodies through this RPC, which removes secret nodes before
-- a player receives the JSON at all.

create or replace function public.redact_document_secrets(p_node jsonb)
returns jsonb
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_node is null then
    return null;
  end if;

  if jsonb_typeof(p_node) = 'object' and p_node ->> 'type' = 'secret' then
    return null;
  end if;

  if jsonb_typeof(p_node) = 'array' then
    select coalesce(jsonb_agg(item.value), '[]'::jsonb)
      into result
      from (
        select public.redact_document_secrets(value) as value
        from jsonb_array_elements(p_node)
      ) as item
      where item.value is not null;
    return result;
  end if;

  if jsonb_typeof(p_node) = 'object' then
    select coalesce(jsonb_object_agg(entry.key, public.redact_document_secrets(entry.value)), '{}'::jsonb)
      into result
      from jsonb_each(p_node) as entry;
    return result;
  end if;

  return p_node;
end;
$$;

revoke all on function public.redact_document_secrets(jsonb) from public;

create or replace function public.get_campaign_document(p_document_id uuid)
returns table (
  id uuid,
  title text,
  doc_type text,
  visibility text,
  author_id uuid,
  updated_at timestamptz,
  content jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.id,
    d.title,
    d.doc_type,
    d.visibility,
    d.author_id,
    d.updated_at,
    case
      when public.can_manage_campaign(d.campaign_id) then d.content
      else public.redact_document_secrets(d.content)
    end,
    d.created_at
  from public.campaign_documents as d
  where d.id = p_document_id
    and public.can_read_visibility(d.campaign_id, d.visibility, d.author_id);
$$;

revoke all on function public.get_campaign_document(uuid) from public;
grant execute on function public.get_campaign_document(uuid) to authenticated;

-- Prevent bypassing the redacting RPC with a direct PostgREST column select.
revoke select on public.campaign_documents from authenticated;
grant select (
  id,
  campaign_id,
  title,
  doc_type,
  visibility,
  author_id,
  created_at,
  updated_at
) on public.campaign_documents to authenticated;
