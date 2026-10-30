from pathlib import Path
import subprocess, time, os
ROOT = Path(__file__).resolve().parents[2]
CONTAINER = os.environ.get('SONDAR_TEST_CONTAINER', 'supabase_db_SONDAR-Project---V2')
DB_USER = os.environ.get('SONDAR_TEST_DB_USER', 'supabase_admin')
DB = 'sondar_clean_check_' + str(int(time.time())) + '_' + str(os.getpid())
assert DB.startswith('sondar_clean_check_') and DB != 'postgres'
created = False

def docker(*args, data=None, check=True):
    result = subprocess.run(['docker', *args], input=data, capture_output=True)
    if check and result.returncode:
        raise RuntimeError(result.stderr.decode('utf8', errors='replace')[-2500:])
    return result

def sql(data, check=True):
    if isinstance(data, str): data = data.encode('utf8')
    result = docker('exec', '-i', CONTAINER, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', DB_USER, '-d', DB, data=data, check=check)
    return result

def apply(path, check=True):
    return sql(path.read_bytes(), check=check)

try:
    docker('exec', CONTAINER, 'createdb', '-U', DB_USER, '-T', 'template0', DB)
    created = True
    print('Base temporal creada:', DB, flush=True)
    infrastructure = docker('exec', CONTAINER, 'pg_dump', '-U', DB_USER, '-d', 'postgres', '--schema-only', '--no-owner', '--no-privileges', '--section=pre-data', '--schema=auth', '--schema=storage', '--schema=realtime').stdout
    sql('CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;')
    sql(infrastructure)
    sql('ALTER TABLE auth.users ADD CONSTRAINT audit_auth_users_pk PRIMARY KEY (id); GRANT USAGE ON SCHEMA auth, storage, realtime, extensions TO anon, authenticated, service_role;')
    migrations = sorted((ROOT/'supabase/migrations').glob('*.sql'))
    for path in migrations:
        # El snapshot usa SET LOCAL: ejecutarlo dentro de una transaccion, como el runner.
        if path == migrations[0]: sql(b'BEGIN;\n' + path.read_bytes() + b'\nCOMMIT;')
        else: apply(path)
        print('Migracion correcta:', path.name, flush=True)
    apply(ROOT/'supabase/seed.sql')
    expected = '{pop,rock,urbano,jazz,blues,funk,folklore}'
    actual = sql('SELECT array_agg(slug ORDER BY orden)::text FROM public.generos WHERE activo;').stdout.decode().strip()
    assert actual == expected, actual
    print('Instalacion + seed: siete generos correctos.', flush=True)
    sql("""
    INSERT INTO auth.users(id,email) VALUES ('11111111-1111-4111-8111-111111111111','prueba@example.invalid'), ('22222222-2222-4222-8222-222222222222','otra@example.invalid');
    INSERT INTO public.users(id,email,username) VALUES ('11111111-1111-4111-8111-111111111111','prueba@example.invalid','artista_prueba'), ('22222222-2222-4222-8222-222222222222','otra@example.invalid','oyente_prueba');
    INSERT INTO public.eventos(id,genero,lugar,fecha,precio,creador_id,latitud,longitud) VALUES (8001,'rock','Sala de prueba','2027-01-15T21:00:00Z',100,'11111111-1111-4111-8111-111111111111',0,0);
    INSERT INTO public.reels(id,titulo,genero,audio_url,audio_path,creador_id) VALUES (8001,'Preview de prueba','funk','https://example.invalid/audio.wav','audios/prueba.wav','11111111-1111-4111-8111-111111111111');
    INSERT INTO public.reel_generos(reel_id,genero,posicion) VALUES (8001,'funk',1);
    INSERT INTO public.evento_generos(event_id,genero,posicion) VALUES (8001,'rock',1);
    INSERT INTO public.reel_saves(user_id,reel_id) VALUES ('22222222-2222-4222-8222-222222222222',8001);
    INSERT INTO public.event_saves(user_id,event_id) VALUES ('22222222-2222-4222-8222-222222222222',8001);
    """)
    before = sql("SELECT json_build_object('eventos',(SELECT count(*) FROM public.eventos),'reels',(SELECT count(*) FROM public.reels),'posts',(SELECT count(*) FROM public.perfil_comunidad_publicaciones),'guardados',(SELECT count(*) FROM public.reel_saves))::text;").stdout
    apply(migrations[-1]); apply(ROOT/'supabase/seed.sql')
    after = sql("SELECT json_build_object('eventos',(SELECT count(*) FROM public.eventos),'reels',(SELECT count(*) FROM public.reels),'posts',(SELECT count(*) FROM public.perfil_comunidad_publicaciones),'guardados',(SELECT count(*) FROM public.reel_saves))::text;").stdout
    assert before == after, (before, after)
    print('Reaplicacion conserva eventos, previews, publicaciones automaticas y guardados.', flush=True)
    sql("INSERT INTO public.generos(slug,nombre,activo,orden) VALUES ('trap','Trap',true,20); UPDATE public.reels SET genero='trap' WHERE id=8001; UPDATE public.reel_generos SET genero='trap' WHERE reel_id=8001;")
    apply(migrations[-1])
    assert sql("SELECT genero FROM public.reels WHERE id=8001;").stdout.strip() == b'urbano'
    assert sql("SELECT count(*) FROM public.reel_saves WHERE reel_id=8001;").stdout.strip() == b'1'
    print('Catalogo antiguo normalizado sin perder guardados.', flush=True)
    sql('DROP TABLE IF EXISTS public.user_genre_preferences; CREATE TABLE public.mi_tabla_personal(id integer);')
    apply(migrations[-1])
    assert sql("SELECT to_regclass('public.mi_tabla_personal') IS NOT NULL;").stdout.strip() == b't'
    print('Se conserva tabla personal y funciona sin preferencias legacy.', flush=True)
    sql("""BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='22222222-2222-4222-8222-222222222222'; INSERT INTO public.perfil_comunidad_respuestas(publicacion_id,user_id,texto) SELECT id,'22222222-2222-4222-8222-222222222222','Respuesta sin seguir' FROM public.perfil_comunidad_publicaciones WHERE evento_id=8001; COMMIT;""")
    print('RLS permite responder sin seguimiento.', flush=True)
    sql("INSERT INTO public.user_blocks(blocker_id,blocked_id) VALUES ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');")
    denied = sql("BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='22222222-2222-4222-8222-222222222222'; INSERT INTO public.perfil_comunidad_respuestas(publicacion_id,user_id,texto) SELECT id,'22222222-2222-4222-8222-222222222222','Bloqueada' FROM public.perfil_comunidad_publicaciones WHERE evento_id=8001; COMMIT;", check=False)
    assert denied.returncode != 0 and b'row-level security' in denied.stderr, denied.stderr[-500:]
    assert sql("SELECT count(*) FROM public.perfil_comunidad_respuestas WHERE texto='Bloqueada';").stdout.strip() == b'0'
    print('RLS impide responder ante un bloqueo sin dar lectura general a user_blocks.', flush=True)

    # Tablas retiradas realmente, no solo omitidas del contrato.
    assert sql("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('profile_community_posts','profile_community_comments','user_genre_preferences');").stdout.strip() == b'0'
    sql('CREATE TABLE public.profile_community_posts(id bigint); INSERT INTO public.profile_community_posts VALUES (99);')
    retained = apply(migrations[-1], check=False)
    assert retained.returncode != 0 and b'contiene datos' in retained.stderr, retained.stderr[-500:]
    assert sql('SELECT id FROM public.profile_community_posts;').stdout.strip() == b'99'
    sql('DELETE FROM public.profile_community_posts;')
    apply(migrations[-1])
    print('Tablas legacy vacias eliminadas; tablas con datos provocan rollback.', flush=True)
    sql("""
    INSERT INTO public.generos(slug,nombre,activo,orden) VALUES ('metal','Metal',true,20);
    INSERT INTO public.comunidades(id,nombre,titulo,genero,descripcion) VALUES ('metal','@metal','Metal','metal','Prueba');
    INSERT INTO public.eventos(id,genero,lugar,fecha,creador_id) VALUES (8002,'rock','Evento con Metal secundario','2027-01-15','11111111-1111-4111-8111-111111111111');
    INSERT INTO public.evento_generos(event_id,genero,posicion) VALUES (8002,'metal',1);
    INSERT INTO public.reels(id,titulo,genero,audio_url,audio_path,creador_id) VALUES (8002,'Metal','metal','https://example.invalid/metal.wav','audios/metal.wav','11111111-1111-4111-8111-111111111111');
    INSERT INTO public.event_saves(user_id,event_id) VALUES ('22222222-2222-4222-8222-222222222222',8002);
    INSERT INTO public.reel_saves(user_id,reel_id) VALUES ('22222222-2222-4222-8222-222222222222',8002);
    INSERT INTO public.comunidad_publicaciones(id,comunidad_id,user_id,tipo,titulo,texto) VALUES (8002,'metal','11111111-1111-4111-8111-111111111111','reciente','Metal','Prueba');
    INSERT INTO public.comunidad_comentarios(publicacion_id,user_id,texto) VALUES (8002,'22222222-2222-4222-8222-222222222222','Comentario');
    INSERT INTO public.notifications(user_id,type,title,entity_type,entity_id) VALUES ('22222222-2222-4222-8222-222222222222','prueba','Metal','event','8002');
    INSERT INTO public.content_reports(reporter_id,content_type,content_id) VALUES ('22222222-2222-4222-8222-222222222222','evento','8002');
    """)
    apply(migrations[-1])
    for table in ['generos','comunidades']:
        field = 'slug' if table == 'generos' else 'id'
        assert sql(f"SELECT count(*) FROM public.{table} WHERE {field}='metal';").stdout.strip() == b'0'
    for table in ['eventos','reels','comunidad_publicaciones']:
        assert sql(f'SELECT count(*) FROM public.{table} WHERE id=8002;').stdout.strip() == b'0'
    assert sql('SELECT count(*) FROM public.eventos WHERE id=8001;').stdout.strip() == b'1'
    assert sql('SELECT count(*) FROM public.reel_saves WHERE reel_id=8001;').stdout.strip() == b'1'
    assert sql('SELECT count(*) FROM public.event_saves WHERE event_id=8002;').stdout.strip() == b'0'
    assert sql('SELECT count(*) FROM public.reel_saves WHERE reel_id=8002;').stdout.strip() == b'0'
    assert sql("SELECT count(*) FROM public.notifications WHERE entity_type='event' AND entity_id='8002';").stdout.strip() == b'0'
    assert sql("SELECT count(*) FROM public.content_reports WHERE content_type='evento' AND content_id='8002';").stdout.strip() == b'0'
    print('Metal y su contenido eliminados; contenido ajeno y guardados conservados.', flush=True)

    sql("INSERT INTO public.generos(slug,nombre,activo,orden) VALUES ('reggae','Reggae',true,20); UPDATE public.eventos SET genero='reggae' WHERE id=8001;")
    failure = apply(migrations[-1], check=False)
    assert failure.returncode != 0 and b'Reggae tiene referencias' in failure.stderr, failure.stderr[-500:]
    assert sql('SELECT genero FROM public.eventos WHERE id=8001;').stdout.strip() == b'reggae'
    assert sql('SELECT count(*) FROM public.reel_saves WHERE reel_id=8001;').stdout.strip() == b'1'
    print('Reggae con contenido aborta y revierte sin borrar entidades.', flush=True)
    print('VALIDACION SQL AISLADA CORRECTA', flush=True)
finally:
    if created:
        docker('exec', CONTAINER, 'dropdb', '-U', DB_USER, '--force', DB)
        print('Base temporal retirada; base de la app intacta.', flush=True)
