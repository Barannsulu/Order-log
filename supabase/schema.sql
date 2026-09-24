-- Order Log: run this once in Supabase > SQL Editor.

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  restaurant_id uuid references restaurants on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants on delete set null,
  vendor text not null,
  receipt_date date not null,
  invoice_no text,
  total numeric(12,2),
  buyer_id uuid references profiles on delete set null,
  created_by uuid references profiles on delete set null default auth.uid(),
  image_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts on delete cascade,
  position int not null default 0,
  name text not null,
  canonical text not null,
  sku text,
  qty numeric(12,3),
  unit text,
  unit_price numeric(12,4),
  line_total numeric(12,2)
);

create index if not exists receipts_date_idx on receipts (receipt_date desc);
create index if not exists items_receipt_idx on receipt_items (receipt_id);
create index if not exists items_canonical_idx on receipt_items (lower(canonical));

-- One row per purchased item, with the receipt context. Used by search and chat.
create or replace view item_log with (security_invoker = true) as
select i.id as item_id, i.receipt_id, i.name, i.canonical, i.sku, i.qty, i.unit, i.unit_price, i.line_total,
       r.vendor, r.receipt_date, r.invoice_no, r.restaurant_id, rest.name as restaurant,
       r.buyer_id, coalesce(p.full_name, '') as buyer
from receipt_items i
join receipts r on r.id = i.receipt_id
left join restaurants rest on rest.id = r.restaurant_id
left join profiles p on p.id = r.buyer_id;

-- New login -> empty profile row.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Access: every signed-in team member can see and edit everything; people edit only their own profile.
alter table restaurants enable row level security;
alter table profiles enable row level security;
alter table receipts enable row level security;
alter table receipt_items enable row level security;

drop policy if exists "team read" on restaurants;
create policy "team read" on restaurants for select to authenticated using (true);
drop policy if exists "team add" on restaurants;
create policy "team add" on restaurants for insert to authenticated with check (true);

drop policy if exists "team read" on profiles;
create policy "team read" on profiles for select to authenticated using (true);
drop policy if exists "own update" on profiles;
create policy "own update" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "team all" on receipts;
create policy "team all" on receipts for all to authenticated using (true) with check (true);
drop policy if exists "team all" on receipt_items;
create policy "team all" on receipt_items for all to authenticated using (true) with check (true);

-- Private photo bucket.
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
  on conflict (id) do nothing;
drop policy if exists "team read photos" on storage.objects;
create policy "team read photos" on storage.objects for select to authenticated using (bucket_id = 'receipts');
drop policy if exists "team upload photos" on storage.objects;
create policy "team upload photos" on storage.objects for insert to authenticated with check (bucket_id = 'receipts');
drop policy if exists "team delete photos" on storage.objects;
create policy "team delete photos" on storage.objects for delete to authenticated using (bucket_id = 'receipts');
