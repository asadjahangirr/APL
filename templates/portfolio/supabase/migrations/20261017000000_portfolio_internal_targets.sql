-- Allow published portfolio cards to open a page in this exported website.
-- Additive migration: existing records and publications remain intact.
create or replace function public.cms_portfolio_payload_valid(p_payload jsonb, p_id uuid, p_published boolean)
returns boolean language plpgsql immutable set search_path = '' as $$
declare field text; image_path text; target jsonb; expected_fields integer := 6;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then return false; end if;
  if p_payload ? 'target' then expected_fields := 7; end if;
  if (select count(*) from jsonb_object_keys(p_payload)) <> expected_fields then return false; end if;
  foreach field in array array['title','summary','category','externalUrl','image','imageAlt'] loop
    if coalesce(jsonb_typeof(p_payload->field), '') <> 'string' then return false; end if;
  end loop;
  if char_length(p_payload->>'title') > 120 or char_length(p_payload->>'category') > 80
    or char_length(p_payload->>'summary') > 320 or char_length(p_payload->>'externalUrl') > 2048
    or char_length(p_payload->>'imageAlt') > 240 then return false; end if;
  if p_payload->>'externalUrl'<>'' and not public.cms_portfolio_url_valid(p_payload->>'externalUrl') then return false; end if;
  if p_payload ? 'target' then
    target := p_payload->'target';
    if jsonb_typeof(target) <> 'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(target)) <> 2
      or coalesce(jsonb_typeof(target->'pageId'),'') <> 'string'
      or coalesce(jsonb_typeof(target->'anchor'),'') <> 'string'
      or target->>'pageId' !~ '^[A-Za-z0-9_-]{1,100}$'
      or target->>'anchor' !~ '^#[a-z][a-z0-9-]*$' then return false; end if;
  end if;
  if p_published and (btrim(p_payload->>'title', U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') = ''
    or (p_payload->>'externalUrl' = '' and not p_payload ? 'target')) then return false; end if;
  image_path := p_payload->>'image';
  if image_path <> '' and (split_part(image_path, '/', 1) <> p_id::text
    or image_path !~ '^[0-9a-f-]{36}/([0-9a-f-]{36}|seed-[0-9a-f]{64})[.]webp$') then return false; end if;
  return true;
end;
$$;
