-- HUMS website database schema (fresh install).
-- Run top to bottom in Supabase → SQL Editor.
--
-- AFTER running it, create your first login in Supabase (Authentication → Users →
-- Add user, tick "Auto Confirm User"), then make that login the main administrator:
--
--   insert into public.admins (user_id, full_name, role)
--   select id, 'Your Name', 'super_admin' from auth.users where email = 'you@example.com';
--
-- From then on, add and remove other administrators from the dashboard's
-- "Administrators" tab.
--
-- NOTE: photo filenames below are lowercase because they must match the real
-- files exactly — web servers are case-sensitive (Windows is not).

-- ─────────────────────────────────────────────────────────────────────────────
--  ADMINISTRATORS — who is allowed to edit the website
--  • "admin"        can edit all website content
--  • "super_admin"  can also add, remove and change the role of administrators
--  A person with a Supabase login but NO row in this table can sign in but
--  cannot change anything (and the dashboard signs them straight back out).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  role       text not null default 'admin' check (role in ('admin', 'super_admin')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
alter table public.admins enable row level security;

-- Helper checks used by every security rule below. "security definer" lets them
-- look inside the admins table without the caller needing direct access to it.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and role = 'super_admin');
$$;

drop policy if exists "Admins can read the admin list"  on public.admins;
drop policy if exists "Super admins can change roles"   on public.admins;
drop policy if exists "Super admins can remove admins"  on public.admins;
create policy "Admins can read the admin list"
  on public.admins for select
  using ((select public.is_admin()));
create policy "Super admins can change roles"
  on public.admins for update
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));
create policy "Super admins can remove admins"
  on public.admins for delete
  using ((select public.is_super_admin()));
-- (No INSERT policy on purpose: new admins are added only through add_admin_by_email below.)

revoke all on public.admins from anon;
grant select, update, delete on public.admins to authenticated;

-- Safety net: the site must never be left without a super administrator.
create or replace function public.protect_last_super_admin()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if old.role = 'super_admin'
     and (tg_op = 'DELETE' or new.role <> 'super_admin')
     and not exists (select 1 from public.admins where role = 'super_admin' and user_id <> old.user_id)
  then
    raise exception 'There must always be at least one super administrator. Promote someone else first.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists admins_protect_last_super on public.admins;
create trigger admins_protect_last_super
  before update or delete on public.admins
  for each row execute function public.protect_last_super_admin();

