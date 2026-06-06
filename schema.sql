-- Idea2Business Cloud SaaS - Supabase Schema Initialization
-- 本脚本用于初始化 Supabase 数据库表结构，配置主外键关系，并开启 Row Level Security (RLS) 行级安全策略。

-- 启用 UUID 扩展
create extension if not exists "uuid-ossp";

-- =========================================================================
-- 1. projects 表
-- =========================================================================
create table if not exists public.projects (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null default '未命名想法',
    github_url text,
    competitors text,
    focus_hint text,
    tags jsonb default '{}'::jsonb not null,
    status text not null default 'Draft',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 开启 RLS
alter table public.projects enable row level security;

-- 配置 RLS 策略
create policy "Users can perform CRUD on their own projects"
    on public.projects
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);


-- =========================================================================
-- 2. versions 表
-- =========================================================================
create table if not exists public.versions (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects(id) on delete cascade not null,
    score integer,
    confidence text,
    report text,
    verdict text,
    dimensions jsonb,
    rat jsonb default null,
    launch_kit jsonb default null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 开启 RLS
alter table public.versions enable row level security;

-- 配置 RLS 策略
create policy "Users can perform CRUD on their project versions"
    on public.versions
    for all
    using (
        project_id in (
            select id from public.projects where user_id = auth.uid()
        )
    )
    with check (
        project_id in (
            select id from public.projects where user_id = auth.uid()
        )
    );


-- =========================================================================
-- 3. watch_areas 表
-- =========================================================================
create table if not exists public.watch_areas (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null default '未命名监控领域',
    keywords text not null,
    tags jsonb default '{}'::jsonb not null,
    last_scanned_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 开启 RLS
alter table public.watch_areas enable row level security;

-- 配置 RLS 策略
create policy "Users can perform CRUD on their own watch areas"
    on public.watch_areas
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);


-- =========================================================================
-- 4. discovered_pains 表
-- =========================================================================
create table if not exists public.discovered_pains (
    id uuid default gen_random_uuid() primary key,
    watch_area_id uuid references public.watch_areas(id) on delete cascade not null,
    title text not null,
    description text not null,
    source_url text,
    raw_evidence text,
    pain_score integer not null default 0,
    potential_solution text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 开启 RLS
alter table public.discovered_pains enable row level security;

-- 配置 RLS 策略
create policy "Users can perform CRUD on discovered pains under their own watch areas"
    on public.discovered_pains
    for all
    using (
        watch_area_id in (
            select id from public.watch_areas where user_id = auth.uid()
        )
    )
    with check (
        watch_area_id in (
            select id from public.watch_areas where user_id = auth.uid()
        )
    );

-- =========================================================================
-- 5. tms_shipments 表
-- =========================================================================
create table if not exists public.tms_shipments (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    shipment_id text not null,
    carrier text not null,
    commodity text not null,
    weight_kg numeric not null,
    cargo_val_usd numeric not null,
    limit_val_usd numeric not null,
    degradation_rate numeric not null,
    excursion_duration_hours numeric not null,
    max_temp_seen numeric not null,
    excursion_in_custody boolean not null,
    estimated_loss_usd numeric not null,
    liable_claim_usd numeric not null,
    liability_score integer not null,
    claim_status text not null,
    temp_logs jsonb default '[]'::jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 开启 RLS
alter table public.tms_shipments enable row level security;

-- 配置 RLS 策略
create policy "Users can select/update/delete their own TMS shipments"
    on public.tms_shipments
    for all
    using (auth.uid() = user_id);

create policy "Allow public/webhook inserts"
    on public.tms_shipments
    for insert
    with check (true);
