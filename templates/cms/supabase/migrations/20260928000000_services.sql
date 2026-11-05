-- Additive Services CMS. Drafts and published snapshots are different records.
-- All writes use server-authorized RPCs. Never reset a production database.
create function public.cms_service_payload_valid(p_payload jsonb, p_id uuid, p_published boolean)
returns boolean language plpgsql immutable set search_path = '' as $$
declare field text; image_path text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(p_payload)) <> 6 then return false; end if;
  foreach field in array array['title','slug','summary','body','image','imageAlt'] loop
    if coalesce(jsonb_typeof(p_payload->field), '') <> 'string' then return false; end if;
  end loop;
  if char_length(p_payload->>'title') > 120 or char_length(p_payload->>'slug') > 80
    or char_length(p_payload->>'summary') > 320 or char_length(p_payload->>'body') > 12000
    or char_length(p_payload->>'imageAlt') > 240 then return false; end if;
  if p_payload->>'slug' <> '' and p_payload->>'slug' !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then return false; end if;
  -- Match JavaScript trim for Unicode whitespace as well as ordinary spaces.
  if p_published and (btrim(p_payload->>'title', U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') = '' or p_payload->>'slug' = '') then return false; end if;
  image_path := p_payload->>'image';
  if image_path <> '' and (split_part(image_path, '/', 1) <> p_id::text
    or image_path !~ '^[0-9a-f-]{36}/([0-9a-f-]{36}|seed-[0-9a-f]{64})[.]webp$') then return false; end if;
  return true;
end;
$$;
revoke all on function public.cms_service_payload_valid(jsonb,uuid,boolean) from public, anon, authenticated;
grant execute on function public.cms_service_payload_valid(jsonb,uuid,boolean) to service_role;

create table public.cms_services (
  id uuid primary key,
  draft jsonb not null check (public.cms_service_payload_valid(draft,id,false)),
  revision bigint not null default 1 check (revision between 1 and 9007199254740991),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.cms_service_publications (
  id uuid primary key references public.cms_services(id) on delete cascade,
  payload jsonb not null check (public.cms_service_payload_valid(payload,id,true)),
  slug text generated always as (payload->>'slug') stored not null unique,
  source_revision bigint not null check (source_revision between 1 and 9007199254740991),
  published_at timestamptz not null default now()
);
alter table public.cms_services enable row level security;
alter table public.cms_service_publications enable row level security;
revoke all on public.cms_services, public.cms_service_publications from anon, authenticated;
grant all on public.cms_services, public.cms_service_publications to service_role;
grant select on public.cms_service_publications to anon, authenticated;
create policy "Read published services" on public.cms_service_publications for select to anon, authenticated using (true);
create index cms_service_publications_date on public.cms_service_publications(published_at desc);

-- The bucket is private. No object policies are granted to browser roles.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('cms-service-media','cms-service-media',false,2097152,array['image/webp'])
on conflict (id) do update set public=false, file_size_limit=2097152, allowed_mime_types=array['image/webp'];

create function public.cms_assert_service_image(p_payload jsonb, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_payload->>'image' <> '' and not exists (
    select 1 from storage.objects where bucket_id='cms-service-media' and name=p_payload->>'image'
  ) then raise exception 'CMS_IMAGE_MISSING'; end if;
end;
$$;
revoke all on function public.cms_assert_service_image(jsonb,uuid) from public, anon, authenticated;
grant execute on function public.cms_assert_service_image(jsonb,uuid) to service_role;

create function public.cms_service_entry(p_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('id',s.id,'draft',s.draft,'revision',s.revision,
    'published',p.payload,'publishedRevision',p.source_revision)
  from public.cms_services s left join public.cms_service_publications p on p.id=s.id where s.id=p_id;
$$;
revoke all on function public.cms_service_entry(uuid) from public, anon, authenticated;
grant execute on function public.cms_service_entry(uuid) to service_role;

create function public.cms_list_services()
returns jsonb language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'draft',s.draft,'revision',s.revision,
    'published',p.payload,'publishedRevision',p.source_revision) order by s.created_at,s.id), '[]'::jsonb)
  from public.cms_services s left join public.cms_service_publications p on p.id=s.id;
$$;
revoke all on function public.cms_list_services() from public, anon, authenticated;
grant execute on function public.cms_list_services() to service_role;

create function public.cms_mutate_service(p_action text, p_id uuid, p_expected_revision bigint, p_draft jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.cms_services%rowtype; next_revision bigint;
begin
  if p_action not in ('create','save','publish','unpublish') or p_action is null or p_id is null then raise exception 'CMS_INVALID_ACTION'; end if;
  if p_action='create' then
    -- Serializes record allocation so concurrent creates cannot exceed the collection cap.
    perform pg_advisory_xact_lock(728480001);
    if exists (select 1 from public.cms_services where id=p_id) then raise exception 'CMS_CONFLICT'; end if;
    if (select count(*) from public.cms_services) >= 200 then raise exception 'CMS_LIMIT'; end if;
    if not public.cms_service_payload_valid(p_draft,p_id,false) then raise exception 'CMS_INVALID_DRAFT'; end if;
    perform public.cms_assert_service_image(p_draft,p_id);
    insert into public.cms_services(id,draft) values(p_id,p_draft);
    return public.cms_service_entry(p_id);
  end if;
  select * into saved from public.cms_services where id=p_id for update;
  if not found then raise exception 'CMS_NOT_FOUND'; end if;
  if p_expected_revision is null or saved.revision<>p_expected_revision then raise exception 'CMS_CONFLICT'; end if;
  next_revision := saved.revision+1;
  if p_action='save' then
    if not public.cms_service_payload_valid(p_draft,p_id,false) then raise exception 'CMS_INVALID_DRAFT'; end if;
    perform public.cms_assert_service_image(p_draft,p_id);
    update public.cms_services set draft=p_draft,revision=next_revision,updated_at=now() where id=p_id;
  elsif p_action='publish' then
    if not public.cms_service_payload_valid(saved.draft,p_id,true) then raise exception 'CMS_INVALID_PUBLICATION'; end if;
    perform public.cms_assert_service_image(saved.draft,p_id);
    insert into public.cms_service_publications(id,payload,source_revision)
      values(p_id,saved.draft,next_revision)
      on conflict(id) do update set payload=excluded.payload,source_revision=excluded.source_revision,published_at=now();
    update public.cms_services set revision=next_revision,updated_at=now() where id=p_id;
  else
    delete from public.cms_service_publications where id=p_id;
    update public.cms_services set revision=next_revision,updated_at=now() where id=p_id;
  end if;
  return public.cms_service_entry(p_id);
end;
$$;
revoke all on function public.cms_mutate_service(text,uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.cms_mutate_service(text,uuid,bigint,jsonb) to service_role;

create function public.cms_import_service(p_entry jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare service_id uuid; revision_value bigint; publication_revision bigint; publication jsonb;
begin
  service_id := (p_entry->>'id')::uuid;
  if service_id is null then raise exception 'CMS_INVALID_ID'; end if;
  perform pg_advisory_xact_lock(728480001);
  -- Repeat setup must never overwrite owner-edited production content.
  if exists (select 1 from public.cms_services where id=service_id) then return false; end if;
  if (select count(*) from public.cms_services) >= 200 then raise exception 'CMS_LIMIT'; end if;
  revision_value := (p_entry->>'revision')::bigint;
  publication_revision := (p_entry->>'publishedRevision')::bigint;
  publication := nullif(p_entry->'published','null'::jsonb);
  if revision_value is null or revision_value not between 1 and 9007199254740991
    or not public.cms_service_payload_valid(p_entry->'draft',service_id,false) then raise exception 'CMS_INVALID_DRAFT'; end if;
  if publication is null and publication_revision is not null then raise exception 'CMS_INVALID_PUBLICATION'; end if;
  if publication is not null and (publication_revision is null or publication_revision<1 or publication_revision>revision_value
    or not public.cms_service_payload_valid(publication,service_id,true)) then raise exception 'CMS_INVALID_PUBLICATION'; end if;
  perform public.cms_assert_service_image(p_entry->'draft',service_id);
  if publication is not null then perform public.cms_assert_service_image(publication,service_id); end if;
  insert into public.cms_services(id,draft,revision) values(service_id,p_entry->'draft',revision_value);
  if publication is not null then
    insert into public.cms_service_publications(id,payload,source_revision) values(service_id,publication,publication_revision);
  end if;
  return true;
end;
$$;
revoke all on function public.cms_import_service(jsonb) from public, anon, authenticated;
grant execute on function public.cms_import_service(jsonb) to service_role;