-- Add an administrator by the email of an existing login (super administrators only).
create or replace function public.add_admin_by_email(
  p_email     text,
  p_full_name text default '',
  p_role      text default 'admin'
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only super administrators can add administrators.';
  end if;
  if p_role not in ('admin', 'super_admin') then
    raise exception 'Role must be "admin" or "super_admin".';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_uid is null then
    raise exception 'No login exists for "%" yet. First create it in Supabase (Authentication → Users → Add user), then add it here.', trim(p_email);
  end if;
  if exists (select 1 from public.admins where user_id = v_uid) then
    raise exception '"%" is already an administrator.', trim(p_email);
  end if;

  insert into public.admins (user_id, full_name, role, created_by)
  values (v_uid, coalesce(trim(p_full_name), ''), p_role, auth.uid());
end;
$$;

-- List administrators with their login email and last sign-in (any administrator may call this).
create or replace function public.list_admins()
returns table (
  user_id         uuid,
  email           text,
  full_name       text,
  role            text,
  created_at      timestamptz,
  last_sign_in_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select a.user_id, u.email::text, a.full_name, a.role, a.created_at, u.last_sign_in_at
  from public.admins a
  join auth.users u on u.id = a.user_id
  where public.is_admin()
  order by (a.role = 'super_admin') desc, a.created_at;
$$;

revoke all on function public.add_admin_by_email(text, text, text) from public, anon;
revoke all on function public.list_admins()                         from public, anon;
grant execute on function public.add_admin_by_email(text, text, text) to authenticated;
grant execute on function public.list_admins()                         to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
--  CONTENT TABLES
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. site_content — global key/value text store
create table if not exists site_content (
  key   text primary key,
  value text not null default ''
);
alter table site_content enable row level security;
create policy "Public can read site_content"
  on site_content for select
  using (true);
create policy "Admins can write site_content"
  on site_content for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
insert into site_content (key, value) values
  ('site_logo', 'haramayalogo.jpg'),
  ('footer_history', 'A proud affiliate of Haramaya University, HUMS delivers quality education from Daycare through Grade 12 in Amharic, Oromiffa, and English, serving the university and surrounding community for many years.'),
  ('hero_headline', 'Excellence in Education'),
  ('hero_bg_image', 'excellence.jpg'),
  ('director_welcome_text', 'It is with great pride that I welcome you to Haramaya University Model School, a heritage of academic distinction spanning for many years. It is Founded within the walls of Haramaya University itself, our school has grown hand in hand with one of Ethiopia''s most respected centres of higher learning. We hold ourselves to the highest standards of academic excellence, while nurturing the leaders, thinkers, and innovators our nation will need tomorrow.'),
  ('director_name', 'Mr. Seyoum Shega'),
  ('director_title', 'School Director, Haramaya University Model School'),
  ('director_photo', 'seyoum.jpg'),
  ('contact_phone', '+251 913 8827 932'),
  ('contact_email', 'seyoumshega@gmail.com'),
  ('contact_address', 'Haramaya University Campus, Haramaya, Oromia, Ethiopia'),
  ('history_text', 'Haramaya University Model School was established in 1955 A.D. by Emperor Haile Selassie at Haramaya College of Agriculture. Initially, it served the children of American teachers at the college, and the institution gradually expanded to Haramaya University (HU), improving step by step. Since its founding, Haramaya Model School has been dedicated to providing high-quality education in rural areas, focusing on early childhood and primary education. Currently, it offers education from kindergarten through 12th grade in three languages: Amharic, Oromiffa and English. 
The school also strives to support students with an interest in learning, prepare capable students for examinations, and nurture and develop students who are ready for higher education. Its programs include:
•	Nursery and Kindergarten in Amharic and Oromiffa (Pre-primary school)
•	Grades 1-6 in Oromiffa and Amharic
•	Grades 7-8 in English
•	Grades 9-12 in English (Secondary school)'),
  ('history_image', 'MS.jpg'),
  ('vision_text', 'To provide quality education that fosters problem-solving and critical thinking among students, making them capable of competing nationwide, and to see the institution as a model.'),
  ('mission_text', 'To deliver quality education to the university and the surrounding community children and to share experiences with nearby schools.'),
  ('focus_area_1', 'Teaching and Learning in the education sector.'),
  ('focus_area_2', 'Good governance and management, including leadership and financial management.'),
  ('goals_text', 'To ensure quality education through the implementation of quality assurance packages and to provide quality education to the university community''s children, achieving specific objectives.'),
  ('focused_goal_1', 'Enrichment in academic & Governance leadership and management.'),
  ('expected_outcome', 'Providing full quality education through careful strategies & procedures so as to achieve quality education & quality results!'),
  ('values_list', 'Motivation & Initiative,Integrity,Creativity,Transparency,Adaptability')
on conflict (key) do nothing;
-- 2. news — chronological school updates
create table if not exists news (
  id          bigint generated always as identity primary key,
  date        date not null default current_date,
  title       text not null,
  description text not null default '',
  image_url   text default '',
  created_at  timestamptz not null default now()
);
alter table news enable row level security;
create policy "Public can read news"
  on news for select
  using (true);
create policy "Admins can write news"
  on news for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
insert into news (date, title, description, image_url) values
  ('2026-06-15', 'Official Academic Year Conclusion & Regional Examination Success', 'Haramaya University Model School has officially concluded its academic year! Students have successfully received their final academic results. Additionally, the Ministry''s Grade 8 and Grade 6 regional examinations have been successfully completed with outstanding student participation and dedication.', '12thmodel.jpg'),
  ('2026-05-19', 'Grade 11 Natural Science Students Visit Haramaya University Farms', 'Today, the Grade 11 Natural Science students embarked on an educational and practical field trip to Haramaya University''s agricultural facilities, bridging classroom theory with real-world farming practice.', 'farm.jpg'),
  ('2026-05-15', '11th Grade Secures Spot in the Finals', 'In an incredibly tight semi-final matchup, the 11th-grade team defeated the 10th-grade team to advance to the championship round of the school tournament.', 'finalist.jpg'),
  ('2026-05-08', 'Thrilling Football Semi-Final', 'In a dramatic match, the 8th-grade team knocked out the 9th-grade team in a tense penalty shootout that ended 5–4, sending the crowd into celebration.', 'malefootball.jpg'),
  ('2026-05-08', 'Female Football Tournament Begins', 'The school''s female football tournament has officially kicked off, marking a proud milestone for girls'' sports at HUMS and showcasing remarkable talent.', 'femalefootball.jpg')
on conflict do nothing;
-- 3. staff — faculty roster
create table if not exists staff (
  id         bigint generated always as identity primary key,
  name       text not null,
  role       text not null default '',
  category   text not null check (category in ('Directorates', 'School Management')),
  image_url  text default '',
  sort_order int not null default 0
);
alter table staff enable row level security;
create policy "Public can read staff"
  on staff for select
  using (true);
create policy "Admins can write staff"
  on staff for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
insert into staff (name, role, category, image_url, sort_order) values
  ('Mr. Seyoum Shega', 'School Director', 'Directorates', 'seyoum.jpg', 1),
  ('Mrs. Bayush Getahun', 'KG Vice Director & Daycare Coordinator', 'Directorates', 'bayush.jpg', 2),
  ('Abdi Jemal Ousman', 'Vice Director — Primary School (1–8)', 'Directorates', 'abdi.jpg', 3),
  ('Abdurahman Hassen', 'Vice Director — Primary School (1–8)', 'Directorates', 'abdro.jpg', 4),
  ('Feyera Tilahun', 'Vice Director — High School (9–12)', 'Directorates', 'feyera.jpg', 5),
  ('Jamal Abdo', 'Unit Leader', 'School Management', 'jamal.jpg', 1),
  ('Gizachew Tadesse', 'Unit Leader', 'School Management', 'getachew.jpg', 2),
  ('Bikile Gadisa', 'Unit Leader', 'School Management', 'bikile.jpg', 3),
  ('Tatek Mekonin', 'Unit Leader', 'School Management', 'tatek.jpg', 4),
  ('Shelema Ketema', 'Unit Leader', 'School Management', 'shelema.jpg', 5),
  ('Mahlet Zeleke', 'Unit Leader', 'School Management', 'mahlet.jpg', 6),
  ('Mulugeta Gudissa', 'English Dept. Head', 'School Management', 'abdela.jpg', 7),
  ('Bontu Tesfaye', 'Mathematics Dept. Head', 'School Management', 'unkown.jpg', 8),
  ('Ebisa Belay', 'Natural Sciences Dept. Head', 'School Management', 'ebisa.jpg', 9),
  ('Almaz Digafe', 'Amharic Dept. Head', 'School Management', 'almaz.jpg', 10),
  ('Misrak Fanta', 'Social Sciences Dept. Head', 'School Management', 'misrak.jpg', 11),
  ('Fikru Bekele', 'Sport Dept. Head (1–8)', 'School Management', 'fikru.jpg', 12),
  ('Yared Shimelis', 'Sport Dept. Head (9–12)', 'School Management', 'yared.jpg', 13),
  ('Alemshet Zewedie', 'Languages'' Dept. Head', 'School Management', 'alemshet.jpg', 14),
  ('Gemechis Ejigu', 'Social Science Dept. Head', 'School Management', 'gemechis.jpg', 15),
  ('Arif Mohammed', 'Natural Science Dept. Head', 'School Management', 'arif.jpg', 16),
  ('Tamru Wogi', 'Teachers Association', 'School Management', 'Tamru.jpg', 17),
  ('Sichale Idosa', 'Afan Oromo Dept. Head', 'School Management', 'sichale.jpg', 18)
on conflict do nothing;
-- 4. academic_metrics — student & staff counters
create table if not exists academic_metrics (
  id            bigint generated always as identity primary key,
  category_name text not null,
  count_value   int not null default 0,
  metric_group  text not null check (metric_group in ('students', 'staff')),
  sort_order    int not null default 0
);
alter table academic_metrics enable row level security;
create policy "Public can read academic_metrics"
  on academic_metrics for select
  using (true);
create policy "Admins can write academic_metrics"
  on academic_metrics for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
insert into academic_metrics (category_name, count_value, metric_group, sort_order) values
  ('Day-Care', 108, 'students', 1),
  ('Kindergarten', 297, 'students', 2),
  ('Grades 1–8 Regular', 1005, 'students', 3),
  ('Grades 1–8 Night', 228, 'students', 4),
  ('Grades 9–12 Regular', 231, 'students', 5),
  ('Grades 9–12 Night', 92, 'students', 6),
  ('Day-Care Staff', 2, 'staff', 1),
  ('KG Staff', 13, 'staff', 2),
  ('Primary Staff (1–8)', 47, 'staff', 3),
  ('Secondary Staff (9–12)', 32, 'staff', 4)
on conflict do nothing;
-- 5. program_lists — curriculum/program grid
create table if not exists program_lists (
  id             bigint generated always as identity primary key,
  program_title  text not null,
  languages      text default '',
  description    text default '',
  sort_order     int not null default 0
);
alter table program_lists enable row level security;
create policy "Public can read program_lists"
  on program_lists for select
  using (true);
create policy "Admins can write program_lists"
  on program_lists for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
insert into program_lists (program_title, languages, description, sort_order) values
  ('Daycare', '—', 'A safe, nurturing, and stimulating environment for our youngest learners, providing early childhood care and developmental support for infants and toddlers.', 1),
  ('Kindergarten (KG)', 'Amharic & Afan Oromo', 'Foundational early education focusing on literacy, numeracy, social skills, and creative development to prepare children for formal schooling.', 2),
  ('Grades 1–6 (Primary)', 'Afan Oromo & Amharic', 'A comprehensive primary curriculum building core competencies in language arts, mathematics, science, and social studies.', 3),
  ('Grades 7–12 (Secondary)', 'English', 'A rigorous secondary program encompassing junior secondary, upper primary, and preparatory levels with emphasis on science, mathematics, and humanities.', 4)
on conflict do nothing;
-- 6. galleries — image sets by section
create table if not exists galleries (
  id          bigint generated always as identity primary key,
  section_key text not null check (section_key in (
                'homepage_wide', 'kg_gallery', 'daycare_gallery', 'primary_secondary_gallery'
              )),
  image_url   text not null,
  description text default '',
  sort_order  int not null default 0
);
alter table galleries enable row level security;
create policy "Public can read galleries"
  on galleries for select
  using (true);
create policy "Admins can write galleries"
  on galleries for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
insert into galleries (section_key, image_url, description, sort_order) values
  ('homepage_wide', 'daycare2.jpg', 'Safe and nurturing daycare environment', 1),
  ('homepage_wide', 'art.jpg', 'Encouraging creativity through art', 2),
  ('homepage_wide', 'queue.jpg', 'Structured school activities', 3),
  ('homepage_wide', 'culture.jpg', 'Celebrating our rich cultural heritage', 4),
  ('homepage_wide', 'library.jpg', 'Fostering a culture of reading, research, and independent academic discovery in our student library.', 5),
  ('homepage_wide', 'computer.jpg', 'Students applying practical web development and IT concepts during a hands-on IT laboratory session.', 6),
  ('kg_gallery', 'kgstudents1.jpg', 'KG Students', 1),
  ('kg_gallery', 'kgstudents2.jpg', 'KG Students', 2),
  ('kg_gallery', 'kgstudents3.jpg', 'KG Students', 3),
  ('kg_gallery', 'kgteachers.jpg', 'KG Teachers Group Photo', 4),
  ('daycare_gallery', 'kids1.jpg', 'Daycare Kids', 1),
  ('daycare_gallery', 'kids2.jpg', 'Daycare Kids', 2),
  ('daycare_gallery', 'kids3.jpg', 'Daycare Kids', 3),
  ('primary_secondary_gallery', '10th.jpg', 'Grade 10', 1),
  ('primary_secondary_gallery', '9th.jpg', 'Grade 9', 2),
  ('primary_secondary_gallery', '8th.jpg', 'Grade 8', 3),
  ('primary_secondary_gallery', '6th.jpg', 'Grade 6', 4),
  ('primary_secondary_gallery', '4th.jpg', 'Grade 4', 5),
  ('primary_secondary_gallery', 'library2.jpg', 'Library', 6),
  ('primary_secondary_gallery', 'allteachers.jpg', 'All Teachers Group Photo', 7)
on conflict do nothing;
