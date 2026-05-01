begin;

alter table public.enrollment_documents
  add column if not exists storage_bucket text default 'documents',
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text,
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null,
  add column if not exists uploaded_at timestamptz;

update public.enrollment_documents
set storage_bucket = coalesce(storage_bucket, 'documents'),
    file_path = coalesce(file_path, file_url)
where storage_bucket is null
   or (file_path is null and file_url is not null);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'auth_read_documents'
  ) then
    create policy auth_read_documents
      on storage.objects
      for select
      to public
      using (bucket_id = 'documents' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'auth_upload_documents'
  ) then
    create policy auth_upload_documents
      on storage.objects
      for insert
      to public
      with check (bucket_id = 'documents' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'auth_update_documents'
  ) then
    create policy auth_update_documents
      on storage.objects
      for update
      to public
      using (bucket_id = 'documents' and auth.role() = 'authenticated')
      with check (bucket_id = 'documents' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'auth_delete_documents'
  ) then
    create policy auth_delete_documents
      on storage.objects
      for delete
      to public
      using (bucket_id = 'documents' and auth.role() = 'authenticated');
  end if;
end $$;

create index if not exists idx_enrollment_documents_file_path
  on public.enrollment_documents(file_path)
  where file_path is not null;

commit;
