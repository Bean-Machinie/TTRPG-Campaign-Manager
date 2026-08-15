-- Record the developer-friendly Markdown source used to verify and maintain
-- the built-in SRD 5.2.1 character catalog. The official SRD remains the
-- licensed source; this URL identifies the conversion used by the application.
update public.game_systems
set definition = jsonb_set(
  definition,
  '{license,referenceUrl}',
  to_jsonb('https://github.com/downfallx/dnd-5e-srd-markdown'::text),
  true
)
where key = 'dnd5e';
