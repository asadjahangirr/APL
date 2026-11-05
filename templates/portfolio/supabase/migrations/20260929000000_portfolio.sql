-- Additive Portfolio CMS. Drafts and published snapshots are different records.
-- All writes use server-authorized RPCs. Never reset a production database.
create function public.cms_portfolio_url_valid(p_url text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare authority text; host_name text; port_text text; closing integer;
begin
  if p_url is null or p_url='' or char_length(p_url)>2048
    or p_url !~* '^https?://[^/?#]+' or p_url ~ '[[:space:][:cntrl:]]'
    or p_url ~ U&'[\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF]'
    or position(chr(92) in p_url)>0 then return false; end if;
  authority := split_part(split_part(split_part(regexp_replace(p_url, '^https?://', '', 'i'), '/', 1), '?', 1), '#', 1);
  -- Credential-bearing URLs are never visitor destinations. Percent-encoded hosts
  -- are rejected too, avoiding parser ambiguity between SQL and web browsers.
  if authority='' or authority ~ '[@%]' then return false; end if;
  if left(authority,1)='[' then
    closing := position(']' in authority);
    if closing<3 then return false; end if;
    host_name := substr(authority,2,closing-2);
    if family(host_name::inet)<>6 then return false; end if;
    if substr(authority,closing+1)<>'' then
      if substr(authority,closing+1,1)<>':' then return false; end if;
      port_text := substr(authority,closing+2);
    end if;
  else
    host_name := split_part(authority,':',1);
    if host_name='' or host_name ~ '[<>"\[\]]' or char_length(authority)-char_length(replace(authority,':',''))>1 then return false; end if;
    if position(':' in authority)>0 then port_text := split_part(authority,':',2); end if;
  end if;
  if port_text is not null and (port_text !~ '^[0-9]{1,5}$' or port_text::integer>65535) then return false; end if;
  return true;
exception when others then return false;
end;
$$;
revoke all on function public.cms_portfolio_url_valid(text) from public, anon, authenticated;
grant execute on function public.cms_portfolio_url_valid(text) to service_role;

create function public.cms_portfolio_payload_valid(p_payload jsonb, p_id uuid, p_published boolean)
returns boolean language plpgsql immutable set search_path = '' as $$
declare field text; image_path text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(p_payload)) <> 6 then return false; end if;
  foreach field in array array['title','summary','category','externalUrl','image','imageAlt'] loop
    if coalesce(jsonb_typeof(p_payload->field), '') <> 'string' then return false; end if;
  end loop;
  if char_length(p_payload->>'title') > 120 or char_length(p_payload->>'category') > 80
    or char_length(p_payload->>'summary') > 320 or char_length(p_payload->>'externalUrl') > 2048
    or char_length(p_payload->>'imageAlt') > 240 then return false; end if;
  if p_payload->>'externalUrl'<>'' and not public.cms_portfolio_url_valid(p_payload->>'externalUrl') then return false; end if;
  if p_published and (btrim(p_payload->>'title', U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') = '' or p_payload->>'externalUrl' = '') then return false; end if;
  image_path := p_payload->>'image';
  if image_path <> '' and (split_part(image_path, '/', 1) <> p_id::text
    or image_path !~ '^[0-9a-f-]{36}/([0-9a-f-]{36}|seed-[0-9a-f]{64})[.]webp$') then return false; end if;
  return true;
end;
$$;
revoke all on function public.cms_portfolio_payload_valid(jsonb,uuid,boolean) from public, anon, authenticated;
grant execute on function public.cms_portfolio_payload_valid(jsonb,uuid,boolean) to service_role;

create table public.cms_portfolio (
  id uuid primary key,
  draft jsonb not null check (public.cms_portfolio_payload_valid(draft,id,false)),
  revision bigint not null default 1 check (revision between 1 and 9007199254740991),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.cms_portfolio_publications (
  id uuid primary key references public.cms_portfolio(id) on delete cascade,
  payload jsonb not null check (public.cms_portfolio_payload_valid(payload,id,true)),
  source_revision bigint not null check (source_revision between 1 and 9007199254740991),
  published_at timestamptz not null default now()
);
alter table public.cms_portfolio enable row level security;
alter table public.cms_portfolio_publications enable row level security;
revoke all on public.cms_portfolio, public.cms_portfolio_publications from anon, authenticated;
grant all on public.cms_portfolio, public.cms_portfolio_publications to service_role;
grant select on public.cms_portfolio_publications to anon, authenticated;
create policy "Read published portfolio projects" on public.cms_portfolio_publications for select to anon, authenticated using (true);
create index cms_portfolio_publications_date on public.cms_portfolio_publications(published_at desc);

-- The bucket is private. No object policies are granted to browser roles.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('cms-portfolio-media','cms-portfolio-media',false,2097152,array['image/webp'])
on conflict (id) do update set public=false, file_size_limit=2097152, allowed_mime_types=array['image/webp'];

create function public.cms_assert_portfolio_image(p_payload jsonb, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_payload->>'image' <> '' and not exists (
    select 1 from storage.objects where bucket_id='cms-portfolio-media' and name=p_payload->>'image'
  ) then raise exception 'CMS_IMAGE_MISSING'; end if;
end;
$$;
revoke all on function public.cms_assert_portfolio_image(jsonb,uuid) from public, anon, authenticated;
grant execute on function public.cms_assert_portfolio_image(jsonb,uuid) to service_role;

create function public.cms_portfolio_entry(p_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('id',s.id,'draft',s.draft,'revision',s.revision,
    'published',p.payload,'publishedRevision',p.source_revision)
  from public.cms_portfolio s left join public.cms_portfolio_publications p on p.id=s.id where s.id=p_id;
$$;
revoke all on function public.cms_portfolio_entry(uuid) from public, anon, authenticated;
grant execute on function public.cms_portfolio_entry(uuid) to service_role;

create function public.cms_list_portfolio()
returns jsonb language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'draft',s.draft,'revision',s.revision,
    'published',p.payload,'publishedRevision',p.source_revision) order by s.id), '[]'::jsonb)
  from public.cms_portfolio s left join public.cms_portfolio_publications p on p.id=s.id;
$$;
revoke all on function public.cms_list_portfolio() from public, anon, authenticated;
grant execute on function public.cms_list_portfolio() to service_role;

create function public.cms_mutate_portfolio(p_action text, p_id uuid, p_expected_revision bigint, p_draft jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.cms_portfolio%rowtype; next_revision bigint;
begin
  if p_action not in ('create','save','publish','unpublish') or p_action is null or p_id is null then raise exception 'CMS_INVALID_ACTION'; end if;
  if p_action='create' then
    -- Serializes record allocation so concurrent creates cannot exceed the collection cap.
    perform pg_advisory_xact_lock(728480002);
    if exists (select 1 from public.cms_portfolio where id=p_id) then raise exception 'CMS_CONFLICT'; end if;
    if (select count(*) from public.cms_portfolio) >= 200 then raise exception 'CMS_LIMIT'; end if;
    if not public.cms_portfolio_payload_valid(p_draft,p_id,false) then raise exception 'CMS_INVALID_DRAFT'; end if;
    perform public.cms_assert_portfolio_image(p_draft,p_id);
    insert into public.cms_portfolio(id,draft) values(p_id,p_draft);
    return public.cms_portfolio_entry(p_id);
  end if;
  select * into saved from public.cms_portfolio where id=p_id for update;
  if not found then raise exception 'CMS_NOT_FOUND'; end if;
  if p_expected_revision is null or saved.revision<>p_expected_revision then raise exception 'CMS_CONFLICT'; end if;
  next_revision := saved.revision+1;
  if p_action='save' then
    if not public.cms_portfolio_payload_valid(p_draft,p_id,false) then raise exception 'CMS_INVALID_DRAFT'; end if;
    perform public.cms_assert_portfolio_image(p_draft,p_id);
    update public.cms_portfolio set draft=p_draft,revision=next_revision,updated_at=now() where id=p_id;
  elsif p_action='publish' then
    if not public.cms_portfolio_payload_valid(saved.draft,p_id,true) then raise exception 'CMS_INVALID_PUBLICATION'; end if;
    perform public.cms_assert_portfolio_image(saved.draft,p_id);
    insert into public.cms_portfolio_publications(id,payload,source_revision)
      values(p_id,saved.draft,next_revision)
      on conflict(id) do update set payload=excluded.payload,source_revision=excluded.source_revision,published_at=now();
    update public.cms_portfolio set revision=next_revision,updated_at=now() where id=p_id;
  else
    delete from public.cms_portfolio_publications where id=p_id;
    update public.cms_portfolio set revision=next_revision,updated_at=now() where id=p_id;
  end if;
  return public.cms_portfolio_entry(p_id);
end;
$$;
revoke all on function public.cms_mutate_portfolio(text,uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.cms_mutate_portfolio(text,uuid,bigint,jsonb) to service_role;

create function public.cms_import_portfolio(p_entry jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare portfolio_id uuid; revision_value bigint; publication_revision bigint; publication jsonb;
begin
  portfolio_id := (p_entry->>'id')::uuid;
  if portfolio_id is null then raise exception 'CMS_INVALID_ID'; end if;
  perform pg_advisory_xact_lock(728480002);
  -- Repeat setup must never overwrite owner-edited production content.
  if exists (select 1 from public.cms_portfolio where id=portfolio_id) then return false; end if;
  if (select count(*) from public.cms_portfolio) >= 200 then raise exception 'CMS_LIMIT'; end if;
  revision_value := (p_entry->>'revision')::bigint;
  publication_revision := (p_entry->>'publishedRevision')::bigint;
  publication := nullif(p_entry->'published','null'::jsonb);
  if revision_value is null or revision_value not between 1 and 9007199254740991
    or not public.cms_portfolio_payload_valid(p_entry->'draft',portfolio_id,false) then raise exception 'CMS_INVALID_DRAFT'; end if;
  if publication is null and publication_revision is not null then raise exception 'CMS_INVALID_PUBLICATION'; end if;
  if publication is not null and (publication_revision is null or publication_revision<1 or publication_revision>revision_value
    or not public.cms_portfolio_payload_valid(publication,portfolio_id,true)) then raise exception 'CMS_INVALID_PUBLICATION'; end if;
  perform public.cms_assert_portfolio_image(p_entry->'draft',portfolio_id);
  if publication is not null then perform public.cms_assert_portfolio_image(publication,portfolio_id); end if;
  insert into public.cms_portfolio(id,draft,revision) values(portfolio_id,p_entry->'draft',revision_value);
  if publication is not null then
    insert into public.cms_portfolio_publications(id,payload,source_revision) values(portfolio_id,publication,publication_revision);
  end if;
  return true;
end;
$$;
revoke all on function public.cms_import_portfolio(jsonb) from public, anon, authenticated;
grant execute on function public.cms_import_portfolio(jsonb) to service_role;
